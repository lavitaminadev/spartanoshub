import { describe, expect, it } from 'vitest';
import { cumpleHoy, diaDelAnoEn, edadEn, puedeRecibirPorEdad } from '../../../src/modules/marketing/edad';

/**
 * Las dos preguntas que se le hacen a una fecha de nacimiento.
 *
 * Parecen triviales y no lo son: los años bisiestos y el cambio de año son donde se rompen las
 * cuentas de edad, y equivocarse significa felicitar el día que no o mandarle publicidad a un
 * menor que declaró serlo.
 */
describe('edad y cumpleaños', () => {
  /*
   * El «hoy» va a mediodía a propósito.
   *
   * `cumpleHoy` decide el día en la zona del negocio. Una medianoche construida con la hora local
   * de la máquina cae en días distintos según dónde corran las pruebas: en Santiago es el día
   * pedido, y en el servidor de integración —que corre en UTC— son las nueve de la noche del día
   * anterior en Chile. Al mediodía las dos zonas coinciden.
   */
  const mediodia = (ano: number, mes: number, dia: number) => new Date(ano, mes, dia, 12);

  describe('cumpleHoy', () => {
    it('reconoce el día, sin importar el año', () => {
      expect(cumpleHoy(new Date(1990, 7, 28), mediodia(2026, 7, 28))).toBe(true);
    });

    it('no confunde el mismo día de otro mes', () => {
      expect(cumpleHoy(new Date(1990, 6, 28), mediodia(2026, 7, 28))).toBe(false);
    });

    /*
     * No felicitar dejaría a esta persona sin saludo tres de cada cuatro años, y pareceria que el
     * sistema se olvidó de ella.
     */
    it('a quien nació un 29 de febrero se le felicita el 28 en año no bisiesto', () => {
      expect(cumpleHoy(new Date(2000, 1, 29), mediodia(2026, 1, 28))).toBe(true);
    });

    it('en año bisiesto se le felicita el 29, no el 28', () => {
      expect(cumpleHoy(new Date(2000, 1, 29), mediodia(2028, 1, 28))).toBe(false);
      expect(cumpleHoy(new Date(2000, 1, 29), mediodia(2028, 1, 29))).toBe(true);
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


/*
 * Qué día es «hoy» cuando el servidor está en otro huso.
 *
 * El proceso corre en UTC y el negocio está en Chile: entre las nueve de la noche y la medianoche
 * de allá, el servidor ya pasó al día siguiente. Preguntándole a él, el saludo salía un día antes
 * si el trabajo caía en esa franja —y la hora a la que cae depende de cuándo arrancó el servidor,
 * así que no es algo que se compruebe una vez y quede resuelto—.
 *
 * Las zonas van escritas en cada prueba a propósito: si dependieran de la máquina que las ejecuta,
 * pasarían en el portátil de Santiago y no dirían nada del servidor, que es donde ocurre el fallo.
 */
describe('el día es el del negocio, no el del servidor', () => {
  // El mismo instante: 28 de agosto a las 23:30 en Santiago, ya 29 en UTC.
  const nocheDel28EnChile = new Date('2026-08-29T03:30:00Z');

  it('diaDelAnoEn responde según la zona que se le pida', () => {
    expect(diaDelAnoEn(nocheDel28EnChile, 'America/Santiago')).toEqual({ ano: 2026, mes: 7, dia: 28 });
    expect(diaDelAnoEn(nocheDel28EnChile, 'UTC')).toEqual({ ano: 2026, mes: 7, dia: 29 });
  });

  it('a las 23:30 de Chile todavía se felicita a quien cumple ese día', () => {
    expect(cumpleHoy(new Date(1990, 7, 28), nocheDel28EnChile, 'America/Santiago')).toBe(true);
    // Con la fecha del servidor —UTC— ese saludo no salía: para él ya era el 29.
    expect(cumpleHoy(new Date(1990, 7, 28), nocheDel28EnChile, 'UTC')).toBe(false);
  });

  it('y no se adelanta el saludo de quien cumple al día siguiente', () => {
    expect(cumpleHoy(new Date(1990, 7, 29), nocheDel28EnChile, 'America/Santiago')).toBe(false);
    // Que es justo lo que hacía con la zona del servidor.
    expect(cumpleHoy(new Date(1990, 7, 29), nocheDel28EnChile, 'UTC')).toBe(true);
  });

  it('de madrugada en Chile, cuando las dos zonas coinciden, no cambia nada', () => {
    const manana = new Date('2026-08-28T13:00:00Z');
    expect(cumpleHoy(new Date(1990, 7, 28), manana, 'America/Santiago')).toBe(true);
    expect(cumpleHoy(new Date(1990, 7, 28), manana, 'UTC')).toBe(true);
  });
});
