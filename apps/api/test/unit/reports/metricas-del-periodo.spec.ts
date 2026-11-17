import { describe, expect, it } from 'vitest';
import { comoFecha, rangoDeComparacion, rangoDelMes } from '../../../src/modules/reports/metricas-del-periodo';

describe('el rango de un mes', () => {
  it('va del día uno al día uno del mes siguiente, con el fin excluido', () => {
    expect(rangoDelMes(2026, 3)).toEqual({ desde: '2026-03-01', hasta: '2026-04-01' });
  });

  it('cruza el año sin salirse', () => {
    expect(rangoDelMes(2026, 12)).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' });
  });

  /**
   * Febrero es la prueba de que el fin no se calcula sumando días.
   *
   * `new Date(year, month, 1)` deja que el calendario resuelva cuántos días tiene el mes. Sumar
   * 30 o 31 daría el 2 o el 3 de marzo, y el informe de febrero contaría reservas de marzo.
   */
  it('respeta los días reales de febrero, en año común y en bisiesto', () => {
    expect(rangoDelMes(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-03-01' });
    expect(rangoDelMes(2028, 2)).toEqual({ desde: '2028-02-01', hasta: '2028-03-01' });
  });
});

describe('contra qué se compara', () => {
  it('toma los mismos días inmediatamente antes, no el mes anterior', () => {
    // Catorce días se comparan con catorce: comparar una quincena contra un mes entero haría
    // bajar toda cifra sin que nada lo diga.
    expect(rangoDeComparacion('2026-03-15', '2026-03-29', 'anterior')).toEqual({ desde: '2026-03-01', hasta: '2026-03-15' });
  });

  it('para un mes completo, el período anterior es el mes anterior', () => {
    const { desde, hasta } = rangoDelMes(2026, 3);
    expect(rangoDeComparacion(desde, hasta, 'anterior')).toEqual({ desde: '2026-02-01', hasta: '2026-03-01' });
  });

  it('corre las dos fechas doce meses atrás cuando se compara con el año anterior', () => {
    expect(rangoDeComparacion('2026-12-01', '2027-01-01', 'ano_anterior')).toEqual({ desde: '2025-12-01', hasta: '2026-01-01' });
  });

  it('no devuelve rango cuando no se quiere comparar', () => {
    expect(rangoDeComparacion('2026-03-01', '2026-04-01', 'ninguna')).toBeNull();
  });

  /**
   * El 29 de febrero comparado con el año anterior.
   *
   * 2024 fue bisiesto y 2023 no, así que el mismo día del año anterior no existe. El calendario
   * lo resuelve rodando al 1 de marzo, que es lo que se quiere acá: un rango válido y de duración
   * comparable, en lugar de una fecha inventada o un error en una pantalla de lectura.
   */
  it('ante un 29 de febrero sin equivalente, entrega un rango válido', () => {
    const rango = rangoDeComparacion('2024-02-29', '2024-03-31', 'ano_anterior');
    expect(rango).toEqual({ desde: '2023-03-01', hasta: '2023-03-31' });
  });
});

describe('cómo se escribe una fecha', () => {
  /**
   * En hora local y no en UTC.
   *
   * `toISOString()` pasa a UTC, y en Chile eso corre el día hacia atrás: el primero del mes se
   * escribiría como el último del anterior, y el rango del informe empezaría un día antes.
   */
  it('usa el día local, sin correrlo por la zona horaria', () => {
    expect(comoFecha(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
    expect(comoFecha(new Date(2026, 11, 31, 23, 45))).toBe('2026-12-31');
  });
});

/**
 * El caso que encontró esta prueba.
 *
 * `rangoDeComparacion` restaba la duración, así que marzo —31 días— se comparaba contra el 29 de
 * enero al 1 de marzo: todo febrero más tres días de enero. El informe mensual de cualquier mes
 * de 31 días habría mostrado una comparación inflada, y nada en la pantalla lo habría dicho.
 */
describe('un mes completo no se compara restando días', () => {
  it('cada mes de 31 días se compara con el mes anterior entero, y nada más', () => {
    for (const mes of [1, 3, 5, 7, 8, 10, 12]) {
      const { desde, hasta } = rangoDelMes(2026, mes);
      const previo = rangoDeComparacion(desde, hasta, 'anterior')!;
      expect(previo.hasta, `mes ${mes}`).toBe(desde);
      expect(previo.desde.endsWith('-01'), `mes ${mes}`).toBe(true);
    }
  });

  it('enero se compara con diciembre del año anterior', () => {
    const { desde, hasta } = rangoDelMes(2026, 1);
    expect(rangoDeComparacion(desde, hasta, 'anterior')).toEqual({ desde: '2025-12-01', hasta: '2026-01-01' });
  });

  it('un rango que no es un mes sigue comparándose con sus mismos días', () => {
    expect(rangoDeComparacion('2026-03-10', '2026-03-20', 'anterior')).toEqual({ desde: '2026-02-28', hasta: '2026-03-10' });
  });
});
