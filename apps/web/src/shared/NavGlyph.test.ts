/**
 * @fileoverview Comprueba que el monograma del menú siga siendo un identificador.
 *
 * El glifo se deriva de la etiqueta, así que renombrar una entrada sin actualizar el mapa hace
 * caer el respaldo `label.slice(0, 2)`. Eso no rompe nada visible de inmediato: la aplicación
 * sigue funcionando y el menú sigue apareciendo, solo que dos entradas distintas pasan a
 * mostrar el mismo par de letras. Estas pruebas convierten ese fallo silencioso en uno ruidoso.
 */

import { describe, expect, it } from 'vitest';
import { glyphFor } from './NavGlyph';
import { getFeatures } from '../core/navigation.registry';

// Los manifiestos se registran al importarse; sin esto el registro está vacío en la prueba.
const manifests = import.meta.glob('../features/*/feature.manifest.ts', { eager: true });

/** Etiquetas del portal de cliente, declaradas aparte de los manifiestos. */
const CLIENT_LABELS = ['Inicio', 'Reservas', 'Grilla', 'Aprobaciones', 'Reuniones', 'Informes'];

function navLabels(): string[] {
  const fromFeatures = getFeatures().flatMap((feature) => feature.navigation).map((item) => item.label);
  return [...new Set([...fromFeatures, ...CLIENT_LABELS])];
}

describe('monogramas del menú', () => {
  it('carga los manifiestos de features', () => {
    expect(Object.keys(manifests).length).toBeGreaterThan(0);
    expect(navLabels().length).toBeGreaterThan(0);
  });

  it('toda etiqueta del menú declara su monograma', () => {
    const sinGlifo = navLabels().filter((label) => glyphFor(label) === undefined);
    expect(sinGlifo, `sin monograma declarado: ${sinGlifo.join(', ')}`).toEqual([]);
  });

  it('ningún monograma se repite entre dos entradas', () => {
    const porGlifo = new Map<string, string[]>();
    for (const label of navLabels()) {
      const glifo = glyphFor(label) ?? label.slice(0, 2).toUpperCase();
      porGlifo.set(glifo, [...(porGlifo.get(glifo) ?? []), label]);
    }
    const choques = [...porGlifo.entries()].filter(([, labels]) => labels.length > 1);
    const detalle = choques.map(([glifo, labels]) => `${glifo}: ${labels.join(' / ')}`).join(' · ');
    expect(choques, `monogramas repetidos → ${detalle}`).toEqual([]);
  });
});
