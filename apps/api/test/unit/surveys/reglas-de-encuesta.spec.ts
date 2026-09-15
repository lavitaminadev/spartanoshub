import { describe, expect, it } from 'vitest';
import type { SurveyQuestion } from '@espartanos/shared';
import { errorDeDato, formatearRut, ordenarParaMostrar, pideDatosPersonales, preguntasVisibles, problemasDeRespuesta, rutValido, traeDatosPersonales } from '@espartanos/shared';
import { aceptacionAGuardar, consentimientoDeEncuesta, contactoEscrito } from '../../../src/modules/surveys/consentimiento-de-encuesta';
import { obligatoriasPendientes } from '../../../src/modules/surveys/flujo-de-encuesta';

const PREGUNTAS: SurveyQuestion[] = [
  { id: 'nota', type: 'rating', question: '¿Cómo fue?', required: true },
  { id: 'fallo', type: 'multiple-choice', question: '¿Qué falló?', required: true, options: ['Atención', 'Comida'], mostrarSi: { preguntaId: 'nota', valores: ['1', '2', '3'] } },
  { id: 'detalle', type: 'text', question: 'Cuéntanos', required: true, mostrarSi: { preguntaId: 'fallo', valores: ['Comida'] } },
  { id: 'dato-correo', type: 'text', question: 'Tu correo', required: false, dato: 'correo' },
  { id: 'dato-rut', type: 'text', question: 'Tu RUT', required: false, dato: 'rut' },
];

describe('reglas de encuesta', () => {
  it('muestra una pregunta sólo con los valores elegidos, y en cadena', () => {
    expect(preguntasVisibles(PREGUNTAS, { nota: 5 }).map((p) => p.id)).toEqual(['nota', 'dato-correo', 'dato-rut']);
    expect(preguntasVisibles(PREGUNTAS, { nota: 2 }).map((p) => p.id)).toEqual(['nota', 'fallo', 'dato-correo', 'dato-rut']);
    expect(preguntasVisibles(PREGUNTAS, { nota: 2, fallo: 'Comida' }).map((p) => p.id)).toContain('detalle');
    // Si el origen queda oculto, lo que depende de él también, aunque tenga respuesta guardada.
    expect(preguntasVisibles(PREGUNTAS, { nota: 5, fallo: 'Comida' }).map((p) => p.id)).not.toContain('detalle');
  });

  it('no exige obligatorias ocultas', () => {
    expect(problemasDeRespuesta(PREGUNTAS, { nota: 5 })).toEqual([]);
    expect(problemasDeRespuesta(PREGUNTAS, { nota: 1 })).toEqual(['Falta: ¿Qué falló?']);
    expect(obligatoriasPendientes(PREGUNTAS, { nota: 5 })).toEqual([]);
    expect(obligatoriasPendientes(PREGUNTAS, { nota: 1 })).toEqual(['¿Qué falló?']);
  });

  it('valida RUT, correo y teléfono', () => {
    expect(rutValido('12.345.678-5')).toBe(true);
    expect(rutValido('12.345.678-9')).toBe(false);
    expect(rutValido('7654321-6')).toBe(true);
    expect(formatearRut('123456785')).toBe('12.345.678-5');
    expect(errorDeDato('correo', 'sin-arroba')).toBe('El correo no es válido');
    expect(errorDeDato('telefono', '123')).toBe('El teléfono no es válido');
    expect(errorDeDato('rut', '')).toBeNull();
    expect(problemasDeRespuesta(PREGUNTAS, { nota: 5, 'dato-rut': '11.111.111-2' })).toEqual(['El RUT no es válido']);
  });

  it('distingue si la encuesta pide datos y si la respuesta los trae', () => {
    expect(pideDatosPersonales(PREGUNTAS)).toBe(true);
    expect(traeDatosPersonales(PREGUNTAS, { nota: 5 })).toBe(false);
    expect(traeDatosPersonales(PREGUNTAS, { nota: 5, 'dato-correo': 'a@b.cl' })).toBe(true);
  });
});

describe('datos de quien responde', () => {
  it('valida la fecha de nacimiento', () => {
    expect(errorDeDato('nacimiento', '1990-05-20')).toBeNull();
    expect(errorDeDato('nacimiento', '1990-02-30')).toBe('La fecha de nacimiento no es válida');
    expect(errorDeDato('nacimiento', '1850-01-01')).toBe('La fecha de nacimiento no es válida');
    expect(errorDeDato('nacimiento', '3000-01-01')).toBe('La fecha de nacimiento no es válida');
  });

  it('muestra los datos primero y en orden fijo, sin cambiar el orden de las preguntas', () => {
    const lista: SurveyQuestion[] = [
      { id: 'a', type: 'rating', question: 'A', required: true },
      { id: 't', type: 'text', question: 'Tel', required: false, dato: 'telefono' },
      { id: 'b', type: 'text', question: 'B', required: false },
      { id: 'n', type: 'text', question: 'Nombre', required: false, dato: 'nombre' },
      { id: 'f', type: 'text', question: 'Nac', required: false, dato: 'nacimiento' },
    ];
    expect(ordenarParaMostrar(lista).map((p) => p.id)).toEqual(['n', 'f', 't', 'a', 'b']);
  });
});

describe('aceptación de datos en encuestas', () => {
  const db = { query: async () => [{ name: 'Casa', legal_name: 'Casa SpA', tax_id: '76.086.428-5', privacy_email: 'priv@casa.cl', privacy_url: 'https://casa.cl/p', legal_mode: 'enlace', privacy_text: null }] };

  it('arma el texto con la empresa responsable y Espartanos como encargado', async () => {
    const c = await consentimientoDeEncuesta(db, { clientId: 'c1', questions: PREGUNTAS });
    expect(c?.responsable).toBe('Casa SpA, RUT 76.086.428-5 («Casa»)');
    expect(c?.identidad).toEqual({ razonSocial: 'Casa SpA', rut: '76.086.428-5', correo: 'priv@casa.cl', nombreComercial: 'Casa' });
    expect(c?.texto).toContain('Agencia de Protección de Datos Personales');
    expect(c?.texto).toContain('priv@casa.cl');
    expect(c?.texto).toContain('por encargo de Casa SpA, RUT 76.086.428-5');
    expect(c?.privacyUrl).toBe('https://casa.cl/p');
    expect(await consentimientoDeEncuesta(db, { clientId: 'c1', questions: [PREGUNTAS[0]] })).toBeNull();
  });

  it('exige aceptar sólo cuando se envían datos, y guarda el texto', async () => {
    await expect(aceptacionAGuardar(db, { clientId: 'c1', questions: PREGUNTAS }, { nota: 5 }, undefined)).resolves.toEqual({});
    await expect(aceptacionAGuardar(db, { clientId: 'c1', questions: PREGUNTAS }, { 'dato-correo': 'a@b.cl' }, false)).rejects.toThrow('aceptar');
    const guardado = await aceptacionAGuardar(db, { clientId: 'c1', questions: PREGUNTAS }, { 'dato-correo': 'a@b.cl' }, true);
    expect(guardado.privacyConsentText).toMatch(/^\[survey-v2\] Acepto que Casa SpA/);
    expect(guardado.privacyConsentAt).toBeInstanceOf(Date);
  });

  it('lee nombre y correo escritos para identificar la respuesta', () => {
    expect(contactoEscrito(PREGUNTAS, { 'dato-correo': ' a@b.cl ' })).toEqual({ nombre: undefined, correo: 'a@b.cl' });
  });
});
