import { describe, expect, it } from 'vitest';
import { canUseAreaLens, defaultWorkspace, effectiveArea } from './area-lens';

describe('lente de área', () => {
  it('solo desarrollo y administración pueden usarla', () => {
    expect(canUseAreaLens('dev')).toBe(true);
    expect(canUseAreaLens('admin')).toBe(true);
    expect(canUseAreaLens('designer')).toBe(false);
    expect(canUseAreaLens('commercial_director')).toBe(false);
    expect(canUseAreaLens(undefined)).toBe(false);
  });

  it('un cargo sin la lente ve siempre su área natural, aunque le pasen otra', () => {
    // Es la garantía de que la lente no sirve para ampliar lo que alguien ve: si el cargo no
    // puede usarla, pedirla no cambia nada.
    expect(effectiveArea('designer', 'audiovisual')).toBe('design');
    expect(effectiveArea('community_manager', 'commercial')).toBe('community');
  });

  it('desarrollo puede mirar por el área que necesite revisar', () => {
    expect(effectiveArea('dev', 'design')).toBe('design');
    expect(effectiveArea('dev', 'audiovisual')).toBe('audiovisual');
  });

  it('sin lente puesta, cada cargo ve lo suyo', () => {
    expect(effectiveArea('art_director')).toBe('design');
    expect(effectiveArea('av_director')).toBe('audiovisual');
  });

  it('un cargo transversal no queda limitado a un área', () => {
    expect(effectiveArea('operations_director')).toBeUndefined();
    expect(effectiveArea('admin')).toBeUndefined();
  });

  it('el espacio inicial de un director de área es su área, no la administración', () => {
    // Es el caso que motivó esto: un cargo que además es administrador abría en una pantalla
    // que mezclaba su operación diaria con lo administrativo.
    expect(defaultWorkspace('commercial_director')).toBe('commercial');
    expect(defaultWorkspace('art_director')).toBe('design');
    expect(defaultWorkspace('dev')).toBe('admin');
  });
});
