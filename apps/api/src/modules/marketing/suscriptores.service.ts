import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { type FindOptionsWhere, IsNull, Like, Repository } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from './suscriptor.entity';
import { ExclusionDeCorreo } from './exclusion.entity';
import { type FilaImportada, interpretarCsv } from './importar-suscriptores';

/** Cómo quedó una importación, para poder decírselo a quien subió el archivo. */
export interface ResultadoDeImportacion {
  creados: number;
  actualizados: number;
  /** Ya estaban de baja: no se tocan ni se cuentan como actualizados. */
  respetadosDeBaja: number;
  /**
   * Pidieron no recibir nunca más, así que el archivo no los vuelve a meter.
   *
   * Se cuenta aparte de `respetadosDeBaja` porque no es lo mismo: aquella es la ficha de esta
   * empresa, y ésta es una petición que alcanza aunque aquí no hubiera ficha ninguna. Quien sube
   * el archivo tiene que ver el número: si son muchos, esa lista viene de donde no debería.
   */
  excluidos: number;
  descartados: Array<{ linea: number; motivo: string }>;
}

@Injectable()
export class SuscriptoresService {
  private readonly logger = new Logger(SuscriptoresService.name);

  constructor(
    @InjectRepository(Suscriptor) private readonly repo: Repository<Suscriptor>,
    @InjectRepository(ExclusionDeCorreo) private readonly exclusiones: Repository<ExclusionDeCorreo>,
  ) {}

  /**
   * Token del enlace de baja.
   *
   * Aleatorio y no derivado del correo: si se pudiera calcular a partir de la dirección,
   * cualquiera podría dar de baja a otra persona probando direcciones.
   */
  private nuevoToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Importa una lista, respetando lo que cada persona ya había decidido.
   *
   * Tres reglas, en este orden:
   *
   * 1. **Quien está de baja no vuelve.** Volver a importar un archivo viejo no puede resucitar a
   *    quien pidió que no le escribieran; es el error que convierte una lista en una denuncia.
   * 2. **Sin consentimiento explícito en el archivo, entra en pendiente.** Se le puede preguntar
   *    una vez, no mandarle campañas.
   * 3. Quien ya estaba suscrito no se degrada por venir en un archivo sin la columna.
   *
   * @param origen - De dónde salió la lista. Obligatorio: una dirección sin procedencia no se
   *   puede defender ante nadie.
   * @param textoConsentimiento - Lo que decía la casilla del formulario. Se guarda entero porque
   *   dentro de dos años hay que poder mostrar qué leyó la persona, no una versión.
   */
  async importarCsv(
    organizationId: string,
    contenido: string,
    origen: string,
    detalle?: string,
    textoConsentimiento?: string,
    clientId?: string | null,
  ): Promise<ResultadoDeImportacion> {
    const { filas, descartadas } = interpretarCsv(contenido);
    const resultado: ResultadoDeImportacion = {
      creados: 0, actualizados: 0, respetadosDeBaja: 0, excluidos: 0, descartados: descartadas,
    };
    const empresa = clientId ?? null;

    for (const fila of filas) {
      /*
       * Un archivo no levanta lo que una persona pidió.
       *
       * El alta desde una reserva ya consultaba la exclusión; importar no, y era el camino más
       * fácil para deshacerla sin querer: basta con que esa dirección siga en el Excel de donde
       * salió la lista. El artículo 28 B no distingue por cómo vuelve a entrar.
       */
      if (await this.exclusionDe(organizationId, fila.email, empresa)) {
        resultado.excluidos += 1;
        continue;
      }

      /*
       * La ficha se busca por empresa, no sólo por organización.
       *
       * Sin el `clientId` la búsqueda encontraba la ficha de otro local: importar la lista de un
       * local pisaba la del vecino y el local importado se quedaba sin fila. Peor, una baja en un
       * local bloqueaba el alta en otro, justo al revés de lo que dice la ficha —una dirección por
       * empresa, porque cada una es responsable distinto y el permiso se dio por separado—.
       */
      const existente = await this.repo.findOne({
        where: { organizationId, clientId: empresa ?? IsNull(), email: fila.email },
      });

      if (existente?.status === EstadoDeSuscripcion.BAJA) {
        resultado.respetadosDeBaja += 1;
        continue;
      }

      if (existente) {
        // El nombre se completa si faltaba, pero no se pisa: el de la ficha puede estar corregido
        // a mano y el del archivo venir como lo escribió la persona con prisa.
        existente.name = existente.name ?? fila.name ?? null;
        if (fila.acepta && existente.status !== EstadoDeSuscripcion.SUSCRITO) {
          this.aplicarConsentimiento(existente, fila, textoConsentimiento);
        }
        await this.repo.save(existente);
        resultado.actualizados += 1;
        continue;
      }

      const nuevo = this.repo.create({
        organizationId,
        clientId: empresa,
        email: fila.email,
        name: fila.name ?? null,
        source: origen,
        sourceDetail: detalle ?? null,
        status: EstadoDeSuscripcion.PENDIENTE,
        unsubscribeToken: this.nuevoToken(),
      });
      if (fila.acepta) this.aplicarConsentimiento(nuevo, fila, textoConsentimiento);
      await this.repo.save(nuevo);
      resultado.creados += 1;
    }

    this.logger.log(
      `Importación desde «${origen}»: ${resultado.creados} nuevos, ${resultado.actualizados} actualizados, `
      + `${resultado.respetadosDeBaja} de baja respetados, ${resultado.excluidos} excluidos, ${descartadas.length} descartados`,
    );
    return resultado;
  }

  /** Deja constancia de qué aceptó y cuándo. La respuesta cruda es la prueba. */
  private aplicarConsentimiento(
    suscriptor: Suscriptor,
    fila: FilaImportada,
    texto?: string,
  ): void {
    suscriptor.status = EstadoDeSuscripcion.SUSCRITO;
    suscriptor.consentAt = new Date();
    suscriptor.consentText = texto
      ?? (fila.respuestaCruda ? `Respuesta en el archivo: «${fila.respuestaCruda}»` : null);
  }

  /**
   * Da de baja por el token del enlace.
   *
   * No exige sesión a propósito: una baja que obliga a recordar una contraseña no es una baja.
   * Y es idempotente —darse de baja dos veces no falla— porque quien pulsa el enlace otra vez
   * merece la misma confirmación tranquilizadora, no un error.
   */
  /**
   * Huella de un correo, para la lista de exclusión.
   *
   * Va hacia un solo lado: de la huella no se vuelve a la dirección. Eso es lo que permite seguir
   * respetando una baja después de borrar los datos de esa persona.
   *
   * Lleva la organización dentro para que la misma dirección dé huellas distintas en cada una: sin
   * eso, quien viera la tabla podría comprobar si un correo concreto está en la lista probándolo.
   */
  private huellaDe(organizationId: string, email: string): string {
    return createHash('sha256').update(`${organizationId}:${email.trim().toLowerCase()}`).digest('hex');
  }

  /**
   * Da de baja desde el enlace de un correo.
   *
   * El artículo 28 B de la Ley 19.496 dice que, pedida la suspensión, los envíos siguientes
   * «quedarán desde entonces prohibidos»: por eso es inmediata y no queda pendiente de nada.
   *
   * @param alcance - `local` saca sólo de la empresa de ese correo. `todas` la saca de todas las
   *   del sistema y la deja en la lista de exclusión, que se respeta aunque después reserve en un
   *   local nuevo: sin eso, el botón «darme de baja de todos» prometería algo que no cumple.
   * @param origen - Plantilla del correo desde el que se pidió, para reconstruir el caso.
   */
  async darDeBaja(token: string, alcance: 'local' | 'todas' = 'local', origen?: string): Promise<{ email: string; alcance: 'local' | 'todas'; empresa: string | null }> {
    const suscriptor = await this.repo.findOne({ where: { unsubscribeToken: token } });
    if (!suscriptor) throw new NotFoundException('Este enlace de baja no es válido');

    const email = suscriptor.email;
    const huella = this.huellaDe(suscriptor.organizationId, email);
    const ahora = new Date();

    const bajar = (fila: Suscriptor) => {
      if (fila.status === EstadoDeSuscripcion.BAJA && fila.unsubscribedScope) return null;
      fila.status = EstadoDeSuscripcion.BAJA;
      fila.unsubscribedAt = fila.unsubscribedAt ?? ahora;
      fila.unsubscribedScope = alcance;
      fila.unsubscribedFrom = origen?.slice(0, 80) ?? fila.unsubscribedFrom ?? null;
      return fila;
    };

    if (alcance === 'todas') {
      // Todas sus fichas de esta organización, sea cual sea la empresa, y la propia agencia.
      const todas = await this.repo.find({ where: { organizationId: suscriptor.organizationId, email } });
      const cambiadas = todas.map(bajar).filter((fila): fila is Suscriptor => fila !== null);
      if (cambiadas.length) await this.repo.save(cambiadas);
    } else {
      const cambiada = bajar(suscriptor);
      if (cambiada) await this.repo.save(cambiada);
    }

    await this.anotarExclusion(suscriptor.organizationId, huella, alcance === 'todas' ? null : suscriptor.clientId ?? null, alcance, origen);
    return { email, alcance, empresa: alcance === 'todas' ? null : suscriptor.clientId ?? null };
  }

  /**
   * A quién pertenece un enlace de baja, **sin dar de baja a nadie**.
   *
   * Existe porque el enlace llega dentro de un correo, y los antivirus de correo y los
   * previsualizadores de Outlook visitan los enlaces para revisarlos. Con la baja colgada del GET,
   * eso daba de baja a gente que nunca hizo clic —y la baja es definitiva—. Así que el GET sólo
   * pregunta con esto, y quien da de baja es el POST del botón.
   *
   * @returns El correo y la empresa del enlace, o `null` si el enlace ya no sirve.
   */
  async aQuienPertenece(token: string): Promise<{ email: string; empresa: string | null; yaDeBaja: boolean } | null> {
    const suscriptor = await this.repo.findOne({ where: { unsubscribeToken: token } });
    if (!suscriptor) return null;
    return {
      email: suscriptor.email,
      empresa: suscriptor.clientId ?? null,
      yaDeBaja: suscriptor.status === EstadoDeSuscripcion.BAJA,
    };
  }

  /**
   * Qué dice la lista de exclusión sobre una dirección concreta.
   *
   * La lista guarda huellas y no correos —para poder cumplir la prohibición del artículo 28 B sin
   * conservar la dirección de quien pidió que la borraran—, y por eso no se puede listar ni mirar:
   * sólo se puede preguntar por una dirección que ya se conoce. Y hacía falta poder preguntar:
   * cuando alguien llama diciendo «sigo recibiendo correos», la respuesta estaba guardada donde
   * nadie podía consultarla.
   *
   * @returns El alcance de lo que pidió y de qué empresas, o `null` si no pidió nada.
   */
  async consultarExclusion(organizationId: string, email: string): Promise<{
    alcance: 'local' | 'todas' | null;
    empresas: Array<{ clientId: string | null; alcance: string; origen: string | null; cuando: Date }>;
  }> {
    const limpio = email?.trim().toLowerCase();
    if (!limpio) return { alcance: null, empresas: [] };
    const filas = await this.exclusiones.find({
      where: { organizationId, huella: this.huellaDe(organizationId, limpio) },
      order: { createdAt: 'DESC' },
    });
    return {
      alcance: filas.length === 0 ? null : filas.some((fila) => fila.clientId === null) ? 'todas' : 'local',
      empresas: filas.map((fila) => ({
        clientId: fila.clientId ?? null,
        alcance: fila.alcance,
        origen: fila.origen ?? null,
        cuando: fila.createdAt,
      })),
    };
  }

  /**
   * Anota una petición de no recibir que llegó por fuera del enlace del correo.
   *
   * Hacía falta y no existía: la única forma de entrar a la lista de exclusión era hacer clic en
   * el enlace de un correo. Pero las peticiones llegan por otros tres caminos, y los tres obligan
   * igual:
   *
   * - **El SERNAC.** En su sistema «No Molestar» el consumidor registra la empresa y los canales, y
   *   el envío **queda prohibido desde ese registro** (Decreto 62 de 2019, art. 5); el aviso por
   *   correo sale el día hábil siguiente. Sin esto, cumplirlo significaba editar la base a mano.
   * - Un correo o una llamada a soporte diciendo «sáquenme de la lista».
   * - Un reclamo, donde la prueba de cuándo se aplicó es justamente lo que se va a pedir.
   *
   * Funciona aunque la dirección no esté en ninguna lista, y es a propósito: la petición vale
   * igual, y la exclusión impide que entre después por una reserva. Quien pide no recibir antes de
   * estar no tiene por qué volver a pedirlo.
   *
   * @param origen De dónde vino. Se exige porque es lo que hay que poder mostrar después.
   * @returns Cuántas fichas se dieron de baja; cero es un resultado válido, no un fallo.
   */
  async anotarPeticionExterna(
    organizationId: string,
    email: string,
    alcance: 'local' | 'todas',
    clientId: string | null,
    origen: string,
    fechaPedida?: string,
  ): Promise<{ fichasDeBaja: number; email: string }> {
    const limpio = email?.trim().toLowerCase();
    if (!limpio || !limpio.includes('@')) throw new BadRequestException('Falta una dirección de correo válida');
    const motivo = origen?.trim();
    if (!motivo) throw new BadRequestException('Hay que decir de dónde vino la petición: es lo que se muestra si alguien reclama');
    if (alcance === 'local' && !clientId) throw new BadRequestException('Para una baja de una sola empresa hay que decir cuál');

    const ahora = this.fechaDeLaPeticion(fechaPedida);
    const donde = alcance === 'todas'
      ? { organizationId, email: limpio }
      : { organizationId, email: limpio, clientId: clientId as string };
    const fichas = await this.repo.find({ where: donde });

    const cambiadas = fichas.filter((fila) => !(fila.status === EstadoDeSuscripcion.BAJA && fila.unsubscribedScope));
    for (const fila of cambiadas) {
      fila.status = EstadoDeSuscripcion.BAJA;
      // La más antigua de las dos, no la última conocida: el Decreto 62/2019 art. 5 inciso 2 hace
      // regir «lo que primero ocurra» cuando se pidió por el Sistema y directamente a la empresa.
      fila.unsubscribedAt = fila.unsubscribedAt && fila.unsubscribedAt < ahora ? fila.unsubscribedAt : ahora;
      fila.unsubscribedScope = alcance;
      fila.unsubscribedFrom = motivo.slice(0, 80);
    }
    if (cambiadas.length) await this.repo.save(cambiadas);

    await this.anotarExclusion(
      organizationId,
      this.huellaDe(organizationId, limpio),
      alcance === 'todas' ? null : clientId,
      alcance,
      motivo,
      ahora,
    );

    this.logger.log(`Petición externa anotada (${motivo}): ${cambiadas.length} fichas de baja, alcance ${alcance}`);
    return { fichasDeBaja: cambiadas.length, email: limpio };
  }

  /** Cuántas peticiones de no recibir hay anotadas. El número sí se puede mostrar; las huellas no. */
  async cuantasExclusiones(organizationId: string): Promise<{ total: number; deTodas: number }> {
    const [total, deTodas] = await Promise.all([
      this.exclusiones.count({ where: { organizationId } }),
      this.exclusiones.count({ where: { organizationId, clientId: IsNull() } }),
    ]);
    return { total, deTodas };
  }

  /** Deja la petición en la lista de exclusión. Repetirla no la duplica ni falla. */
  /**
   * El día en que la persona pidió la baja, a partir de lo que se anotó en pantalla.
   *
   * Acepta `AAAA-MM-DD` y lo fija al mediodía UTC, para que el día no se corra al convertirlo al
   * horario de Chile. Sin fecha, o con una fecha futura o ilegible, devuelve el momento actual:
   * adelantar la fecha no beneficia a nadie y una fecha futura sólo puede ser un error de tipeo.
   */
  private fechaDeLaPeticion(fecha?: string): Date {
    const texto = fecha?.trim();
    if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return new Date();
    const dia = new Date(`${texto}T12:00:00Z`);
    if (Number.isNaN(dia.getTime()) || dia.getTime() > Date.now()) return new Date();
    return dia;
  }

  private async anotarExclusion(organizationId: string, huella: string, clientId: string | null, alcance: 'local' | 'todas', origen?: string, pedidaEl?: Date): Promise<void> {
    const yaEsta = await this.exclusiones.findOne({ where: { organizationId, huella, clientId: clientId ?? IsNull() } });
    if (yaEsta) {
      // Una exclusión ya anotada no se reescribe, salvo para corregir su fecha hacia atrás: vale la
      // primera vez que la persona lo pidió, aunque nos hayamos enterado después (art. 5 inciso 2).
      if (pedidaEl && (!yaEsta.pedidaEl || pedidaEl < yaEsta.pedidaEl)) {
        yaEsta.pedidaEl = pedidaEl;
        await this.exclusiones.save(yaEsta);
      }
      return;
    }
    await this.exclusiones.save(this.exclusiones.create({ organizationId, huella, clientId, alcance, origen: origen?.slice(0, 80) ?? null, pedidaEl: pedidaEl ?? null }));
  }

  /**
   * Si a esta dirección se le prohibió escribir, y con qué alcance.
   *
   * Se consulta **antes de crear o reactivar** una suscripción. Una reserva no es un permiso para
   * mandar publicidad, así que no puede resucitar a quien pidió no recibir más; sólo una casilla
   * marcada a propósito, que es un acto nuevo y voluntario.
   *
   * @returns `todas` si pidió no recibir de ninguna, `local` si fue sólo de esa empresa, o `null`.
   */
  async exclusionDe(organizationId: string, email: string, clientId: string | null): Promise<'local' | 'todas' | null> {
    const huella = this.huellaDe(organizationId, email);
    const filas = await this.exclusiones.find({ where: { organizationId, huella } });
    if (filas.some((fila) => fila.clientId === null)) return 'todas';
    return filas.some((fila) => fila.clientId === clientId) ? 'local' : null;
  }

  /**
   * Levanta la exclusión porque volvió a darlo, explícitamente y para esa empresa.
   *
   * Sólo desde una casilla marcada a propósito. La de «todas» se levanta igual, pero la pantalla
   * tiene que haberle advertido antes que había pedido no recibir: un permiso nuevo vale, pero
   * tiene que ser inequívoco.
   */
  async levantarExclusion(organizationId: string, email: string, clientId: string | null): Promise<void> {
    const huella = this.huellaDe(organizationId, email);
    const filas = await this.exclusiones.find({ where: { organizationId, huella } });
    const quitar = filas.filter((fila) => fila.clientId === clientId || fila.clientId === null);
    if (quitar.length) await this.exclusiones.remove(quitar);
  }

  /**
   * A quién se le puede escribir una campaña ahora mismo.
   *
   * La consulta filtra por estado en la base y no en memoria: es la única forma de que un fallo
   * al escribir el filtro no acabe enviando a toda la tabla.
   */
  async suscritos(organizationId: string, clientId?: string | null): Promise<Suscriptor[]> {
    const where: FindOptionsWhere<Suscriptor> = { organizationId, status: EstadoDeSuscripcion.SUSCRITO };
    // `undefined` significa «de cualquier empresa»; `null`, «las de la agencia». Son distintos.
    if (clientId !== undefined) where.clientId = clientId === null ? IsNull() : clientId;
    const candidatos = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    /*
     * La edad se filtra en memoria y el estado en la base.
     *
     * «Quién cumple 18 hoy» no se puede escribir como condición SQL sin repetir la aritmética
     * de años bisiestos en otro lenguaje, y tenerla en dos sitios es tenerla mal en uno. El
     * conjunto ya viene acotado por estado, así que son pocas filas.
     */
    return candidatos.filter((suscriptor) => suscriptor.puedeRecibirCampana());
  }

  /** La lista completa, para la pantalla. Incluye pendientes y bajas, con su procedencia. */
  /**
   * La lista, acotada a lo que se pida.
   *
   * Antes sólo aceptaba un tope de filas: no se podía mirar una empresa, ni separar a quien está
   * suscrito de quien se dio de baja, ni buscar a alguien. Con varios locales en la misma
   * organización, una lista sin filtros no se puede leer.
   *
   * @param empresa - Id de la empresa, o `agencia` para la lista propia —la que no tiene empresa—.
   * @param encerradoEn - Empresa de la que no puede salir la consulta, cuando quien pregunta es
   *   una cuenta de empresa. Manda sobre `empresa`: la dirección puede pedir otra, y no se le da.
   */
  async listar(organizationId: string, filtros: {
    limite?: number;
    empresa?: string;
    encerradoEn?: string;
    estado?: EstadoDeSuscripcion;
    origen?: string;
    busqueda?: string;
  } = {}): Promise<{
    data: Suscriptor[];
    total: number;
    resumen: Array<{ clientId: string | null; suscritos: number; bajas: number; pendientes: number }>;
    /** Las procedencias que existen de verdad, para que el filtro no ofrezca lo que no hay. */
    origenes: string[];
  }> {
    const where: FindOptionsWhere<Suscriptor> = { organizationId };
    const empresa = filtros.encerradoEn ?? filtros.empresa;
    if (empresa === 'agencia') where.clientId = IsNull();
    else if (empresa) where.clientId = empresa;
    if (filtros.estado) where.status = filtros.estado;
    if (filtros.origen) where.source = filtros.origen;

    const texto = filtros.busqueda?.trim();
    // El nombre y el correo, con la misma búsqueda: se busca a una persona, no un campo.
    const condiciones = texto
      ? [{ ...where, email: Like(`%${texto.toLowerCase()}%`) }, { ...where, name: Like(`%${texto}%`) }]
      : where;

    const [data, total] = await this.repo.findAndCount({
      where: condiciones,
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(filtros.limite ?? 200, 1), 1000),
    });

    /*
     * El recuento por empresa sale de la base y no de las filas traídas.
     *
     * Contar sobre la página mostraría «12 suscritos» cuando hay trescientos, que es peor que no
     * mostrar nada: el número se usa para decidir si vale la pena una campaña.
     */
    const consulta = this.repo
      .createQueryBuilder('s')
      .select('s.client_id', 'clientId')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(*)', 'cuantos')
      .where('s.organization_id = :organizationId', { organizationId });

    /*
     * El recuento respeta el mismo encierro que las filas.
     *
     * Sin esto, una cuenta de empresa recibía en la misma respuesta cuántos suscritos, bajas y
     * pendientes tiene cada una de las demás. La pantalla no dibuja esas tarjetas, pero los
     * números viajan en el JSON, y ahí ya se fueron.
     */
    if (filtros.encerradoEn) consulta.andWhere('s.client_id = :encerradoEn', { encerradoEn: filtros.encerradoEn });

    const filas = await consulta
      .groupBy('s.client_id')
      .addGroupBy('s.status')
      .getRawMany<{ clientId: string | null; status: string; cuantos: string }>()
      .catch((error) => {
        // Se devuelve la lista sin las tarjetas, pero queda dicho por qué faltan: un recuento
        // que desaparece en silencio se lee como «no hay nadie», que es lo contrario del dato.
        this.logger.warn(`No se pudo contar por empresa: ${error instanceof Error ? error.message : error}`);
        return [];
      });

    /*
     * Las procedencias salen de la base, no de una lista escrita a mano.
     *
     * `source` es texto libre —lo escribe quien importa: `google_forms`, `landing_verano`— así que
     * un selector con valores fijos ofreceria filtros que no devuelven nada y ocultaría los que sí
     * existen. Se acota igual que todo lo demás: una empresa ve de dónde salió su lista, no la de
     * las otras.
     */
    const consultaDeOrigenes = this.repo
      .createQueryBuilder('s')
      .select('DISTINCT s.source', 'source')
      .where('s.organization_id = :organizationId', { organizationId });
    if (filtros.encerradoEn) consultaDeOrigenes.andWhere('s.client_id = :encerradoEn', { encerradoEn: filtros.encerradoEn });

    const origenes = await consultaDeOrigenes
      .getRawMany<{ source: string | null }>()
      .then((filas) => filas.map((fila) => fila.source).filter((valor): valor is string => Boolean(valor)).sort())
      .catch((error) => {
        this.logger.warn(`No se pudieron listar las procedencias: ${error instanceof Error ? error.message : error}`);
        return [];
      });

    const resumen = new Map<string | null, { clientId: string | null; suscritos: number; bajas: number; pendientes: number }>();
    for (const fila of filas) {
      const clave = fila.clientId ?? null;
      const actual = resumen.get(clave) ?? { clientId: clave, suscritos: 0, bajas: 0, pendientes: 0 };
      const cuantos = Number(fila.cuantos) || 0;
      if (fila.status === EstadoDeSuscripcion.SUSCRITO) actual.suscritos += cuantos;
      else if (fila.status === EstadoDeSuscripcion.BAJA) actual.bajas += cuantos;
      else actual.pendientes += cuantos;
      resumen.set(clave, actual);
    }

    return { data, total, resumen: [...resumen.values()], origenes };
  }

  /**
   * Los que una empresa puede descargar para escribirles por su cuenta.
   *
   * **Nunca la lista cruda.** Sólo quien está suscrito ahora mismo: incluir a quien se dio de baja
   * pondría esa dirección en un archivo que sale del sistema, donde el enlace de baja ya no
   * funciona y la baja no se puede hacer cumplir. Desde que el archivo se descarga, esa copia es
   * responsabilidad de quien la tiene, y por eso hay que volver a bajarla antes de cada envío.
   */
  async paraDescargar(organizationId: string, empresa: string): Promise<Suscriptor[]> {
    return this.repo.find({
      where: {
        organizationId,
        clientId: empresa === 'agencia' ? IsNull() : empresa,
        status: EstadoDeSuscripcion.SUSCRITO,
      },
      order: { createdAt: 'DESC' },
      take: 5000,
    });
  }
}
