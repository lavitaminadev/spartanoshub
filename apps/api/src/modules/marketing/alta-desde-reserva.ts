import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from './suscriptor.entity';

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

  constructor(@InjectRepository(Suscriptor) private readonly suscriptores: Repository<Suscriptor>) {}

  /**
   * Crea o completa la ficha. Nunca falla hacia afuera: la reserva ya está hecha y confirmada, y
   * perderla por no poder escribir en la lista sería cambiar un problema pequeño por uno grave.
   *
   * A quien ya está en la lista sólo se le completan los huecos: si se dio de baja, sigue de baja
   * —una reserva nueva no revierte una baja—, y si ya tenía fecha de nacimiento no se pisa.
   */
  async registrar(datos: AltaDesdeReserva): Promise<void> {
    const email = datos.email?.trim().toLowerCase();
    if (!email) return;

    try {
      const existente = await this.suscriptores.findOne({
        where: { organizationId: datos.organizationId, email },
      });

      if (existente) {
        if (!existente.birthDate && datos.birthDate) existente.birthDate = new Date(`${datos.birthDate}T00:00:00Z`);
        if (!existente.name && datos.name) existente.name = datos.name;
        // Una baja es definitiva: sólo se reactiva a quien nunca dijo que sí.
        if (existente.status === EstadoDeSuscripcion.PENDIENTE) {
          existente.status = EstadoDeSuscripcion.SUSCRITO;
          existente.consentAt = datos.consentAt ?? new Date();
          existente.consentText = datos.consentText ?? existente.consentText ?? null;
        }
        await this.suscriptores.save(existente);
        return;
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
    } catch (error) {
      this.logger.warn(`No se pudo sumar a la lista a quien reservó: ${error instanceof Error ? error.message : error}`);
    }
  }
}
