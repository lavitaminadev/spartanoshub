/**
 * @fileoverview Qué campos son datos protegidos, y cómo se ocultan.
 *
 * El nivel —`oculto`, `bajo_registro` o `directo`— lo decide el perfil de cada persona en cada
 * módulo, y vive en `areas.ts`. Aquí está la otra mitad: **cuáles son esos campos**, y la función
 * que recorta un objeto antes de que salga.
 *
 * DOS REGLAS QUE SOSTIENEN TODO LO DEMÁS
 *
 * 1. **Se recorta al serializar, no al pintar.** Si el filtro vive en el navegador, el dato ya
 *    viajó y el control es decorativo: basta mirar la respuesta en las herramientas del
 *    navegador. La auditoría encontró respuestas que mandan veinte campos para pintar cinco.
 *
 * 2. **La exportación pasa por aquí igual que la pantalla.** Proteger la ficha y no el archivo no
 *    protege nada: quien quiera el dato lo descarga. Lo mismo vale para cualquier API futura.
 *
 * Y UNA QUE DECIDE LOS CORREOS
 *
 * Un correo **no puede** ser `bajo_registro`: no hay forma de saber quién lo leyó, así que no
 * deja la constancia que ese nivel significa. Por eso el correo nunca lleva datos protegidos —
 * lleva el aviso y el enlace a la ficha, donde sí se registra quién miró—. Es además la opción
 * que protege los textos futuros: lo que el código no entrega, ninguna plantilla puede imprimir.
 */
import type { OrganizationModuleKey } from './constants/modules';
import type { NivelDeDatosProtegidos } from './areas';
/**
 * Por qué un campo está protegido. Decide la ceremonia, no el resultado.
 *
 * `sensible` son las categorías especiales de la Ley 21.719 —en la práctica, salud: las alergias
 * y restricciones alimentarias—. `identificador` es lo que señala a una persona por sí solo, como
 * el RUT. `contacto` es con qué se le escribe o se le llama.
 */
export type CategoriaDeDato = 'contacto' | 'identificador' | 'sensible';
export interface CampoProtegido {
    /** La propiedad tal como viaja en la respuesta. */
    campo: string;
    modulo: OrganizationModuleKey;
    categoria: CategoriaDeDato;
    /** Cómo se nombra en pantalla cuando se dice que está protegido. */
    nombre: string;
}
export declare const CAMPOS_PROTEGIDOS: readonly CampoProtegido[];
export declare function camposProtegidosDe(modulo: OrganizationModuleKey): CampoProtegido[];
/** Lo que la pantalla recibe en lugar del valor, para poder decir que existe y está protegido. */
export declare const MARCA_PROTEGIDA: "__protegido__";
export interface RecorteDeDatos<T> {
    /** El objeto con los campos protegidos reemplazados por la marca, o intactos si el nivel lo permite. */
    datos: T;
    /** Qué campos se recortaron, para que la pantalla ofrezca el botón «ver» cuando corresponda. */
    recortados: readonly string[];
    /** Si quien pida verlos tiene que dejar constancia. */
    exigeConstancia: boolean;
}
/**
 * Recorta de un objeto los campos protegidos de un módulo, según el nivel de quien lo pidió.
 *
 * Con `directo` no toca nada. Con `oculto` y con `bajo_registro` recorta igual: la diferencia
 * entre los dos **no es qué se entrega, es si existe la forma de pedirlo**. Entregar el dato y
 * confiar en que la pantalla no lo pinte sería el error que esta función existe para evitar.
 *
 * No muta el objeto recibido.
 */
export declare function recortarProtegidos<T extends Record<string, unknown>>(objeto: T, modulo: OrganizationModuleKey, nivel: NivelDeDatosProtegidos): RecorteDeDatos<T>;
/** La misma regla sobre una lista. */
export declare function recortarListaProtegidos<T extends Record<string, unknown>>(objetos: readonly T[], modulo: OrganizationModuleKey, nivel: NivelDeDatosProtegidos): {
    datos: T[];
    recortados: readonly string[];
    exigeConstancia: boolean;
};
/**
 * Si un campo recortado se puede pedir, o no existe la forma.
 *
 * Es la única diferencia visible entre los dos niveles que recortan, y es la que la pantalla
 * necesita para decidir si dibuja el botón «ver».
 */
export declare function sePuedePedir(nivel: NivelDeDatosProtegidos): boolean;
/** Si el valor que llegó es la marca y no el dato. */
export declare function estaProtegido(valor: unknown): boolean;
/**
 * Las columnas de una exportación que hay que quitar para un nivel dado.
 *
 * El archivo sale sin ellas, no con la marca: un CSV con `__protegido__` en una columna es un
 * archivo que alguien va a intentar procesar.
 */
export declare function columnasAQuitar(modulo: OrganizationModuleKey, nivel: NivelDeDatosProtegidos): string[];
//# sourceMappingURL=datos-protegidos.d.ts.map