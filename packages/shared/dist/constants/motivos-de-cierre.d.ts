/**
 * @fileoverview Por qué se cerró una solicitud de grupo sin convertirla en reserva.
 *
 * Cerrarlas era un botón y nada más: la solicitud desaparecía de la bandeja sin dejar dicho si el
 * local no tenía fecha, si el precio no les cuadró o si la persona nunca contestó. Cada una de
 * esas causas se corrige de una forma distinta —abrir cupo, revisar precios, responder antes— y
 * sin registrarlas no hay manera de saber cuál está costando más eventos.
 *
 * Las categorías son fijas para poder contarlas; la nota libre queda para lo que no entre en
 * ninguna.
 */
export declare const MOTIVOS_DE_CIERRE: readonly [{
    readonly clave: "sin_fecha";
    readonly nombre: "No teníamos fecha o cupo";
}, {
    readonly clave: "precio";
    readonly nombre: "No aceptaron el precio";
}, {
    readonly clave: "sin_respuesta";
    readonly nombre: "Nunca contestaron";
}, {
    readonly clave: "eligio_otro";
    readonly nombre: "Eligieron otro lugar";
}, {
    readonly clave: "duplicada";
    readonly nombre: "Repetida o de prueba";
}, {
    readonly clave: "otro";
    readonly nombre: "Otro motivo";
}];
export type MotivoDeCierre = (typeof MOTIVOS_DE_CIERRE)[number]['clave'];
export declare function esMotivoDeCierre(valor: string): valor is MotivoDeCierre;
/** El nombre que se muestra, o la clave cruda si llega una que ya no está en el catálogo. */
export declare function nombreDelMotivo(clave?: string | null): string;
//# sourceMappingURL=motivos-de-cierre.d.ts.map