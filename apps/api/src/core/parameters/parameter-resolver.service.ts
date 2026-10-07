import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

@Injectable()
export class ParameterResolver {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(
    @InjectRepository(ParameterDefinition) private definitionRepo: Repository<ParameterDefinition>,
    @InjectRepository(ParameterValue) private valueRepo: Repository<ParameterValue>,
  ) {}

  /**
   * @param formId - Reserva que se apartó del texto de su empresa. Va al final por ser opcional,
   *   aunque es el nivel de **mayor** precedencia: formulario, empresa, plan, organización. Quien
   *   no tenga un formulario en la mano lo omite y nada cambia.
   */
  async get(
    key: string,
    clientId?: string | null,
    planId?: string | null,
    organizationId?: string | null,
    formId?: string | null,
  ): Promise<any> {
    const cacheKey = this.cacheKey(key, clientId, planId, organizationId, formId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.resolveFromDb(key, clientId, planId, organizationId, formId);

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  async getFresh(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any> {
    this.invalidate(key, clientId, planId, organizationId);
    return this.get(key, clientId, planId, organizationId);
  }

  invalidate(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): void {
    this.cache.delete(this.cacheKey(key, clientId, planId, organizationId));
    // Lo que una empresa cambia alcanza a sus formularios que no lo hayan redefinido, y esas
    // entradas llevan el id del formulario en la clave: sin barrerlas, una plantilla corregida
    // seguiría saliendo con el texto viejo hasta que venciera el minuto de caché.
    const prefijo = `${this.cacheKey(key, clientId, planId, organizationId)}:form:`;
    for (const clave of this.cache.keys()) if (clave.startsWith(prefijo)) this.cache.delete(clave);
  }

  private cacheKey(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null, formId?: string | null): string {
    const base = `param:${key}:${clientId ?? 'null'}:${planId ?? 'null'}:${organizationId ?? 'null'}`;
    return formId ? `${base}:form:${formId}` : base;
  }

  /**
   * Resuelve varias claves de una organización en dos consultas, no en dos por clave.
   *
   * `get` está pensado para una clave suelta y cuesta dos viajes: la definición y su valor.
   * Llamarlo en un bucle multiplica ese costo — resolver el ciclo de vida de los 31 módulos
   * costaba 62 consultas en cada petición con la caché fría, sobre una base compartida donde
   * el procesador se disputa entre cuentas.
   *
   * Acá se traen todas las definiciones con un `IN` y todos los valores vigentes con otro, y
   * se cruzan en memoria. Alimenta la misma caché que `get`, así que una llamada individual
   * posterior no vuelve a la base.
   *
   * Solo resuelve el ámbito de organización: es el único que necesita el resolutor de permisos.
   * Para valores por cliente o por plan sigue estando `get`.
   */
  async getManyForOrganization(keys: string[], organizationId?: string | null): Promise<Map<string, any>> {
    const resolved = new Map<string, any>();
    const pendientes: string[] = [];

    for (const key of keys) {
      const cached = this.cache.get(this.cacheKey(key, null, null, organizationId));
      if (cached && cached.expiresAt > Date.now()) resolved.set(key, cached.value);
      else pendientes.push(key);
    }
    if (pendientes.length === 0) return resolved;

    const definitions = await this.definitionRepo.find({ where: { key: In(pendientes) } });
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));

    let values: ParameterValue[] = [];
    if (organizationId && definitions.length) {
      const now = new Date();
      values = await this.valueRepo.find({
        where: [
          { definitionId: In([...byId.keys()]), scopeType: 'organization', scopeId: organizationId, validFrom: LessThanOrEqual(now), validTo: IsNull() },
          { definitionId: In([...byId.keys()]), scopeType: 'organization', scopeId: organizationId, validFrom: LessThanOrEqual(now), validTo: MoreThanOrEqual(now) },
        ],
        order: { version: 'DESC' },
      });
    }

    // La consulta viene ordenada por versión descendente: la primera de cada definición es la
    // vigente y las siguientes son historia.
    const vigente = new Map<string, any>();
    for (const value of values) {
      if (!vigente.has(value.definitionId)) vigente.set(value.definitionId, value.valueJson?.value ?? null);
    }

    for (const key of pendientes) {
      const definition = definitions.find((item) => item.key === key);
      const valor = definition
        ? vigente.get(definition.id) ?? definition.defaultValue?.value ?? null
        : null;
      resolved.set(key, valor);
      this.cache.set(this.cacheKey(key, null, null, organizationId), { value: valor, expiresAt: Date.now() + this.ttlMs });
    }
    return resolved;
  }

  private async resolveFromDb(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null, formId?: string | null): Promise<any> {
    const definition = await this.definitionRepo.findOne({ where: { key } });
    if (!definition) return null;

    // La reserva manda sobre su empresa, igual que la empresa sobre la organización. Lo que no
    // haya escrito cae al nivel siguiente, que es lo que hace útil la cascada: cambiar una línea
    // no obliga a copiar la plantilla entera.
    if (formId) {
      const value = await this.findActiveValue(definition.id, 'form', formId);
      if (value !== null) return value;
    }

    if (clientId) {
      const value = await this.findActiveValue(definition.id, 'client', clientId);
      if (value !== null) return value;
    }

    if (planId) {
      const value = await this.findActiveValue(definition.id, 'plan', planId);
      if (value !== null) return value;
    }

    if (organizationId) {
      const value = await this.findActiveValue(definition.id, 'organization', organizationId);
      if (value !== null) return value;
    }

    return definition.defaultValue?.value ?? null;
  }

  private async findActiveValue(definitionId: string, scopeType: string, scopeId: string): Promise<any> {
    const now = new Date();
    const value = await this.valueRepo.findOne({
      where: [
        { definitionId, scopeType, scopeId, validFrom: LessThanOrEqual(now), validTo: IsNull() },
        { definitionId, scopeType, scopeId, validFrom: LessThanOrEqual(now), validTo: MoreThanOrEqual(now) },
      ],
      order: { version: 'DESC' },
    });

    return value?.valueJson?.value ?? null;
  }
}
