# Qué queda pendiente y qué está desconectado

Estado de la rama `mejoras/crm-automatizaciones` al 18 de agosto de 2026.

## 1. Lo que ya quedó hecho y verificado

| Commit | Contenido |
|---|---|
| `4d652bc0` | Historial de etapas del pipeline · hilos del CRM · atribución de captura · arreglo de escritura de Pixeles |
| `4efb8feb` | Motor de automatizaciones (servidor) |
| `b13daaae` | Documentación |
| `827e671d` | Pantallas: tablero de pipeline, constructor de automatizaciones, historial de ejecuciones, seis componentes compartidos |
| `813ab8a0` | Arreglo del refresco automático |
| `2a33ab07` | Bitácora de trabajo conectada |

**691 pruebas en verde** (586 servidor + 105 interfaz). `tsc` y lint limpios.

## 2. El refresco que rompía el uso

Estaba mal de una forma concreta. `refetchWhenIdle(60_000)` devolvía **un número
calculado al renderizar**, y TanStack Query solo vuelve a preguntar cuando
recibe una función. Como la consulta no se vuelve a montar por enfocar un campo,
la decisión quedaba tomada en el instante del renderizado: quien empezaba a
escribir después recibía el refresco encima igual.

La guardia existía desde siempre y casi nunca llegaba a aplicarse.

Ahora devuelve una función, que se evalúa en cada vencimiento. Y se suma lo que
un redibujado también deshace y no se estaba mirando: un arrastre en curso, un
diálogo abierto y una selección de texto.

## 3. Procesos construidos que nadie usa

De **344 endpoints** en el servidor, la interfaz llama **175**. La diferencia no
es toda desperdicio —muchos son variantes de un mismo recurso— pero hay
controladores enteros sin una sola llamada:

| Controlador | Estado | Comentario |
|---|---|---|
| `production/pieces/:id/comments` | **Conectado en esta rama** | Ver commit `2a33ab07` |
| `crm/leads/:id/comments` | Backend listo, **sin pantalla** | Falta pestaña en el detalle del prospecto |
| `crm/opportunities/:id/comments` | Backend listo, **sin pantalla** | Falta pestaña en el detalle del trato |
| `audiovisual/sessions/:id/comments` | Backend listo, **sin pantalla** | Mismo componente, otra ruta base |
| `intake/requests/:id/comments` | Backend listo, **sin pantalla** | Mismo componente, otra ruta base |
| `dashboard/overview`, `/production`, `/financial` | **Nadie los llama** | El tablero se arma con `/reporting/dashboard` y `/reporting/performance`. Hay dos implementaciones de lo mismo y una está muerta |
| `design-budget` (`/budget`, `/reserve`, `/confirm`) | **729 líneas sin interfaz** | El modelo de capacidad en UD existe entero y no se ve en ninguna parte |
| `gamification` (ranking, disputas) | Backend completo, UI de 74 líneas | Las disputas de XP están modeladas y no hay dónde abrirlas |
| `knowledge` (`/stats`, `/search`) | 731 líneas de API, 64 de UI | La búsqueda troceada existe y no se usa |
| `objectives` (`PUT /:id`) | Sin interfaz | No se puede actualizar el avance de un objetivo |
| `integrations/google` | Sin interfaz | Solo se administra por Meta |

**El patrón:** la deuda no está en el servidor. Nueve módulos tienen backend
sólido y pantallas de menos de 200 líneas.

## 4. Flujos que siguen sin unir

1. **Ganar un trato no crea nada.** `deal.won` ya se emite y el motor puede
   escucharlo, pero no hay acción que cree contrato, cliente ni producción. El
   tramo comercial y el operativo siguen unidos por una persona que hace clic en
   dos sitios.
2. **Dos tableros distintos.** `/dashboard/*` y `/reporting/*` calculan lo mismo;
   uno está muerto. Hay que elegir cuál sobrevive.
3. **Cuatro modelos de tarea sin unificar** — `action_items` (atado a reuniones
   con borrado en cascada), `approval_requests` (polimórfico, el mejor
   candidato), `objectives`, `service_requests`. Ninguno disponible para el CRM.
4. **Capacidad sin consumo.** `pods.monthly_capacity_ud` y `ud_movements`
   modelan la carga del equipo y ninguna pantalla la muestra.

## 5. Errores al crear registros

No pude reproducir los que describes desde el modo visual, que responde siempre
200 y no ejerce la validación real del servidor. Para localizarlos hace falta
correr contra la API de verdad.

Lo que sí encontré es la **clase** de fallo: desajustes entre la forma que
devuelve el servidor y la que espera la pantalla. Un caso concreto apareció al
preparar los datos de ejemplo — `/production/pieces` responde un arreglo pelado
y basta envolverlo en `{ data }` para que el detalle caiga con
`pieces.find is not a function`. Es exactamente el modo de fallo que describes:
la pantalla no valida la forma, asume, y revienta en el primer uso.

**Cómo atacarlos bien:** hace falta la lista concreta de qué crear falla y con
qué mensaje. Con eso se corrige la causa; sin eso solo se puede adivinar.

## 6. Qué falta terminar

| Prioridad | Pendiente | Esfuerzo |
|---|---|---|
| **P0** | Pestaña de bitácora en prospecto, trato, sesión audiovisual y solicitud | Muy bajo — el componente ya existe, solo cambia `basePath` |
| **P0** | Decidir entre `/dashboard/*` y `/reporting/*`, borrar el que sobre | Bajo |
| **P1** | Acción "crear contrato/producción al ganar" en el motor | Medio |
| **P1** | Más disparadores: reserva creada/cancelada, solicitud creada, tarea vencida, fecha alcanzada | Medio |
| **P1** | Webhook de salida como acción, con su propia bandeja de salida | Medio |
| **P1** | Pantallas para `design-budget` y disputas de gamificación | Medio |
| **P2** | Generalizar `approval_requests` a tarea del CRM | Medio |
| **P2** | Paginación de servidor en `DataTable` | Medio |
| **P2** | Importación CSV de prospectos | Bajo |
| **P3** | Búsqueda sobre `knowledge_chunks` | Alto |

## 7. Repositorios externos: qué más vale la pena

La respuesta honesta es **muy poco más**, y la razón no cambió: Espartanos tiene
4.861 líneas de CSS propio con `tokens.css`, y los proyectos de referencia
(Atomic CRM sobre Material UI, Twenty y Tremor sobre Tailwind) no pueden aportar
código sin arrastrar su sistema de diseño entero.

Lo que sí conviene, por necesidad concreta y sin sobrecargar:

| Necesidad | Biblioteca | Licencia | Peso | Veredicto |
|---|---|---|---|---|
| Lienzo de nodos | `@xyflow/react` | MIT | 13 paquetes | **Ya instalada y en uso** |
| Arrastre | `@dnd-kit/*` | MIT | ya presente | **Ya en uso** |
| Gráficos | `recharts` | MIT | ya presente | **Ya en uso** |
| Importar CSV | `papaparse` | MIT | 1 paquete, ~45 KB | **Vale la pena** cuando se haga la importación |
| Reintentos, colas | — | — | — | **No instalar.** El patrón de bandeja de salida ya está resuelto en el repositorio |
| Validación de formularios | — | — | — | **No instalar.** `class-validator` ya cubre el servidor, que es donde importa |

Para lo que falta —webhooks de salida, más disparadores, unir el trato ganado con
producción— **no hace falta ninguna dependencia**: son reglas de negocio propias
sobre infraestructura que ya existe. Instalar algo ahí sería sumar mantenimiento
sin comprar nada.

De los repositorios como referencia conceptual, el único con recorrido pendiente
es **Activepieces** (MIT fuera de `packages/ee/`), para dos ideas concretas que
todavía no están: **probar un paso aislado** con datos reales sin ejecutar el
flujo entero, y **reanudar una ejecución fallida** desde el paso que falló.
`automation_run_steps` ya guarda la entrada y la salida de cada nodo, que es
justo lo que ambas necesitan.
