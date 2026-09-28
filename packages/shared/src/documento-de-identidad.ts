/**
 * @fileoverview Documento de identidad: RUT o pasaporte, siempre guardado igual.
 *
 * El RUT sólo lo tienen quienes viven en Chile. Un campo que aceptara únicamente RUT dejaba sin
 * poder reservar a cualquier turista si el local lo marcaba obligatorio. Por eso el documento
 * es de dos tipos:
 *
 * - **RUT**: se comprueba el dígito verificador y se guarda sin puntos, con guion y la K en
 *   mayúscula. `12.345.678-9`, `12345678-9` y `123456789` quedan iguales.
 * - **Pasaporte u otro documento extranjero**: no hay dígito que comprobar, así que se guarda en
 *   mayúsculas, sin espacios ni signos, **junto con el país que lo emitió**: dos países pueden dar
 *   el mismo número a personas distintas.
 *
 * Entre el navegador y el servidor viaja como texto —`rut:12345678-9` o `pasaporte:AR:AB123456`—
 * y no como objeto, porque las respuestas del formulario se leen como texto en exportaciones,
 * correos y notas: un objeto ahí saldría como «[object Object]».
 */

import { rutValido } from './survey-rules';

export type TipoDeDocumento = 'rut' | 'pasaporte';

export interface DocumentoDeIdentidad {
  tipo: TipoDeDocumento;
  /** Código ISO de dos letras del país emisor. Sólo en pasaportes. */
  pais: string | null;
  /** El número ya normalizado: `12345678-9` o `AB123456`. */
  numero: string;
}

/** Países que se ofrecen primero: los que más visitan Chile. El resto se elige como «Otro». */
export const PAISES_DE_DOCUMENTO: Array<[string, string]> = [
  ['AR', 'Argentina'], ['BR', 'Brasil'], ['PE', 'Perú'], ['BO', 'Bolivia'], ['CO', 'Colombia'],
  ['VE', 'Venezuela'], ['EC', 'Ecuador'], ['UY', 'Uruguay'], ['PY', 'Paraguay'], ['MX', 'México'],
  ['US', 'Estados Unidos'], ['CA', 'Canadá'], ['ES', 'España'], ['FR', 'Francia'], ['DE', 'Alemania'],
  ['IT', 'Italia'], ['GB', 'Reino Unido'], ['CN', 'China'], ['HT', 'Haití'], ['XX', 'Otro país'],
];

const PAISES = new Set(PAISES_DE_DOCUMENTO.map(([codigo]) => codigo));

/** RUT sin puntos, con guion y K mayúscula, o `null` si no es válido. */
export function normalizarRut(valor: string): string | null {
  const limpio = valor.replace(/[^\dkK]/g, '').toUpperCase();
  if (!rutValido(limpio)) return null;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/**
 * Número de un documento extranjero en mayúsculas y sólo letras y dígitos, o `null`.
 *
 * Entre 5 y 20 caracteres: cubre pasaportes y cédulas de la región sin aceptar cualquier cosa.
 */
export function normalizarNumeroExtranjero(valor: string): string | null {
  const limpio = valor.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  return limpio.length >= 5 && limpio.length <= 20 ? limpio : null;
}

/**
 * Lee un documento escrito de cualquiera de las formas aceptadas.
 *
 * Acepta el formato de viaje (`rut:…`, `pasaporte:PAIS:…`) y también un RUT suelto, que es lo
 * que guardan los campos «RUT» antiguos: así los dos se comparan con la misma regla.
 *
 * @returns `null` si está vacío o no es válido.
 */
export function leerDocumento(valor: unknown): DocumentoDeIdentidad | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const texto = valor.trim();
  const [prefijo = '', ...resto] = texto.split(':');

  if (prefijo.toLowerCase() === 'rut') {
    const numero = normalizarRut(resto.join(':'));
    return numero ? { tipo: 'rut', pais: null, numero } : null;
  }
  if (prefijo.toLowerCase() === 'pasaporte') {
    const [pais, ...numeroEnPartes] = resto;
    const codigo = (pais ?? '').trim().toUpperCase();
    if (!PAISES.has(codigo)) return null;
    const numero = normalizarNumeroExtranjero(numeroEnPartes.join(''));
    return numero ? { tipo: 'pasaporte', pais: codigo, numero } : null;
  }
  // Un RUT sin prefijo: el formato de los campos RUT que ya existían.
  const rut = normalizarRut(texto);
  return rut ? { tipo: 'rut', pais: null, numero: rut } : null;
}

/** El documento en su formato de viaje, el que se guarda en las respuestas. */
export function documentoATextoCanonico(documento: DocumentoDeIdentidad): string {
  return documento.tipo === 'rut' ? `rut:${documento.numero}` : `pasaporte:${documento.pais}:${documento.numero}`;
}

/**
 * Lo que se compara para saber si dos reservas son de la misma persona.
 *
 * Incluye el tipo y el país para que un RUT y un pasaporte con los mismos dígitos no se
 * confundan.
 */
export function claveDeDocumento(documento: DocumentoDeIdentidad): string {
  return documento.tipo === 'rut' ? `RUT:${documento.numero}` : `PAS:${documento.pais}:${documento.numero}`;
}

/** Cómo se lee en pantalla: `RUT 12.345.678-9` o `Pasaporte (Argentina) AB123456`. */
export function documentoLegible(valor: unknown): string {
  const documento = leerDocumento(valor);
  if (!documento) return typeof valor === 'string' ? valor : '';
  if (documento.tipo === 'rut') {
    const [cuerpo = '', dv = ''] = documento.numero.split('-');
    return `RUT ${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  }
  const pais = PAISES_DE_DOCUMENTO.find(([codigo]) => codigo === documento.pais)?.[1] ?? documento.pais;
  return `Pasaporte (${pais}) ${documento.numero}`;
}
