/**
 * Qué se garantiza: los valores se guardan en su forma canónica, guardar un campo no borra los
 * demás, lo archivado se conserva sin poder editarse, lo obligatorio sólo se exige a una persona,
 * y cambiar el tipo de un campo no puede romper lo ya guardado sin avisarlo.
 */

import { describe, expect, it } from 'vitest';
import {
  claveDesdeEtiqueta, normalizarValor, problemaDeClave, validarCamposPersonalizados, valoresQueSeRomperian,
  type CustomFieldDefinition,
} from '@espartanos/shared';

function campo(parcial: Partial<CustomFieldDefinition> & Pick<CustomFieldDefinition, 'key' | 'type'>): CustomFieldDefinition {
  return { id: parcial.key, entity: 'lead', label: parcial.key, required: false, position: 0, options: null, archivedAt: null, ...parcial };
}

const CAMPOS = [
  campo({ key: 'canal', label: 'Canal', type: 'select', options: ['WhatsApp', 'Correo'] }),
  campo({ key: 'personas', label: 'Personas', type: 'number' }),
  campo({ key: 'intereses', label: 'Intereses', type: 'multi_select', options: ['Cumpleaños', 'Empresa'] }),
  campo({ key: 'viejo', label: 'Viejo', type: 'text', archivedAt: '2026-01-01T00:00:00Z' }),
  campo({ key: 'rut', label: 'RUT', type: 'text', required: true }),
];

describe('claves', () => {
  it('arma claves legibles, sin tildes y sin chocar con datos propios', () => {
    expect(claveDesdeEtiqueta('Canal preferido')).toBe('canal_preferido');
    expect(claveDesdeEtiqueta('Año de fundación')).toBe('ano_de_fundacion');
    expect(claveDesdeEtiqueta('Email')).toBe('email_propio');
    expect(claveDesdeEtiqueta('2do contacto')).toMatch(/^campo_/);
  });

  it('rechaza claves con formato inválido o reservadas', () => {
    expect(problemaDeClave('canal_preferido')).toBeNull();
    expect(problemaDeClave('Canal')).not.toBeNull();
    expect(problemaDeClave('status')).toContain('ya es un dato propio');
  });
});

describe('normalizarValor', () => {
  it('acepta las formas en que llega un número y guarda un número', () => {
    expect(normalizarValor({ type: 'number', label: 'N' }, '1 234,5')).toEqual({ ok: true, valor: 1234.5 });
    expect(normalizarValor({ type: 'number', label: 'N' }, 'doce').ok).toBe(false);
  });

  it('valida fechas de verdad, no sólo su forma', () => {
    expect(normalizarValor({ type: 'date', label: 'F' }, '2026-02-28')).toEqual({ ok: true, valor: '2026-02-28' });
    expect(normalizarValor({ type: 'date', label: 'F' }, '2026-02-30').ok).toBe(false);
  });

  it('entiende sí/no escritos de varias formas', () => {
    expect(normalizarValor({ type: 'boolean', label: 'B' }, 'Sí')).toEqual({ ok: true, valor: true });
    expect(normalizarValor({ type: 'boolean', label: 'B' }, '0')).toEqual({ ok: true, valor: false });
    expect(normalizarValor({ type: 'boolean', label: 'B' }, 'quizás').ok).toBe(false);
  });

  it('exige que las opciones existan, y quita repetidas', () => {
    expect(normalizarValor(CAMPOS[2], 'Empresa;Empresa;Cumpleaños')).toEqual({ ok: true, valor: ['Empresa', 'Cumpleaños'] });
    expect(normalizarValor(CAMPOS[0], 'Teléfono').ok).toBe(false);
  });
});

describe('validarCamposPersonalizados', () => {
  /* Regla 3: si Meta reenvía un lead, lo que el equipo escribió a mano no puede desaparecer. */
  it('guardar un campo no borra los demás', () => {
    const { valores, errores } = validarCamposPersonalizados(CAMPOS, { canal: 'WhatsApp', personas: 4 }, { personas: '6' }, { exigirObligatorios: false });
    expect(errores).toEqual([]);
    expect(valores).toEqual({ canal: 'WhatsApp', personas: 6 });
  });

  it('un valor vacío borra sólo ese campo', () => {
    const { valores } = validarCamposPersonalizados(CAMPOS, { canal: 'WhatsApp', personas: 4 }, { canal: '' }, { exigirObligatorios: false });
    expect(valores).toEqual({ personas: 4 });
  });

  /* Regla 2: archivar no borra lo guardado. */
  it('conserva el valor de un campo archivado pero no deja escribirlo', () => {
    const { valores, errores } = validarCamposPersonalizados(CAMPOS, { viejo: 'dato histórico' }, { viejo: 'otro' }, { exigirObligatorios: false });
    expect(valores.viejo).toBe('dato histórico');
    expect(errores[0]).toContain('archivado');
  });

  /* Regla 4: un lead de Meta o de una importación no rebota por un campo que su origen no tiene. */
  it('exige lo obligatorio sólo cuando edita una persona', () => {
    expect(validarCamposPersonalizados(CAMPOS, {}, {}, { exigirObligatorios: false }).errores).toEqual([]);
    expect(validarCamposPersonalizados(CAMPOS, {}, {}, { exigirObligatorios: true }).errores).toEqual(['Falta completar «RUT»']);
  });

  it('no exige un obligatorio que está archivado', () => {
    const archivado = CAMPOS.map((def) => (def.key === 'rut' ? { ...def, archivedAt: '2026-01-01T00:00:00Z' } : def));
    expect(validarCamposPersonalizados(archivado, {}, {}, { exigirObligatorios: true }).errores).toEqual([]);
  });

  it('rechaza campos que no existen', () => {
    expect(validarCamposPersonalizados(CAMPOS, {}, { inventado: 'x' }, { exigirObligatorios: false }).errores[0]).toContain('no existe');
  });
});

describe('valoresQueSeRomperian', () => {
  it('cuenta lo guardado que dejaría de ser válido con el tipo nuevo', () => {
    const guardados = [{ edad: '34' }, { edad: 'entre 5 y 10' }, {}, null];
    expect(valoresQueSeRomperian({ key: 'edad', type: 'text', label: 'Edad' }, 'number', null, guardados)).toBe(1);
  });

  it('quitar una opción en uso cuenta como romper', () => {
    const guardados = [{ canal: 'Correo' }, { canal: 'WhatsApp' }];
    expect(valoresQueSeRomperian(CAMPOS[0], 'select', ['WhatsApp'], guardados)).toBe(1);
  });
});
