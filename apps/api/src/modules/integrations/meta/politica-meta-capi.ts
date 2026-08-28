import { Logger } from '@nestjs/common';

/**
 * Qué puede salir del CRM hacia Meta, y nada más.
 *
 * El CRM guarda la ficha comercial completa —capacidad de inversión, respuestas del formulario,
 * notas del vendedor— porque la necesita para calificar. Meta no puede recibir nada de eso: sus
 * Condiciones de las herramientas empresariales prohíben compartir información financiera, de
 * salud o sensible, y también prohíben que el *nombre* de un evento la insinúe.
 *
 * La política es negar por defecto. Un campo nuevo en la base de datos no empieza a viajar solo:
 * si no está nombrado acá, no sale. La lista blanca es corta a propósito; ampliarla es una
 * decisión que alguien tiene que tomar y escribir, no algo que ocurra por descuido.
 *
 * Se comprueba dos veces —al encolar y justo antes del POST— porque un evento peligroso que se
 * cuele por un camino nuevo no debe llegar a Meta aunque haya conseguido entrar al outbox.
 */

/** Identificadores admitidos en `user_data`. Cualquier otro se descarta. */
export const IDENTIFICADORES_PERMITIDOS = [
  // Contacto y nombre: Meta los documenta para emparejar y exige SHA-256. Nada más.
  'em', 'ph', 'fn', 'ln',
  // Geografía a nivel de ciudad, región y país. No identifica por sí sola y sube la coincidencia.
  'ct', 'st', 'country',
  // Identificadores: el nuestro (hasheado) y el que generó Meta (en claro, es suyo).
  'externalId', 'lead_id',
  // Señales técnicas del navegador. Meta prohíbe hashearlas.
  'fbc', 'fbp', 'client_ip_address', 'client_user_agent',
] as const;

/**
 * Campos admitidos en `custom_data`.
 *
 * No hay campos libres: `custom_data` es donde acabaría cualquier dato comercial que a alguien le
 * pareciera útil para segmentar, y es justo lo que las condiciones de Meta prohíben.
 */
export const DATOS_PERSONALIZADOS_PERMITIDOS = [
  'currency', 'value', 'contentIds', 'contentType', 'leadEventSource', 'eventSource',
] as const;

/** Campos admitidos en la raíz del evento. */
export const CAMPOS_DE_EVENTO_PERMITIDOS = [
  'eventName', 'eventTime', 'eventId', 'actionSource', 'eventSourceUrl', 'userData', 'customData',
] as const;

/**
 * Palabras que delatan una categoría prohibida.
 *
 * Se buscan tanto en los nombres de los campos como en el nombre del evento. No pretende ser una
 * lista completa —ninguna lo es— sino atrapar el caso realista: alguien añade `capacidad_inversion`
 * al evento porque le sirve para segmentar, y nadie lo nota hasta que Meta restringe la cuenta.
 */
export const TERMINOS_PROHIBIDOS = [
  'capacidad', 'inversion', 'inversión', 'investment', 'patrimonio', 'renta', 'income', 'sueldo',
  'salario', 'salary', 'presupuesto', 'budget', 'financ', 'deuda', 'debt', 'credito', 'crédito',
  'credit', 'banco', 'bank', 'tarjeta', 'card', 'iban', 'rut', 'dni', 'passport',
  'pasaporte', 'ssn', 'salud', 'health', 'medic', 'diagnos', 'enfermedad',
  'embarazo', 'menor', 'nino', 'niño', 'child', 'nota', 'note', 'comentario', 'comment',
  'observacion', 'observación', 'respuesta', 'answer', 'formulario', 'documento',
  'adjunto', 'attachment', 'patrimon', 'wealth', 'networth',
] as const;

/** Un incumplimiento de la política, listo para registrar sin exponer el valor. */
export interface InfraccionDePolitica {
  /** Dónde apareció: `user_data`, `custom_data` o `event`. */
  seccion: string;
  /** Nombre del campo. Nunca su contenido. */
  campo: string;
  motivo: string;
}

const logger = new Logger('MetaCapiPolitica');

function terminoProhibidoEn(texto: string): string | null {
  const normalizado = texto.toLowerCase();
  return TERMINOS_PROHIBIDOS.find((termino) => normalizado.includes(termino)) ?? null;
}

/**
 * Revisa un evento contra la política sin modificarlo.
 *
 * Devuelve todas las infracciones, no la primera: quien esté corrigiendo un evento nuevo quiere
 * ver de una vez todo lo que sobra, no descubrirlo de a un campo por intento.
 *
 * @param evento - El evento tal como lo construyó el emisor.
 * @returns Lista vacía si el evento cumple.
 */
export function revisarEvento(evento: Record<string, unknown>): InfraccionDePolitica[] {
  const infracciones: InfraccionDePolitica[] = [];

  const revisarSeccion = (seccion: string, objeto: unknown, permitidos: readonly string[]) => {
    if (!objeto || typeof objeto !== 'object') return;
    const datos = objeto as Record<string, unknown>;
    for (const campo of Object.keys(datos)) {
      if (datos[campo] === undefined) continue;
      if (permitidos.includes(campo)) continue;
      const termino = terminoProhibidoEn(campo);
      infracciones.push({
        seccion,
        campo,
        motivo: termino
          ? `campo fuera de la lista blanca y con término prohibido «${termino}»`
          : 'campo fuera de la lista blanca de Meta CAPI',
      });
    }
  };

  revisarSeccion('event', evento, CAMPOS_DE_EVENTO_PERMITIDOS);
  revisarSeccion('user_data', evento.userData, IDENTIFICADORES_PERMITIDOS);
  revisarSeccion('custom_data', evento.customData, DATOS_PERSONALIZADOS_PERMITIDOS);

  /*
   * El nombre del evento viaja tal cual a los informes de Meta y a las conversiones personalizadas.
   * Un «LeadRentaAlta» comunica la categoría prohibida igual de bien que el campo que se quitó, y
   * desde septiembre de 2025 Meta marca esas conversiones y las inhabilita para campañas.
   */
  if (typeof evento.eventName === 'string') {
    const termino = terminoProhibidoEn(evento.eventName);
    if (termino) {
      infracciones.push({
        seccion: 'event',
        campo: 'eventName',
        motivo: `el nombre del evento contiene el término prohibido «${termino}»`,
      });
    }
  }

  /*
   * `value` es el único número que sale del CRM, y la vía más fácil de filtrar dinero del lead.
   *
   * Meta lo interpreta como el importe de la conversión, así que solo tiene sentido acompañado de
   * su moneda y siendo positivo. Un `value` suelto, negativo o sin `currency` no es el valor de
   * una venta: es otra cifra que alguien puso ahí, y la más probable es la del lead.
   */
  const customData = (evento.customData ?? {}) as Record<string, unknown>;
  if (customData.value !== undefined) {
    const valor = customData.value;
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
      infracciones.push({ seccion: 'custom_data', campo: 'value', motivo: 'no es un importe positivo' });
    } else if (typeof customData.currency !== 'string' || customData.currency.length === 0) {
      infracciones.push({ seccion: 'custom_data', campo: 'value', motivo: 'viaja sin currency' });
    }
  }

  return infracciones;
}

/**
 * Construye un evento nuevo con lo permitido y descarta el resto.
 *
 * Copia campo por campo a propósito: con `{...evento}` cualquier clave añadida más arriba
 * viajaría sola, que es exactamente lo que esta política existe para impedir.
 */
export function construirEventoPermitido<T extends Record<string, unknown>>(evento: T): T {
  const copiar = (objeto: unknown, permitidos: readonly string[]): Record<string, unknown> => {
    const origen = (objeto ?? {}) as Record<string, unknown>;
    const destino: Record<string, unknown> = {};
    for (const campo of permitidos) {
      if (origen[campo] !== undefined) destino[campo] = origen[campo];
    }
    return destino;
  };

  const limpio = copiar(evento, CAMPOS_DE_EVENTO_PERMITIDOS);
  limpio.userData = copiar(evento.userData, IDENTIFICADORES_PERMITIDOS);
  if (evento.customData !== undefined) {
    limpio.customData = copiar(evento.customData, DATOS_PERSONALIZADOS_PERMITIDOS);
  }
  return limpio as T;
}

/**
 * Registra un bloqueo con lo necesario para auditarlo y nada más.
 *
 * Se anota el nombre del campo y el motivo, nunca el valor: dejar el dato prohibido en los logs
 * mientras se impide enviarlo a Meta solo cambia de sitio el problema.
 */
export function registrarBloqueo(eventId: string | undefined, infracciones: InfraccionDePolitica[]): void {
  for (const infraccion of infracciones) {
    logger.error(
      `META_CAPI_POLICY_BLOCKED event_id=${eventId ?? 'sin-id'} `
      + `seccion=${infraccion.seccion} campo=${infraccion.campo} motivo="${infraccion.motivo}"`,
    );
  }
}

/**
 * Qué se envió, en forma auditable y sin datos de contacto.
 *
 * Poder responder «¿qué mandamos por este lead?» es parte de la responsabilidad que Meta deja del
 * lado del anunciante. Se anotan los campos presentes, no su contenido: para auditar basta saber
 * que el correo viajaba, y guardarlo repondría en los logs el dato que se hasheó para no exponer.
 */
export function resumenAuditable(evento: Record<string, unknown>): string {
  const userData = (evento.userData ?? {}) as Record<string, unknown>;
  const customData = (evento.customData ?? {}) as Record<string, unknown>;
  const presentes = (objeto: Record<string, unknown>) =>
    Object.keys(objeto).filter((campo) => objeto[campo] !== undefined).join(',') || 'ninguno';
  return (
    `event_name=${String(evento.eventName)} event_id=${String(evento.eventId ?? 'sin-id')} `
    + `lead_id=${userData.lead_id ? 'si' : 'no'} `
    + `email_present=${Array.isArray(userData.em) && userData.em.length > 0} `
    + `phone_present=${Array.isArray(userData.ph) && userData.ph.length > 0} `
    + `user_data=[${presentes(userData)}] custom_data=[${presentes(customData)}]`
  );
}
