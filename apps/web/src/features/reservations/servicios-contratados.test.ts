import { describe, expect, it } from 'vitest';
import { empresaOfrece } from './servicios-contratados';

const CON_ENCUESTAS = { id: 'a', capabilities: { reservations: true, surveys: true } };
const SIN_ENCUESTAS = { id: 'b', capabilities: { reservations: true, surveys: false } };

describe('servicios contratados', () => {
  it('con una empresa elegida manda lo que ella tiene', () => {
    expect(empresaOfrece('surveys', [CON_ENCUESTAS, SIN_ENCUESTAS], 'b')).toBe(false);
    expect(empresaOfrece('surveys', [CON_ENCUESTAS, SIN_ENCUESTAS], 'a')).toBe(true);
  });

  it('sin empresa elegida basta con que alguna lo tenga', () => {
    expect(empresaOfrece('surveys', [CON_ENCUESTAS, SIN_ENCUESTAS])).toBe(true);
    expect(empresaOfrece('surveys', [SIN_ENCUESTAS])).toBe(false);
  });

  /* Sin el dato se mantiene lo que había antes: nadie pierde un enlace por una respuesta incompleta. */
  it('sin capacidades declaradas se asume contratado', () => {
    expect(empresaOfrece('surveys', [{ id: 'c' }], 'c')).toBe(true);
    expect(empresaOfrece('surveys', [])).toBe(true);
  });

  it('una empresa elegida que no está en la lista no decide por las demás', () => {
    expect(empresaOfrece('surveys', [SIN_ENCUESTAS], 'inexistente')).toBe(false);
  });
});
