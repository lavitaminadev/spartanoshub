"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_INDUSTRY_VALUES = exports.CLIENT_INDUSTRIES = void 0;
exports.industryLabel = industryLabel;
exports.isClientIndustry = isClientIndustry;
/**
 * Rubros de los clientes de la agencia.
 *
 * Cerrado a lista y no texto libre porque el rubro se usa para agrupar en reportes: escrito a
 * mano, «gastronómico», «Gastronomia» y «restaurante» son tres rubros distintos y ningún
 * informe por rubro cuadra.
 *
 * Los cinco primeros son los que el sitio público trabaja con página propia. El resto cubre
 * lo que suele aparecer sin tener landing, para no empujar todo a «Otro».
 *
 * `otro` existe a propósito: una lista cerrada sin salida obliga a mentir, y un rubro mal
 * clasificado ensucia más que uno sin clasificar. Cuando `otro` empiece a acumular casos, esa
 * es la señal de que falta una categoría.
 */
exports.CLIENT_INDUSTRIES = [
    { value: 'gastronomico', label: 'Gastronómico' },
    { value: 'inmobiliario', label: 'Inmobiliario' },
    { value: 'legal', label: 'Legal' },
    { value: 'salud_estetica', label: 'Salud y estética' },
    { value: 'startups', label: 'Startups' },
    { value: 'retail', label: 'Retail y comercio' },
    { value: 'ecommerce', label: 'Comercio electrónico' },
    { value: 'educacion', label: 'Educación' },
    { value: 'turismo', label: 'Turismo y hotelería' },
    { value: 'fitness', label: 'Fitness y deporte' },
    { value: 'automotriz', label: 'Automotriz' },
    { value: 'construccion', label: 'Construcción' },
    { value: 'servicios_profesionales', label: 'Servicios profesionales' },
    { value: 'entretenimiento', label: 'Entretenimiento y eventos' },
    { value: 'otro', label: 'Otro' },
];
exports.CLIENT_INDUSTRY_VALUES = exports.CLIENT_INDUSTRIES.map((item) => item.value);
/** Etiqueta legible de un rubro; devuelve el valor crudo si no está en el catálogo. */
function industryLabel(value) {
    if (!value)
        return '';
    return exports.CLIENT_INDUSTRIES.find((item) => item.value === value)?.label ?? value;
}
function isClientIndustry(value) {
    return exports.CLIENT_INDUSTRY_VALUES.includes(value);
}
//# sourceMappingURL=industries.js.map