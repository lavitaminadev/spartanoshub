import { describe, expect, it } from 'vitest';
import {
  hashearTodos,
  normalizarCorreo,
  normalizarTelefono,
} from '../../../src/modules/integrations/meta/identificadores-meta';

/**
 * Los ejemplos que publica Meta, comprobados contra nuestro código.
 *
 * Vienen del CSV de datos normalizados y cifrados que acompaña a la documentación de parámetros
 * de información del cliente. Son la única forma de saber que la normalización es la que ellos
 * esperan y no la que nos parece razonable: un digest distinto se acepta igual y simplemente no
 * empareja con nadie, así que el error no se ve por ningún otro medio.
 */
describe('vectores oficiales de Meta', () => {
  it.each([
    ['     John_Smith@gmail.com    ', '62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f'],
    ['someone@domain.com', '508a7286f88555648990c08a1002657a28ba330379e8b47f3291120e6c80580d'],
    ['    SomeOne@domain.com  ', '508a7286f88555648990c08a1002657a28ba330379e8b47f3291120e6c80580d'],
  ])('correo %s produce el digest que Meta publica', (entrada, esperado) => {
    expect(hashearTodos([entrada], normalizarCorreo)).toEqual([esperado]);
  });

  it('un correo ya hasheado pasa intacto, como indica el propio CSV', () => {
    const digest = '8df99a46f811595e1a1de5016e2445bc202f72b946482032a75aec528a0a350d';
    expect(hashearTodos([digest], normalizarCorreo)).toEqual([digest]);
  });

  it.each([
    ['+1 (616) 954-78 88', 'bb2fa2e6d2cea4746530c99686d0c7886ab2019875dca2d7e9e171c0e6ada00d'],
    // El mismo número con ceros a la izquierda: Meta los ignora y nosotros también.
    ['+001 (616) 954-78 88', 'bb2fa2e6d2cea4746530c99686d0c7886ab2019875dca2d7e9e171c0e6ada00d'],
    ['+1(650)123-4567', '1f41a6876308cc581e7c096db4b342524d51f06f1df35537e30859e3956b5e89'],
  ])('teléfono %s produce el digest que Meta publica', (entrada, esperado) => {
    expect(hashearTodos([entrada], normalizarTelefono)).toEqual([esperado]);
  });

  /*
   * El número chileno escrito como lo escribe la gente.
   *
   * Meta exige el código de país siempre, incluso cuando todos los datos son del mismo país. Un
   * `912345678` sin prefijo produce un hash que no empareja, y es la forma en que el número llega
   * desde la mitad de los formularios.
   */
  it('un número local chileno sale con el código de país y sin signos', () => {
    for (const entrada of ['912345678', '+56 9 1234 5678', '0912345678', '(56) 9-1234-5678']) {
      expect(normalizarTelefono(entrada)).toBe('56912345678');
    }
  });
});
