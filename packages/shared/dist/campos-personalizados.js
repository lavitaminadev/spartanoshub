"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAVES_RESERVADAS = exports.TIPOS_DE_CAMPO = void 0;
exports.problemaDeClave = problemaDeClave;
exports.claveDesdeEtiqueta = claveDesdeEtiqueta;
exports.normalizarValor = normalizarValor;
exports.validarCamposPersonalizados = validarCamposPersonalizados;
exports.valoresQueSeRomperian = valoresQueSeRomperian;
exports.TIPOS_DE_CAMPO = [
    { value: 'text', label: 'Texto corto' },
    { value: 'long_text', label: 'Texto largo' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Fecha' },
    { value: 'select', label: 'Una opción' },
    { value: 'multi_select', label: 'Varias opciones' },
    { value: 'boolean', label: 'Sí / No' },
];
/**
 * Claves que ya son columnas propias de un lead, contacto u oportunidad.
 *
 * Un campo personalizado con uno de estos nombres se confundiría con el dato real en
 * exportaciones, filtros e integraciones: `email` propio y `email` personalizado en la misma fila.
 */
exports.CLAVES_RESERVADAS = new Set([
    'id', 'name', 'email', 'phone', 'company', 'source', 'status', 'stage', 'notes', 'tags', 'amount',
    'client', 'client_id', 'assigned_to', 'owner', 'created_at', 'updated_at', 'metadata', 'custom_fields',
    'domain', 'probability', 'position', 'lead', 'lead_id', 'campaign', 'campaign_name',
]);
const LARGO_TEXTO = 255;
const LARGO_TEXTO_LARGO = 4000;
/** Si una clave nueva se puede usar. Devuelve el problema, o `null` si sirve. */
function problemaDeClave(clave) {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(clave))
        return 'Usa minúsculas, números y guion bajo, empezando por una letra (2 a 40 caracteres)';
    if (exports.CLAVES_RESERVADAS.has(clave))
        return `«${clave}» ya es un dato propio del CRM`;
    return null;
}
/** Una clave legible a partir de la etiqueta: «Canal preferido» → `canal_preferido`. */
function claveDesdeEtiqueta(etiqueta) {
    const base = etiqueta
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        .slice(0, 40);
    const conLetra = /^[a-z]/.test(base) ? base : `campo_${base}`.slice(0, 40);
    return exports.CLAVES_RESERVADAS.has(conLetra) ? `${conLetra}_propio`.slice(0, 40) : conLetra;
}
function vacio(valor) {
    return valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
}
/**
 * Normaliza un valor para su tipo, o devuelve el motivo por el que no sirve.
 *
 * Acepta las formas en que llega desde un formulario o una importación —«12» para un número,
 * «true» o «sí» para un sí/no— y guarda siempre la forma canónica.
 */
function normalizarValor(def, valor) {
    switch (def.type) {
        case 'text':
        case 'long_text': {
            const texto = String(valor).trim();
            const limite = def.type === 'text' ? LARGO_TEXTO : LARGO_TEXTO_LARGO;
            if (texto.length > limite)
                return { ok: false, error: `«${def.label}» admite hasta ${limite} caracteres` };
            return { ok: true, valor: texto };
        }
        case 'number': {
            const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(/\s/g, '').replace(',', '.'));
            if (!Number.isFinite(numero))
                return { ok: false, error: `«${def.label}» tiene que ser un número` };
            return { ok: true, valor: numero };
        }
        case 'date': {
            const texto = String(valor).trim().slice(0, 10);
            const fecha = new Date(`${texto}T00:00:00Z`);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
                return { ok: false, error: `«${def.label}» tiene que ser una fecha válida` };
            }
            return { ok: true, valor: texto };
        }
        case 'boolean': {
            if (typeof valor === 'boolean')
                return { ok: true, valor };
            const texto = String(valor).trim().toLowerCase();
            if (['true', 'si', 'sí', '1', 'yes'].includes(texto))
                return { ok: true, valor: true };
            if (['false', 'no', '0'].includes(texto))
                return { ok: true, valor: false };
            return { ok: false, error: `«${def.label}» tiene que ser sí o no` };
        }
        case 'select': {
            const texto = String(valor).trim();
            if (!(def.options ?? []).includes(texto))
                return { ok: false, error: `«${texto}» no es una opción de «${def.label}»` };
            return { ok: true, valor: texto };
        }
        case 'multi_select': {
            const lista = (Array.isArray(valor) ? valor : String(valor).split(/[;|]/)).map((item) => String(item).trim()).filter(Boolean);
            const fuera = lista.filter((item) => !(def.options ?? []).includes(item));
            if (fuera.length)
                return { ok: false, error: `${fuera.map((f) => `«${f}»`).join(', ')} no ${fuera.length === 1 ? 'es opción' : 'son opciones'} de «${def.label}»` };
            return { ok: true, valor: [...new Set(lista)] };
        }
        default:
            return { ok: false, error: `«${def.label}» tiene un tipo desconocido` };
    }
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
function validarCamposPersonalizados(definiciones, previos, nuevos, opciones) {
    const porClave = new Map(definiciones.map((def) => [def.key, def]));
    const valores = { ...(previos ?? {}) };
    const errores = [];
    for (const [clave, crudo] of Object.entries(nuevos ?? {})) {
        const def = porClave.get(clave);
        if (!def) {
            errores.push(`El campo «${clave}» no existe`);
            continue;
        }
        // Archivado: lo guardado se conserva, pero no se escribe encima.
        if (def.archivedAt) {
            errores.push(`«${def.label}» está archivado y no se puede editar`);
            continue;
        }
        if (vacio(crudo)) {
            delete valores[clave];
            continue;
        }
        const resultado = normalizarValor(def, crudo);
        if (resultado.ok)
            valores[clave] = resultado.valor;
        else
            errores.push(resultado.error);
    }
    if (opciones.exigirObligatorios) {
        for (const def of definiciones) {
            if (def.required && !def.archivedAt && vacio(valores[def.key]))
                errores.push(`Falta completar «${def.label}»`);
        }
    }
    return { valores, errores };
}
/**
 * Si cambiar el tipo de un campo pondría en riesgo lo ya guardado.
 *
 * Pasar «texto» a «número» con «entre 5 y 10» guardado rompe esas fichas. Se permite sólo si
 * todo lo guardado sigue siendo válido con el tipo nuevo.
 *
 * @returns Cuántos valores guardados dejarían de ser válidos.
 */
function valoresQueSeRomperian(def, tipoNuevo, opcionesNuevas, guardados) {
    let rotos = 0;
    for (const registro of guardados) {
        const valor = registro?.[def.key];
        if (vacio(valor))
            continue;
        const prueba = normalizarValor({ type: tipoNuevo, options: opcionesNuevas, label: def.label }, valor);
        if (!prueba.ok)
            rotos += 1;
    }
    return rotos;
}
//# sourceMappingURL=campos-personalizados.js.map