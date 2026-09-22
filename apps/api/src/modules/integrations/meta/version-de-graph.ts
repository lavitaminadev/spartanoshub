/**
 * La versión de la API de Meta con que se hacen todas las llamadas.
 *
 * Estaba escrita en cada archivo que llamaba a Meta, así que actualizarla obligaba a acordarse de
 * siete sitios y bastaba olvidar uno para que una parte hablara una versión distinta del resto.
 *
 * `META_GRAPH_API_VERSION` la sobrescribe sin desplegar: subir de versión se prueba cambiando esa
 * variable y, si algo falla, se vuelve atrás con la misma.
 *
 * **v25.0, no la más nueva.** Cada versión de Meta vive unos dos años. La v23 ya no figura como
 * disponible en la API de Marketing, que es la que trae el gasto de las campañas. La v25 lleva
 * meses en producción y dura hasta 2028; la más reciente es demasiado nueva para estrenarla acá.
 * Ninguna de las dos cambia nada de lo que este sistema usa: conversiones, formularios
 * instantáneos y métricas de campaña siguen igual.
 */
export const VERSION_GRAPH_POR_DEFECTO = 'v25.0';
