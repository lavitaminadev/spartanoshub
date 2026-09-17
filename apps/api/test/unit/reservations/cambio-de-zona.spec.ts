/**
 * Cambiar de zona a una reserva que ya existe: la de origen se libera sola, porque el cupo se
 * cuenta y no se guarda; lo que hay que comprobar es que en la de destino quepa.
 */

import { describe, expect, it } from 'vitest';
import { evaluarCambioDeZona } from '../../../src/modules/reservations/application/cambio-de-zona';

const ZONAS = [
  { id: 'terrace', name: 'Terraza', capacity: 20, active: true },
  { id: 'salon', name: 'Salón', capacity: 8 },
  { id: 'barra', name: 'Barra', capacity: 6, active: false },
];

const base = { zonas: ZONAS, destino: 'salon', ocupado: 0, personas: 2, capacidadDelLocal: 24 };

describe('cambio de zona', () => {
  it('deja mover cuando queda espacio', () => {
    expect(evaluarCambioDeZona({ ...base, ocupado: 6, personas: 2 })).toBeNull();
  });

  it('rechaza cuando el grupo no cabe y dice cuánto hay ocupado', () => {
    const rechazo = evaluarCambioDeZona({ ...base, ocupado: 7, personas: 2 });
    expect(rechazo?.motivo).toBe('sin-espacio');
    expect(rechazo?.mensaje).toBe('Salón no tiene espacio a esa hora: 7 de 8 ocupados');
  });

  /* Justo en el límite sí cabe: el tope es cuántos caben, no cuántos menos uno. */
  it('el cupo exacto alcanza', () => {
    expect(evaluarCambioDeZona({ ...base, ocupado: 6, personas: 2 })).toBeNull();
    expect(evaluarCambioDeZona({ ...base, ocupado: 6, personas: 3 })?.motivo).toBe('sin-espacio');
  });

  it('una zona apagada no recibe gente y explica dónde encenderla', () => {
    const rechazo = evaluarCambioDeZona({ ...base, destino: 'barra' });
    expect(rechazo?.motivo).toBe('apagada');
    expect(rechazo?.mensaje).toContain('ajustes del día');
  });

  it('una zona que no existe se rechaza sin mirar cupos', () => {
    expect(evaluarCambioDeZona({ ...base, destino: 'inventada' })?.motivo).toBe('inexistente');
  });

  /* Sin cupo propio manda el del local, que es como se comporta el resto del cálculo. */
  it('la zona sin cupo declarado usa el del local', () => {
    const zonas = [{ id: 'patio', name: 'Patio' }];
    expect(evaluarCambioDeZona({ ...base, zonas, destino: 'patio', ocupado: 20, personas: 4 })).toBeNull();
    expect(evaluarCambioDeZona({ ...base, zonas, destino: 'patio', ocupado: 22, personas: 4 })?.motivo).toBe('sin-espacio');
  });
});
