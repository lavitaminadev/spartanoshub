/**
 * @fileoverview Campos propios del CRM: qué se puede definir y cómo se valida lo que se guarda.
 *
 * Lo usan el servidor —para no guardar basura— y la pantalla —para avisar antes de enviar—. Que
 * sea la misma función es lo que evita la pantalla que acepta un valor y el servidor que después
 * lo rechaza con un error que nadie entiende.
 *
 * Cuatro reglas protegen los datos que ya existen, y están acá y no en cada pantalla:
 *
 * 1. **Se guarda por clave, nunca por etiqueta.** Renombrar un campo no toca sus valores.
 * 2. **Archivar no borra.** Un campo archivado deja de mostrarse y de editarse, pero lo guardado
 *    sigue ahí y vuelve si se desarchiva.
 * 3. **Se fusiona campo por campo.** Guardar un campo no borra los demás: si Meta reenvía un lead,
 *    lo que el equipo escribió a mano sigue en su sitio.
 * 4. **Lo obligatorio sólo se exige a una persona.** Un lead que entra por Meta o por una
 *    importación no puede rebotar por un campo que el formulario de origen no tiene.
 */
export type CustomFieldEntity = 'lead' | 'contact' | 'opportunity';
export type CustomFieldType = 'text' | 'long_text' | 'number' | 'date' | 'select' | 'multi_select' | 'boolean';
export declare const TIPOS_DE_CAMPO: ReadonlyArray<{
    value: CustomFieldType;
    label: string;
}>;
export interface CustomFieldDefinition {
    id: string;
    entity: CustomFieldEntity;
    /** Estable. Es la llave del valor guardado: no cambia al renombrar. */
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[] | null;
    required: boolean;
    position: number;
    /** Preguntas de formularios de Meta que llenan este campo. Vacío: sólo se llena a mano. */
    metaQuestions?: string[] | null;
    archivedAt?: string | null;
}
export type CustomFieldValue = string | number | boolean | string[];
export type CustomFieldValues = Record<string, CustomFieldValue>;
/**
 * Claves que ya son columnas propias de un lead, contacto u oportunidad.
 *
 * Un campo personalizado con uno de estos nombres se confundiría con el dato real en
 * exportaciones, filtros e integraciones: `email` propio y `email` personalizado en la misma fila.
 */
export declare const CLAVES_RESERVADAS: Set<string>;
/** Si una clave nueva se puede usar. Devuelve el problema, o `null` si sirve. */
export declare function problemaDeClave(clave: string): string | null;
/** Una clave legible a partir de la etiqueta: «Canal preferido» → `canal_preferido`. */
export declare function claveDesdeEtiqueta(etiqueta: string): string;
/**
 * Normaliza un valor para su tipo, o devuelve el motivo por el que no sirve.
 *
 * Acepta las formas en que llega desde un formulario o una importación —«12» para un número,
 * «true» o «sí» para un sí/no— y guarda siempre la forma canónica.
 */
export declare function normalizarValor(def: Pick<CustomFieldDefinition, 'type' | 'options' | 'label'>, valor: unknown): {
    ok: true;
    valor: CustomFieldValue;
} | {
    ok: false;
    error: string;
};
export interface ResultadoDeValidacion {
    valores: CustomFieldValues;
    errores: string[];
}
/**
 * Valida lo que llega y lo fusiona con lo guardado.
 *
 * @param definiciones Las del tipo de registro, archivadas incluidas: hace falta saber que un
 *   campo existe aunque ya no se edite.
 * @param previos Lo que el registro ya tenía.
 * @param nuevos Lo que llega. Un valor vacío borra ese campo; una clave ausente lo deja igual.
 * @param opciones.exigirObligatorios Sólo cuando edita una persona en la pantalla.
 */
export declare function validarCamposPersonalizados(definiciones: CustomFieldDefinition[], previos: CustomFieldValues | null | undefined, nuevos: Record<string, unknown> | null | undefined, opciones: {
    exigirObligatorios: boolean;
}): ResultadoDeValidacion;
/**
 * Si cambiar el tipo de un campo pondría en riesgo lo ya guardado.
 *
 * Pasar «texto» a «número» con «entre 5 y 10» guardado rompe esas fichas. Se permite sólo si
 * todo lo guardado sigue siendo válido con el tipo nuevo.
 *
 * @returns Cuántos valores guardados dejarían de ser válidos.
 */
export declare function valoresQueSeRomperian(def: Pick<CustomFieldDefinition, 'key' | 'type' | 'options' | 'label'>, tipoNuevo: CustomFieldType, opcionesNuevas: string[] | null | undefined, guardados: Array<CustomFieldValues | null | undefined>): number;
//# sourceMappingURL=campos-personalizados.d.ts.map