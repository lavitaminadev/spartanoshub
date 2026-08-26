import { describe, expect, it } from 'vitest';
import { franjasDelDia } from './jornada';

/** Una actividad a la hora local indicada del 26 de agosto de 2026. */
const a = (hora: number, minuto = 0, id = `${hora}:${minuto}`) => ({
  id, date: new Date(2026, 7, 26, hora, minuto).toISOString(),
});

describe('reparto de la jornada por horas', () => {
  it('sin nada agendado dibuja el horario habitual completo', () => {
    const franjas = franjasDelDia([]);
    expect(franjas).toHaveLength(13);
    expect(franjas[0].hora).toBe(8);
    expect(franjas[12].hora).toBe(20);
    expect(franjas.every((franja) => franja.eventos.length === 0)).toBe(true);
  });

  it('pone cada actividad en su hora', () => {
    const franjas = franjasDelDia([a(11, 30), a(16, 0)]);
    expect(franjas.find((f) => f.hora === 11)?.eventos).toHaveLength(1);
    expect(franjas.find((f) => f.hora === 16)?.eventos).toHaveLength(1);
    expect(franjas.find((f) => f.hora === 12)?.eventos).toHaveLength(0);
  });

  it('ordena por reloj lo que cae en la misma hora', () => {
    const franjas = franjasDelDia([a(9, 45, 'tarde'), a(9, 10, 'temprano')]);
    expect(franjas.find((f) => f.hora === 9)?.eventos.map((e) => e.id)).toEqual(['temprano', 'tarde']);
  });

  it('estira la jornada hacia atrás para no perder lo temprano', () => {
    // Sin esto, una visita a las 7 no encontraría fila y no se dibujaría en ninguna parte.
    const franjas = franjasDelDia([a(7, 0)]);
    expect(franjas[0].hora).toBe(7);
    expect(franjas[0].eventos).toHaveLength(1);
  });

  it('estira la jornada hacia adelante para no perder lo tarde', () => {
    const franjas = franjasDelDia([a(22, 30)]);
    expect(franjas[franjas.length - 1].hora).toBe(22);
    expect(franjas[franjas.length - 1].eventos).toHaveLength(1);
  });
});
