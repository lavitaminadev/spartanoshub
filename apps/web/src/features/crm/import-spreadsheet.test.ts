import { describe, expect, it } from 'vitest';
import { sheetRowsToRecords } from './import-spreadsheet';

describe('lectura de Excel para CRM', () => {
  it('usa la primera fila como encabezado y conserva los datos de Meta', () => {
    const parsed = sheetRowsToRecords([
      ['full_name', 'email', 'phone_number', 'created_time'],
      ['Ana Meta', 'ana@example.com', 56912345678, new Date('2026-08-24T12:00:00Z')],
      [null, null, null, null],
    ]);
    expect(parsed.headers).toEqual(['full_name', 'email', 'phone_number', 'created_time']);
    expect(parsed.rows).toEqual([{
      full_name: 'Ana Meta', email: 'ana@example.com', phone_number: '56912345678',
      created_time: '2026-08-24T12:00:00.000Z',
    }]);
  });

  it('mantiene la posición aunque haya una columna sin encabezado', () => {
    expect(sheetRowsToRecords([
      ['Nombre', null, 'Correo'],
      ['Beto', 'ignorar', 'beto@example.com'],
    ]).rows[0]).toEqual({ Nombre: 'Beto', Correo: 'beto@example.com' });
  });
});
