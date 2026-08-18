# Personalizar el formulario de reservas

Qué se puede cambiar sin tocar código, dónde se cambia y qué archivo hay que abrir cuando sí
hace falta.

## Dónde se edita todo

**Reservas → abrir un formulario → constructor.** Todo lo de esta página se guarda en
`reservation_forms.design_config`, un JSON por formulario. No hay que desplegar para cambiarlo.

## Fondo y apariencia

Sí, el fondo se cambia desde el formulario. Las opciones disponibles:

| Ajuste | Clave | Valores |
|---|---|---|
| Modo de fondo | `backgroundMode` | `gradient`, `image`, `color` |
| Imagen | `backgroundImage` | dirección de la imagen |
| Degradado | `backgroundGradient` | CSS, ej. `linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)` |
| Color plano | `backgroundColor` | hexadecimal |
| Opacidad | `backgroundOpacity` | 0 a 100 |
| Encuadre | `backgroundPosition`, `backgroundSize` | `center`, `cover`… |
| Colores | `primaryColor`, `accentColor`, `textColor` | hexadecimal |
| Tipografía | `fontFamily` | familia CSS |
| Redondeos | `buttonRadius`, `fieldRadius` | píxeles |
| Posición del recuadro | `layoutPosition` | `center`, `left`, `right` |

El contraste del texto se calcula solo (`shared/color-contrast.ts`): si eliges un fondo oscuro,
el texto se aclara para seguir siendo legible. No hay que ajustarlo a mano.

## Textos de la confirmación

| Qué | Clave | Por defecto |
|---|---|---|
| Bienvenida | `welcome` | «Elige el horario que mejor te acomode.» |
| Mensaje al confirmar | `confirmationMessage` | «Tu reserva quedó registrada. Te esperamos.» |
| Título al responder encuesta | `surveySuccessTitle` | «Gracias por tu opinión» |
| Aviso del calendario | `calendarSaveText` | explica que el dispositivo pedirá confirmar |
| Botón de WhatsApp | `whatsappShareText` | «Guardar en WhatsApp» |

## Recomendaciones del local

Las cuatro líneas bajo el código de reserva. Se escriben **una por línea** en el campo
`venueTips`; se muestran como máximo cuatro.

Vienen escritas con estas cuatro, que responden lo que la persona se pregunta igual:

```
Te esperamos 10 minutos antes para acomodarte con calma.
Estamos en la esquina; si llegas en auto, hay estacionamiento a media cuadra.
Si te surge algo, avísanos con tu código y liberamos la mesa sin problema.
¿Alguna duda antes de venir? Escríbenos y te respondemos.
```

**Por qué esas cuatro.** Cada una evita una llamada al local o una inasistencia:

- **Hora de llegada** — da una instrucción concreta y quita la duda de a qué hora salir.
- **Estacionamiento** — es la fricción que aparece más tarde y la que más retrasa la llegada.
- **Cómo cancelar** — la que más pesa. Ofrecer la salida **reduce** la inasistencia: quien sabe
  que puede cancelar avisa, en vez de simplemente no aparecer.
- **Canal de dudas** — evita que una duda menor termine en una cancelación silenciosa.

Hay otras cuatro sugeridas —celebraciones, anfitrión, restricciones alimentarias, niños— con el
motivo de cada una en `apps/web/src/features/reservations/success/venue-tips.ts`.

Para agregar una sugerencia nueva al catálogo, se agrega una entrada a `VENUE_TIP_PRESETS` en
ese archivo. Para cambiar lo que ve un local concreto, **no se toca código**: se edita su campo.

## WhatsApp

El botón «Guardar en WhatsApp» **no necesita ninguna integración**. Abre WhatsApp con el mensaje
ya escrito —local, fecha, personas y código— y la persona decide si lo envía y a quién.
Normalmente se lo manda a sí misma o a quien la acompaña.

Con `venuePhone` configurado (formato internacional, solo dígitos) el enlace abre la
conversación con el local. Sin él, deja elegir destinatario.

**Lo que esto no hace, para no prometerlo:** no envía nada por su cuenta. Un mensaje automático
al confirmar, o un recordatorio el día anterior sin que la persona haga nada, exige la API de
WhatsApp Business. Ver `CONFIRMACION-POR-WHATSAPP.md`.

## Archivos

| Qué quieres cambiar | Archivo |
|---|---|
| Catálogo de recomendaciones sugeridas | `apps/web/src/features/reservations/success/venue-tips.ts` |
| Cómo se arma el mensaje de WhatsApp | `apps/web/src/features/reservations/success/whatsapp-link.ts` |
| Cómo se ven las recomendaciones | `apps/web/src/features/reservations/success/VenueTips.tsx` |
| El botón de compartir | `apps/web/src/features/reservations/success/ShareBooking.tsx` |
| Estilos de la página pública | `apps/web/src/features/reservations/PublicReservationPage.premium.css` |
| Valores iniciales al crear un formulario | `apps/api/src/modules/reservations/application/reservations.service.ts` |

Cada archivo lleva en su cabecera qué resuelve y dónde se usa, para no tener que rastrearlo.
