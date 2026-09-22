import { describe, expect, it } from 'vitest';
import { describirEvento, type EventoDeReserva } from './describir-evento';

const evento = (parcial: Partial<EventoDeReserva>): EventoDeReserva => ({ id: 'e', type: 'status_changed', actorType: 'team', createdAt: '2026-09-22T23:00:00.000Z', ...parcial });
const ZONA = 'America/Santiago';

describe('describirEvento', () => {
  it('nombra a la persona del equipo que hizo el cambio', () => {
    expect(describirEvento(evento({ toStatus: 'attended', actorName: 'Juan Pérez' })).autor).toBe('Equipo · Juan Pérez');
    expect(describirEvento(evento({ actorType: 'guest' })).autor).toBe('Quien reservó');
    expect(describirEvento(evento({ actorType: 'system' })).autor).toBe('Sistema');
  });

  it('una cancelación desde el local dice que lo es y por qué', () => {
    const descrito = describirEvento(evento({ toStatus: 'cancelled_business', metadata: { cancellationReason: 'corte de agua' } }));
    expect(descrito.titulo).toBe('Cancelada por el local');
    expect(descrito.detalle).toBe('Motivo: corte de agua.');
  });

  it('la asistencia automática se muestra como supuesta y explica qué no garantiza', () => {
    const descrito = describirEvento(evento({ actorType: 'system', toStatus: 'attended', metadata: { via: 'automatic_day_close', afterMinutes: 60 } }));
    expect(descrito.titulo).toBe('Asistencia supuesta por el sistema');
    expect(descrito.supuesto).toBe(true);
    expect(descrito.detalle).toContain('no confirma que la persona haya venido');
  });

  it('la salida cerrada al cierre dice que es un tope y que no cuenta en el promedio', () => {
    const descrito = describirEvento(evento({ type: 'departed', actorType: 'system', metadata: { source: 'local_closed', tope: 'cierre', leftAt: '2026-09-23T02:00:00.000Z' } }), ZONA);
    expect(descrito.titulo).toBe('Cerrada automáticamente por el sistema');
    expect(descrito.detalle).toContain('el cierre del local (23:00) como hora máxima');
    expect(descrito.detalle).toContain('no cuenta en la duración promedio');
  });

  it('la salida marcada por el equipo muestra la hora real y la prevista', () => {
    const descrito = describirEvento(evento({ type: 'departed', metadata: { source: 'team', leftAt: '2026-09-23T00:15:00.000Z', plannedEndsAt: '2026-09-23T01:00:00.000Z' } }), ZONA);
    expect(descrito.titulo).toBe('Se retiró · mesa liberada');
    expect(descrito.detalle).toBe('Se retiró a las 21:15; estaba prevista hasta las 22:00. El cupo volvió a ofrecerse.');
  });

  it('alargar la estadía avisa si puede dejar la franja sobre el cupo', () => {
    const descrito = describirEvento(evento({ type: 'extended', metadata: { to: '2026-09-23T01:30:00.000Z', minutes: 30, overCapacity: true } }), ZONA);
    expect(descrito.detalle).toContain('Se alargó hasta las 22:30 (+30 min).');
    expect(descrito.detalle).toContain('sobre el cupo');
  });
});
