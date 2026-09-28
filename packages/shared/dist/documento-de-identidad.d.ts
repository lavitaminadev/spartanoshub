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
export type TipoDeDocumento = 'rut' | 'pasaporte';
export interface DocumentoDeIdentidad {
    tipo: TipoDeDocumento;
    /** Código ISO de dos letras del país emisor. Sólo en pasaportes. */
    pais: string | null;
    /** El número ya normalizado: `12345678-9` o `AB123456`. */
    numero: string;
}
/** Países que se ofrecen primero: los que más visitan Chile. El resto se elige como «Otro». */
export declare const PAISES_DE_DOCUMENTO: Array<[string, string]>;
/** RUT sin puntos, con guion y K mayúscula, o `null` si no es válido. */
export declare function normalizarRut(valor: string): string | null;
/**
 * Número de un documento extranjero en mayúsculas y sólo letras y dígitos, o `null`.
 *
 * Entre 5 y 20 caracteres: cubre pasaportes y cédulas de la región sin aceptar cualquier cosa.
 */
export declare function normalizarNumeroExtranjero(valor: string): string | null;
/**
 * Lee un documento escrito de cualquiera de las formas aceptadas.
 *
 * Acepta el formato de viaje (`rut:…`, `pasaporte:PAIS:…`) y también un RUT suelto, que es lo
 * que guardan los campos «RUT» antiguos: así los dos se comparan con la misma regla.
 *
 * @returns `null` si está vacío o no es válido.
 */
export declare function leerDocumento(valor: unknown): DocumentoDeIdentidad | null;
/** El documento en su formato de viaje, el que se guarda en las respuestas. */
export declare function documentoATextoCanonico(documento: DocumentoDeIdentidad): string;
/**
 * Lo que se compara para saber si dos reservas son de la misma persona.
 *
 * Incluye el tipo y el país para que un RUT y un pasaporte con los mismos dígitos no se
 * confundan.
 */
export declare function claveDeDocumento(documento: DocumentoDeIdentidad): string;
/** Cómo se lee en pantalla: `RUT 12.345.678-9` o `Pasaporte (Argentina) AB123456`. */
export declare function documentoLegible(valor: unknown): string;
//# sourceMappingURL=documento-de-identidad.d.ts.map