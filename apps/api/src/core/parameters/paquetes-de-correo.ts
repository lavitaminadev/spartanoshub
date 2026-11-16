import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';

/**
 * Los correos que trae cada servicio contratado.
 *
 * Contratar Reservas y que la confirmación —el comprobante de quien reserva, sin el cual no tiene
 * ni fecha ni código— venga apagada de fábrica no es una decisión que alguien tomara: es un
 * interruptor que nadie encendió porque nadie sabía que existía. Lo mismo con el recordatorio, que
 * es la medida que más reduce las ausencias.
 *
 * El aviso de pago vencido no entra en ningún paquete: va de la agencia hacia la empresa y no
 * depende de lo que ella contrató.
 */
export const PAQUETES_DE_CORREO: Record<'reservations' | 'crm' | 'surveys', string[]> = {
  reservations: [
    'email.reservation_confirmation_enabled',
    'email.reservation_reminder_enabled',
    'email.reservation_change_enabled',
    'email.reservation_cancellation_enabled',
    'email.reservation_recovery_enabled',
    'email.group_request_ack_enabled',
    'email.waitlist_ack_enabled',
    'email.waitlist_spot_enabled',
    'email.team_new_reservation_enabled',
    'email.team_group_request_enabled',
    'email.team_waitlist_enabled',
  ],
  /*
   * La encuesta se enciende, pero no sale hasta elegir cuál.
   *
   * Encenderla sin encuesta no manda nada y la pantalla lo dice; dejarla apagada obligaría a
   * descubrir dos cosas en vez de una.
   */
  surveys: ['email.post_visit_survey_enabled'],
  crm: [
    'email.daily_digest_enabled',
    'email.task_reminder_enabled',
    'email.new_lead_enabled',
  ],
};

@Injectable()
export class PaquetesDeCorreo {
  constructor(
    @InjectRepository(ParameterDefinition) private readonly definiciones: Repository<ParameterDefinition>,
    @InjectRepository(ParameterValue) private readonly valores: Repository<ParameterValue>,
  ) {}

  /**
   * Enciende los correos de un servicio recién contratado, **sin tocar lo ya decidido**.
   *
   * Sólo escribe donde esa empresa no tiene un valor propio: si alguien apagó la confirmación a
   * propósito, volver a contratar Reservas no la reenciende. Apagar el servicio tampoco apaga los
   * correos: se dejan como están y la pantalla avisa que ese módulo no está contratado, porque
   * borrarlos perdería los textos escritos.
   *
   * Nunca hace fallar el guardado de la empresa: contratar un servicio es la operación; encender
   * sus avisos es una comodidad que se puede rehacer a mano.
   *
   * @returns Claves efectivamente encendidas.
   */
  async encenderPara(clientId: string, servicios: Array<'reservations' | 'crm' | 'surveys'>): Promise<string[]> {
    const claves = servicios.flatMap((servicio) => PAQUETES_DE_CORREO[servicio] ?? []);
    if (claves.length === 0) return [];

    try {
      const definiciones = await this.definiciones.find({ where: { key: In(claves) } });
      if (definiciones.length === 0) return [];

      const yaDecididas = await this.valores.find({
        where: {
          definitionId: In(definiciones.map((definicion) => definicion.id)),
          scopeType: 'client',
          scopeId: clientId,
          validTo: IsNull(),
        },
      });
      const conValorPropio = new Set(yaDecididas.map((valor) => valor.definitionId));

      const nuevas = definiciones.filter((definicion) => !conValorPropio.has(definicion.id));
      if (nuevas.length === 0) return [];

      await this.valores.save(nuevas.map((definicion) => this.valores.create({
        definitionId: definicion.id,
        scopeType: 'client',
        scopeId: clientId,
        valueJson: { value: true },
        version: 1,
        validFrom: new Date(),
      })));
      return nuevas.map((definicion) => definicion.key);
    } catch {
      return [];
    }
  }

  /**
   * Apaga explícitamente el paquete y conserva cada valor anterior como una versión cerrada.
   * Se usa al retirar la capacidad de correo, no al apagar Reservas: ambos interruptores son
   * deliberadamente independientes.
   */
  async apagarPara(clientId: string, servicios: Array<'reservations' | 'crm' | 'surveys'>): Promise<string[]> {
    return this.fijarPara(clientId, servicios, false);
  }

  /** Reactivar desde la capacidad sí reemplaza la decisión anterior de paquete apagado. */
  async activarPara(clientId: string, servicios: Array<'reservations' | 'crm' | 'surveys'>): Promise<string[]> {
    return this.fijarPara(clientId, servicios, true);
  }

  private async fijarPara(clientId: string, servicios: Array<'reservations' | 'crm' | 'surveys'>, enabled: boolean): Promise<string[]> {
    const claves = servicios.flatMap((servicio) => PAQUETES_DE_CORREO[servicio] ?? []);
    if (claves.length === 0) return [];
    const definiciones = await this.definiciones.find({ where: { key: In(claves) } });
    if (definiciones.length === 0) return [];
    const ahora = new Date();
    return this.valores.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ParameterValue);
      const activas = await repo.find({ where: { definitionId: In(definiciones.map((item) => item.id)), scopeType: 'client', scopeId: clientId, validTo: IsNull() } });
      for (const activa of activas) activa.validTo = ahora;
      if (activas.length) await repo.save(activas);
      await repo.save(definiciones.map((definicion) => {
        const anterior = activas.find((item) => item.definitionId === definicion.id);
        return repo.create({ definitionId: definicion.id, scopeType: 'client', scopeId: clientId, valueJson: { value: enabled }, version: (anterior?.version ?? 0) + 1, validFrom: ahora });
      }));
      return definiciones.map((item) => item.key);
    });
  }
}
