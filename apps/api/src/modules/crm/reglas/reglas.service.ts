import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ReglaDeCalificacion } from './regla-de-calificacion.entity';
import { Lead } from '../leads/lead.entity';
import {
  comparable,
  primeraReglaQueCalza,
  type Acciones,
  type Condicion,
  type LeadParaReglas,
  type Regla,
  type ReglaAplicada,
} from './evaluar-reglas';

/** Tope de reglas por empresa. No es un límite del negocio: es lo que evita una lista ilegible. */
const MAX_REGLAS = 60;

/** Tope de leads que una aplicación a mano puede tocar de una vez. */
const MAX_POR_TANDA = 500;

/**
 * Cuánto se recuerdan las reglas de una empresa.
 *
 * Se leen enteras en cada lead que entra, y son pocas y casi nunca cambian: sin esto, una
 * campaña que trae cien leads en una hora hace cien consultas idénticas. Medio minuto es corto
 * para que un cambio se note enseguida y largo para absorber una ráfaga.
 */
const MEMORIA_MS = 30_000;

export interface DatosDeRegla {
  nombre: string;
  unir?: 'todas' | 'alguna';
  condiciones?: Condicion[];
  acciones?: Acciones;
  activa?: boolean;
  automatica?: boolean;
}

/** Una pregunta que está llegando, con lo que contestan y cuántos lo contestan. */
export interface PreguntaDelCatalogo {
  pregunta: string;
  total: number;
  respuestas: Array<{ respuesta: string; total: number; tieneRegla: boolean }>;
}

@Injectable()
export class ReglasService {
  private readonly logger = new Logger(ReglasService.name);

  /** Lo recordado por empresa, con su vencimiento. */
  private readonly memoria = new Map<string, { reglas: Regla[]; vence: number }>();

  constructor(
    @InjectRepository(ReglaDeCalificacion) private readonly reglas: Repository<ReglaDeCalificacion>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
  ) {}

  /** Se descarta lo recordado de una empresa tras cualquier cambio en sus reglas. */
  private olvidar(organizationId: string, clientId: string): void {
    this.memoria.delete(`${organizationId}:${clientId}`);
  }

  /**
   * Las reglas vivas de una empresa, listas para el motor.
   *
   * Es el camino que usan la entrada de leads y la aplicación a mano; `listar` queda para la
   * pantalla, que necesita también las archivadas y siempre al día.
   */
  private async vigentes(organizationId: string, clientId: string): Promise<Regla[]> {
    const clave = `${organizationId}:${clientId}`;
    const recordado = this.memoria.get(clave);
    if (recordado && recordado.vence > Date.now()) return recordado.reglas;

    const reglas = (await this.listar(organizationId, clientId)).map((regla) => this.aDominio(regla));
    this.memoria.set(clave, { reglas, vence: Date.now() + MEMORIA_MS });
    return reglas;
  }

  /** Las reglas de una empresa, en el orden en que se prueban. */
  async listar(organizationId: string, clientId: string, incluirArchivadas = false): Promise<ReglaDeCalificacion[]> {
    return this.reglas.find({
      where: { organizationId, clientId, ...(incluirArchivadas ? {} : { archivedAt: IsNull() }) },
      order: { posicion: 'ASC', createdAt: 'ASC' },
    });
  }

  private async unaOFalla(organizationId: string, id: string): Promise<ReglaDeCalificacion> {
    const regla = await this.reglas.findOne({ where: { id, organizationId } });
    if (!regla) throw new NotFoundException('Esa regla no existe');
    return regla;
  }

  /**
   * Comprueba lo que la pantalla no puede garantizar sola.
   *
   * Una condición a medio escribir es el fallo caro: «contiene» sin valor calzaría con cualquier
   * lead y la regla calificaría a todos igual. El motor ya la descarta, pero dejarla guardar
   * produce una regla que se ve activa y no hace nada, que es peor que un error al guardar.
   */
  private validar(datos: DatosDeRegla): void {
    const nombre = datos.nombre?.trim();
    if (!nombre) throw new BadRequestException('La regla necesita un nombre');

    for (const condicion of datos.condiciones ?? []) {
      const sinValor = !['vacio', 'no_vacio'].includes(condicion.comparador) && !String(condicion.valor ?? '').trim();
      if (sinValor) throw new BadRequestException('Hay una condición sin valor: no calzaría con nada');
      if (['pregunta', 'campo'].includes(condicion.donde) && !String(condicion.clave ?? '').trim()) {
        throw new BadRequestException('Falta decir qué pregunta o qué campo mirar');
      }
    }

    /*
     * Una regla automática sin condiciones calificaría todo lo que entra.
     *
     * Guardarla a medias mientras se escribe es normal y no se impide; lo que se impide es
     * dejarla corriendo sola, que es cuando el error sale caro.
     */
    if (datos.automatica && (datos.condiciones ?? []).length === 0) {
      throw new BadRequestException('Una regla sin condiciones no puede quedar automática: calificaría todos los leads');
    }
  }

  async crear(organizationId: string, clientId: string, datos: DatosDeRegla, creadaPor?: string): Promise<ReglaDeCalificacion> {
    this.validar(datos);
    const cuantas = await this.reglas.count({ where: { organizationId, clientId, archivedAt: IsNull() } });
    if (cuantas >= MAX_REGLAS) throw new BadRequestException(`No caben más de ${MAX_REGLAS} reglas por empresa`);

    const ultima = await this.reglas.findOne({
      where: { organizationId, clientId, archivedAt: IsNull() },
      order: { posicion: 'DESC' },
    });

    const creada = await this.reglas.save(this.reglas.create({
      organizationId,
      clientId,
      nombre: datos.nombre.trim().slice(0, 120),
      unir: datos.unir === 'alguna' ? 'alguna' : 'todas',
      condiciones: datos.condiciones ?? [],
      acciones: datos.acciones ?? {},
      activa: datos.activa ?? true,
      // Nace a mano aunque la pidan automática: se prueba antes de dejarla correr sola.
      automatica: datos.automatica ?? false,
      posicion: (ultima?.posicion ?? 0) + 1,
      createdBy: creadaPor ?? null,
    }));
    this.olvidar(organizationId, clientId);
    return creada;
  }

  async editar(organizationId: string, id: string, datos: Partial<DatosDeRegla>): Promise<ReglaDeCalificacion> {
    const regla = await this.unaOFalla(organizationId, id);
    const mezcla: DatosDeRegla = {
      nombre: datos.nombre ?? regla.nombre,
      unir: datos.unir ?? regla.unir,
      condiciones: datos.condiciones ?? regla.condiciones ?? [],
      acciones: datos.acciones ?? regla.acciones ?? {},
      activa: datos.activa ?? regla.activa,
      automatica: datos.automatica ?? regla.automatica,
    };
    this.validar(mezcla);

    regla.nombre = mezcla.nombre.trim().slice(0, 120);
    regla.unir = mezcla.unir === 'alguna' ? 'alguna' : 'todas';
    regla.condiciones = mezcla.condiciones ?? [];
    regla.acciones = mezcla.acciones ?? {};
    regla.activa = mezcla.activa ?? true;
    regla.automatica = mezcla.automatica ?? false;
    const guardada = await this.reglas.save(regla);
    this.olvidar(regla.organizationId, regla.clientId);
    return guardada;
  }

  /** Apagar o encender. Sigue existiendo y conserva su sitio en la lista. */
  async activar(organizationId: string, id: string, activa: boolean): Promise<ReglaDeCalificacion> {
    const regla = await this.unaOFalla(organizationId, id);
    regla.activa = activa;
    const guardada = await this.reglas.save(regla);
    this.olvidar(regla.organizationId, regla.clientId);
    return guardada;
  }

  /** Correr sola al entrar un lead, o solo cuando alguien la aplique. */
  async automatizar(organizationId: string, id: string, automatica: boolean): Promise<ReglaDeCalificacion> {
    const regla = await this.unaOFalla(organizationId, id);
    if (automatica && (regla.condiciones ?? []).length === 0) {
      throw new BadRequestException('Una regla sin condiciones no puede quedar automática: calificaría todos los leads');
    }
    regla.automatica = automatica;
    const guardada = await this.reglas.save(regla);
    this.olvidar(regla.organizationId, regla.clientId);
    return guardada;
  }

  /**
   * Archivar en vez de borrar.
   *
   * Una regla que calificó leads es la explicación de por qué están como están. Borrarla dejaría
   * el historial diciendo «regla eliminada» justo cuando alguien pregunta qué pasó.
   */
  async archivar(organizationId: string, id: string, archivar: boolean): Promise<ReglaDeCalificacion> {
    const regla = await this.unaOFalla(organizationId, id);
    regla.archivedAt = archivar ? new Date() : null;
    if (archivar) regla.automatica = false;
    const guardada = await this.reglas.save(regla);
    this.olvidar(regla.organizationId, regla.clientId);
    return guardada;
  }

  /**
   * Reordena la lista completa. El orden es lo que decide entre reglas que se contradicen.
   *
   * Se recibe la lista entera y no «sube una»: con movimientos sueltos, dos personas ordenando
   * a la vez dejan un orden que ninguna de las dos pidió.
   */
  async reordenar(organizationId: string, clientId: string, idsEnOrden: string[]): Promise<ReglaDeCalificacion[]> {
    const suyas = await this.listar(organizationId, clientId, true);
    const conocidas = new Set(suyas.map((regla) => regla.id));
    const ajena = idsEnOrden.find((id) => !conocidas.has(id));
    if (ajena) throw new BadRequestException('Esa regla no es de esta empresa');

    /*
     * Una sola escritura para toda la lista.
     *
     * Guardar regla por regla deja la lista a medio ordenar si algo falla en el medio, y son
     * tantas consultas como reglas. Con `CASE` es una transacción: queda el orden entero o el
     * anterior, nunca una mezcla.
     */
    const cambios = idsEnOrden
      .map((id, indice) => ({ id, posicion: indice + 1 }))
      .filter(({ id, posicion }) => suyas.find((regla) => regla.id === id)?.posicion !== posicion);

    if (cambios.length > 0) {
      const casos = cambios.map(() => 'WHEN ? THEN ?').join(' ');
      const valores = cambios.flatMap(({ id, posicion }) => [id, posicion]);
      await this.reglas.query(
        `UPDATE crm_reglas_de_calificacion SET posicion = CASE id ${casos} ELSE posicion END
         WHERE organization_id = ? AND client_id = ? AND id IN (${cambios.map(() => '?').join(',')})`,
        [...valores, organizationId, clientId, ...cambios.map(({ id }) => id)],
      );
    }
    this.olvidar(organizationId, clientId);
    return this.listar(organizationId, clientId);
  }

  /**
   * Copia las reglas de otra empresa.
   *
   * Es la alternativa a heredarlas por rubro: nadie recibe reglas que no pidió, y quien repite
   * el mismo criterio en dos proyectos no lo escribe dos veces. Las copias son propias desde el
   * primer momento —editarlas no toca el original— y llegan apagadas, para revisarlas antes.
   */
  async copiarDesde(organizationId: string, origenClientId: string, destinoClientId: string, creadaPor?: string): Promise<number> {
    if (origenClientId === destinoClientId) throw new BadRequestException('Esa es la misma empresa');
    const origen = await this.listar(organizationId, origenClientId);
    if (origen.length === 0) throw new BadRequestException('Esa empresa no tiene reglas que copiar');

    const yaHay = await this.reglas.count({ where: { organizationId, clientId: destinoClientId, archivedAt: IsNull() } });
    if (yaHay + origen.length > MAX_REGLAS) throw new BadRequestException(`No caben más de ${MAX_REGLAS} reglas por empresa`);

    let desde = yaHay;
    for (const regla of origen) {
      desde += 1;
      await this.reglas.save(this.reglas.create({
        organizationId,
        clientId: destinoClientId,
        nombre: regla.nombre,
        unir: regla.unir,
        condiciones: regla.condiciones ?? [],
        acciones: regla.acciones ?? {},
        // Copiadas y apagadas: se revisan antes de que califiquen nada.
        activa: false,
        automatica: false,
        posicion: desde,
        createdBy: creadaPor ?? null,
      }));
    }
    this.olvidar(organizationId, destinoClientId);
    return origen.length;
  }

  /** Traduce una regla guardada a lo que el motor entiende. */
  private aDominio(regla: ReglaDeCalificacion): Regla {
    return {
      id: regla.id,
      nombre: regla.nombre,
      posicion: regla.posicion,
      activa: regla.activa,
      archivadaEn: regla.archivedAt ? regla.archivedAt.toISOString() : null,
      unir: regla.unir === 'alguna' ? 'alguna' : 'todas',
      condiciones: regla.condiciones ?? [],
      acciones: regla.acciones ?? {},
      automatica: regla.automatica,
    };
  }

  /** Reúne lo que las reglas pueden mirar de un lead. */
  private aLeadParaReglas(lead: Lead): LeadParaReglas {
    const metadata = (lead.metadata ?? {}) as { answers?: Array<{ question?: string; answer?: string }> };
    const respuestas = Array.isArray(metadata.answers) ? metadata.answers : [];
    return {
      respuestas: respuestas.map((fila) => ({
        pregunta: String(fila?.question ?? ''),
        respuesta: String(fila?.answer ?? ''),
      })),
      campos: (lead.customFields ?? {}) as Record<string, unknown>,
      fuente: lead.source ?? null,
      responsable: lead.assignedTo ?? null,
      monto: lead.estimatedAmount === null || lead.estimatedAmount === undefined ? null : Number(lead.estimatedAmount),
      campana: lead.campaignName ?? null,
    };
  }

  /**
   * Qué regla le tocaría a un lead, sin tocarlo.
   *
   * Es lo que permite probar antes de activar: se ve el resultado sobre leads reales y nadie
   * descubre que descartó cincuenta por una palabra mal escrita.
   */
  async queLeTocaria(organizationId: string, clientId: string, lead: Lead, modo: 'automatica' | 'manual' = 'manual'): Promise<ReglaAplicada | null> {
    const reglas = await this.vigentes(organizationId, clientId);
    return primeraReglaQueCalza(this.aLeadParaReglas(lead), reglas, modo);
  }

  /**
   * Cuántos leads calzarían con una regla, y algunos ejemplos.
   *
   * El número es lo que evita el error tonto: si sale 0 o salen todos, algo está mal escrito y
   * se ve antes de activar nada.
   */
  async cuantosCalzan(
    organizationId: string,
    clientId: string,
    datos: DatosDeRegla,
    limiteEjemplos = 5,
  ): Promise<{ total: number; revisados: number; ejemplos: Array<{ id: string; nombre: string; porque: string }> }> {
    const candidata: Regla = {
      id: 'prueba',
      nombre: datos.nombre || 'Prueba',
      posicion: 0,
      activa: true,
      unir: datos.unir === 'alguna' ? 'alguna' : 'todas',
      condiciones: datos.condiciones ?? [],
      acciones: datos.acciones ?? {},
      automatica: true,
    };

    const leads = await this.leads
      .createQueryBuilder('lead')
      // Lo que una condición puede mirar, y nada más.
      .select([
        'lead.id', 'lead.name', 'lead.metadata', 'lead.customFields',
        'lead.source', 'lead.assignedTo', 'lead.estimatedAmount', 'lead.campaignName',
      ])
      .where('lead.organization_id = :organizationId AND lead.client_id = :clientId', { organizationId, clientId })
      .orderBy('lead.created_at', 'DESC')
      .take(MAX_POR_TANDA)
      .getMany();

    const ejemplos: Array<{ id: string; nombre: string; porque: string }> = [];
    let total = 0;
    for (const lead of leads) {
      const aplicada = primeraReglaQueCalza(this.aLeadParaReglas(lead), [candidata], 'automatica');
      if (!aplicada) continue;
      total += 1;
      if (ejemplos.length < limiteEjemplos) ejemplos.push({ id: lead.id, nombre: lead.name, porque: aplicada.porque });
    }
    return { total, revisados: leads.length, ejemplos };
  }

  /**
   * Las preguntas que están llegando, con sus respuestas y cuántos las contestan.
   *
   * Es el cimiento de todo: para escribir «contado» hay que saber que esa palabra aparece y con
   * qué ortografía. Sin esta lista, las reglas se escriben de memoria contra textos que nadie
   * ha visto, y fallan el día que Meta cambia una opción del formulario.
   *
   * `tieneRegla` marca lo que ya está cubierto, así lo que queda sin marcar es exactamente lo
   * que se está calificando a ojo.
   */
  async preguntasQueLlegan(organizationId: string, clientId: string, limite = MAX_POR_TANDA): Promise<PreguntaDelCatalogo[]> {
    /*
     * Solo la metadata, y solo de los últimos.
     *
     * Traer el lead entero para contar respuestas multiplica por diez lo que viaja: el resto de
     * columnas no se mira. El tope no es una decisión de producto sino el precio de una pantalla
     * que se abre a menudo; lo que se busca es saber qué se está contestando, y eso se ve igual
     * con los últimos quinientos que con todos.
     */
    const leads = await this.leads
      .createQueryBuilder('lead')
      .select(['lead.id', 'lead.metadata'])
      .where('lead.organization_id = :organizationId AND lead.client_id = :clientId', { organizationId, clientId })
      .orderBy('lead.created_at', 'DESC')
      .take(limite)
      .getMany();

    const reglas = await this.listar(organizationId, clientId);
    const buscados = reglas
      .flatMap((regla) => regla.condiciones ?? [])
      .map((condicion) => comparable(condicion.valor))
      .filter(Boolean);

    const porPregunta = new Map<string, { pregunta: string; total: number; respuestas: Map<string, { respuesta: string; total: number }> }>();

    for (const lead of leads) {
      const metadata = (lead.metadata ?? {}) as { answers?: Array<{ question?: string; answer?: string }> };
      const filas = Array.isArray(metadata.answers) ? metadata.answers : [];
      for (const fila of filas) {
        const pregunta = String(fila?.question ?? '').trim();
        const respuesta = String(fila?.answer ?? '').trim();
        if (!pregunta || !respuesta) continue;

        const clave = comparable(pregunta);
        const entrada = porPregunta.get(clave) ?? { pregunta, total: 0, respuestas: new Map() };
        entrada.total += 1;

        const claveRespuesta = comparable(respuesta);
        const anterior = entrada.respuestas.get(claveRespuesta);
        entrada.respuestas.set(claveRespuesta, { respuesta: anterior?.respuesta ?? respuesta, total: (anterior?.total ?? 0) + 1 });
        porPregunta.set(clave, entrada);
      }
    }

    return [...porPregunta.values()]
      .map((entrada) => ({
        pregunta: entrada.pregunta,
        total: entrada.total,
        respuestas: [...entrada.respuestas.values()]
          .map((fila) => ({
            ...fila,
            // Cubierta si alguna regla busca un texto que aparece en esta respuesta.
            tieneRegla: buscados.some((buscado) => comparable(fila.respuesta).includes(buscado)),
          }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Escribe en el lead lo que la regla decidió.
   *
   * Solo toca lo que la regla nombra: una regla que pone semáforo no debe borrar el responsable
   * que alguien asignó a mano. Lo que no está en las acciones se queda como estaba.
   *
   * La tarea y el aviso no se hacen aquí: crean cosas en otros módulos y se resuelven donde el
   * lead ya está guardado, para que un fallo al avisar no deshaga la calificación.
   */
  aplicarAlLead(lead: Lead, aplicada: ReglaAplicada | null): void {
    lead.reglaAplicadaId = aplicada?.reglaId ?? null;
    lead.reglaAplicadaMotivo = aplicada ? aplicada.porque.slice(0, 300) : null;
    if (!aplicada) return;

    const acciones = aplicada.acciones ?? {};
    if (acciones.semaforo) lead.trafficLight = acciones.semaforo;
    if (acciones.calificacion) lead.fitStatus = acciones.calificacion;
    if (acciones.etapa) lead.status = acciones.etapa;
    if (acciones.responsable) lead.assignedTo = acciones.responsable;
    /*
     * Descartar mueve de etapa además de anotar el motivo.
     *
     * Con solo el motivo, el lead se quedaba en la columna donde estaba y el equipo lo seguía
     * llamando: el motivo se lee al abrirlo, y a un descartado no se le abre.
     */
    if (acciones.descartarMotivo) {
      lead.discardReason = acciones.descartarMotivo;
      lead.status = 'lost';
    }
    if (acciones.nota) {
      const anterior = lead.notes ? `${lead.notes}
` : '';
      lead.notes = `${anterior}${acciones.nota}`.slice(0, 5000);
    }
    if (acciones.guardarEnCampo) {
      lead.customFields = { ...(lead.customFields ?? {}), [acciones.guardarEnCampo]: aplicada.porque };
    }
  }

  /**
   * Aplica las reglas a un grupo de leads y devuelve qué le pasó a cada uno.
   *
   * No lanza si un lead falla: con doscientos seleccionados, que uno con datos raros detenga la
   * tanda dejaría la mitad calificada y la otra mitad no, sin decir cuál es cuál.
   */
  async aplicarA(
    organizationId: string,
    clientId: string,
    leadIds: string[],
    aplicarCambios: (lead: Lead, aplicada: ReglaAplicada) => Promise<void>,
  ): Promise<{ calificados: number; sinRegla: number; fallidos: number }> {
    const ids = [...new Set(leadIds)].slice(0, MAX_POR_TANDA);
    if (ids.length === 0) return { calificados: 0, sinRegla: 0, fallidos: 0 };

    const reglas = await this.vigentes(organizationId, clientId);
    const leads = await this.leads.find({ where: { organizationId, clientId, id: In(ids) } });

    let calificados = 0;
    let sinRegla = 0;
    let fallidos = 0;

    for (const lead of leads) {
      try {
        const aplicada = primeraReglaQueCalza(this.aLeadParaReglas(lead), reglas, 'manual');
        if (!aplicada) {
          sinRegla += 1;
          continue;
        }
        await aplicarCambios(lead, aplicada);
        calificados += 1;
      } catch (error) {
        fallidos += 1;
        this.logger.warn(`No se pudo aplicar reglas al lead ${lead.id}: ${(error as Error).message}`);
      }
    }

    return { calificados, sinRegla, fallidos };
  }
  /**
   * Aplica las reglas a unos leads y guarda el resultado.
   *
   * Envuelve `aplicarA` con el guardado: el servicio decide, y aqui se escribe. Un lead que
   * falla no detiene a los demas —con doscientos elegidos, uno con datos raros dejaria la mitad
   * calificada sin decir cual es cual— y el resumen dice exactamente que paso con cada grupo.
   */
  async aplicarYGuardar(organizationId: string, clientId: string, leadIds: string[]) {
    return this.aplicarA(organizationId, clientId, leadIds, async (lead, aplicada) => {
      this.aplicarAlLead(lead, aplicada);
      await this.leads.save(lead);
    });
  }
}
