import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from '../../../modules/marketing/suscriptor.entity';
import { cumpleHoy } from '../../../modules/marketing/edad';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

/**
 * Felicita a quien cumple años hoy.
 *
 * Solo a quien está suscrito y no consta como menor: un saludo de cumpleaños con la marca de la
 * agencia **es** comunicación comercial, por muy amable que suene, y se rige por el mismo permiso
 * que una promoción.
 *
 * Se manda una vez al día y no cada vez que el trabajo corre, gracias a que la comprobación es
 * por día del año: si el trabajo se ejecutara dos veces el mismo día, la persona recibiría dos
 * saludos. Por eso se apunta el envío en `lastSentAt` y se comprueba antes.
 */
@Injectable()
export class SaludoDeCumpleanosJob {
  private readonly logger = new Logger(SaludoDeCumpleanosJob.name);

  constructor(
    @InjectRepository(Suscriptor) private readonly suscriptores: Repository<Suscriptor>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const hoy = new Date();

    /*
     * Solo los que tienen fecha y están suscritos.
     *
     * El día del año no se puede filtrar en SQL sin repetir la regla del 29 de febrero en otro
     * lenguaje, así que se acota lo que sí se puede —estado y fecha presente— y el resto se
     * decide en un solo sitio.
     */
    const candidatos = await this.suscriptores.find({
      where: { status: EstadoDeSuscripcion.SUSCRITO, birthDate: Not(IsNull()) },
    });

    const encendidoPorOrganizacion = new Map<string, boolean>();
    let enviados = 0;

    for (const suscriptor of candidatos) {
      // Un registro con datos raros no puede impedir felicitar al resto.
      try {
        if (!suscriptor.birthDate) continue;
        if (!cumpleHoy(new Date(suscriptor.birthDate), hoy)) continue;
        // La regla de edad y de estado viven en la entidad, no acá: repetirlas sería tenerlas mal
        // en uno de los dos sitios el día que cambien.
        if (!suscriptor.puedeRecibirCampana(hoy)) continue;

        // Ya se le escribió hoy: el trabajo pudo correr dos veces, y dos saludos el mismo día se
        // leen como un fallo del sistema.
        if (suscriptor.lastSentAt && this.mismoDia(suscriptor.lastSentAt, hoy)) continue;

        let encendido = encendidoPorOrganizacion.get(suscriptor.organizationId);
        if (encendido === undefined) {
          encendido = Boolean(await this.parametros.get(
            'email.birthday_enabled', null, null, suscriptor.organizationId,
          ));
          encendidoPorOrganizacion.set(suscriptor.organizationId, encendido);
        }
        if (!encendido) continue;

        await this.enviar(suscriptor);
        await this.suscriptores.update(suscriptor.id, { lastSentAt: new Date() });
        enviados += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo felicitar a ${suscriptor.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Saludos de cumpleaños enviados: ${enviados} de ${candidatos.length} con fecha`);
  }

  private mismoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private async enviar(suscriptor: Suscriptor): Promise<void> {
    const [asunto, cuerpo] = await Promise.all([
      this.parametros.get('email.birthday_subject', null, null, suscriptor.organizationId),
      this.parametros.get('email.birthday_body', null, null, suscriptor.organizationId),
    ]);

    const { subject, html } = componerCorreo(
      String(asunto ?? '¡Feliz cumpleaños, {{nombre}}!'),
      String(cuerpo ?? 'Que tengas un gran día.'),
      // Sin nombre se saluda igual, sin el hueco: «Hola ,» delata que el sistema no sabía a quién
      // escribía, y en un correo de felicitación eso es peor que no mandarlo.
      { nombre: suscriptor.name ?? '' },
      this.enlaceDeBaja(suscriptor),
    );

    await this.correo.send(suscriptor.email, subject, html);
  }

  /**
   * El enlace de baja va en **todo** correo comercial, incluido el de cumpleaños.
   *
   * Es amable, pero sigue siendo comunicación comercial, y una felicitación de la que no se puede
   * uno bajar es exactamente lo que la normativa persigue.
   */
  private enlaceDeBaja(suscriptor: Suscriptor): { texto: string; url: string } | undefined {
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '');
    if (!base) return undefined;
    return {
      texto: 'No quiero recibir más correos',
      url: `${base}/api/marketing/suscriptores/baja/${suscriptor.unsubscribeToken}`,
    };
  }
}
