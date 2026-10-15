import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Campana, EstadoDeCampana } from './campana.entity';
import { SuscriptoresService } from './suscriptores.service';
import { ReservationCoupon } from '../reservations/domain/reservation-coupon.entity';
import { ReservationCouponRedemption } from '../reservations/domain/reservation-coupon-redemption.entity';
import { Reservation } from '../reservations/domain/reservation.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { EnviosDeCampanaService } from './envios-de-campana.service';
import { componerCorreo } from '../../core/notifications/plantilla-de-correo';
import { nombreDeCampana } from './marcar-enlaces';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

/** Cómo quedó un envío, para decírselo a quien lo mandó sin que tenga que ir a buscarlo. */
export interface ResultadoDeEnvio {
  destinatarios: number;
  enviados: number;
  fallidos: number;
  /** Verdadero cuando quedó en cola: los correos salen en las siguientes pasadas del cron. */
  enCola?: boolean;
}

/**
 * Campañas: escribir a la lista de una empresa.
 *
 * Todo lo que hay aquí existe para que no salga un correo que no debía. La lista de destinatarios
 * no se arma acá sino en `suscritos()`, que filtra por estado en la base y por edad en la ficha:
 * tenerla en dos sitios sería tenerla mal en uno el día que cambie. Y cada correo lleva su enlace
 * de baja —individual, porque el token es de cada ficha—, sin interruptor que lo apague.
 */
@Injectable()
export class CampanasService {
  private readonly logger = new Logger(CampanasService.name);

  constructor(
    @InjectRepository(Campana) private readonly repo: Repository<Campana>,
    private readonly suscriptores: SuscriptoresService,
    private readonly envios: EnviosDeCampanaService,
    private readonly parametros: ParameterResolver,
    @InjectRepository(ReservationCoupon) private readonly cupones: Repository<ReservationCoupon>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    /*
     * Al final, como el resto del repositorio: las pruebas construyen este servicio por
     * posición, y meterlo junto a `cupones` desplazaba `usuarios` sin que nada lo avisara.
     *
     * Sólo se leen: quien registra un canje es Reservas.
     */
    @InjectRepository(ReservationCouponRedemption) private readonly canjes: Repository<ReservationCouponRedemption>,
    // También sólo de lectura: la reserva la crea Reservas, acá sólo se cuenta.
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
  ) {}

  /** `agencia` y vacío significan la lista sin empresa; en la base eso es `null`. */
  private empresaDe(empresa?: string | null): string | null {
    return !empresa || empresa === 'agencia' ? null : empresa;
  }

  /**
   * @param filtros - `cupon` coincide por fragmento y `conCupon` separa las que reparten alguno
   *   de las que no. El código y su vencimiento viven en la campaña desde la 0164 y hasta ahora
   *   no se podían consultar: saber qué campañas llevaban un cupón exigía abrirlas una por una.
   */
  async listar(
    organizationId: string,
    encerradoEn?: string,
    filtros?: {
      estado?: string; cupon?: string; conCupon?: 'true' | 'false';
      clientId?: string; asunto?: string; destino?: string; desde?: string; hasta?: string;
      page?: number; pageSize?: number;
    },
  ): Promise<{ data: Campana[]; total: number; page: number; pageSize: number }> {
    const qb = this.repo.createQueryBuilder('campana')
      .where('campana.organization_id = :organizationId', { organizationId });
    // El encierro de una cuenta de portal manda sobre la empresa pedida: no es un filtro, es su límite.
    if (encerradoEn) qb.andWhere('campana.client_id = :encerradoEn', { encerradoEn });
    else if (filtros?.clientId) qb.andWhere('campana.client_id = :clientId', { clientId: filtros.clientId });
    if (filtros?.estado) qb.andWhere('campana.estado = :estado', { estado: filtros.estado });
    if (filtros?.destino) qb.andWhere('campana.destino = :destino', { destino: filtros.destino });
    if (filtros?.asunto) qb.andWhere('campana.asunto LIKE :asunto', { asunto: `%${filtros.asunto}%` });
    if (filtros?.cupon) qb.andWhere('campana.cupon LIKE :cupon', { cupon: `%${filtros.cupon}%` });
    // Una cadena vacía cuenta como «sin cupón»: es lo que deja un campo que se borró a medias.
    if (filtros?.conCupon === 'true') qb.andWhere("campana.cupon IS NOT NULL AND campana.cupon <> ''");
    if (filtros?.conCupon === 'false') qb.andWhere("campana.cupon IS NULL OR campana.cupon = ''");
    /*
     * Las fechas acotan por cuándo salió, no por cuándo se escribió.
     *
     * Un borrador no tiene `sent_at`, así que acotar por fechas lo deja fuera: es lo correcto,
     * porque «qué mandé en octubre» no incluye lo que nunca se mandó.
     */
    if (filtros?.desde) qb.andWhere('campana.sent_at >= :desde', { desde: new Date(filtros.desde) });
    if (filtros?.hasta) {
      const hasta = new Date(filtros.hasta);
      if (/^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta.trim())) hasta.setHours(23, 59, 59, 999);
      qb.andWhere('campana.sent_at <= :hasta', { hasta });
    }

    /*
     * Paginado, no topado en cien.
     *
     * El tope fijo hacía invisible la campaña ciento uno, sin decirlo: la pantalla mostraba una
     * lista completa que no lo era. Devolver el total deja que la pantalla diga cuántas hay.
     */
    const page = Math.max(filtros?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filtros?.pageSize ?? 50, 1), 100);
    const [data, total] = await qb
      .orderBy('campana.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, total, page, pageSize };
  }

  async crear(datos: {
    organizationId: string;
    clientId?: string | null;
    asunto: string;
    cuerpo: string;
    cupon?: string | null;
    destino?: 'lista' | 'administradores';
    createdBy?: string | null;
  }): Promise<Campana> {
    const asunto = datos.asunto?.trim();
    const cuerpo = datos.cuerpo?.trim();
    if (!asunto || !cuerpo) throw new BadRequestException('La campaña necesita asunto y texto');

    const clientId = this.empresaDe(datos.clientId);
    const cupon = datos.cupon?.trim().toUpperCase() || null;
    const cuponVence = cupon ? await this.comprobarCupon(datos.organizationId, clientId, cupon) : null;

    return this.repo.save(this.repo.create({
      organizationId: datos.organizationId,
      clientId,
      asunto,
      cuerpo,
      cupon,
      cuponVence,
      destino: datos.destino ?? 'lista',
      estado: EstadoDeCampana.BORRADOR,
      createdBy: datos.createdBy ?? null,
    }));
  }

  /** Editar sólo mientras es borrador: cambiar el texto de algo ya enviado falsea la constancia. */
  async editar(id: string, organizationId: string, cambios: { asunto?: string; cuerpo?: string; cupon?: string | null; destino?: 'lista' | 'administradores' }): Promise<Campana> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Esta campaña ya se envió: su texto es la constancia de lo que salió');
    }
    if (cambios.asunto !== undefined) campana.asunto = cambios.asunto.trim();
    if (cambios.cuerpo !== undefined) campana.cuerpo = cambios.cuerpo.trim();
    if (cambios.destino !== undefined) campana.destino = cambios.destino;
    if (cambios.cupon !== undefined) {
      const cupon = cambios.cupon?.trim().toUpperCase() || null;
      campana.cuponVence = cupon ? await this.comprobarCupon(campana.organizationId, campana.clientId ?? null, cupon) : null;
      campana.cupon = cupon;
    }
    if (!campana.asunto || !campana.cuerpo) throw new BadRequestException('La campaña necesita asunto y texto');
    return this.repo.save(campana);
  }

  async borrar(id: string, organizationId: string): Promise<void> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Una campaña enviada no se borra: es la constancia de lo que salió');
    }
    await this.repo.remove(campana);
  }

  /**
   * El correo compuesto, para mirarlo antes de mandarlo.
   *
   * Usa la misma función que el envío, así que lo que se ve es lo que sale. Y **con el pie de
   * baja puesto**: es lo que distingue una campaña de cualquier otro correo, y una vista previa
   * que lo omitiera enseñaría algo que no existe. El enlace es de muestra —el real lleva el token
   * de cada persona— y por eso no lleva a ninguna parte.
   */
  vistaPrevia(asunto: string, cuerpo: string): { subject: string; html: string; text: string } {
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return componerCorreo(
      asunto ?? '',
      cuerpo ?? '',
      { nombre: 'Ana' },
      undefined,
      undefined,
      undefined,
      `${base}/api/marketing/suscriptores/baja/de-muestra`,
    );
  }

  /** A cuántos le llegaría si se enviara ahora. Lo que se muestra antes de apretar el botón. */
  /**
   * A cuántos llegaría, y a quiénes.
   *
   * El número solo no basta para decidir: «312 personas» no dice si son las que uno cree. Una
   * muestra de los primeros permite reconocer la lista antes de mandar algo que no se puede
   * deshacer. Van pocos a propósito: esto es para reconocer, no para leer la lista entera, que
   * está en su propia pantalla con sus filtros.
   */
  async destinatarios(
    organizationId: string,
    empresa?: string | null,
    destino: 'lista' | 'administradores' = 'lista',
  ): Promise<{ total: number; muestra: Array<{ email: string; nombre: string | null }>; deQuienes: string }> {
    const lista = await this.aQuienes(organizationId, empresa, destino);
    return {
      total: lista.length,
      muestra: lista.slice(0, 5).map((fila) => ({ email: fila.email, nombre: fila.name ?? null })),
      // En palabras: «312 personas» no dice si son las que uno cree, y esto no se puede deshacer.
      deQuienes: destino === 'administradores'
        ? 'Quienes administran cada empresa'
        : this.empresaDe(empresa) === null
          ? 'La lista propia de Espartanos'
          : 'La lista de esta empresa',
    };
  }

  /**
   * De dónde salen las direcciones de una campaña.
   *
   * Un solo lugar, para que lo que se muestra antes de enviar y lo que sale después sean lo mismo:
   * dos consultas parecidas terminan dando números distintos, y ahí ya nadie confía en la pantalla.
   */
  async aQuienes(
    organizationId: string,
    empresa: string | null | undefined,
    destino: 'lista' | 'administradores',
  ): Promise<Array<{ id?: string; email: string; name?: string; unsubscribeToken?: string }>> {
    if (destino === 'administradores') {
      /*
       * Quienes administran cada empresa, no sus suscriptores.
       *
       * Es aviso de servicio a quien contrató —un cambio en su plan, una funcionalidad nueva—, no
       * publicidad: por eso no exige permiso de marketing. Si alguna vez se usa para venderles
       * algo, deja de ser esto y necesita su propio respaldo.
       *
       * Sólo cuentas activas: escribirle a quien ya no trabaja ahí es filtrar a un tercero lo que
       * pasa en esa empresa.
       */
      const donde: Record<string, unknown> = { organizationId, role: UserRole.CLIENT, isActive: true };
      const soloUna = this.empresaDe(empresa);
      if (soloUna) donde.clientId = soloUna;
      const cuentas = await this.usuarios.find({ where: donde, select: { id: true, email: true, name: true } });
      return cuentas.map((cuenta) => ({ id: cuenta.id, email: cuenta.email, name: cuenta.name ?? undefined }));
    }

    const fichas = await this.suscriptores.suscritos(organizationId, this.empresaDe(empresa));
    return fichas.map((ficha) => ({
      id: ficha.id,
      email: ficha.email,
      name: ficha.name ?? undefined,
      unsubscribeToken: ficha.unsubscribeToken ?? undefined,
    }));
  }

  /**
   * Comprueba el cupón con las mismas reglas que el de después de la visita.
   *
   * Un código que no existe, de otra empresa, desactivado o vencido es un descuento que la caja va
   * a rechazar delante del cliente: es peor que no ofrecer ninguno. Se comprueba al guardar y no
   * al enviar, para que quien escribe la campaña se entere mientras puede corregirlo.
   *
   * @returns Hasta cuándo vale, para que el correo pueda decirlo. `null` si no vence.
   * @throws BadRequestException con lo que pasa, en palabras de quien escribe la campaña.
   */
  private async comprobarCupon(organizationId: string, clientId: string | null, codigo: string): Promise<Date | null> {
    const cupon = await this.cupones.findOne({ where: { organizationId, code: codigo } });
    const ahora = new Date();
    const problema = !cupon ? 'no existe'
      : (cupon.clientId ?? null) !== clientId ? 'es de otra empresa'
        : !cupon.active ? 'está desactivado'
          : cupon.validUntil && cupon.validUntil <= ahora ? 'ya venció'
            /*
             * Sin usos libres la caja lo rechaza igual que si hubiera vencido.
             *
             * Faltaba, y era el agujero con más alcance de los cuatro: un cupón con tope se agota
             * sin cambiar de estado ni de fecha, así que pasaba la comprobación y salía anunciado
             * a toda la lista. `maxUses = 0` es sin tope.
             */
            : cupon.maxUses > 0 && cupon.usageCount >= cupon.maxUses ? 'ya agotó sus usos'
              : null;
    if (problema) {
      throw new BadRequestException(`El cupón ${codigo} ${problema}. Revísalo en Cupones antes de mandar la campaña: un código que la caja rechaza delante del cliente es peor que no ofrecer ninguno.`);
    }
    return cupon!.validUntil ?? null;
  }

  /**
   * Deja la campaña lista para salir. **No manda ningún correo.**
   *
   * Mandar aquí era el error. Doscientos correos no caben en una petición: el `curl` del cron
   * corta al minuto y Passenger antes, así que la lista se enviaba a medias y la campaña quedaba
   * en «enviando» para siempre —la misma guarda que impide el doble envío impedía reanudarla—.
   *
   * Ahora se encolan los destinatarios y el cron los despacha por tandas. Lo que se gana no es
   * sólo que quepa: un rebote reintenta a esa persona y no a la campaña, una ejecución que muere
   * a medias la recoge la siguiente pasada, y queda constancia de a quién le llegó.
   *
   * El estado se mueve a `ENVIANDO` con una condición sobre el anterior: si otra petición ganó la
   * carrera, aquí no se afecta ninguna fila y no se encola nada.
   */
  async enviar(id: string, organizationId: string): Promise<ResultadoDeEnvio> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Esta campaña ya se envió');
    }

    /*
     * El cupón se vuelve a comprobar aquí, no sólo al guardar.
     *
     * Entre escribir una campaña y mandarla pueden pasar semanas, y en ese rato el cupón se puede
     * desactivar, vencer o agotar sin que nadie lo relacione con la campaña que lo anuncia.
     * Comprobarlo sólo al guardar dejaba salir doscientos correos con un código muerto.
     *
     * Falla el envío en vez de salir sin cupón: el correo entero está escrito alrededor de esa
     * oferta, y mandarlo sin ella es otra campaña que nadie aprobó.
     */
    if (campana.cupon) {
      campana.cuponVence = await this.comprobarCupon(organizationId, campana.clientId ?? null, campana.cupon);
      await this.repo.update(campana.id, { cuponVence: campana.cuponVence });
    }

    // La misma consulta que mostró la pantalla antes de apretar: si dieran distinto, el número que
    // se vio al decidir no sería el que salió.
    const destinatarios = await this.aQuienes(
      organizationId,
      campana.clientId ?? null,
      campana.destino ?? 'lista',
    );
    if (!destinatarios.length) {
      throw new ConflictException(campana.destino === 'administradores'
          ? 'No hay cuentas activas que administren esta empresa'
          : 'No hay nadie suscrito en esta lista ahora mismo');
    }

    /*
     * El nombre con el que se marcará se fija ahora, antes de que salga el primer correo.
     *
     * Deducirlo del asunto al leer habría bastado hasta el día en que alguien edita el asunto de
     * una campaña ya enviada: desde ese momento el nombre guardado en las reservas y el calculado
     * dejarían de coincidir, y lo atribuido se perdería sin que nada fallara.
     */
    if (!campana.utmCampaign) {
      campana.utmCampaign = nombreDeCampana(campana.asunto);
      await this.repo.update(campana.id, { utmCampaign: campana.utmCampaign });
    }

    const tomada = await this.repo.update(
      { id: campana.id, estado: EstadoDeCampana.BORRADOR },
      { estado: EstadoDeCampana.ENVIANDO },
    );
    if (!tomada.affected) throw new ConflictException('Esta campaña ya se está enviando');

    const encolados = await this.envios.encolar(campana, destinatarios);
    await this.repo.update(campana.id, { destinatarios: encolados });

    this.logger.log(`Campaña ${campana.id}: ${encolados} destinatarios en cola`);
    return { destinatarios: encolados, enviados: 0, fallidos: 0, enCola: true };
  }

  /** Cómo va una campaña que está saliendo. */
  async avance(id: string, organizationId: string) {
    const campana = await this.buscar(id, organizationId);
    return { estado: campana.estado, ...await this.envios.avanceDe(campana.id) };
  }

  /** A quiénes no les llegó el correo, y por qué. */
  async fallidos(id: string, organizationId: string) {
    const campana = await this.buscar(id, organizationId);
    return { asunto: campana.asunto, fallidos: await this.envios.fallidosDe(campana.id) };
  }

  /**
   * Qué trajo la campaña: cuántos canjearon el cupón que repartió.
   *
   * Es la pregunta que justifica el módulo y la única que no se podía responder. Los dos
   * extremos estaban guardados desde hacía tiempo —la campaña anota qué código reparte, los
   * canjes anotan cuándo y por dónde se usó cada uno— y no había una sola consulta que los
   * juntara.
   *
   * **Se cuenta desde que salió**, no desde que existe el cupón. El mismo código puede estar en
   * un cartel y en el mesón desde antes; atribuirle a la campaña los canjes anteriores a su
   * envío sería contarle usos que no trajo. Por el mismo motivo esto no dice «la campaña causó
   * estos canjes» sino «esto pasó con su cupón después de salir»: quien lo vio en el mesón y lo
   * usó ese mismo día también cuenta, y no hay forma de separarlos.
   *
   * @returns `undefined` si la campaña no reparte cupón o todavía no salió: no hay nada que
   *   contar, que es distinto de contar cero.
   */
  async retorno(id: string, organizationId: string) {
    const campana = await this.buscar(id, organizationId);
    if (!campana.cupon || !campana.sentAt) return undefined;

    const cupon = await this.cupones.findOne({ where: { organizationId, code: campana.cupon } });
    if (!cupon) return undefined;

    const canjes = await this.canjes.find({
      where: { organizationId, couponId: cupon.id, createdAt: MoreThanOrEqual(campana.sentAt) },
      order: { createdAt: 'DESC' },
    });
    const suma = (campo: 'monto' | 'descuento') => canjes
      .reduce((total, canje) => total + Number(canje[campo] ?? 0), 0);

    return {
      cupon: campana.cupon,
      desde: campana.sentAt,
      enviados: campana.enviados,
      canjes: canjes.length,
      porReserva: canjes.filter((canje) => canje.canal === 'reserva').length,
      enElLocal: canjes.filter((canje) => canje.canal === 'local').length,
      /** Nulo cuando nadie anotó importes: cero significaría que consumieron cero. */
      consumo: canjes.some((canje) => canje.monto !== null) ? suma('monto') : null,
      descuento: canjes.some((canje) => canje.descuento !== null) ? suma('descuento') : null,
      reservas: await this.reservasAtribuidas(campana),
    };
  }

  /**
   * Reservas que llegaron por los enlaces marcados de esta campaña.
   *
   * Es la otra mitad del retorno y mide algo distinto del cupón: el cupón lo puede usar quien lo
   * vio en un cartel, mientras que esto son las personas que entraron desde este correo. Una
   * campaña sin cupón sólo tiene esta mitad.
   *
   * **Sólo cuenta desde el envío y sólo con la marca de esta campaña.** `null` cuando la campaña
   * salió antes de que existiera el marcado: nadie puso ahí un cero, simplemente no se sabe, y
   * un cero se leería como que no funcionó.
   */
  private async reservasAtribuidas(campana: Campana): Promise<number | null> {
    if (!campana.utmCampaign || !campana.sentAt) return null;
    return this.reservas.count({
      where: {
        organizationId: campana.organizationId,
        utmCampaign: campana.utmCampaign,
        createdAt: MoreThanOrEqual(campana.sentAt),
      },
    });
  }

  private async buscar(id: string, organizationId: string): Promise<Campana> {
    const campana = await this.repo.findOne({ where: { id, organizationId } });
    if (!campana) throw new NotFoundException('Esta campaña no existe');
    return campana;
  }
}
