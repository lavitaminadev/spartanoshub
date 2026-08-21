/**
 * @fileoverview Que una recarga traiga de verdad la versión nueva.
 *
 * La aplicación se instala como PWA, así que un service worker responde a las peticiones antes
 * de que salgan al servidor. Eso la hace rápida y utilizable con mala conexión, y trae un
 * problema propio: la pestaña abierta sigue sirviendo la copia guardada, y **recargar no la
 * desaloja** —ni con Ctrl+F5—, porque la recarga también la atiende el service worker.
 *
 * Se nota como una avería, no como una versión vieja: la mitad de la pantalla es la anterior y
 * el servidor ya es el nuevo, así que la pantalla ofrece cosas que la API rechaza. En el CRM se
 * veía como que arrastrar una tarjeta «no guardaba»: el tablero viejo ofrecía una etapa que el
 * servidor nuevo no acepta para ese lead, respondía 400, y la tarjeta volvía a su columna.
 *
 * Tres piezas, y las tres hacen falta:
 *
 * 1. **Preguntar.** El navegador solo comprueba si hay service worker nuevo al navegar. Una
 *    pestaña que lleva horas abierta no pregunta nunca, así que se le pregunta cada tanto y al
 *    volver a ella.
 * 2. **Recargar cuando entra.** Al activarse el nuevo, la página sigue con el código anterior en
 *    memoria. Se recarga una vez, y solo una: sin el pestillo, dos pestañas que se relevan el
 *    control se recargarían la una a la otra sin parar.
 * 3. **No durante una escritura.** Recargar en mitad de un guardado perdería lo escrito. Se
 *    espera a que la pestaña vuelva a estar quieta.
 */

/** Cada cuánto se pregunta si hay versión nueva. */
const INTERVALO_MS = 60_000;

let recargando = false;

/**
 * Deja la pestaña al día con lo que hay desplegado.
 *
 * @param registro - Registro del service worker, tal como lo entrega `registerSW`.
 */
export function mantenerAlDia(registro?: ServiceWorkerRegistration): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  /*
   * Recarga en cuanto otro service worker toma el control.
   *
   * `controllerchange` es la señal de que lo que responde a partir de ahora es la versión nueva.
   * Se escucha una sola vez y se protege con un pestillo porque el evento puede llegar más de
   * una vez durante la activación.
   */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });

  if (!registro) return;

  const comprobar = () => {
    // Un fallo acá no es un problema del que haya que informar: significa que no se pudo
    // preguntar ahora —sin red, o el servidor no respondió— y se volverá a preguntar luego.
    void registro.update().catch(() => undefined);
  };

  comprobar();
  window.setInterval(comprobar, INTERVALO_MS);
  // Volver a la pestaña es el momento en que alguien va a usarla: es cuando más vale la pena
  // que esté al día, y cuando menos molesta enterarse.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') comprobar();
  });
}
