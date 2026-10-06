/**
 * Deja constancia de que se le escribió a un prospecto por WhatsApp.
 *
 * Nace de una medición, no de una idea: de 72 prospectos, **una sola** tenía una actividad escrita
 * por una persona. Todo lo demás en el historial lo había puesto el sistema al recibir la ficha.
 * Con eso no se puede responder nada de lo que importa —cuánto se demora el equipo en contactar,
 * cuántos intentos hubo antes de rendirse, si «nunca respondió» es verdad— porque el intento no
 * existe en ninguna parte.
 *
 * Pedirle al equipo que lo anote a mano no iba a funcionar: ya se podía y no se hacía. Lo que sí
 * hace todo el mundo es apretar el botón de WhatsApp, así que la constancia se toma de ahí. El
 * trabajo no cambia; lo único que cambia es que queda escrito.
 *
 * **No afirma que la persona haya contestado.** Dice que se le escribió, que es exactamente lo que
 * el clic demuestra. Confundir las dos cosas volvería a llenar el historial de datos que nadie
 * verificó, que es el problema que esto viene a resolver.
 */

import { api } from '../../core/api';

/** Tipo con el que queda guardada. Distinto de `meeting` o `call`: es un envío, no una conversación. */
export const TIPO_WHATSAPP = 'whatsapp_enviado';

/**
 * Registra el envío sin estorbar al que lo manda.
 *
 * Nunca lanza ni muestra un error. El clic abre WhatsApp en otra pestaña y eso es lo que la
 * persona vino a hacer: si la constancia falla —se cayó la red, se perdió la sesión—, perder el
 * registro es malo, pero interrumpir el contacto con un cartel rojo es peor. El fallo queda en la
 * consola para que se pueda investigar.
 *
 * @param leadId Prospecto al que se le escribe.
 * @param nombre Para que la línea del historial se lea sola, sin ir a buscar a quién corresponde.
 */
export function registrarWhatsapp(leadId: string, nombre?: string): void {
  void api.post('/crm/interactions', {
    leadId,
    type: TIPO_WHATSAPP,
    description: nombre ? `Se le escribió por WhatsApp a ${nombre}.` : 'Se le escribió por WhatsApp.',
  }).catch((error: unknown) => {
    console.warn('No se pudo registrar el WhatsApp', error);
  });
}
