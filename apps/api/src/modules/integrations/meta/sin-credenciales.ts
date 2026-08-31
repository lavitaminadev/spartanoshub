/**
 * Quita de un texto cualquier credencial de Meta antes de registrarlo o devolverlo.
 *
 * Los mensajes de error de Meta repiten lo que se les mandó. Cuando el token está mal formado
 * —por ejemplo si se pegó con texto delante— la respuesta es «Malformed access token» seguida
 * del token entero, y ese texto viajaba tal cual al registro del servidor y a la pantalla de
 * quien lo estaba configurando. La credencial quedaba escrita en los logs sin que nadie la
 * hubiera impreso a propósito.
 *
 * Se sanea el texto y no se sustituye por uno genérico porque el motivo real es lo único que
 * dice qué hacer: «token caducado» y «el Pixel no existe» piden cosas distintas.
 */

/**
 * Forma de un token de Meta.
 *
 * Todos empiezan por `EAA` y siguen con una tirada larga de caracteres de base64 en su variante
 * para URL. El mínimo de sesenta evita confundirlo con una palabra que empiece igual: un token
 * real ronda los doscientos caracteres.
 */
const TOKEN_DE_META = /EAA[A-Za-z0-9_-]{60,}/g;

/** Con qué se reemplaza. Deja constancia de que había algo, sin decir qué. */
const OCULTO = '[token oculto]';

/**
 * @param texto - Mensaje que va a registrarse o devolverse.
 * @returns El mismo mensaje con las credenciales sustituidas.
 */
export function sinCredenciales(texto: string | null | undefined): string {
  return String(texto ?? '').replace(TOKEN_DE_META, OCULTO);
}
