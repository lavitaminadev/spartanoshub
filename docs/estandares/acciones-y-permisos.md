# Estándares: acciones, permisos y flujo

Lo aprendido corrigiendo veintitantos fallos en el CRM. No es teoría: cada regla de aquí nació
de algo que estaba roto y de lo que costó encontrarlo.

Sirve para dos cosas: escribir lo próximo sin repetir los mismos errores, y saber qué revisar
cuando algo se comporta raro.

---

## 1. Las tres rejas

Un dato es visible solo si las tres dejan pasar. Son independientes y responden preguntas
distintas.

| Reja | Pregunta | Dónde vive |
| --- | --- | --- |
| **Rol** | ¿Este cargo alcanza este módulo? | `role-permissions.ts` + `PermissionGuard` |
| **Cuenta** | ¿Esta persona alcanza esta empresa? | `AccountAccessService` |
| **Capacidad** | ¿Esta empresa contrató este servicio? | `ClientCapabilityService` |

Y una cuarta, que no filtra sino que acota dentro:

| **Perfil** | ¿Cuánto abarca dentro de lo que alcanza? | `lead-visibility.ts` |

El nivel se deduce del método: `GET` exige `view`, `POST`/`PUT`/`PATCH` exigen `edit`, `DELETE`
exige `manage`. No hace falta declararlo.

### La regla que más cuesta

> **Un alcance vacío no es la ausencia de alcance.**

`undefined` significa «sin límite». `[]` significa «ninguna cuenta». Confundirlos convierte a
alguien sin acceso en alguien con acceso total. Se ha visto dos veces en este código:

```ts
// Mal: sin cuentas, no filtra nada.
if (clientIds?.length) where.clientId = In(clientIds);

// Bien: sin cuentas, no devuelve nada.
if (clientIds !== undefined) where.clientId = In(clientIds.length ? clientIds : ['']);
```

### El endpoint que responde «por todo lo que alcanzo»

Es el más fácil de saltarse. Un control escrito como *«comprueba la empresa pedida»* **no
comprueba nada cuando no se pide ninguna**. Pasó con el inicio y el panel del CRM: bastaba
omitir un parámetro para recibir las cifras de toda la organización.

Si un endpoint acepta un filtro opcional de empresa, tiene que resolver además las cuentas
alcanzables y aplicarlas cuando el filtro no viene.

---

## 2. Botones: lo que se ofrece es lo que se puede hacer

> **Un botón que siempre falla se lee como que la pantalla está rota, no como que no
> corresponde.**

Antes de añadir una acción, tres preguntas:

1. **¿Aplica en este contexto?** Un CRM tiene dos embudos. Convertir en cliente vale para un
   prospecto de la agencia y no para un comensal de un local. Agendar mueve a «visita agendada»
   en uno y a «reservó» en el otro.
2. **¿Quien mira puede hacerlo?** El portal del cliente entra en solo lectura. Ofrecerle
   «Guardar» solo sirve para que reciba un 403.
3. **¿El módulo está encendido?** «Traer de Meta» con las integraciones apagadas solo puede
   fallar, y el error no dice que sea configuración.

La condición vive **en el contexto compartido**, no repetida en cada pantalla:

```ts
// crm-scope.ts
puedeEditar: boolean;   // el portal mira, el equipo mueve
esAgencia: boolean;     // qué embudo se está mirando
```

Repetir la regla en seis sitios garantiza que el séptimo se olvide. Ya pasó.

### Acciones sin vuelta atrás

Piden confirmación, y la confirmación **nombra lo que va a pasar**, no lo que se pulsó:

- Mal: «¿Seguro que quieres quitar esta campaña?»
- Bien: «Se borra la campaña y su inversión. Los leads se conservan, pero su costo por lead deja
  de calcularse, también hacia atrás.»

La primera pide un sí. La segunda deja decidir.

---

## 3. Reglas de negocio: en la base, no solo en el código

Una regla que vive únicamente en un caso de uso protege **la puerta por la que pasa el equipo** y
ninguna otra: no protege de una importación antigua, de una integración, ni de un `UPDATE` a mano
para arreglar algo.

En producción había un contacto de campaña en estado `won`. Efecto: **sin columna donde
dibujarse**. No estaba borrado; era invisible. Y seguía contando en los totales.

```sql
ALTER TABLE leads ADD CONSTRAINT CHK_leads_status_domain CHECK (...)
```

**Criterio:** si un valor inválido deja el registro invisible o corrompe una cifra, la regla va
también en la base. Si solo produce un mensaje feo, basta con el código.

---

## 4. Estandarización pendiente

Lo que hoy está resuelto de dos maneras distintas. No es urgente; es lo que conviene unificar
antes de que crezca más.

### 4.1 La respuesta de una lista

El CRM devuelve `{ data, total }` y reservas `{ items, total, page }`. Cada pantalla que consuma
las dos tiene que saber cuál es cuál — y las pruebas también.

**Propuesta:** `{ data, total, page, pageSize }` en todo endpoint que pagine. Cambio mecánico,
pero toca las pantallas que ya consumen `items`.

### 4.2 Confirmar antes de borrar

Hay tres formas conviviendo: `DeleteRecordModal` (contactos), un `Modal` a mano (campañas,
llaves) y borrado directo sin preguntar. **Propuesta:** un solo `ConfirmarAccion` con título,
consecuencia y botón nombrado.

### 4.3 Vocabulario del dominio

`clientId` es la empresa cliente; `client` es también el rol del portal. En el mismo archivo,
`client` puede significar dos cosas. **Propuesta:** en código nuevo, `empresa` para la entidad y
`portal` para el rol.

### 4.4 Un solo sitio por regla

Ya unificados: el rótulo de etapa (`etapaLabel`), el enlace de WhatsApp (`contacto.ts`), el
alcance por cuenta (`AccountAccessService`), la capacidad (`ClientCapabilityService`), quién
puede escribir (`scope.puedeEditar`).

Sin unificar: los estados de un lead están declarados en `packages/shared`, en el enum de la API,
en `STATUSES_BY_DOMAIN`, en `stage-labels.ts` y en `status-palette.ts`. Cinco sitios. Hay pruebas
que los comparan entre sí —por eso se detectó que faltaban «Visitó» y «Descartado»— pero la
comparación es un parche sobre la duplicación, no su solución.

---

## 5. Seguridad: lo aprendido

### Lo que resistió

- Un registro ajeno responde **404, no 403**: decir que existe ya es contar algo.
- Las llaves de ingesta se guardan **solo como huella**, como una contraseña.
- Una llave apagada responde **igual que una inexistente**: distinguirlas confirmaría a un
  tercero que la suya es válida.
- Desactivar una cuenta **echa a quien esté dentro**, no solo impide el próximo ingreso.
- Restablecer la contraseña de otra persona **exige confirmar la propia**: es tomar el control de
  esa cuenta.

### Lo que falló, y el patrón que comparten

| Fallo | Patrón |
| --- | --- |
| El inicio y el panel respondían por toda la organización | Control sobre el parámetro, no sobre el alcance |
| La capacidad `crm` no se comprobaba en ninguna parte | Se declara un concepto y no se aplica |
| Un comensal podía convertirse en empresa cliente | Acción sin comprobar el contexto |
| El portal veía botones de escritura | Permiso en el servidor, no en la pantalla |
| Un lead en estado imposible | Regla solo en el código |

**El patrón común:** todos son *omisiones*, no errores. Nada falla, nada se registra, nadie se
entera. Por eso las pruebas tienen que comprobar **el efecto** —qué quedó en la base— y no el
código de respuesta.

### Lo que sigue abierto

1. **El límite de acceso es por dirección de origen, no por persona.** Cinco intentos por minuto
   para toda una oficina. Ajustable con `AUTH_THROTTLE_LIMIT`, pero el reparto sigue siendo por
   IP.
2. **El camino directo de Meta** (`/webhooks/meta`) exige que cada campaña esté registrada con su
   nombre exacto. Si no, el lead queda en error en vez de entrar mal — es la decisión correcta,
   pero hay que saberlo antes de encenderlo.
3. **Las seis fuentes de autorización** siguen sin unificar: 216 decoradores `@Roles` en 43
   controladores, más la matriz, el interruptor por organización, el ciclo de vida de módulos, los
   manifiestos del frontend y el perfil cacheado en el navegador. Es la deuda más grande que
   queda.

---

## 6. Cómo se prueba

```bash
npm run test:api --workspace @espartanos/api    # unitarias, rápidas
npm run test:e2e --workspace @espartanos/api    # extremo a extremo, necesitan MariaDB
```

Las de extremo a extremo arrancan **la API de verdad** en un puerto libre contra
`espartanos_test`, y entran por el mismo inicio de sesión que una persona.

Tres reglas que costaron caro:

1. **Comprobar el efecto, no la respuesta.** Que la API devuelva 200 al quitar un acceso no dice
   nada si el acceso sigue funcionando en la petición siguiente.
2. **Comprobar también el caso positivo.** Una prueba de aislamiento pasa igual si la pantalla
   está rota y no devuelve nada. Sin la comprobación de que quien sí alcanza las cuentas las ve,
   un filtro que lo tapa todo se ve idéntico a uno correcto.
3. **Puerto libre por ejecución.** Con puerto fijo, una API viva de la ejecución anterior sigue
   respondiendo y las pruebas confirman una corrección que no está puesta. Es la peor forma de
   fallar: verde y mintiendo.
