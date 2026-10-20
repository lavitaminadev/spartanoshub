import { describe, expect, it } from 'vitest';
import { MARCA_PROTEGIDA } from '@espartanos/shared';
import { valorLlegado } from '../../shared/datos-protegidos';
import { whatsapp } from './contacto';

describe('datos protegidos en el CRM', () => {
  it('la marca no se confunde con un dato: valorLlegado la descarta y deja pasar lo demás', () => {
    expect(valorLlegado(MARCA_PROTEGIDA)).toBeUndefined();
    expect(valorLlegado('+56911112222')).toBe('+56911112222');
    expect(valorLlegado(null)).toBeNull();
  });

  it('con el teléfono protegido no hay enlace de WhatsApp', () => {
    expect(whatsapp(MARCA_PROTEGIDA)).toBeUndefined();
    expect(whatsapp('+56 9 1111 2222')).toBe('https://wa.me/56911112222');
  });
});
