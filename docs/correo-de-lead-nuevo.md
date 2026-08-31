# Correo de lead nuevo

Qué hace, a quién le llega y qué decisiones quedan abiertas.

Implementado en `c2e85ae7` por `dev@lavitamina.com`, no por esta sesión. Documentado aquí tras
leerlo; **no se ha visto funcionar contra un envío real**.

---

## Qué hace

Cuando entra una **ficha nueva** al CRM, avisa por correo a las personas de la empresa dueña de ese
lead.

`apps/api/src/modules/crm/leads/lead-created-email.listener.ts`

## Cuándo se dispara

`LeadIntakeService` emite `lead.created`, y solo si la captura **creó** una ficha. Una recaptura del
mismo lead —el mismo `external_lead_id` llegando otra vez— no vuelve a avisar.

Esa distinción importa con Make: su escenario reintenta y llegó a mandar el mismo lead **nueve
veces**. Sin la bandera `created` serían nueve correos.

```
LeadIntakeService.capture()
        │
        ├─ persistCapture() devuelve { lead, contact, created }
        │
        └─ anunciarCreacion(lead, created)
                 └─ si created → emit('lead.created')
                          └─ LeadCreatedEmailListener
```

## Es distinto de `lead.received`

Conviven dos avisos de entrada y no son intercambiables:

| | `lead.received` | `lead.created` |
|---|---|---|
| Para qué | Atribución en Meta | Aviso por correo |
| Dominio audiencia | se omite | se incluye |
| En una recaptura | se emite | **no** se emite |
| Importados con más de 7 días | se omite | se incluye |

## A quién llega

**A los usuarios de la empresa dueña del lead**, no a la agencia.

El vínculo es `users.client_id`. Todos los usuarios activos de esa empresa reciben el aviso, y se
deduplica por dirección para que una ficha duplicada no produzca dos correos a la misma bandeja.

**Dos casos en los que no manda nada, a propósito:**

- **Lead sin empresa** (`clientId` nulo) — es un prospecto de la propia agencia y no hay
  destinatario de cliente que sea correcto.
- **Empresa sin usuarios** — no se inventa un destinatario ni se cae hacia una dirección global.
  Es lo que evita filtrar el lead de una empresa a otra.

## Cómo se enciende

Es un ajuste por empresa, editable en la pantalla **Correos**:

| Clave | Qué es |
|---|---|
| `email.new_lead_enabled` | El interruptor. **Solo manda si vale exactamente `true`** |
| `email.new_lead_subject` | Asunto |
| `email.new_lead_body` | Cuerpo |

Y por encima de todo, `SMTP_ENABLED` en el servidor: apagado, no sale nada aunque el aviso esté
encendido.

## Qué variables lleva la plantilla

`responsable` · `lead` · `origen` · `campana` · `telefono` · `correo`

**No lleva** las respuestas del formulario, ni la calificación, ni las notas internas, ni el monto
estimado. Es correcto: son datos comerciales que no le corresponden a quien recibe el aviso.

## Si el correo falla

El lead **se conserva igual**. El evento se emite después de la transacción, y el manejador traga
sus propios errores. Un SMTP caído no puede deshacer una captura ya confirmada.

---

## Lo que queda abierto

### 1. Cambia quién ve los correos

Hasta ahora los correos los manejaba solo Espartanos. **Este aviso va a los usuarios del cliente.**
Es coherente con lo que hace —es su lead—, pero es una decisión que conviene que sea consciente.

### 2. Hoy probablemente no manda nada

Requiere que la empresa **tenga usuarios**. Compruébalo:

```sql
SELECT c.name AS empresa,
       COUNT(u.id) AS usuarios_activos,
       SUM(u.email IS NOT NULL AND u.email <> '') AS con_correo
FROM clients c
LEFT JOIN users u ON u.client_id = c.id AND u.is_active = 1
GROUP BY c.id, c.name;
```

Si GRDS sale con cero, el aviso no llega a nadie aunque lo enciendas.

### 3. Sin verificar

No lo he visto entregar un correo. Antes de que entren leads reales, enciéndelo para una empresa
con un usuario tuyo y provoca una captura de prueba.

---

## Archivos

| Archivo | Papel |
|---|---|
| `modules/crm/leads/lead-created-email.listener.ts` | El manejador |
| `modules/crm/leads/lead-intake.service.ts` | Emite `lead.created` con la bandera `created` |
| `modules/crm/crm.module.ts` | Lo registra |
| `test/unit/crm/lead-created-email.listener.spec.ts` | Sus pruebas |
