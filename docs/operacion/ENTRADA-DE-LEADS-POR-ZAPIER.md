# Entrada de leads desde Make y otras integraciones

Cómo conectar un portal, un formulario de terceros o una automatización para que sus leads
entren al CRM.

## Antes de empezar: Meta no va por acá

Mientras se valida el webhook directo, los leads de Meta entran por **Make** a
`/api/public/ingest/leads`. Cuando el webhook firmado esté validado, Meta podrá entrar directo a
`/integrations/meta/webhook`.
Ahí se comprueba la firma `X-Hub-Signature-256` contra el secreto de la aplicación, lo que
demuestra que el lead viene de Meta de verdad.

Make usa una llave por campaña/origen, deduplicación e historial de recepción. Es el puente
operativo temporal; no se configura Zapier.

Esta puerta es para todo lo demás: portales inmobiliarios, formularios de terceros, WhatsApp,
planillas, o cualquier origen que Make pueda leer.

## Una llave por origen

Cada origen tiene la suya. No es burocracia: con una llave compartida, filtrarse obliga a rotarla
en todas partes a la vez y a reconfigurar cada escenario. Con una por origen se revoca la afectada y las
demás siguen recibiendo sin que nadie toque nada.

Y hay una segunda razón: **la llave determina la fuente del lead**. Quien llama no la declara. Si
pudiera, una llave del portal serviría para marcar leads como venidos de una campaña pagada, y el
costo por lead —que es lo que decide dónde se invierte— quedaría falseado sin que nada fallara.

La llave se muestra **una sola vez**, al crearla. Después solo se puede rotar. Guardarla de forma
recuperable la volvería tan insegura como no cifrarla.

## Configurar el escenario de Make

**Módulo:** *HTTP → Make a request* → `POST`

| Campo | Valor |
|---|---|
| URL | `https://refugio.espartanos.cl/api/public/ingest/leads` |
| Payload Type | `json` |
| Headers | `Authorization` → `Bearer esp_in_…` |

### Datos

```json
{
  "nombre": "Ana Pérez",
  "telefono": "+56912345678",
  "email": "ana@ejemplo.cl",
  "idExterno": "12345",
  "campana": "Primavera",
  "mensaje": "Consultó por el proyecto de Talca"
}
```

**Solo `nombre` es obligatorio**, y hace falta al menos uno entre `telefono` y `email`: un lead sin
forma de contactar no es un lead.

Los nombres de campo son tolerantes a propósito, porque en Make se mapea a mano y equivocarse
cuesta una ronda de prueba y error:

| Se guarda como | También se acepta |
|---|---|
| `nombre` | `name`, `full_name`, `fullName` |
| `telefono` | `phone`, `celular`, `mobile`, `phone_number` |
| `email` | `correo`, `mail` |
| `idExterno` | `external_id`, `externalId`, `id` |
| `campana` | `campaign`, `utm_campaign` |
| `mensaje` | `message`, `notas`, `notes`, `comentario` |

### `idExterno` importa más de lo que parece

**Make puede reintentar ante un error de servidor.** Sin un identificador estable, un corte de
red de tres segundos convierte un lead en tres.

Mapea el identificador del sistema de origen: el número de la fila, el id del formulario, lo que
sea que no cambie. Se guarda junto con el origen, así que dos portales pueden numerar desde 1 sin
pisarse entre ellos.

Si no lo mandas, el sistema deduplica por teléfono y correo. Funciona, pero es más frágil: alguien
que escribe su teléfono con y sin código de país entra dos veces.

## Qué responde

**Éxito** — Zapier muestra este cuerpo en su historial, así que sirve para comprobar de un vistazo
que está entregando de verdad:

```json
{ "ok": true, "leadId": "…", "source": "portal" }
```

**Errores**, y qué hacer con cada uno:

| Código | Mensaje | Qué revisar |
|---|---|---|
| `401` | Falta la llave | No pusiste la cabecera `Authorization` |
| `401` | Llave de integración no válida | La llave está mal, o el origen está apagado |
| `400` | Falta el nombre | Mapea `nombre` en el paso de Zapier |
| `400` | El lead necesita teléfono o correo | Mapea al menos uno de los dos |
| `400` | El correo no tiene forma de correo | Estás mapeando el campo equivocado |
| `429` | Demasiadas peticiones | Ráfaga sobre el límite; Zapier reintenta solo |

Los `4xx` **no se reintentan**: son configuración, y reintentar no los arregla. Los `5xx` sí, y por
eso `idExterno` importa.

## Diagnosticar cuando no llegan

La pantalla de orígenes muestra, por cada uno:

- **Recibidos** y **último recibido** — si dice «sin uso aún», el Zap nunca llegó a llamar. El
  problema está en Zapier, no acá.
- **Último error** — si hay uno, dice exactamente qué se rechazó y cuándo.

Esa diferencia es la que convierte «no me llegan los leads» en un diagnóstico de dos segundos: un
contador en cero **sin error** significa que nadie llamó; en cero **con error** significa que
llamaron mal.

## Si una llave se filtra

Apaga ese origen. Los demás siguen recibiendo. Después genera una llave nueva y actualiza solo el
Zap afectado.

Nada de lo ya recibido se pierde: apagar corta la entrada, no borra el historial.
