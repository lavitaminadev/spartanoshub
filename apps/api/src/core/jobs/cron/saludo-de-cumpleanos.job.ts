import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from '../../../modules/marketing/suscriptor.entity';
import { cumpleHoy, diaDelAnoEn } from '../../../modules/marketing/edad';
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

    /*
     * El interruptor se pregunta por empresa, no sólo por organización.
     *
     * Cada empresa enciende y apaga sus propios avisos y escribe sus propios textos; este trabajo
     * preguntaba siempre por el valor general, así que una empresa que apagaba el saludo lo seguía
     * mandando, y la plantilla que había escrito no se usaba nunca. El resolutor de parámetros
     * hereda —empresa, plan, organización, valor por defecto—, de modo que quien no tenga valor
     * propio sigue recibiendo exactamente lo mismo que hasta ahora.
     */
    const encendidoPorEmpresa = new Map<string, boolean>();
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

        const clave = `${suscriptor.organizationId}:${suscriptor.clientId ?? 'sin-empresa'}`;
        let encendido = encendidoPorEmpresa.get(clave);
        if (encendido === undefined) {
          encendido = Boolean(await this.parametros.get(
            'email.birthday_enabled', suscriptor.clientId ?? null, null, suscriptor.organizationId,
          ));
          encendidoPorEmpresa.set(clave, encendido);
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

  /**
   * Si dos instantes caen el mismo día **donde está el negocio**.
   *
   * Comparado con la fecha del servidor —que corre en UTC— el día cambia a las nueve de la noche
   * en Chile: un saludo enviado a las 21:30 y otro a las 22:30 del mismo día parecían de días
   * distintos, y la persona recibía dos.
   */
  private mismoDia(a: Date, b: Date): boolean {
    const uno = diaDelAnoEn(a);
    const otro = diaDelAnoEn(b);
    return uno.ano === otro.ano && uno.mes === otro.mes && uno.dia === otro.dia;
  }

  private async enviar(suscriptor: Suscriptor): Promise<void> {
    // Con la empresa: el texto que ella escribió para su marca, y el general si no escribió ninguno.
    const [asunto, cuerpo] = await Promise.all([
      this.parametros.get('email.birthday_subject', suscriptor.clientId ?? null, null, suscriptor.organizationId),
      this.parametros.get('email.birthday_body', suscriptor.clientId ?? null, null, suscriptor.organizationId),
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
