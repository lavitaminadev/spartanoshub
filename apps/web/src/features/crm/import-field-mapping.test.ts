import { describe, expect, it } from 'vitest';
import { guessField, guessMapping, normalizeHeader } from './import-field-mapping';

/**
 * El mapeo es por nombre de columna y no por posición, así que el orden del archivo da igual. Lo
 * que se prueba acá es que reconozca las formas en que un sistema u otro nombra lo mismo: con
 * coincidencia exacta, cada planilla exportada de otra herramienta obliga a mapear a mano.
 */
describe('reconocimiento de columnas al importar', () => {
  it('reconoce el mismo campo escrito de cualquier forma', () => {
    for (const header of ['Teléfono', 'TELEFONO', 'telefono_movil', 'Teléfono / Móvil', 'phone number']) {
      expect(guessField(header), header).toBe('phone');
    }
  });

  it('reconoce nombre y correo en español y en inglés', () => {
    expect(guessField('Nombre completo')).toBe('name');
    expect(guessField('Full Name')).toBe('name');
    expect(guessField('Correo electrónico')).toBe('email');
    expect(guessField('E-Mail Address')).toBe('email');
  });

  /** Una columna llamada exactamente «nombre» es el nombre, aunque «contacto» sea del teléfono. */
  it('la coincidencia exacta manda sobre la parcial', () => {
    expect(guessField('nombre')).toBe('name');
    expect(guessField('contacto')).toBe('phone');
  });

  it('deja sin asignar lo que no reconoce, en vez de adivinar mal', () => {
    expect(guessField('Columna 7')).toBe('');
    expect(guessField('xyz')).toBe('');
    expect(guessField('   ')).toBe('');
  });

  /**
   * El orden del archivo no puede importar: es la razón de mapear por nombre. Dos planillas con
   * las mismas columnas en distinto orden deben producir el mismo mapeo.
   */
  it('produce el mismo mapeo con las columnas en cualquier orden', () => {
    const directo = guessMapping(['Nombre', 'Correo', 'Teléfono', 'Empresa']);
    const invertido = guessMapping(['Empresa', 'Teléfono', 'Correo', 'Nombre']);

    expect(directo.Nombre).toBe('name');
    expect(invertido.Nombre).toBe('name');
    expect(directo['Teléfono']).toBe(invertido['Teléfono']);
    expect(directo.Empresa).toBe(invertido.Empresa);
  });

  /**
   * Sin esta regla la segunda columna parecida pisaba a la primera y se importaba el dato
   * equivocado sin aviso.
   */
  it('no asigna el mismo campo a dos columnas', () => {
    const mapeo = guessMapping(['Teléfono', 'Teléfono secundario']);
    expect(mapeo['Teléfono']).toBe('phone');
    expect(mapeo['Teléfono secundario']).toBe('');
  });

  it('normaliza acentos, mayúsculas y separadores', () => {
    expect(normalizeHeader('Razón Social')).toBe('razonsocial');
    expect(normalizeHeader('E-Mail_Address ')).toBe('emailaddress');
  });

  it('mapea una planilla real de otro sistema sin intervención', () => {
    const mapeo = guessMapping(['full_name', 'email_address', 'phone_number', 'company_name', 'notes']);
    expect(Object.values(mapeo)).toEqual(['name', 'email', 'phone', 'company', 'notes']);
  });
});
