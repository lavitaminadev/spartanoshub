import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Una etapa apagada desaparece de los cuatro sitios, columnas del tablero incluidas.
 *
 * `etapasDelEmbudo` descuenta las etapas que la empresa decidió no usar, y su comentario dice
 * que de ahí salen las columnas. No era cierto: las columnas se construían recorriendo el
 * catálogo completo, así que apagar «Visita agendada» la quitaba del filtro y de los
 * desplegables de mover, y la dejaba dibujada en el tablero.
 *
 * Se comprueba sobre el texto del componente porque el fallo es de procedencia —de qué lista
 * sale cada cosa—, y montarlo exigiría simular el servidor entero para observar lo mismo.
 */
const ARCHIVO = join(__dirname, 'LeadsBoardPage.tsx');

describe('etapas apagadas por la empresa', () => {
  const fuente = readFileSync(ARCHIVO, 'utf8');

  it('las columnas del tablero salen de la lista ya filtrada', () => {
    const columnas = fuente.slice(fuente.indexOf('const columnas = useMemo'));
    const cuerpo = columnas.slice(0, columnas.indexOf('  );'));

    expect(cuerpo).toContain('etapasDelEmbudo');
  });

  it('las columnas no recorren el catálogo completo por su cuenta', () => {
    // `STAGES` se usa una sola vez, para construir la lista que después se filtra.
    const veces = fuente.split('STAGES').length - 1;

    // Una en el import y una en `etapasDelEmbudo`. Una tercera sería una lista paralela.
    expect(veces).toBe(2);
  });

  it('recalcula cuando cambia lo que la empresa apagó', () => {
    const columnas = fuente.slice(fuente.indexOf('const columnas = useMemo'));
    const cuerpo = columnas.slice(0, columnas.indexOf('  );'));
    // Las dependencias son la última lista del bloque, después del cuerpo de la función.
    const dependencias = cuerpo.slice(cuerpo.lastIndexOf('['));

    // Sin esta dependencia el tablero conserva las columnas viejas hasta que algo más lo redibuje.
    expect(dependencias).toContain('etapasDelEmbudo');
  });
});
