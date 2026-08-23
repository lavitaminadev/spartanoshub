# Rotar la clave de las tareas programadas

Paso a paso, sin dejar nada caído.

---

## Por qué esto importa más de lo que parece

**Un cron que no corre no da error.** No hay pantalla roja, no hay aviso, no hay nada en la
consola. Todo se ve normal.

Si la clave queda desalineada entre el servidor y el disparador, esto es lo que deja de pasar, en
silencio:

| Tarea | Lo que deja de ocurrir |
| --- | --- |
| `collection-emails` | **La cobranza no se manda.** Nadie recibe su recordatorio de pago |
| `meta-capi` | Las conversiones no llegan a Meta. Las campañas optimizan a ciegas |
| `google-ads` | Igual, del lado de Google |
| `data-retention` | Los datos personales vencidos **no se purgan**. Es una obligación legal |
| `monthly-cycles` | No se abren los ciclos del mes. Las cuentas quedan sin período |
| `operational-alerts` | Los avisos de operación no salen |
| `stale-pieces` | Las piezas atascadas no se señalan |
| `reservation-integrations` | Las reservas que no llegaron a Meta no se reintentan |
| `xp-periods` | Los períodos de puntos no se cierran |
| `meta-capi/cleanup` | La cola de eventos crece sin limpiarse |

Te enteras días después, cuando alguien echa de menos un correo. Por eso el procedimiento acepta
**dos claves a la vez**: para que no exista ni un minuto en que ninguna sirva.

---

## Antes de empezar

Necesitas dos accesos:

- **cPanel → Setup Node.js App → Environment variables** (donde vive `CRON_SECRET`).
- **El disparador**: cPanel → Cron Jobs, o el servicio externo que llame a `/api/cron/*`.

Y una clave nueva. Genérala así, en cualquier terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guárdala donde la tengas a mano durante los tres pasos. **No la reutilices** de otro servicio.

---

## Paso 1 · El servidor acepta las dos

En cPanel → Setup Node.js App → Environment variables:

1. Copia el valor actual de `CRON_SECRET`.
2. Crea `CRON_SECRET_PREVIOUS` y pega ahí ese valor.
3. Reemplaza `CRON_SECRET` por la clave nueva.
4. **Restart** de la aplicación.

Desde este momento el servidor acepta las dos: el disparador sigue funcionando con la vieja, y la
nueva ya vale.

### Verificación

Con la clave **nueva**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://refugio.espartanos.cl/api/cron/meta-capi -H "x-cron-secret: LA_NUEVA"
```

Debe responder **200**. Repite con la vieja: también **200**. Y con una inventada:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://refugio.espartanos.cl/api/cron/meta-capi -H "x-cron-secret: inventada"
```

Debe responder **403**. Si la inventada devuelve 200, para: algo no quedó bien y es peor que antes.

> Si la nueva devuelve 403, el reinicio no tomó las variables. Repite el **Restart** y vuelve a
> probar antes de seguir.

---

## Paso 2 · El disparador usa la nueva

Ahora, sin prisa —el servidor acepta las dos, así que nada se rompe mientras tanto.

En cPanel → Cron Jobs, edita cada tarea y reemplaza la clave en la cabecera. Las líneas tienen
esta forma:

```bash
curl -s -X POST https://refugio.espartanos.cl/api/cron/meta-capi -H "x-cron-secret: LA_CLAVE"
```

Son diez rutas: `meta-capi`, `google-ads`, `meta-capi/cleanup`, `stale-pieces`,
`operational-alerts`, `monthly-cycles`, `collection-emails`, `data-retention`,
`reservation-integrations`, `xp-periods`.

**Cámbialas todas.** Una que se quede con la vieja seguirá funcionando hasta el paso 3, y entonces
dejará de correr sin avisar — que es exactamente lo que este procedimiento evita.

### Verificación

Espera a que corra alguna, o dispárala a mano con la clave nueva. Las tareas tienen su gemela en
`GET` para consultar sin ejecutar:

```bash
curl -s https://refugio.espartanos.cl/api/cron/meta-capi/diagnostics -H "x-cron-secret: LA_NUEVA"
```

---

## Paso 3 · Retirar la anterior

**Este paso hay que hacerlo.** Dejar `CRON_SECRET_PREVIOUS` puesta significa que la clave vieja
sigue sirviendo para siempre, y entonces rotar no sirvió de nada: si la rotaste porque se filtró,
sigue filtrada y sigue funcionando.

1. En Environment variables, **borra** `CRON_SECRET_PREVIOUS` (la variable entera, no su valor).
2. **Restart**.

### Verificación

Con la clave **vieja**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://refugio.espartanos.cl/api/cron/meta-capi -H "x-cron-secret: LA_VIEJA"
```

Debe responder **403**. Con la nueva, **200**.

---

## Si algo sale mal

**Las tareas dejaron de correr y no sé cuál clave tiene el disparador.**
Vuelve a poner la vieja en `CRON_SECRET_PREVIOUS` y reinicia. Todo vuelve a funcionar mientras
averiguas. No es una vergüenza: es para lo que existe la segunda variable.

**Se me olvidó cuál era la vieja.**
No pasa nada: pon la nueva en todos los disparadores y borra `CRON_SECRET_PREVIOUS`. La vieja solo
servía para no cortar durante la transición.

**No sé si una tarea corrió.**
Cada una responde con lo que hizo. Las de Meta y Google tienen además `/diagnostics`, que consulta
sin ejecutar.

---

## Cuándo rotar

- **Ya**, si la clave apareció en un correo, un chat, una captura o un repositorio.
- Cuando alguien que la conocía deja el equipo.
- Una vez al año, por costumbre.

---

## Cómo está hecho por dentro

En `cron.controller.ts`, `verifySecret` acepta `CRON_SECRET` y, si está declarada,
`CRON_SECRET_PREVIOUS`. Las compara en **tiempo constante** con `timingSafeEqual`: una comparación
normal filtra la clave carácter a carácter, midiendo cuánto tarda en fallar.

Sin `CRON_SECRET` configurada **no atiende a nadie**, en vez de atender a todos. Es la decisión
segura cuando falta configuración.

Seis pruebas cubren esto en `test/unit/cron/rotacion-de-clave.spec.ts`, incluida la que comprueba
que al borrar la anterior deja de servir.
