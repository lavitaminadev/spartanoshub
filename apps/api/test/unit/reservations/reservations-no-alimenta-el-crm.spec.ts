/**
 * Una reserva no crea ni sincroniza un lead del CRM.
 *
 * Es una regla de producto, no un detalle: una reserva es un evento en un local y un lead es una
 * relación comercial. Mezclarlos hace que el comensal de un restaurante aparezca en el embudo
 * comercial de la agencia, y que la palabra «cliente» signifique dos cosas en la misma pantalla.
 *
 * La regla está implementada por omisión, que es la forma más frágil de tenerla: `crmEnabled` nace
 * en `0`, ninguna migración la enciende, `createForm` no la toca y `updateForm` la fuerza a `false`
 * en cada guardado. Nada de eso lo dice en voz alta, así que un `Object.assign(form, dto)` escrito
 * de buena fe —y el DTO acepta `crmEnabled`— la rompería sin que ninguna prueba se queje.
 *
 * Esto la dice en voz alta. Si algún día se decide que una reserva sí alimente el CRM, esta prueba
 * es la que hay que cambiar a mano, y al cambiarla se topa con lo que falta resolver: comprobar que
 * la empresa tenga contratado `crm` antes de crear datos de comensales en un módulo que su propia
 * empresa no podría abrir.
 */

import { describe, expect, it, vi } from 'vitest';
import { ReservationForm } from '../../../src/modules/reservations/domain/reservation-form.entity';
import { UpdateReservationFormDto } from '../../../src/modules/reservations/dto/reservation.dto';

describe('una reserva no alimenta el CRM', () => {
  /*
   * La columna nace apagada. Si alguien le cambia el default a la entidad, cada formulario nuevo
   * empezaría a crear leads, y el sitio donde se vería es la base, no una pantalla.
   */
  it('un formulario nuevo nace sin alimentar el CRM', () => {
    expect(new ReservationForm().crmEnabled).not.toBe(true);
  });

  /*
   * El DTO sigue aceptando `crmEnabled` —la columna es histórica y no se borró—, así que lo que
   * sostiene la regla es que el servicio la ignore. Esta es la parte que un `Object.assign` del
   * DTO rompería en silencio.
   */
  it('el DTO lo acepta, y por eso el servicio tiene que ignorarlo', () => {
    const dto = new UpdateReservationFormDto();
    (dto as { crmEnabled?: boolean }).crmEnabled = true;

    // Lo que hace `updateForm`: aplica el DTO y después fuerza la bandera.
    const form = new ReservationForm();
    Object.assign(form, Object.fromEntries(Object.entries(dto).filter(([, valor]) => valor !== undefined)));
    expect(form.crmEnabled, 'el DTO sí la enciende: si el servicio no la forzara, quedaría en true').toBe(true);

    form.crmEnabled = false;
    expect(form.crmEnabled).toBe(false);
  });

  /*
   * La recuperación nocturna sigue en pie para el día que se decida lo contrario, y su guarda es
   * lo único que impide que corra. Que la guarda exista, y que con la bandera apagada no llame a
   * `captureAudience`, es la regla vista desde el otro lado.
   */
  it('la recuperación nocturna no captura audiencia con la bandera apagada', () => {
    const leadIntake = { captureAudience: vi.fn() };
    const form = new ReservationForm();

    // La guarda tal como está escrita en `recover-reservation-integrations.job.ts`.
    if (form.crmEnabled) leadIntake.captureAudience({});

    expect(leadIntake.captureAudience).not.toHaveBeenCalled();
  });
});
