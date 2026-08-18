# Motor de automatizaciones

Cómo funciona, cómo se usa hoy y qué falta.

## Qué es y qué no es

**Es** un motor que reacciona a hechos del negocio: un trato cambia de etapa y a
partir de ahí se evalúan condiciones, se ejecutan acciones y se pueden intercalar
esperas de minutos, horas o días.

**No es** `workflow_templates`. Ese módulo administra las listas de etapas de los
procesos operativos (onboarding, producción, audiovisual, ciclo mensual) y no
ejecuta nada. Los dos nombres se parecen y no tienen relación; por eso el módulo
nuevo se llama `automations`.

## Las piezas

```
apps/api/src/modules/automations/
├── automation.entity.ts            cabecera + grafo en JSON
├── automation-run.entity.ts        una fila por disparo
├── automation-run-step.entity.ts   una fila por paso ejecutado
├── automation-catalog.ts           qué disparadores, condiciones y acciones existen
├── automation-graph.ts             validación y evaluación (funciones puras)
├── automation-trigger.listener.ts  evento → fila pendiente
├── automation-runner.service.ts    ejecuta lo pendiente
├── automation-actions.service.ts   los efectos
└── automations.service.ts          alta, edición, activación, consulta
```

## Por qué está construido así

**El disparador solo escribe una fila.** El bus de eventos de Nest es síncrono y
vive en memoria: si el proceso cae entre el evento y su manejador, lo que había
que hacer se pierde sin dejar rastro. Ejecutar dentro del evento además metería
el trabajo de la automatización dentro de la petición que movió el trato.

**El ejecutor copia el patrón de la bandeja de salida de conversiones.** Reservar
un lote con bloqueo en una transacción corta, trabajar fuera de ella, devolver a
la cola lo que quedó abandonado más de diez minutos, y reintentar con espera
creciente hasta cinco veces. Es el mismo problema que ya estaba resuelto para
Meta y Google, así que no se inventó otro.

**Las esperas son una fecha.** `resume_at` en la fila, y un trabajo por minuto
recoge lo que ya venció. No hace falta Redis, ni BullMQ, ni un proceso aparte —
que con 768 MB compartidos habría sido desproporcionado.

**El grafo va en JSON y la cabecera en columnas.** En cada evento hay que
responder "¿qué automatizaciones activas de esta organización escuchan esto?", y
eso se resuelve por índice. El grafo, en cambio, se lee siempre entero: repartirlo
en tablas solo agregaría uniones y volvería migración cada tipo de nodo nuevo.

**Los ciclos se rechazan al guardar.** Un bucle sin fin no degrada la
automatización: agota la memoria compartida y alcanza a toda la aplicación.

## Identidad de ejecución

Toda automatización declara un `runAsUserId`: la persona en cuyo nombre actúa.
Debe estar activa en la organización y se verifica al crear y al editar.

No es un detalle administrativo. Una automatización escribe sin que haya nadie
autenticado detrás; sin identidad declarada, sus efectos quedarían en la bitácora
sin responsable y podrían alcanzar datos que su creador no puede ver.

## Catálogo actual

**Disparadores** — `deal.created`, `deal.stage_changed`, `deal.won`, `deal.lost`,
`lead.converted`.

Solo se listan los que hoy tienen un evento emitido de verdad. Declarar uno que
nadie emite produce automatizaciones que se guardan, se activan y no corren
nunca: peor que no ofrecerlo, porque parece que funciona.

**Condiciones** — `equals`, `not_equals`, `contains`, `is_empty`, `is_not_empty`,
`greater_than`, `less_than`, sobre cualquier campo del contexto.

**Acciones** — `notify_user`, `notify_assignee`, `send_email`, `assign_user`,
`add_comment`.

**Esperas** — minutos, horas o días.

En los textos se puede usar `{{campo}}` para insertar un valor del contexto.
Deliberadamente no es un lenguaje de plantillas: solo reemplaza claves planas.
Cualquier cosa más expresiva acabaría siendo código ejecutable dentro de un campo
de texto editable desde una pantalla.

## Cómo se usa hoy

Todavía no hay editor visual. Se administra por API:

```
GET    /automations/catalog        disparadores y acciones disponibles
GET    /automations                listar
POST   /automations                crear (nace desactivada)
PUT    /automations/:id            editar el flujo
POST   /automations/:id/active     activar o desactivar
GET    /automations/:id/runs       ejecuciones recientes
GET    /automations/runs/:runId    detalle paso a paso
DELETE /automations/:id            eliminar
```

Ejemplo de flujo: al ganar un trato de más de un millón, avisar al responsable
pasadas dos horas.

```json
{
  "name": "Aviso de trato grande ganado",
  "triggerType": "deal.won",
  "runAsUserId": "<uuid de una persona activa>",
  "graph": {
    "nodes": [
      { "id": "t1", "type": "trigger",   "key": "deal.won",        "config": {} },
      { "id": "c1", "type": "condition", "key": "field",           "config": { "field": "amount", "operator": "greater_than", "value": 1000000 } },
      { "id": "d1", "type": "delay",     "key": "wait",            "config": { "amount": 2, "unit": "hours" } },
      { "id": "a1", "type": "action",    "key": "notify_assignee", "config": { "title": "Trato ganado", "message": "El trato {{opportunityId}} se cerró en {{amount}}." } }
    ],
    "edges": [
      { "id": "e1", "source": "t1", "target": "c1" },
      { "id": "e2", "source": "c1", "target": "d1", "branch": "true" },
      { "id": "e3", "source": "d1", "target": "a1" }
    ]
  }
}
```

## Seguridad al desplegar

**Toda automatización nace desactivada**, incluso si se pide lo contrario.
Mientras nadie active una a propósito, el sistema se comporta exactamente igual
que antes: los disparadores no encuentran nada que ejecutar y el trabajo
periódico no procesa nada.

## Qué falta

- **Editor visual** con React Flow. El catálogo (`/automations/catalog`) está
  pensado para que el editor construya su paleta leyéndolo, de modo que agregar
  una acción no obligue a tocar el frontend.
- **Más disparadores**: reservas, solicitudes, tareas vencidas, fecha alcanzada.
  Cada uno necesita que su módulo emita el evento; el motor ya está listo para
  recibirlos.
- **Más acciones**: webhook de salida, crear tarea, crear proyecto, etiquetas,
  Meta CAPI. La de webhook debería tener su propia bandeja de salida en vez de
  llamar en línea, por la misma razón que la tienen Meta y Google.
- **Probar un paso aislado** desde el editor. `automation_run_steps` ya guarda
  entrada y salida por nodo, que es lo que hace falta para sostenerlo.
