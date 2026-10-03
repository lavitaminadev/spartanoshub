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

/**
 * Clave de las etapas que una empresa decide no usar.
 *
 * Va aparte del renombrado porque son decisiones distintas: una cambia cómo se lee un paso y
 * la otra si ese paso existe para esa empresa. Comparten el mecanismo, no el contenido.
 */
export const CLAVE_ETAPAS_OCULTAS = 'crm.hidden_stages';

/**
 * Clave de las etapas en las que se pregunta si el prospecto era el tipo de cliente buscado.
 *
 * Va aparte de las ocultas porque son decisiones distintas: una dice si un paso existe para esa
 * empresa y la otra si ese paso es el momento de preguntar. Comparten el mecanismo, no el
 * contenido.
 */
export const CLAVE_PREGUNTAR_CALIFICACION = 'crm.qualify_at_stages';

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
   * Etapas que esta empresa decidió no usar.
   *
   * No se borran del catálogo ni de los leads: lo que cambia es si la columna se dibuja y si el
   * estado se ofrece al mover una tarjeta. Un lead que ya estuviera en una etapa oculta seguiría
   * teniéndola guardada, y por eso apagarla se impide mientras haya alguno dentro.
   *
   * @returns Claves internas de estado. Vacío significa que se usan todas.
   */
  async ocultas(organizationId: string, clientId?: string | null): Promise<string[]> {
    return this.leerLista(CLAVE_ETAPAS_OCULTAS, organizationId, clientId);
  }

  /**
   * Etapas en las que se pregunta si el prospecto era el tipo de cliente que se busca.
   *
   * Vacío —el valor de fábrica— significa que no se pregunta al mover de etapa, y entonces la
   * única oportunidad es el descarte. Encenderlo adelanta esa respuesta al momento en que de
   * verdad se sabe: quien acaba de hablar con la persona lo tiene claro, y quien cierra la ficha
   * cuarenta días después ya no se acuerda.
   *
   * Se elige por empresa porque el momento en que se sabe depende del negocio: una inmobiliaria
   * lo descubre en la visita y una agencia en la primera llamada.
   */
  async etapasQuePreguntan(organizationId: string, clientId?: string | null): Promise<string[]> {
    return this.leerLista(CLAVE_PREGUNTAR_CALIFICACION, organizationId, clientId);
  }

  /** Fija en qué etapas se pregunta. Se guarda la lista completa, igual que las ocultas. */
  async fijarEtapasQuePreguntan(organizationId: string, clientId: string | null, estados: string[]): Promise<string[]> {
    return this.guardarLista(
      CLAVE_PREGUNTAR_CALIFICACION,
      'Etapas en las que se pregunta si el prospecto era el tipo de cliente buscado.',
      organizationId,
      clientId,
      estados,
    );
  }

  /**
   * Lee una lista de estados guardada bajo una clave.
   *
   * Sin definición devuelve vacío en vez de fallar: una organización que nunca tocó el ajuste no
   * tiene fila, y eso es «el valor de fábrica», no un error.
   */
  private async leerLista(clave: string, organizationId: string, clientId?: string | null): Promise<string[]> {
    const definicion = await this.definiciones.findOne({ where: { key: clave } });
    if (!definicion) return [];

    const fila = await this.valores.findOne({
      where: {
        definitionId: definicion.id,
        ...this.alcance(organizationId, clientId),
        validTo: IsNull(),
      },
    });
    const guardado = fila?.valueJson?.value;
    return Array.isArray(guardado) ? guardado.map(String) : [];
  }

  /**
   * Guarda una lista de estados bajo una clave, creando la definición si hace falta.
   *
   * Se guarda la lista completa y no una diferencia: quitar algo de la lista es no incluirlo, y
   * con parches habría que inventar una forma de decir «esto vuelve».
   */
  private async guardarLista(
    clave: string,
    descripcion: string,
    organizationId: string,
    clientId: string | null,
    estados: string[],
  ): Promise<string[]> {
    const definicion = await this.definiciones.findOne({ where: { key: clave } })
      ?? await this.definiciones.save(this.definiciones.create({
        key: clave,
        description: descripcion,
        defaultValue: { value: [] },
      }));

    // Sin repetidos y sin vacíos: la lista se compara por pertenencia, y un duplicado solo
    // engorda el JSON sin cambiar ninguna respuesta.
    const limpias = [...new Set(estados.map((estado) => String(estado ?? '').trim()).filter(Boolean))];

    const alcance = this.alcance(organizationId, clientId);
    const existente = await this.valores.findOne({
      where: { definitionId: definicion.id, ...alcance, validTo: IsNull() },
    });

    if (existente) {
      existente.valueJson = { value: limpias };
      existente.version += 1;
      await this.valores.save(existente);
    } else {
      await this.valores.save(this.valores.create({
        definitionId: definicion.id,
        ...alcance,
        valueJson: { value: limpias },
      }));
    }
    return limpias;
  }

  /**
   * Fija qué etapas quedan ocultas para esta empresa.
   *
   * Se guarda la lista completa y no una diferencia: volver a usar una etapa es no incluirla, y
   * con parches habría que inventar una forma de decir «esta vuelve».
   */
  async ocultar(
    organizationId: string,
    clientId: string | null,
    estados: string[],
  ): Promise<string[]> {
    return this.guardarLista(
      CLAVE_ETAPAS_OCULTAS,
      'Etapas del embudo que una empresa decide no usar. No borra nada: solo deja de mostrarlas.',
      organizationId,
      clientId,
      estados,
    );
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
