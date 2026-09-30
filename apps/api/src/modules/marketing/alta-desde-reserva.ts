import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from './suscriptor.entity';
import { SuscriptoresService } from './suscriptores.service';

/** Lo que una reserva sabe de quien la hizo y hace falta para la lista. */
export interface AltaDesdeReserva {
  organizationId: string;
  clientId: string;
  email?: string | null;
  name?: string | null;
  birthDate?: string | null;
  /** Nombre de la sucursal, para poder explicar de dónde salió cada dirección. */
  origen: string;
  /** El texto exacto que aceptó, tal como se le mostró. */
  consentText?: string | null;
  consentAt?: Date | null;
}

/**
 * Da de alta en la lista de correo a quien reservó **y pidió beneficios**.
 *
 * Sin esto, aceptar «quiero beneficios y novedades» no tenía ninguna consecuencia: la lista se
 * llenaba sólo importando un CSV a mano, y el saludo de cumpleaños —que lee esa lista— no le
 * llegaba a nadie que hubiera reservado, por más que su fecha estuviera guardada en la reserva.
 *
 * **Sólo con consentimiento y sólo con correo.** Una dirección que llega sin que su dueño lo haya
 * pedido no es una lista: es un problema, y de los caros. Se guarda el texto que aceptó y cuándo,
 * que es lo que permite demostrarlo después.
 */
@Injectable()
export class AltaDeSuscriptorDesdeReserva {
  private readonly logger = new Logger(AltaDeSuscriptorDesdeReserva.name);

  constructor(
    @InjectRepository(Suscriptor) private readonly suscriptores: Repository<Suscriptor>,
    private readonly suscriptores2: SuscriptoresService,
  ) {}

  /**
   * Crea o completa la ficha. Nunca falla hacia afuera: la reserva ya está hecha y confirmada, y
   * perderla por no poder escribir en la lista sería cambiar un problema pequeño por uno grave.
   *
   * A quien ya está en la lista sólo se le completan los huecos: si se dio de baja, sigue de baja
   * —una reserva nueva no revierte una baja—, y si ya tenía fecha de nacimiento no se pisa.
   *
   * @param reactivar - Que esta persona pidió volver, a propósito y sabiendo que había pedido no
   *   recibir. Sólo lo pone quien ya se lo advirtió y recibió un sí; no se deduce de reservar.
   * @returns `alta` si quedó en la lista; el alcance de la exclusión que lo impidió —`local` o
   *   `todas`— para que la pantalla pueda advertirlo; u `omitida` si no entró por cualquier otro
   *   motivo (sin dirección, o un fallo al escribir, que no se propaga).
   */
  async registrar(datos: AltaDesdeReserva, reactivar = false): Promise<'alta' | 'omitida' | 'local' | 'todas'> {
    const email = datos.email?.trim().toLowerCase();
    if (!email) return 'omitida';

    try {
      /*
       * Reservar no es pedir publicidad.
       *
       * Si esta persona pidió no recibir más, no se le crea ficha ni se le reactiva la que tenga:
       * el artículo 28 B de la Ley 19.496 dice que tras la solicitud los envíos «quedarán desde
       * entonces prohibidos», sin excepción por una reserva posterior. Sólo una casilla marcada a
       * propósito —un acto nuevo y voluntario— levanta la exclusión, y ése es el camino que abre
       * `reactivar`: quien lo pasa ya le advirtió que había pedido no recibir y le dijo que sí.
       */
      const exclusion = await this.suscriptores2.exclusionDe(datos.organizationId, email, datos.clientId ?? null);
      if (exclusion && !reactivar) return exclusion;
      if (exclusion) await this.suscriptores2.levantarExclusion(datos.organizationId, email, datos.clientId ?? null);

      // Por empresa: la misma persona puede estar suscrita en un local y de baja en otro.
      const existente = await this.suscriptores.findOne({
        where: { organizationId: datos.organizationId, clientId: datos.clientId ?? IsNull(), email },
      });

      if (existente) {
        if (!existente.birthDate && datos.birthDate) existente.birthDate = new Date(`${datos.birthDate}T00:00:00Z`);
        if (!existente.name && datos.name) existente.name = datos.name;
        /*
         * Una baja es definitiva: sólo se reactiva a quien nunca dijo que sí.
         *
         * La excepción es `reactivar`, y no se la salta: es la misma persona diciendo que vuelve,
         * después de que se le recordara que había pedido no recibir. Se guarda el texto y la
         * fecha nuevos, porque el permiso que vale ahora es ése y no el de la primera vez.
         */
        if (existente.status === EstadoDeSuscripcion.PENDIENTE || reactivar) {
          existente.status = EstadoDeSuscripcion.SUSCRITO;
          existente.consentAt = datos.consentAt ?? new Date();
          existente.consentText = datos.consentText ?? existente.consentText ?? null;
          if (reactivar) { existente.unsubscribedAt = null; existente.unsubscribedScope = null; }
        }
        await this.suscriptores.save(existente);
        return 'alta';
      }

      await this.suscriptores.save(this.suscriptores.create({
        organizationId: datos.organizationId,
        clientId: datos.clientId,
        email,
        name: datos.name ?? null,
        birthDate: datos.birthDate ? new Date(`${datos.birthDate}T00:00:00Z`) : null,
        source: 'reserva',
        sourceDetail: datos.origen,
        status: EstadoDeSuscripcion.SUSCRITO,
        consentAt: datos.consentAt ?? new Date(),
        consentText: datos.consentText ?? null,
        unsubscribeToken: randomBytes(24).toString('base64url'),
      }));
      return 'alta';
    } catch (error) {
      this.logger.warn(`No se pudo sumar a la lista a quien reservó: ${error instanceof Error ? error.message : error}`);
      return 'omitida';
    }
  }
}
