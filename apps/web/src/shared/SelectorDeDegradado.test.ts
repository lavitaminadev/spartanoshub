import { describe, expect, it } from 'vitest';
import { degradadoCss, leerDegradado } from './SelectorDeDegradado';

describe('degradado de dos colores', () => {
  it('lee los degradados de las plantillas y los vuelve a escribir igual', () => {
    const plantilla = 'linear-gradient(135deg, #f4f5f7 0%, #d8f3f0 100%)';
    const leido = leerDegradado(plantilla);
    expect(leido).toEqual({ angulo: 135, desde: '#f4f5f7', hasta: '#d8f3f0' });
    expect(degradadoCss(leido!)).toBe(plantilla);
  });

  it('no toca degradados personalizados que no son de dos colores', () => {
    expect(leerDegradado('linear-gradient(135deg, #fff 0%, #000 50%, #f00 100%)')).toBeNull();
    expect(leerDegradado('linear-gradient(90deg, rgba(0,0,0,.2), #ffffff)')).toBeNull();
    expect(leerDegradado('radial-gradient(#ffffff, #000000)')).toBeNull();
    expect(leerDegradado('')).toBeNull();
  });
});
