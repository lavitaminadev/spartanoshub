/**
 * @fileoverview Dar y retirar el permiso de medición en el navegador.
 *
 * Retirar tiene que surtir efecto de verdad: avisar a Meta y a Google que ya no hay permiso, para
 * que dejen de enviar, y borrar las cookies que dejaron. Sin esto, el Pixel ya cargado seguía
 * midiendo el resto de la visita aunque la página dijera «no aceptada».
 */

const COOKIES_DE_MEDICION = [/^_fbp$/, /^_fbc$/, /^_ga$/, /^_ga_/, /^_gid$/, /^_gat/, /^_gcl_/];
/** La misma clave con que `meta-match` recuerda el clic del anuncio. */
const CLAVE_CLIC = 'vh.meta.fbclid';

/** Borra una cookie en el dominio actual y en sus dominios padre, que es donde la dejan Meta y Google. */
function borrarCookie(nombre: string): void {
  const partes = window.location.hostname.split('.');
  const dominios = [''];
  for (let i = 0; i < partes.length - 1; i += 1) dominios.push(`.${partes.slice(i).join('.')}`);
  for (const dominio of dominios) {
    document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${dominio ? `; domain=${dominio}` : ''}`;
  }
}

/** Retira el permiso: Meta y Google dejan de enviar y se borran sus cookies y el clic recordado. */
export function retirarMedicion(): void {
  try { window.fbq?.('consent', 'revoke'); } catch { /* sin Pixel */ }
  try {
    window.gtag?.('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  } catch { /* sin Google */ }
  try {
    for (const par of document.cookie.split(';')) {
      const nombre = par.split('=')[0]?.trim();
      if (nombre && COOKIES_DE_MEDICION.some((patron) => patron.test(nombre))) borrarCookie(nombre);
    }
  } catch { /* sin cookies accesibles */ }
  try { localStorage.removeItem(CLAVE_CLIC); } catch { /* sin almacenamiento */ }
}
