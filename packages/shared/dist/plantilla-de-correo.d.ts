/**
 * El armazón de todos los correos que salen del sistema, y cómo se rellenan sus plantillas.
 *
 * Quien edita una plantilla escribe **texto con variables**, no HTML. El HTML lo pone este
 * módulo y nadie puede tocarlo. No es una limitación por comodidad: el HTML de correo es
 * primitivo —sin hojas de estilo externas, sin JavaScript, con estilos escritos dentro de cada
 * etiqueta— y Gmail y Outlook borran casi todo lo demás. Un texto pegado desde Word rompe el
 * correo entero, y quien lo pegó no tiene forma de saberlo hasta que alguien se queja.
 *
 * Separarlo así resuelve tres problemas a la vez: el correo nunca se rompe, las variables se
 * escapan al sustituirse —así que un nombre con `<` no puede inyectar nada— y una plantilla a la
 * que le falte una variable sale sin ese dato en vez de fallar.
 */
/** Valores que se pueden meter en una plantilla. Se convierten a texto al sustituir. */
export type VariablesDePlantilla = Record<string, string | number | null | undefined>;
/**
 * Escapa lo que va a acabar dentro del HTML.
 *
 * Se aplica a **todo** valor sustituido, sin excepción. Los datos vienen de formularios que
 * rellena cualquiera: un nombre puede traer `<script>` sin que nadie lo haya escrito con mala
 * intención, y el correo llega igual a la bandeja de otra persona.
 */
export declare function escaparHtml(valor: string): string;
/**
 * Sustituye `{{variable}}` por su valor, ya escapado.
 *
 * Lo que no tenga valor se reemplaza por vacío y no por el nombre de la variable: dejar
 * `{{responsable}}` a la vista en un correo real es peor que la frase incompleta, porque delata
 * que el sistema falló en algo que nadie sabe qué era.
 *
 * @param plantilla - Texto con variables, tal como lo escribió una persona.
 * @param variables - Los valores de esta vez.
 */
export declare function rellenar(plantilla: string, variables: VariablesDePlantilla): string;
/**
 * La empresa que firma el correo, junto a la agencia.
 *
 * Opcional en todo el camino: sin ella el correo sale como siempre, con la marca de la agencia
 * sola. No se deduce de ningún sitio —hay correos que manda la agencia por su cuenta— y por eso
 * la pasa quien sabe de qué empresa es el envío.
 */
export interface MarcaDelCorreo {
    /** Dirección absoluta del logo. Una relativa no resuelve en un cliente de correo. */
    logo?: string | null;
    nombre?: string | null;
}
/** Un botón, cuando el correo lleva a hacer algo concreto. */
export interface AccionDeCorreo {
    texto: string;
    url: string;
}
/**
 * Envuelve el cuerpo en el armazón de marca.
 *
 * Todo en tablas y con los estilos escritos dentro de cada etiqueta, que es lo único que
 * interpretan Outlook y Gmail por igual. El ancho máximo y el `viewport` hacen que se lea en un
 * teléfono sin tener que ampliar, que es donde se abre la mayoría de los correos.
 *
 * @param titulo - Encabezado dentro del correo. No es el asunto.
 * @param cuerpo - Texto ya rellenado, con sus saltos de línea.
 * @param accion - Botón opcional.
 */
/**
 * Bloque de tarjetas que el sistema arma —no la plantilla— y que se agrega bajo el cuerpo.
 *
 * Lo escribe el código y no quien edita el correo: el HTML de correo es frágil y una tabla mal
 * cerrada rompe el mensaje entero en Outlook. Las plantillas siguen siendo texto con variables.
 */
export interface TarjetaDeCorreo {
    titulo: string;
    texto?: string;
    imagen?: string;
}
/**
 * Filas de «dato: valor» que acompañan al cuerpo, armadas por el sistema.
 *
 * La plantilla es texto con variables y no puede listar lo que cada local pregunta: son campos
 * distintos en cada sucursal. Esto las pinta sin que quien edita tenga que saber HTML.
 */
export interface DetalleDeCorreo {
    etiqueta: string;
    valor: string;
}
export declare function armazonDeCorreo(titulo: string, cuerpo: string, accion?: AccionDeCorreo, extra?: {
    titulo: string;
    tarjetas: TarjetaDeCorreo[];
}, detalle?: DetalleDeCorreo[], preheader?: string, baja?: string, marca?: MarcaDelCorreo): string;
/**
 * Un correo listo para enviar, a partir de una plantilla editable.
 *
 * @param asunto - Plantilla del asunto. También lleva variables: «Lead parado» sirve menos que
 *   «{{lead}} lleva {{dias}} días sin avanzar» cuando llegan varios seguidos.
 * @param cuerpo - Plantilla del cuerpo.
 * @param variables - Los valores de este envío.
 * @param accion - Botón opcional. Su texto y su dirección **no** salen de la plantilla: una
 *   dirección editable es una puerta abierta a que un correo con nuestra marca lleve a otro
 *   sitio.
 */
export declare function componerCorreo(asunto: string, cuerpo: string, variables: VariablesDePlantilla, accion?: AccionDeCorreo, extra?: {
    titulo: string;
    tarjetas: TarjetaDeCorreo[];
}, detalle?: DetalleDeCorreo[], 
/** Dirección de baja, sólo en el correo comercial. Va en el pie, no como botón. */
baja?: string, 
/** Empresa que firma junto a la agencia. Sin ella el correo sale como siempre. */
marca?: MarcaDelCorreo): {
    subject: string;
    html: string;
    text: string;
};
/**
 * La versión en texto a partir del HTML ya armado.
 *
 * Existe porque el envío es el único punto por el que pasan **todos** los correos. Componerla en
 * cada uno de los veintitrés sitios que arman un correo habría dejado alguno fuera —dos veces en
 * este proyecto se corrigió una pantalla de doce y se dio el asunto por cerrado— y un correo sin
 * versión en texto no falla: simplemente cae en spam más seguido, que es de lo más difícil de
 * notar.
 *
 * El HTML lo genera `armazonDeCorreo`, así que esto no es un convertidor general: sabe qué va a
 * encontrar. Quien tenga el texto exacto a mano puede pasarlo y esto no se usa.
 */
export declare function textoDesdeHtml(html: string): string;
//# sourceMappingURL=plantilla-de-correo.d.ts.map