import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ParameterDefinition } from '../../../core/parameters/parameter-definition.entity';
import { ParameterValue } from '../../../core/parameters/parameter-value.entity';

/** Clave de los rótulos de etapa. Una sola definición; el alcance distingue la empresa. */
export const CLAVE_ROTULOS = 'crm.stage_labels';

/**
 * Clave del vocabulario: cómo llama cada empresa a las cosas del CRM.
 *
 * Va aparte de los rótulos de etapa porque son dos preguntas distintas —cómo se llama un paso
 * del embudo y cómo se llama la unidad de negocio— y quien renombra una no está renombrando la
 * otra. Comparten el mecanismo, no el contenido.
 */
export const CLAVE_VOCABULARIO = 'crm.vocabulary';

/** Rótulos de etapa: estado interno → cómo lo llama esa empresa. */
export type RotulosDeEtapa = Record<string, string>;

/**
 * Cómo llama cada empresa a las etapas de su embudo.
 *
 * El estado que se guarda en el lead —`contacted`, `won`— no cambia nunca: es lo que entienden
 * las reglas, los informes y la integración. Lo que cambia es la palabra que se muestra. Una
 * inmobiliaria dice «Visita agendada» donde una agencia dice «Propuesta enviada», y obligar a
 * las dos al mismo vocabulario hace que el tablero se lea como de otro negocio.
 *
 * Se guarda por empresa y no por organización porque el CRM ya se mira por empresa: cambiar el
 * rótulo en una no puede alterar el tablero de la de al lado.
 */
@Injectable()
export class StageLabelsService {
  constructor(
    @InjectRepository(ParameterDefinition) private readonly definiciones: Repository<ParameterDefinition>,
    @InjectRepository(ParameterValue) private readonly valores: Repository<ParameterValue>,
  ) {}

  /**
   * Rótulos vigentes de una empresa.
   *
   * @param clientId - Empresa cuyo CRM se mira, o `null` para el embudo propio de la agencia.
   * @returns Solo los estados renombrados. Los que no aparecen usan el rótulo de fábrica, que
   *   vive en la pantalla: repetirlo acá obligaría a mantener la misma lista en dos sitios.
   */
  async get(
    organizationId: string,
    clientId?: string | null,
    clave: string = CLAVE_ROTULOS,
  ): Promise<RotulosDeEtapa> {
    const definicion = await this.definiciones.findOne({ where: { key: clave } });
    if (!definicion) return {};

    const fila = await this.valores.findOne({
      where: {
        definitionId: definicion.id,
        ...this.alcance(organizationId, clientId),
        validTo: IsNull(),
      },
    });
    const guardado = fila?.valueJson?.value;
    return guardado && typeof guardado === 'object' ? (guardado as RotulosDeEtapa) : {};
  }

  /**
   * Reemplaza los rótulos de una empresa.
   *
   * Se guarda el mapa completo y no una diferencia: borrar un rótulo es no mandarlo, y con
   * parches habría que inventar una forma de decir «este vuelve al de fábrica».
   */
  async set(
    organizationId: string,
    clientId: string | null,
    rotulos: RotulosDeEtapa,
    clave: string = CLAVE_ROTULOS,
  ): Promise<RotulosDeEtapa> {
    const definicion = await this.definiciones.findOne({ where: { key: clave } })
      ?? await this.definiciones.save(this.definiciones.create({
        key: clave,
        description: 'Cómo llama cada empresa a las cosas del CRM. Solo cambia lo que se muestra.',
        defaultValue: { value: {} },
      }));

    // Un rótulo vacío es una petición de volver al de fábrica, no un nombre en blanco.
    const limpios: RotulosDeEtapa = {};
    for (const [estado, rotulo] of Object.entries(rotulos)) {
      const texto = String(rotulo ?? '').trim();
      if (texto) limpios[estado] = texto.slice(0, 40);
    }

    const alcance = this.alcance(organizationId, clientId);
    const existente = await this.valores.findOne({
      where: { definitionId: definicion.id, ...alcance, validTo: IsNull() },
    });

    if (existente) {
      existente.valueJson = { value: limpios };
      existente.version += 1;
      await this.valores.save(existente);
    } else {
      await this.valores.save(this.valores.create({
        definitionId: definicion.id,
        ...alcance,
        valueJson: { value: limpios },
      }));
    }
    return limpios;
  }

  /**
   * Alcance del valor.
   *
   * Sin empresa elegida el embudo es el de la agencia, que no es cliente de nadie: se guarda
   * contra la organización. Con empresa, contra ella.
   */
  private alcance(organizationId: string, clientId?: string | null): { scopeType: string; scopeId: string } {
    return clientId
      ? { scopeType: 'client', scopeId: clientId }
      : { scopeType: 'organization', scopeId: organizationId };
  }
}
