import { describe, expect, it } from 'vitest';
import { buildCsv } from './to-csv';
import { fileNameWithDate } from './document';
import type { ExportDocument } from './document';

/**
 * Un CSV se abre casi siempre en Excel, y Excel falla de maneras poco obvias. Cada prueba de acá
 * fija la corrección de un fallo concreto que se ve al abrir el archivo, no una preferencia.
 */
interface Fila { nombre: string; monto: number; telefono?: string }

function documento(rows: Fila[], extra: Partial<ExportDocument<Fila>> = {}): ExportDocument<Fila> {
  return {
    fileName: 'leads',
    title: 'Leads del embudo',
    columns: [
      { header: 'Nombre', value: (f) => f.nombre },
      { header: 'Monto', value: (f) => f.monto, align: 'right' },
      { header: 'Teléfono', value: (f) => f.telefono },
    ],
    rows,
    ...extra,
  };
}

describe('generación de CSV', () => {
  /** Con coma, Excel en español abre todo el archivo apilado en una sola columna. */
  it('separa con punto y coma', () => {
    const csv = buildCsv(documento([{ nombre: 'Ana', monto: 1000 }]));
    expect(csv).toContain('Nombre;Monto;Teléfono');
  });

  /** Sin entrecomillar, un nombre con coma parte la fila y desplaza todo lo que sigue. */
  it('entrecomilla lo que contiene el separador', () => {
    const csv = buildCsv(documento([{ nombre: 'Pérez, Ana', monto: 1 }]));
    expect(csv).toContain('"Pérez, Ana"');
  });

  it('duplica las comillas internas, que es como el formato las representa', () => {
    const csv = buildCsv(documento([{ nombre: 'El "Rojo"', monto: 1 }]));
    expect(csv).toContain('"El ""Rojo"""');
  });

  /**
   * La garantía de seguridad: Excel ejecuta como fórmula toda celda que empiece por `=`, `+`, `-`
   * o `@`. Con datos que vienen de un formulario público, eso es una vía para dejar una fórmula
   * lista para correr en el equipo de quien abra el archivo.
   */
  it('neutraliza las celdas que Excel tomaría por fórmula', () => {
    const csv = buildCsv(documento([{ nombre: '=SUM(A1:A9)', monto: 1, telefono: '+56912345678' }]));
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(csv).toContain("'+56912345678");
  });

  /** «null» impreso en una celda se lee como un dato, no como su ausencia. */
  it('deja vacía la celda de un valor ausente', () => {
    const csv = buildCsv(documento([{ nombre: 'Ana', monto: 0 }]));
    expect(csv).not.toMatch(/null|undefined/);
    expect(csv.trim().split('\r\n').pop()).toBe('Ana;0;');
  });

  /**
   * El archivo se lee semanas después, fuera de la pantalla que lo generó: sin el filtro anotado
   * nadie sabe si son todas las filas o solo las de un cliente.
   */
  it('escribe el contexto antes de los encabezados', () => {
    const csv = buildCsv(documento([{ nombre: 'Ana', monto: 1 }], {
      subtitle: 'Últimos 30 días',
      meta: [{ label: 'Cliente', value: 'Cocina Norte' }],
    }));
    const lineas = csv.split('\r\n');

    expect(lineas[0]).toBe('Leads del embudo');
    expect(lineas[1]).toBe('Últimos 30 días');
    expect(lineas[2]).toBe('Cliente;Cocina Norte');
    expect(lineas.indexOf('Nombre;Monto;Teléfono')).toBeGreaterThan(2);
  });

  it('usa saltos de línea de Windows, que es lo que Excel espera', () => {
    expect(buildCsv(documento([{ nombre: 'Ana', monto: 1 }]))).toContain('\r\n');
  });

  it('exporta encabezados aunque no haya filas', () => {
    expect(buildCsv(documento([]))).toContain('Nombre;Monto;Teléfono');
  });
});

describe('nombre del archivo', () => {
  /** Sin fecha, el navegador numera las descargas repetidas y no se sabe cuál es de cuándo. */
  it('agrega la fecha del día', () => {
    expect(fileNameWithDate('Leads', 'csv')).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('quita acentos y caracteres que el sistema de archivos rechaza', () => {
    expect(fileNameWithDate('Reporte de Camión / Ñuñoa', 'pdf')).toMatch(/^reporte-de-camion-nunoa-/);
  });

  it('nunca devuelve un nombre vacío', () => {
    expect(fileNameWithDate('///', 'csv')).toMatch(/^export-/);
  });
});
