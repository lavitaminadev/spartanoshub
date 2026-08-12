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
export declare const CLIENT_INDUSTRIES: readonly [{
    readonly value: "gastronomico";
    readonly label: "Gastronómico";
}, {
    readonly value: "inmobiliario";
    readonly label: "Inmobiliario";
}, {
    readonly value: "legal";
    readonly label: "Legal";
}, {
    readonly value: "salud_estetica";
    readonly label: "Salud y estética";
}, {
    readonly value: "startups";
    readonly label: "Startups";
}, {
    readonly value: "retail";
    readonly label: "Retail y comercio";
}, {
    readonly value: "ecommerce";
    readonly label: "Comercio electrónico";
}, {
    readonly value: "educacion";
    readonly label: "Educación";
}, {
    readonly value: "turismo";
    readonly label: "Turismo y hotelería";
}, {
    readonly value: "fitness";
    readonly label: "Fitness y deporte";
}, {
    readonly value: "automotriz";
    readonly label: "Automotriz";
}, {
    readonly value: "construccion";
    readonly label: "Construcción";
}, {
    readonly value: "servicios_profesionales";
    readonly label: "Servicios profesionales";
}, {
    readonly value: "entretenimiento";
    readonly label: "Entretenimiento y eventos";
}, {
    readonly value: "otro";
    readonly label: "Otro";
}];
export type ClientIndustry = (typeof CLIENT_INDUSTRIES)[number]['value'];
export declare const CLIENT_INDUSTRY_VALUES: readonly string[];
/** Etiqueta legible de un rubro; devuelve el valor crudo si no está en el catálogo. */
export declare function industryLabel(value?: string | null): string;
export declare function isClientIndustry(value: string): value is ClientIndustry;
//# sourceMappingURL=industries.d.ts.map