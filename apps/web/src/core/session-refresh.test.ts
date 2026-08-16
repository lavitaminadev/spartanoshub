import { describe, expect, it } from 'vitest';

/**
 * Decisión de renovar al volver a la pestaña.
 *
 * Se prueba la regla y no el escuchador del navegador: lo que puede equivocarse es el criterio
 * —cuándo hace falta renovar—, no que `addEventListener` funcione.
 *
 * Espeja la condición de `api.ts`. Si allá cambia el margen, esta constante y sus expectativas
 * tienen que moverse con él.
 */
const MARGEN_MS = 60_000;

function necesitaRenovar(expiresAt: number | null, ahora: number): boolean {
  if (!expiresAt) return false;
  return expiresAt - ahora <= MARGEN_MS;
}

describe('renovación al volver a la pestaña', () => {
  const ahora = new Date('2026-08-15T12:00:00Z').getTime();

  it('renueva cuando el token venció mientras la pestaña estaba en segundo plano', () => {
    // Es el caso que hacía parecer que la sesión se caía sola: el temporizador quedó suspendido
    // con la pestaña oculta y el token vencció sin que nadie lo renovara.
    expect(necesitaRenovar(ahora - 5 * 60_000, ahora)).toBe(true);
  });

  it('renueva también cuando está por vencer, para que la primera acción no falle', () => {
    expect(necesitaRenovar(ahora + 30_000, ahora)).toBe(true);
  });

  it('no renueva si todavía queda margen', () => {
    expect(necesitaRenovar(ahora + 10 * 60_000, ahora)).toBe(false);
  });

  it('sin token no intenta nada', () => {
    expect(necesitaRenovar(null, ahora)).toBe(false);
  });
});
