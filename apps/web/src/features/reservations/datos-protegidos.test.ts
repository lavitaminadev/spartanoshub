import { describe, expect, it } from 'vitest';
import { MARCA_PROTEGIDA } from '@espartanos/shared';
import { contactoDe, telefonoDe } from './datos-protegidos';
import { respuestasLegibles } from './answer-labels';

describe('datos protegidos en la pantalla de reservas', () => {
  it('distingue «Protegido» de «Sin contacto»', () => {
    expect(contactoDe({ guestPhone: MARCA_PROTEGIDA, guestEmail: undefined })).toBe('Protegido');
    expect(contactoDe({ guestPhone: undefined, guestEmail: undefined })).toBe('Sin contacto');
    expect(contactoDe({ guestPhone: '+56911112222' })).toBe('+56911112222');
  });

  it('nunca entrega la marca como teléfono', () => {
    expect(telefonoDe({ guestPhone: MARCA_PROTEGIDA })).toBeUndefined();
    expect(telefonoDe({ guestPhone: '+56911112222' })).toBe('+56911112222');
  });

  it('las respuestas protegidas no se recorren como si fueran un objeto', () => {
    expect(respuestasLegibles(MARCA_PROTEGIDA as never, undefined)).toEqual([]);
  });
});
