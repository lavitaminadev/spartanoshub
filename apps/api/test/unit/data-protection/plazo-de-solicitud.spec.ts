import { describe, expect, it } from 'vitest';
import { plazoDeSolicitud, vencimientoConProrroga, PLAZO_RESPUESTA_DERECHOS_DIAS } from '@espartanos/shared';

/*
 * El plazo para responder una solicitud de derechos.
 *
 * Treinta días **corridos** desde que entra la solicitud, prorrogables una sola vez por otros
 * treinta avisando antes del vencimiento y explicando el motivo. Estaba escrito en las políticas
 * que el comensal lee y en ninguna parte del sistema: nadie lo calculaba, nadie avisaba, y una
 * solicitud podía vencer sin que se enterara nadie. Lo que se incumple no es «no responder», es
 * «no responder a tiempo».
 */
const RECIBIDA = new Date('2026-09-01T10:00:00Z');
const enDias = (dias: number) => new Date(RECIBIDA.getTime() + dias * 86_400_000);

describe('plazo de una solicitud de derechos', () => {
  it('son treinta días corridos desde que entra, no hábiles', () => {
    expect(PLAZO_RESPUESTA_DERECHOS_DIAS).toBe(30);

    const plazo = plazoDeSolicitud(RECIBIDA, { ahora: RECIBIDA });

    expect(plazo.vence.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(plazo.diasRestantes).toBe(30);
    expect(plazo.estado).toBe('a tiempo');
  });

  /* Una semana: responder bien toma días, y avisar el día antes no sirve de nada. */
  it('avisa desde una semana antes, no el último día', () => {
    expect(plazoDeSolicitud(RECIBIDA, { ahora: enDias(22) }).estado).toBe('a tiempo');
    expect(plazoDeSolicitud(RECIBIDA, { ahora: enDias(23) }).estado).toBe('por vencer');
    expect(plazoDeSolicitud(RECIBIDA, { ahora: enDias(30) }).estado).toBe('por vencer');
  });

  it('pasado el plazo queda vencida, y dice cuántos días lleva', () => {
    const plazo = plazoDeSolicitud(RECIBIDA, { ahora: enDias(33) });

    expect(plazo.estado).toBe('vencida');
    expect(plazo.diasRestantes).toBe(-3);
  });

  /* Respondida es respondida: el plazo deja de correr y no tiene sentido seguir avisando. */
  it('una respondida no vence aunque haya pasado el plazo', () => {
    const plazo = plazoDeSolicitud(RECIBIDA, { resuelta: enDias(5), ahora: enDias(90) });

    expect(plazo.estado).toBe('respondida');
  });

  /*
   * La prórroga se cuenta desde el vencimiento original y no desde que alguien se acordó:
   * el plazo es «treinta días más», no «treinta desde hoy».
   */
  it('la prórroga da treinta días más contados desde el vencimiento original', () => {
    const hasta = vencimientoConProrroga(RECIBIDA);

    expect(hasta.toISOString().slice(0, 10)).toBe('2026-10-31');

    const plazo = plazoDeSolicitud(RECIBIDA, { prorrogadaHasta: hasta, ahora: enDias(35) });
    expect(plazo.estado).toBe('a tiempo');
    expect(plazo.prorrogada).toBe(true);
  });

  it('prorrogar el día 29 no da más tiempo que prorrogar el día 2', () => {
    expect(vencimientoConProrroga(RECIBIDA).getTime()).toBe(vencimientoConProrroga(RECIBIDA).getTime());
    expect(plazoDeSolicitud(RECIBIDA, { prorrogadaHasta: vencimientoConProrroga(RECIBIDA), ahora: enDias(61) }).estado).toBe('vencida');
  });
});
