# Matriz de acceso

Generada por `test/e2e/matriz-de-acceso.e2e.spec.ts`. **No se edita a mano.**

Qué responde cada ruta a cada cargo, con una sesión válida. `200` es que atiende;
`403` es que el cargo, la empresa o el servicio contratado no alcanzan; `404` es que
además se oculta la existencia.

| Ruta | dev | admin | equipoUno | portalCrmUno | portalReservasUno |
| --- | --- | --- | --- | --- | --- |
| CRM · leads | 200 | 200 | 200 | 200 | 403 |
| CRM · inicio | 200 | 200 | 200 | 200 | 403 |
| CRM · panel | 200 | 200 | 200 | 200 | 403 |
| CRM · rótulos de etapa | 200 | 200 | 200 | 200 | 200 |
| Clientes | 200 | 200 | 403 | 403 | 403 |
| Usuarios | 200 | 200 | 403 | 403 | 403 |
| Reservas | 200 | 200 | 200 | 403 | 200 |
| Reservas · formularios | 200 | 200 | 200 | 403 | 200 |
| Aprobaciones | 200 | 403 | 403 | 403 | 403 |
| Reuniones | 200 | 403 | 403 | 403 | 403 |
| Contenido · grillas | 200 | 403 | 403 | 403 | 403 |
| Informes · panel | 200 | 403 | 403 | 403 | 403 |
| Tareas · mías | 200 | 200 | 200 | 200 | 200 |

## Cómo leerla

- **dev** y **admin** atraviesan la organización entera: es su trabajo.
- **equipoUno** es un community manager sin cuentas asignadas en este escenario, así que
  ve las pantallas que su cargo permite pero sin datos de ninguna empresa.
- **portalCrmUno** y **portalReservasUno** son el mismo cargo (`client`) sobre empresas con
  servicios distintos. Sus respuestas de CRM y Reservas deben diferir: cada portal alcanza
  únicamente el servicio que su empresa contrató.
