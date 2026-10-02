# Por qué el CRM no daba las métricas que debería

Diagnóstico cerrado contra la base de producción, al 2 de octubre de 2026.

**Conclusión:** no faltaba ningún campo. Faltaba que quedara registrado el trabajo. De 72
prospectos, **uno solo** tenía una actividad escrita por una persona; todo lo demás del historial
lo había puesto el sistema al recibir la ficha.

Este documento reemplaza una versión anterior que razonaba sobre el código sin datos. Dos de
aquellas conclusiones resultaron falsas al medirlas, y se dicen abajo en vez de borrarse.

---

## 1 · Lo que se midió

Período: 72 prospectos comerciales, agosto a octubre de 2026.

| Hallazgo | Cifra |
|---|---|
| Actividades escritas por una persona | **1** de 74 |
| Actividades creadas por el sistema | 73 (`lead_ingested` 72, `lead_qualified` 1) |
| Prospectos descartados | 65 |
| …de ellos, por «Nunca respondió» | **59 (91%)** |
| …con constancia del cierre en su historial | **0** |
| Ventas cerradas en 180 días | **0** |
| Señales a Meta: «Descartado» | 62 |
| Señales a Meta: «Calificado» | 4 |

La proporción que recibe Meta está **15 a 1 en contra**, y unas 50 de esas negativas salen de
«Nunca respondió» — gente sobre la que no se juntó ninguna información.

---

## 2 · La causa raíz

`crm_interactions` sólo tenía filas automáticas. El botón de WhatsApp del tablero y de la ficha era
un enlace suelto: abría WhatsApp y **no registraba nada**.

Sin ese registro no se puede responder ninguna de las preguntas que importan:

- ¿Cuánto tarda el equipo en contactar a un lead nuevo?
- ¿Cuántos intentos hubo antes de rendirse?
- ¿«Nunca respondió» es verdad, o es que nadie escribió?
- ¿Qué campaña trae gente que **sí** contesta?

Y la que cuesta plata: los 62 «Descartado» que se le mandan a Meta descansan en información que el
sistema no tiene.

**Pedirle al equipo que lo anote a mano no iba a funcionar: ya se podía y no se hacía.**

---

## 3 · Lo que se corrigió

| | Qué | Dónde |
|---|---|---|
| 1 | El botón de WhatsApp deja constancia del envío | `registrar-whatsapp.ts`, tablero y ficha |
| 2 | Resultados muestra sin contactar, contactados y demora al primer contacto | `crm-dashboard.service.ts` |
| 3 | El descarte escribe su constancia en el historial | `update-lead.use-case.ts` |
| 4 | El corte de descartados pasa a ventana de 30 días | `list-leads.use-case.ts` |

**Sobre el 1.** Registra que *se escribió*, no que la persona contestara: es lo que el clic
demuestra. Nunca interrumpe — si la constancia falla, WhatsApp abre igual.

**Sobre el 2.** Cuenta sólo lo que escribió una persona. Incluir las automáticas daba 100% de
contactados sin que nadie hubiera levantado el teléfono. Va **antes** de «por qué perdemos
negocios»: un motivo de descarte sólo significa algo si alguien habló con esa persona.

**Sobre el 3.** `runForLead` sólo corre al crear el lead, así que un descarte hecho por una persona
—que son casi todos— no dejaba ninguna línea. Se llama la constancia desde el cierre en vez de
reejecutar toda la automatización, que también crea contactos y oportunidades.

**Sobre el 4.** Con el mes de calendario, un cierre del 31 desaparecía al día siguiente y uno del 2
duraba un mes entero. Los que **no** están descartados se ven siempre, sin límite de fecha.

### La advertencia que hay que tener presente

La métrica nueva sólo sirve si el equipo usa el botón. Si llaman por teléfono o escriben desde su
WhatsApp personal, Resultados va a seguir marcando cero. Por eso la tarjeta lo dice con palabras en
vez de mostrar un cero que parezca un dato.

---

## 4 · Lo que se revisó y estaba bien

**Los 40 leads sin reportar a Meta no eran un fallo.** Se desglosan así, y suman los 72:

| | Leads | Por qué |
|---|---|---|
| Anteriores al 31-08-2026 | 27 | La integración no existía todavía |
| Importados con origen de más de 7 días | 13 | Meta rechaza eventos más viejos; falsear la fecha arriesga el lote entero |
| Excluidos a mano | 3 | `excluded_from_meta`, decisión explícita |
| Reportados | 29 | — |

Desde el 31 de agosto la tasa es **100%**. Lo único que queda es operativo: un lead importado con
fecha de origen vieja no se va a reportar nunca, y está bien que así sea.

**La cola de envío funciona.** 75 de 75 procesados en 30 días, 103 segundos de promedio, cero
fallos recientes.

**Las dos ventas perdidas ya estaban corregidas.** Usaban el nombre estándar `Purchase`, que exige
`value` y `currency`; sin monto Meta devuelve 400 (`code=100 subcode=2804010`). El código se movió
a nombres libres y `Vendido` pasa bien. Esas dos no se reintentan solas.

**`last_error` no se trunca.** El `...` era phpMyAdmin recortando a 50 caracteres por celda. El
texto completo son 192 caracteres y está entero en la base.

---

## 5 · Dos conclusiones anteriores que los datos desmintieron

Se dejan escritas porque el documento se usó para decidir.

**«Compró en otro proyecto» archivado como basura.** Era el ejemplo con que se explicaba el
problema de que descartar pise la calificación. **En los datos aparece 0 veces.** El mecanismo es
real, el ejemplo no lo era: el motivo que domina es «Nunca respondió», con 59 de 65.

**«Nadie contacta a los leads».** Una primera consulta dio «100% sin contactar» y se leyó como
abandono. Estaba mal: la consulta miraba `lead_interactions`, una tabla de 2023 que **ningún código
escribe**. La tabla viva es `crm_interactions`. Lo que sí es cierto, ya medido bien, es que ahí sólo
hay una actividad humana — pero eso puede significar que no se contacta **o** que se contacta por
fuera sin registrar, y el sistema no puede distinguirlo. La corrección del punto 3.1 es justamente
lo que permitirá saberlo.

---

## 6 · Lo que queda pendiente

**Descartar pisa la calificación.** `update-lead.use-case.ts` fija `fitStatus = unqualified` al
descartar, sin preguntar y cualquiera sea el motivo. De los nueve motivos de la lista sólo tres
significan que el lead era malo. Mientras siga así, «qué porcentaje de los leads de esta campaña
servía» mide al vendedor y no al anuncio.

Aplazado por decisión del dueño, a la espera de su propio análisis. Cuando se retome, la decisión
difícil es qué hacer con los 62 descartes ya guardados como «no calificado»: dejarlos y medir desde
el cambio, o pasarlos a «no se sabe» salvo los tres motivos claros. *No sé* es verdad; *no servía*
no lo es.

**Dos nombres para el mismo hecho.** `QualifiedLead` (al convertir un lead en cliente) convive con
`Vendido`. Se revisó y se decidió dejarlo: quitarlo haría que aceptar una cotización dejara de
reportar la venta, porque ese camino no pasa por `UpdateLeadUseCase`. Nunca se ha disparado.

---

## 7 · Consultas para volver a medir

```sql
-- ¿Se está registrando el trabajo? Lo humano es todo lo que no sea automático.
SELECT type, COUNT(*) AS filas
FROM   crm_interactions
WHERE  lead_id IS NOT NULL
  AND  type NOT IN ('lead_ingested','lead_qualified','lead_discarded')
GROUP  BY type;

-- Demora al primer contacto real, por campaña.
SELECT COALESCE(l.campaign_name,'(sin campaña)') AS campana,
       COUNT(*)                                  AS leads,
       SUM(i.primera IS NULL)                    AS sin_contactar,
       ROUND(AVG(TIMESTAMPDIFF(HOUR, l.created_at, i.primera)), 1) AS horas_promedio
FROM   leads l
LEFT   JOIN (SELECT lead_id, MIN(`date`) AS primera
             FROM   crm_interactions
             WHERE  lead_id IS NOT NULL
               AND  type NOT IN ('lead_ingested','lead_qualified','lead_discarded')
             GROUP  BY lead_id) i ON i.lead_id = l.id
WHERE  l.domain = 'commercial' AND l.created_at >= NOW() - INTERVAL 90 DAY
GROUP  BY campana;

-- Salud de los envíos a Meta.
SELECT JSON_VALUE(event_data,'$.eventName') AS evento, status, COUNT(*) AS veces
FROM   meta_conversion_outbox
WHERE  created_at >= NOW() - INTERVAL 30 DAY
GROUP  BY evento, status ORDER BY veces DESC;
```
