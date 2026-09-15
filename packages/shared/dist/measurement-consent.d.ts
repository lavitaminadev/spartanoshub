/**
 * @fileoverview Texto único del permiso de medición publicitaria.
 *
 * La página lo muestra y el servidor guarda exactamente este texto con su versión junto a la
 * reserva: así lo aceptado siempre se puede demostrar. Pensado para la Ley 21.719 de protección
 * de datos personales: el permiso es específico, informado, separado de la reserva, sin casilla
 * marcada de antemano y tan fácil de retirar como de dar. Nombra las cookies y la transferencia
 * internacional porque Meta y Google procesan fuera de Chile.
 *
 * Si cambia el texto, cambia la versión: lo ya aceptado queda guardado con la anterior.
 */
export declare const VERSION_MEDICION = "medicion-v3";
/** Frase corta del aviso al entrar. */
export declare const AVISO_MEDICION = "\u00BFNos ayudas a mejorar nuestros anuncios? Con tu permiso usamos cookies de Meta y Google para medir qu\u00E9 anuncios traen reservas y mostrarte anuncios relevantes, envi\u00E1ndoles datos de tu reserva protegidos con cifrado. Tu reserva funciona igual si no aceptas.";
/** Texto completo que se acepta y se guarda. */
export declare const TEXTO_MEDICION = "Acepto que esta p\u00E1gina use cookies e identificadores de Meta (Pixel y Conversions API) y de Google (Analytics y Ads) para medir qu\u00E9 anuncios traen reservas y mostrarme anuncios relevantes de este local, incluidas audiencias de clientes. Para eso se env\u00EDan a Meta y Google el evento, la fecha, cookies de medici\u00F3n, mi direcci\u00F3n IP y navegador, y mi correo y tel\u00E9fono cifrados de forma irreversible. Meta y Google tratan estos datos fuera de Chile. Es voluntario, no condiciona la reserva y puedo retirarlo en cualquier momento desde \u00ABPreferencias de medici\u00F3n\u00BB: se dejan de enviar datos y se borran estas cookies del navegador.";
//# sourceMappingURL=measurement-consent.d.ts.map