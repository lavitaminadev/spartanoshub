import { describe, expect, it } from 'vitest';
import { MUESTRA_MINIMA_POR_ORIGEN, asistenciaPorOrigen, type ReservaParaAtribuir } from '../../../src/modules/reservations/application/asistencia-por-origen';

/**
 * Del anuncio al comensal que llegó.
 *
 * Lo que se mide no es cuántas reservas entraron por una campaña, sino cuántas de ésas se
 * sentaron. Un origen que trae cien reservas y la mitad no aparece es peor que uno que trae veinte
 * y llegan todas, y ningún informe de Meta o de Google puede decirlo porque la asistencia se marca
 * acá.
 */
function reserva(parcial: Partial<ReservaParaAtribuir> = {}): ReservaParaAtribuir {
  return { status: 'attended', partySize: 2, ...parcial };
}

/** `n` reservas iguales, para pasar la muestra mínima sin escribirlas a mano. */
function varias(n: number, parcial: Partial<ReservaParaAtribuir>): ReservaParaAtribuir[] {
  return Array.from({ length: n }, () => reserva(parcial));
}

describe('asistencia por origen', () => {
  it('cuenta reservas, asistencias y comensales de cada campaña', () => {
    const filas = asistenciaPorOrigen([
      ...varias(8, { utmSource: 'facebook', utmCampaign: 'primavera', status: 'attended', partySize: 4 }),
      ...varias(2, { utmSource: 'facebook', utmCampaign: 'primavera', status: 'no_show' }),
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      origen: 'facebook', campana: 'primavera',
      reservas: 10, llegaron: 8, noLlegaron: 2, comensales: 32, asistencia: 80,
    });
  });

  /*
   * Lo que todavía no ocurrió no dice nada sobre si alguien llegó. Contar una reserva de mañana
   * como ausencia hunde el porcentaje de la campaña que se está evaluando justo ahora.
   */
  it('las reservas que aún no cerraron no entran', () => {
    const filas = asistenciaPorOrigen([
      ...varias(10, { utmSource: 'google', status: 'attended' }),
      ...varias(5, { utmSource: 'google', status: 'confirmed' }),
      ...varias(3, { utmSource: 'google', status: 'pending' }),
    ]);
    expect(filas[0].reservas).toBe(10);
  });

  /*
   * Con tres reservas, una ausencia son treinta y tres puntos. Publicar ese número invita a apagar
   * una campaña que no se ha medido, así que se entregan los conteos —que son hechos— y se omite
   * el porcentaje, que con esa muestra es una opinión.
   */
  it('bajo la muestra mínima entrega conteos y no porcentaje', () => {
    const pocas = asistenciaPorOrigen(varias(MUESTRA_MINIMA_POR_ORIGEN - 1, { utmSource: 'facebook' }));
    expect(pocas[0].asistencia).toBeNull();
    expect(pocas[0].llegaron).toBe(MUESTRA_MINIMA_POR_ORIGEN - 1);

    const justas = asistenciaPorOrigen(varias(MUESTRA_MINIMA_POR_ORIGEN, { utmSource: 'facebook' }));
    expect(justas[0].asistencia).toBe(100);
  });

  /*
   * Tres casos distintos que no se pueden mezclar: sin rastro es una reserva directa; con rastro y
   * sin nombre es un enlace mal armado, y sumarlo a lo directo esconde el error.
   */
  it('separa lo directo de lo que vino con rastro sin nombre', () => {
    const filas = asistenciaPorOrigen([
      reserva({ utmSource: null, originDetected: false }),
      reserva({ utmSource: '   ', originDetected: true }),
      reserva({ utmSource: 'facebook' }),
    ]);
    expect(filas.map((fila) => fila.origen).sort()).toEqual(['directo', 'facebook', 'sin_identificar']);
  });

  /*
   * Ordenar por porcentaje pone arriba a la campaña que menos mueve: con doce reservas y el cien
   * por ciento parece mejor que una con trescientas y el setenta. Lo que se decide con esto es
   * dónde poner el presupuesto, así que manda la gente sentada.
   */
  it('ordena por comensales sentados, no por porcentaje', () => {
    const filas = asistenciaPorOrigen([
      ...varias(12, { utmSource: 'instagram', partySize: 2 }),
      ...varias(60, { utmSource: 'facebook', partySize: 4, status: 'attended' }),
      ...varias(30, { utmSource: 'facebook', partySize: 4, status: 'no_show' }),
    ]);
    expect(filas[0].origen).toBe('facebook');
    expect(filas[0].asistencia).toBeLessThan(filas[1].asistencia!);
  });

  it('una mesa sin cantidad anotada cuenta como una persona', () => {
    const filas = asistenciaPorOrigen([reserva({ utmSource: 'google', partySize: null })]);
    expect(filas[0].comensales).toBe(1);
  });

  /*
   * Si el recordatorio hace que la gente confirme y llegue, el número lo dice; si no, también. Es
   * lo que permite saber si vale seguir mandándolo en ese origen.
   */
  it('dice cuántas de las que llegaron habían confirmado tras el recordatorio', () => {
    const ayer = new Date();
    const filas = asistenciaPorOrigen([
      ...varias(4, { utmSource: 'facebook', reminderSentAt: ayer, guestConfirmedAt: ayer }),
      ...varias(3, { utmSource: 'facebook', reminderSentAt: ayer, guestConfirmedAt: null }),
      ...varias(2, { utmSource: 'facebook', status: 'no_show', reminderSentAt: ayer, guestConfirmedAt: ayer }),
    ]);
    expect(filas[0].confirmadasTrasRecordatorio).toBe(4);
  });
});
