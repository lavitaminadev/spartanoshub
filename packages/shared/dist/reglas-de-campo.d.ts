/**
 * @fileoverview Cuándo se muestra un campo del formulario, según lo que ya se respondió.
 *
 * Hasta ahora cada pregunta condicional era una bandera en la configuración —«preguntar por
 * niños», «preguntar por alergias»— más una condición escrita a mano en la pantalla pública. Cada
 * pregunta nueva sumaba una bandera, una condición y un estado más que probar, y ninguna de esas
 * combinaciones se podía cambiar sin desplegar.
 *
 * Acá la condición es un dato del campo. Quien arma el formulario decide, sin que nadie toque
 * código, y la misma regla la evalúan el navegador —para mostrar u ocultar— y el servidor —para
 * no exigir lo que no se mostró—. **Que las dos partes usen esta función es el punto**: si el
 * navegador esconde un campo obligatorio y el servidor lo sigue exigiendo, la reserva se vuelve
 * imposible de enviar y el mensaje de error nombra un campo que no está en pantalla.
 *
 * No es un lenguaje de expresiones: una condición, un campo, un valor. Con eso se cubren los
 * casos reales —«si viene con niños, preguntar cuántos»— y se evita tener que explicar precedencia
 * de operadores a quien solo quiere agregar una pregunta.
 */
/** Comparaciones disponibles. Se nombran por lo que significan, no por su símbolo. */
export declare const OPERADORES_DE_CAMPO: {
    readonly IGUAL: "igual";
    readonly DISTINTO: "distinto";
    readonly RESPONDIDO: "respondido";
    readonly VACIO: "vacio";
    readonly MAYOR_QUE: "mayor_que";
    readonly CONTIENE: "contiene";
};
export type OperadorDeCampo = (typeof OPERADORES_DE_CAMPO)[keyof typeof OPERADORES_DE_CAMPO];
/** La condición que decide si un campo se muestra. */
export interface ReglaDeCampo {
    /** Identificador del campo que se mira. */
    campo: string;
    operador: OperadorDeCampo;
    /** Con qué se compara. `respondido` y `vacio` no lo usan. */
    valor?: string;
}
/** Lo mínimo que necesita esta función de un campo. */
export interface CampoConRegla {
    id: string;
    mostrarSi?: ReglaDeCampo;
}
/**
 * Si un campo debe mostrarse con las respuestas que hay hasta ahora.
 *
 * Un campo sin regla se muestra siempre. Lo no respondido cuenta como respuesta vacía, así que al
 * abrir el formulario las preguntas condicionales parten ocultas, que es lo que se configuró.
 *
 * @param campo Campo a evaluar.
 * @param respuestas Lo respondido hasta el momento, por identificador de campo.
 */
export declare function campoVisible(campo: CampoConRegla, respuestas: Record<string, unknown>): boolean;
/**
 * Los campos que hoy corresponde mostrar.
 *
 * Se recorre en orden y arrastrando lo ya decidido: si una pregunta está oculta, las que dependen
 * de ella tampoco aparecen, aunque su propia condición se cumpla por una respuesta vieja que
 * quedó guardada. Sin eso, ocultar una pregunta dejaría visibles a sus hijas.
 */
export declare function camposVisibles<T extends CampoConRegla>(campos: T[], respuestas: Record<string, unknown>): T[];
//# sourceMappingURL=reglas-de-campo.d.ts.map