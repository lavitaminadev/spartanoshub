import { beforeEach, describe, expect, it } from 'vitest';
import { clearProgress, loadProgress, progressKey, saveProgress } from './first-access-progress';

describe('progreso del primer acceso', () => {
  beforeEach(() => sessionStorage.clear());

  it('conserva el avance para que recargar no obligue a releer los cinco puntos', () => {
    saveProgress('user-1', {
      step: 'terms',
      name: 'Maxi',
      phone: '+56911112222',
      readTerms: { terms: true },
      accepted: { terms: true },
      termsVersion: 'v1',
    });

    const recuperado = loadProgress('user-1', 'v1');
    expect(recuperado?.name).toBe('Maxi');
    expect(recuperado?.accepted).toEqual({ terms: true });
  });

  it('nunca guarda la contraseña ni tokens, aunque se los pasen', () => {
    // El filtro protege de un descuido futuro: si alguien agrega la contraseña al objeto de
    // progreso, no debe llegar al almacenamiento del navegador.
    saveProgress('user-1', {
      name: 'Maxi',
      password: 'Secreta123',
      accessToken: 'jwt',
      refreshToken: 'jwt-refresh',
    } as never);

    const crudo = sessionStorage.getItem(progressKey('user-1')!) ?? '';
    expect(crudo).not.toContain('Secreta123');
    expect(crudo).not.toContain('jwt');
    expect(crudo).toContain('Maxi');
  });

  it('descarta las aceptaciones si el texto cambió desde que se guardó', () => {
    // Dar por aceptado un texto que la persona no leyó es lo mismo que el servidor rechaza con
    // 409; el navegador no debería hacerlo por su cuenta.
    saveProgress('user-1', { step: 'terms', name: 'Maxi', accepted: { terms: true }, termsVersion: 'v1' });

    const recuperado = loadProgress('user-1', 'v2');
    expect(recuperado?.name).toBe('Maxi');
    expect(recuperado?.accepted).toBeUndefined();
  });

  it('no mezcla el avance de dos personas en la misma pestaña', () => {
    saveProgress('user-1', { name: 'Maxi', termsVersion: 'v1' });
    expect(loadProgress('user-2', 'v1')).toBeNull();
  });

  it('se borra al completar la activación', () => {
    saveProgress('user-1', { name: 'Maxi', termsVersion: 'v1' });
    clearProgress('user-1');
    expect(loadProgress('user-1', 'v1')).toBeNull();
  });

  it('un valor corrupto no impide activar la cuenta', () => {
    sessionStorage.setItem(progressKey('user-1')!, '{no es json');
    expect(loadProgress('user-1', 'v1')).toBeNull();
  });

  it('sin usuario no guarda ni lee nada', () => {
    saveProgress(undefined, { name: 'Maxi' });
    expect(sessionStorage.length).toBe(0);
    expect(loadProgress(undefined, 'v1')).toBeNull();
  });
});
