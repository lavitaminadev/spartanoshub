import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, In, Repository } from 'typeorm';
import { FailureVerdict, OutboxProcessor } from '../../core/outbox/outbox-processor.base';
import { EnvioDeCampana } from './envio-de-campana.entity';
import { Campana, EstadoDeCampana } from './campana.entity';
import { EstadoDeSuscripcion, Suscriptor } from './suscriptor.entity';
import { SuscriptoresService } from './suscriptores.service';
import { EmailService } from '../../core/notifications/email.service';
import { componerCorreo } from '../../core/notifications/plantilla-de-correo';
import { enlaceDeBaja } from '../../core/notifications/enlace-de-baja';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

/**
 * La bandeja de salida de las campañas.
 *
 * El envío no cabe en una petición: el `curl` del cron corta a los sesenta segundos y Passenger
 * antes. Mandando en el propio botón, una lista de doscientas personas se cortaba a la mitad y la
 * campaña quedaba marcada como «enviando» para siempre, sin forma de reanudarla ni de repetirla.
 *
 * Así que el botón sólo encola, y esto despacha por tandas. Todo lo difícil —reservar un lote sin
 * que dos pasadas tomen lo mismo, devolver a la cola lo que quedó tomado por una ejecución que no
 * terminó, reintentar con espera creciente— ya vive en `OutboxProcessor`, igual que para Meta y
 * Google. Aquí sólo se declara cómo se manda un correo y qué errores no vale la pena repetir.
 */
@Injectable()
export class EnviosDeCampanaService extends OutboxProcessor<EnvioDeCampana> {
  protected readonly logger = new Logger(EnviosDeCampanaService.name);
  protected readonly entity: EntityTarget<EnvioDeCampana> = EnvioDeCampana;
  protected readonly label = 'Campañas';

  /**
   * Tres intentos y no los ocho de las demás bandejas.
   *
   * Meta y Google hablan con una API que puede estar caída un rato; aquí al otro lado hay una
   * persona. Insistir ocho veces con una dirección que rebota no la hace existir, y si el rebote
   * fue un buzón lleno, el octavo intento llega dos días después de que la campaña dejó de tener
   * sentido. Lo que no se pudo entregar queda anotado, que es lo que sirve.
   */
  protected readonly maxAttempts = 3;

  constructor(
    @InjectRepository(EnvioDeCampana) protected readonly repository: Repository<EnvioDeCampana>,
    @InjectRepository(Campana) private readonly campanas: Repository<Campana>,
    @InjectRepository(Suscriptor) private readonly suscriptores: Repository<Suscriptor>,
    private readonly listaDeCorreo: SuscriptoresService,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {
    super();
  }

  /**
   * Deja encolada una campaña entera, sin mandar nada.
   *
   * Se insertan todas las filas de una vez: si se cortara a mitad de la inserción, la siguiente
   * pasada del cron mandaría una campaña incompleta sin que nadie se enterase. El índice único
   * por campaña y suscriptor hace que un segundo encolado no duplique a nadie.
   *
   * @returns Cuántos destinatarios quedaron en cola.
   */
  async encolar(campana: Campana, destinatarios: Suscriptor[]): Promise<number> {
    /*
     * Sin token no se encola.
     *
     * El enlace de baja es individual —se resuelve por el token de la ficha— así que una ficha sin
     * token no puede recibir un correo del que se pueda dar de baja. Antes que mandarlo sin salida,
     * no se manda: es una fila que arreglar, no una persona a la que escribir igual.
     */
    const conToken = destinatarios.filter((suscriptor) => {
      if (suscriptor.unsubscribeToken) return true;
      this.logger.warn(`Suscriptor ${suscriptor.id} sin token de baja: queda fuera de la campaña ${campana.id}`);
      return false;
    });
    if (!conToken.length) return 0;

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(EnvioDeCampana)
      .values(conToken.map((suscriptor) => ({
        organizationId: campana.organizationId,
        campanaId: campana.id,
        suscriptorId: suscriptor.id,
        email: suscriptor.email,
        status: 'pending',
      })))
      // Reencolar la misma campaña no duplica a nadie ni falla: lo ya encolado se queda como está.
      .orIgnore()
      .execute();

    return conToken.length;
  }

  /** Cómo va una campaña, para la pantalla mientras sale. */
  async avanceDe(campanaId: string): Promise<{ enviados: number; pendientes: number; fallidos: number }> {
    const filas = await this.repository
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'cuantos')
      .where('e.campana_id = :campanaId', { campanaId })
      .groupBy('e.status')
      .getRawMany<{ status: string; cuantos: string }>();

    const por = (...estados: string[]) => filas
      .filter((fila) => estados.includes(fila.status))
      .reduce((suma, fila) => suma + (Number(fila.cuantos) || 0), 0);

    return {
      enviados: por('processed'),
      pendientes: por('pending', 'retry', 'processing'),
      fallidos: por('failed', 'expired'),
    };
  }

  /**
   * Una baja entre el encolado y el envío se respeta.
   *
   * Es el motivo por el que esto se comprueba aquí y no al encolar: entre que se aprieta el botón
   * y sale el último correo pasan minutos, y en ese rato alguien puede darse de baja desde un
   * correo anterior. El artículo 28 B no da margen —pedida la suspensión, los envíos siguientes
   * «quedarán prohibidos»— así que la comprobación va pegada al envío, no a la intención.
   */
  protected async expirationReason(item: EnvioDeCampana): Promise<string | null> {
    const suscriptor = await this.suscriptores.findOne({ where: { id: item.suscriptorId } });
    if (!suscriptor) return 'La ficha ya no existe';
    if (suscriptor.status !== EstadoDeSuscripcion.SUSCRITO) return 'Se dio de baja antes de que saliera';
    if (!suscriptor.puedeRecibirCampana()) return 'No puede recibir campañas';
    if (await this.listaDeCorreo.exclusionDe(item.organizationId, suscriptor.email, suscriptor.clientId ?? null)) {
      return 'Pidió no recibir más antes de que saliera';
    }
    return null;
  }

  protected async send(item: EnvioDeCampana): Promise<void> {
    const [campana, suscriptor] = await Promise.all([
      this.campanas.findOne({ where: { id: item.campanaId } }),
      this.suscriptores.findOne({ where: { id: item.suscriptorId } }),
    ]);
    if (!campana) throw new Error('La campaña ya no existe');
    if (!suscriptor?.unsubscribeToken) throw new Error('La ficha ya no tiene token de baja');

    const baja = await enlaceDeBaja(this.parametros, 'email.campaign', suscriptor.unsubscribeToken, suscriptor);
    const { subject, html } = componerCorreo(
      campana.asunto,
      campana.cuerpo,
      // Sin nombre se escribe igual y sin el hueco: «Hola ,» delata que no se sabía a quién.
      { nombre: suscriptor.name ?? '' },
      undefined,
      undefined,
      undefined,
      baja,
    );

    const salio = await this.correo.send(suscriptor.email, subject, html, baja ? { bajaUrl: baja } : undefined);
    if (!salio) throw new Error('El servidor de correo no aceptó el mensaje');
  }

  /**
   * Casi nada se reintenta.
   *
   * Un rebote permanente —dirección que no existe, dominio que no resuelve— da el mismo resultado
   * las tres veces, y gastar los intentos sólo retrasa la constancia de que no llegó. Lo único
   * que se repite es lo que suena a problema del momento: la conexión con el servidor de correo.
   */
  protected classifyFailure(error: unknown): FailureVerdict {
    const mensaje = error instanceof Error ? error.message : String(error);
    const pasajero = /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket|no aceptó/i.test(mensaje);
    return { retryable: pasajero, tag: pasajero ? '[REINTENTABLE]' : '[DEFINITIVO]' };
  }

  /**
   * Cierra las campañas cuyo último correo ya salió.
   *
   * Corre al final de cada pasada y no al enviar la última fila: cuál es la última no se sabe
   * desde dentro del lote, y preguntarlo por fila sería una consulta por destinatario.
   */
  async cerrarTerminadas(): Promise<number> {
    const enCurso = await this.campanas.find({ where: { estado: EstadoDeCampana.ENVIANDO }, take: 50 });
    let cerradas = 0;

    for (const campana of enCurso) {
      const avance = await this.avanceDe(campana.id);
      if (avance.pendientes > 0) continue;

      await this.campanas.update(campana.id, {
        estado: EstadoDeCampana.ENVIADA,
        destinatarios: avance.enviados + avance.fallidos,
        enviados: avance.enviados,
        sentAt: new Date(),
      });
      cerradas += 1;
      this.logger.log(`Campaña ${campana.id} terminada: ${avance.enviados} enviados, ${avance.fallidos} sin entregar`);
    }

    return cerradas;
  }

  /**
   * La constancia no se borra.
   *
   * Las demás bandejas limpian lo procesado a los siete días porque su valor se acaba al
   * entregar. El de éstas empieza ahí: es la respuesta a «¿a mí me escribieron, y cuándo?».
   */
  override async cleanup(): Promise<{ deleted: number }> {
    return { deleted: 0 };
  }

  /** Reencola lo que quedó sin entregar por un problema pasajero ya resuelto. */
  async reintentarFallidos(campanaId: string): Promise<number> {
    const resultado = await this.repository.update(
      { campanaId, status: In(['failed']) },
      { status: 'pending', attempts: 0, nextAttemptAt: null, lastError: null },
    );
    return resultado.affected ?? 0;
  }
}
