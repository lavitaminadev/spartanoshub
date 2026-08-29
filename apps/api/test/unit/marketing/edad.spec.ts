import { describe, expect, it } from 'vitest';
import { cumpleHoy, edadEn, puedeRecibirPorEdad } from '../../../src/modules/marketing/edad';

/**
 * Las dos preguntas que se le hacen a una fecha de nacimiento.
 *
 * Parecen triviales y no lo son: los años bisiestos y el cambio de año son donde se rompen las
 * cuentas de edad, y equivocarse significa felicitar el día que no o mandarle publicidad a un
 * menor que declaró serlo.
 */
describe('edad y cumpleaños', () => {
  describe('cumpleHoy', () => {
    it('reconoce el día, sin importar el año', () => {
      expect(cumpleHoy(new Date(1990, 7, 28), new Date(2026, 7, 28))).toBe(true);
    });

    it('no confunde el mismo día de otro mes', () => {
      expect(cumpleHoy(new Date(1990, 6, 28), new Date(2026, 7, 28))).toBe(false);
    });

    /*
     * No felicitar dejaría a esta persona sin saludo tres de cada cuatro años, y pareceria que el
     * sistema se olvidó de ella.
     */
    it('a quien nació un 29 de febrero se le felicita el 28 en año no bisiesto', () => {
      expect(cumpleHoy(new Date(2000, 1, 29), new Date(2026, 1, 28))).toBe(true);
    });

    it('en año bisiesto se le felicita el 29, no el 28', () => {
      expect(cumpleHoy(new Date(2000, 1, 29), new Date(2028, 1, 28))).toBe(false);
      expect(cumpleHoy(new Date(2000, 1, 29), new Date(2028, 1, 29))).toBe(true);
    });
  });

  describe('edadEn', () => {
    it('cuenta los años cumplidos', () => {
      expect(edadEn(new Date(2000, 7, 28), new Date(2026, 7, 28))).toBe(26);
    });

    /*
     * El caso que rompe la cuenta por milisegundos: los bisiestos hacen que la división dé 17,99
     * para alguien que cumplió 18 esta mañana.
     */
    it('el día del cumpleaños ya cuenta', () => {
      expect(edadEn(new Date(2008, 7, 28), new Date(2026, 7, 28))).toBe(18);
    });

    it('el día anterior todavía no', () => {
      expect(edadEn(new Date(2008, 7, 28), new Date(2026, 7, 27))).toBe(17);
    });

    it('sin fecha no hay edad, que no es lo mismo que cero', () => {
      expect(edadEn(null)).toBeNull();
      expect(edadEn(undefined)).toBeNull();
    });
  });

  describe('puedeRecibirPorEdad', () => {
    it('un mayor de edad puede', () => {
      expect(puedeRecibirPorEdad(new Date(1990, 0, 1), new Date(2026, 7, 28))).toBe(true);
    });

    it('quien declaró ser menor, no', () => {
      expect(puedeRecibirPorEdad(new Date(2015, 0, 1), new Date(2026, 7, 28))).toBe(false);
    });

    /*
     * Decisión deliberada: exigir la fecha dejaría fuera a toda la lista actual, recogida sin
     * preguntarla, y no hay indicio de que sean menores. Lo que se impide es escribirle a quien
     * declaró serlo.
     */
    it('quien no la declaró puede recibir', () => {
      expect(puedeRecibirPorEdad(null)).toBe(true);
    });

    it('justo al cumplir los 18 ya puede', () => {
      expect(puedeRecibirPorEdad(new Date(2008, 7, 28), new Date(2026, 7, 28))).toBe(true);
    });
  });
});
