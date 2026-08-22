import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from '../../modules/clients/client.entity';
import {
  normalizeClientCapabilities,
  type ClientCapabilityKey,
} from '../../modules/clients/client-capabilities';

/** Cómo se llama cada capacidad al explicarla, para que el aviso diga algo y no una clave. */
const NOMBRE: Record<string, string> = {
  crm: 'CRM',
  reservations: 'reservas',
  metaConversions: 'conversiones de Meta',
  googleConversions: 'conversiones de Google',
  budgetVisibility: 'visibilidad de presupuesto',
};

/**
 * Qué servicios tiene contratados cada empresa.
 *
 * La agencia vende servicios sueltos: una empresa lleva solo el CRM, otra solo reservas. Eso vive
 * en `clients.capabilities` desde hace tiempo, pero **solo el módulo de reservas lo comprobaba**:
 * el CRM atendía peticiones de cualquier empresa, tuviera contratado el CRM o no. No era una fuga
 * entre clientes —cada lead seguía en su empresa— pero sí una capacidad que se cobra y no se
 * aplica, y una pantalla que se abre donde no debería existir.
 *
 * Es una reja distinta de las otras dos y las tres se suman:
 *
 * 1. **Rol** — qué módulos alcanza el cargo de la persona.
 * 2. **Cuenta** — qué empresas alcanza esa persona (`AccountAccessService`).
 * 3. **Capacidad** — qué servicios tiene contratados esa empresa. Esta.
 */
@Injectable()
export class ClientCapabilityService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { capacidades: Set<string>; expiresAt: number }>();

  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  /**
   * Comprueba que una empresa tenga contratada una capacidad.
   *
   * @param clientId - Empresa pedida. Sin empresa no se comprueba nada: es el embudo propio de
   *   la agencia, que no es cliente de sí misma y no contrata sus servicios.
   * @throws ForbiddenException con el nombre del servicio, para que la pantalla pueda explicar
   *   que falta contratarlo en vez de mostrar un error sin causa.
   */
  async assert(organizationId: string, clientId: string | undefined, capacidad: ClientCapabilityKey): Promise<void> {
    if (!clientId) return;
    if (await this.tiene(organizationId, clientId, capacidad)) return;
    throw new ForbiddenException(
      `Esta empresa no tiene ${NOMBRE[capacidad] ?? capacidad} entre sus servicios contratados`,
    );
  }

  /** Si una empresa concreta tiene la capacidad. */
  async tiene(organizationId: string, clientId: string, capacidad: ClientCapabilityKey): Promise<boolean> {
    const clave = `${organizationId}:${clientId}`;
    const enCache = this.cache.get(clave);
    if (enCache && enCache.expiresAt > Date.now()) return enCache.capacidades.has(capacidad);

    const client = await this.clients.findOne({
      where: { id: clientId, organizationId },
      select: { id: true, capabilities: true } as never,
    });
    // Una empresa que no existe no tiene ninguna capacidad. Quien decide si eso es un 404 es el
    // control de cuenta, que corre antes; acá basta con no concederla.
    const capacidades = new Set(
      Object.entries(normalizeClientCapabilities(client?.capabilities))
        .filter(([, activa]) => activa)
        .map(([nombre]) => nombre),
    );
    this.cache.set(clave, { capacidades, expiresAt: Date.now() + ClientCapabilityService.CACHE_TTL_MS });
    return capacidades.has(capacidad);
  }

  /**
   * De una lista de empresas, las que tienen la capacidad.
   *
   * Lo usa el listado, donde no hay una empresa pedida sino todas las que la persona alcanza:
   * sin esto, un CRM sin empresa elegida devolvía también los leads de las que solo llevan
   * reservas.
   *
   * @param clientIds - `undefined` significa «todas las de la organización».
   */
  async filtrar(
    organizationId: string,
    clientIds: string[] | undefined,
    capacidad: ClientCapabilityKey,
  ): Promise<string[]> {
    const empresas = await this.clients.find({
      where: clientIds === undefined
        ? { organizationId }
        : { organizationId, id: In(clientIds.length ? clientIds : ['']) },
      select: { id: true, capabilities: true } as never,
    });
    return empresas
      .filter((empresa) => normalizeClientCapabilities(empresa.capabilities)[capacidad])
      .map((empresa) => empresa.id);
  }
}
