# Estado de la rama y qué queda pendiente

Rama `mejoras/crm-automatizaciones`, al 18 de agosto de 2026.
Punto de retorno: tag `punto-retorno-2026-08-18` → commit `25309384`.

## 1. Estado de la lista de pendientes

| Prioridad | Pendiente | Estado |
|---|---|---|
| P0 | Bitácora en prospecto, trato, sesión audiovisual y solicitud | **Hecho** — las cinco áreas |
| P0 | Decidir entre `/dashboard/*` y `/reporting/*`, borrar el que sobre | **Hecho** — borrado el muerto |
| P0 | Captura de atribución (`fbp`, `fbc`, anuncio, IP) | **Hecho** |
| P0 | Historial de etapas del pipeline | **Hecho** |
| P1 | Acción «abrir contrato al ganar» | **Hecho** |
| P1 | Webhook de salida con su propia bandeja | **Hecho** |
| P1 | Disparadores de tiempo: tarea vencida, trato sin seguimiento | **Hecho** |
| P1 | Disparadores de reserva y solicitud | **Pendiente** — ver §3 |
| P1 | Pantallas para `design-budget` y disputas de gamificación | **Pendiente** |
| P2 | Importación CSV de prospectos | **Hecho** |
| P2 | Errores de validación que digan qué campo falla | **Hecho** |
| P2 | Generalizar `approval_requests` a tarea del CRM | **Pendiente** |
| P2 | Paginación de servidor en `DataTable` | **Pendiente** |
| P3 | Búsqueda sobre `knowledge_chunks` | **Pendiente** — ver §4 |

**Verificación:** 591 pruebas de servidor y 112 de interfaz, todas en verde.
`tsc`, lint y `build:cpanel` limpios.

## 2. Lo que se borró y por qué

**El módulo `dashboards`** (`/dashboard/overview`, `/production`, `/financial`).

Había dos implementaciones del mismo tablero. `/reporting/*` lo consumen cinco
pantallas; a `/dashboard/*` no lo llamaba nadie.

No aportaba nada que el otro no tenga —solo conteos crudos— y sí tenía un
problema: contaba clientes, piezas y contratos de toda la organización **sin
pasar por el alcance por cuenta**. Mientras estuvo desconectado no importó;
conectarlo habría mostrado cifras que su rol no debe ver.

## 3. Los disparadores que faltan, y por qué no se hicieron

`reserva creada`, `reserva cancelada` y `solicitud creada` exigen inyectar el
emisor de eventos en `reservations.service.ts` (1.509 líneas, el archivo más
grande del repositorio) y en `service-requests.service.ts`.

Es el camino por donde entra el dinero de las reservas, con bloqueos por día y
pruebas de carga propias. Tocarlo para agregar un `emit` es de bajo riesgo en sí
mismo, pero merece hacerse solo y con su propia verificación, no dentro de una
tanda que ya cambió doce cosas.

Los de tiempo (`tarea vencida`, `trato sin seguimiento`) sí se hicieron, porque
son un archivo nuevo que no toca nada existente.

## 4. `knowledge_chunks`: qué hacer con él

731 líneas de servidor, 64 de interfaz, y sus dos endpoints útiles —`/stats` y
`/search`— no los llama nadie.

**No conviene borrarlo, pero tampoco terminarlo ahora.** La tabla ya está
troceada para búsqueda, que es la parte laboriosa y la que no se puede rehacer
sin volver a procesar todo el contenido. Lo que falta es la búsqueda en sí, y
hacerla bien pide decidir si basta con coincidencia de texto —que MySQL resuelve
con un índice de texto completo— o si se quiere búsqueda por significado, que
exige un servicio de vectores y es desproporcionado para 768 MB compartidos.

Es una decisión de producto, no una tarea pendiente. Mientras no se tome, el
módulo no molesta: está apagado y no cuesta nada.

## 5. Lo que sigue construido sin conexión

| Qué | Estado |
|---|---|
| `design-budget` (`/budget`, `/reserve`, `/confirm`) | 729 líneas sin ninguna pantalla. El modelo de capacidad en UD existe entero y no se ve |
| `gamification` (ranking, disputas) | Backend completo, interfaz de 74 líneas. Las disputas de XP están modeladas y no hay dónde abrirlas |
| `objectives` (`PUT /:id`) | No se puede actualizar el avance de un objetivo |
| `integrations/google` | Sin pantalla; solo se administra Meta |
| `knowledge` (`/stats`, `/search`) | Ver §4 |

De 344 endpoints, la interfaz llama 175. Parte de esa diferencia son variantes
del mismo recurso, pero lo de la tabla es ausencia real de pantalla.

## 6. Sobre los errores al crear

**No se pudieron reproducir** y hay una razón concreta: no hay MySQL local y el
modo visual responde siempre 200, así que no ejerce la validación del servidor.

Lo que sí se corrigió es la causa de que fueran indistinguibles. El servidor
tiene `forbidNonWhitelisted: true`, así que **cualquier campo de más devuelve
400**, y responde `{ field, message }` por cada campo inválido. El frontend
descartaba `field`: un formulario con ocho casillas mostraba «must be a UUID»
sin decir cuál. Ahora nombra el campo con la etiqueta que se ve en pantalla y
traduce los mensajes habituales.

Se revisaron formulario contra DTO en intake, oportunidades y parrilla de
contenido: **coinciden**. El `{ pieces: [...] }` que parecía sospechoso sí
corresponde a `ResolveWorkRequestDto`.

**Para arreglar los que quedan hace falta la lista concreta**: qué se intenta
crear, y el mensaje que aparece ahora. Con el arreglo de esta tanda ese mensaje
ya debería señalar el campo.

## 7. Dependencias instaladas

| Paquete | Licencia | Para qué |
|---|---|---|
| `@xyflow/react` | MIT | Lienzo del constructor de automatizaciones |
| `papaparse` + tipos | MIT | Lectura del CSV en el navegador |

Nada más. Para lo que queda —los disparadores de reserva, las pantallas
faltantes, la paginación— **no hace falta ninguna dependencia**: son reglas
propias sobre infraestructura que ya existe.
