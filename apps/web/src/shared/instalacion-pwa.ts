/**
 * Cuándo ofrecer instalar la aplicación, y cuándo callarse.
 *
 * Vive aparte del componente para poder probarlo: son cuatro reglas que se equivocan fácil y que
 * en pantalla solo se comprueban mirando en cuatro dispositivos distintos.
 */

/** Dónde se recuerda que alguien dijo que no. */
const CLAVE_DESCARTE = 'pwa.instalacion.descartada';

/** Marca de que en este equipo llegó a estar instalada. */
const CLAVE_ESTUVO = 'pwa.instalacion.estuvo';

/**
 * Si la aplicación se está ejecutando ya instalada.
 *
 * Dos comprobaciones porque cada sistema lo dice a su manera: `display-mode` es el estándar y
 * `navigator.standalone` es lo único que expone Safari.
 *
 * **No detecta que esté instalada mientras se navega en una pestaña normal.** Ningún navegador lo
 * permite sin permisos adicionales; la señal real de que no lo está es que el navegador ofrezca
 * instalarla, cosa que no hace con las que ya lo están.
 */
export function estaInstalada(ventana: Window = window): boolean {
  const comoApp = ventana.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const enSafari = (ventana.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return comoApp || enSafari;
}

/**
 * Si es un dispositivo de Apple.
 *
 * El iPad de las versiones recientes se presenta como un Mac de escritorio, así que además se
 * mira si tiene pantalla táctil: un Mac de verdad no tiene varios puntos de contacto.
 */
export function esDeApple(navegador: Navigator = navigator): boolean {
  const ua = navegador.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navegador.maxTouchPoints > 1;
}

/**
 * Si el navegador puede instalar en un dispositivo de Apple.
 *
 * Solo Safari. Chrome y Firefox en iPhone usan su motor pero **no ofrecen** añadir a la pantalla
 * de inicio, así que explicarle el gesto a quien está en Chrome sería mandarlo a buscar un botón
 * que no existe.
 */
export function esSafariDeApple(navegador: Navigator = navigator): boolean {
  const ua = navegador.userAgent;
  return esDeApple(navegador) && !/crios|fxios|edgios|opios/i.test(ua);
}

/** Si alguien ya dijo que no quiere instalarla. */
export function fueDescartada(almacen: Storage = window.localStorage): boolean {
  try {
    return almacen.getItem(CLAVE_DESCARTE) === 'si';
  } catch {
    // Modo privado o almacenamiento lleno: se prefiere ofrecerla a fallar por no poder leerlo.
    return false;
  }
}

/** Recuerda que dijo que no. Se respeta hasta que la situación cambie. */
export function recordarDescarte(almacen: Storage = window.localStorage): void {
  try {
    almacen.setItem(CLAVE_DESCARTE, 'si');
  } catch {
    // Sin dónde guardarlo, el descarte dura lo que la pestaña. Es lo máximo que se puede hacer.
  }
}

/** Recuerda que llegó a instalarse, para poder notar después que la quitaron. */
export function recordarInstalacion(almacen: Storage = window.localStorage): void {
  try {
    almacen.setItem(CLAVE_ESTUVO, 'si');
  } catch {
    // Sin marca no se podrá detectar la desinstalación; se prefiere eso a fallar.
  }
}

/**
 * Si hay que volver a preguntar porque la desinstalaron.
 *
 * El navegador ofrece instalarla en **cada carga** mientras no lo esté, así que ese aviso por sí
 * solo no significa nada nuevo: tomarlo como señal haría reaparecer la propuesta en cada recarga
 * a quien ya dijo que no, que es exactamente lo que el descarte existe para evitar.
 *
 * Lo que sí es información nueva es que vuelva a ofrecerla **después de haber estado instalada**.
 * Eso solo ocurre si la quitaron, y entonces el «no, gracias» anterior describe una situación que
 * ya no existe. Se olvidan las dos marcas: la de descarte y la de haber estado instalada.
 *
 * @returns Si se olvidó un descarte previo, para que la pantalla vuelva a ofrecerla.
 */
export function olvidarDescarteSiLaQuitaron(almacen: Storage = window.localStorage): boolean {
  try {
    if (almacen.getItem(CLAVE_ESTUVO) !== 'si') return false;
    almacen.removeItem(CLAVE_ESTUVO);
    const habiaDescarte = almacen.getItem(CLAVE_DESCARTE) === 'si';
    almacen.removeItem(CLAVE_DESCARTE);
    return habiaDescarte;
  } catch {
    return false;
  }
}
