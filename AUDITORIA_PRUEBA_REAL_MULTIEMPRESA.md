# Auditoría de prueba real multiempresa

Estado: en curso. No se declara apto para producción hasta cerrar esta lista y repetir los casos afectados.

## Alcance obligatorio

- 20 empresas de prueba, cada una con servicio CRM o Reservas, usuario portal y datos propios.
- Roles: desarrollo, administración, equipo con asignación, cliente CRM y cliente Reservas.
- CRM: alta manual, CSV, búsqueda, filtros, paginación, edición, cambio de etapa, asignación, excepciones y aislamiento entre empresas.
- Reservas: constructor, campos, arrastrar/soltar, enlace público, reserva, cancelación, reprogramación y concurrencia de 5, 10 y 20 intentos por horario.
- Capacidad: 1.000, 5.000 y 10.000 contactos por empresa; búsqueda, listado y tiempos medidos sin exponer datos de otra cuenta.
- Ciclo de vida: activar/desactivar empresa, usuario, servicio y excepción; comprobar menú, URL, API, recarga y expulsión de sesión.

## Hallazgos confirmados antes del recorrido de datos

1. **P1 — Leads no escala más de 100 registros en tablero.** Confirmado visualmente: el CRM muestra “100 de 100” y no hay paginación. Una empresa con 1.000 o más contactos no verá el conjunto completo.
2. **Corregido/validado — Teléfono y correo en leads.** Producción muestra columnas individuales Teléfono y Correo; ya no se concatenan.
3. **P1 — Módulos futuros requerían refuerzo en API.** Aprobaciones, reuniones y contenido podían quedar accesibles según controlador. El cierre central ya fue publicado en `4997f234`; falta validación visual tras despliegue.
4. **P1 — La capacidad del hosting no está medida.** Los límites de 1.000/5.000/10.000 contactos y 5/10/20 operaciones concurrentes no se deben asumir: se medirán con datos de prueba y se registrarán tiempos, errores y consumo.
5. **P1 — Arrastrar y soltar requiere corrección transversal.** El constructor de reservas dependía de tipos personalizados de `DataTransfer`, incompatibles con parte de los navegadores y webviews. Se reforzó con formato estándar `text/plain`, tipos propios y asa explícita para reordenar, manteniendo Subir/Bajar como alternativa. Falta validarlo visualmente en navegador tras desplegar. Kanban conserva pendiente la regresión de Escape, soltar fuera y error de API.
6. **Validado — El constructor de reservas sí ofrece alternativa accesible.** Cada campo ya expone botones Subir/Bajar; se verificará visualmente junto al arrastre y la persistencia, pero no requiere corrección de accesibilidad.
7. **Corregido/validado — Alta de empresa.** phpMyAdmin confirmó que las empresas creadas se persistieron en la organización correcta. Tras desplegar el último artefacto, la API de desarrollo devuelve las 12 empresas, incluida `QA Creation Probe 02`. El mensaje de éxito queda además protegido con lectura posterior.
8. **P0 — Portal podía listar toda la cartera de empresas.** Una sesión real de portal CRM recibió 12 empresas por `GET /clients?limit=100`, en vez de solo la asignada. Se añadió un alcance explícito por `req.user.clientId`. Su CI detectó además una expectativa obsoleta: el catálogo de clientes está fuera del alcance inicial y debe responder 403; la regresión fue ajustada a esa regla. Falta CI verde, despliegue y repetir con el mismo portal antes de continuar el lote multiempresa.
9. **P1 — Meta/CAPI no está operativo en los formularios revisados.** Los ocho formularios publicados indican “Meta apagado”; en el constructor CAPI queda deshabilitado y avisa que primero Administración/Dev debe conectar Pixel y token. Existen orígenes de captación, pero sin recepciones. Es una configuración pendiente, no evidencia aún de una falla de envío.
10. **P1 — Configuración de fase inconsistente.** El panel de acceso comunica 30 módulos activos y el editor de ciclo de vida los muestra todos como `Activo` y `Encendido`, durante una fase que solo debe operar CRM y Reservas. Aunque las puertas de fase puedan negar rutas, esta configuración habilita una futura filtración al cambiar una sola regla. Debe apagarse o ponerse en desarrollo para toda la organización cada módulo no lanzado, dejando CRM y Reservas como único alcance operativo.
11. **P1 — La matriz del cargo Cliente conserva accesos de módulos fuera del alcance inicial.** El panel muestra para Cliente permisos en informes, métricas, contenido, reuniones, documentos y aprobaciones, además de CRM/Reservas. La puerta de fase debe bloquearlos hoy, pero la matriz comunica una promesa distinta y se volverían accesibles si se relaja esa puerta. La matriz inicial debe reducirse a los módulos vendidos/operativos.
12. **Validado — Reserva pública.** Un formulario de prueba completó fecha, horario, datos, consentimiento y confirmación. La reserva quedó una sola vez en el panel interno con el mismo código y estado Confirmada.
13. **Preparado, sin datos reales — Encuestas.** No hay encuestas publicadas ni respuestas. El asistente obliga a elegir una empresa dueña para encuestas de clientes, lo que preserva el aislamiento; falta crear, publicar, responder y comprobar resultados con una empresa de prueba.
14. **P2 — Importación CSV aún no está validada de punta a punta.** El diálogo muestra carga local y exige cabecera, pero falta completar una importación sintética, comprobar mapeo de teléfono/correo, deduplicación, error de formato y aislamiento entre dos empresas.
15. **Corregido, pendiente de prueba visual — Contexto CRM de portal y etapas.** El portal ya toma la empresa exclusivamente de su sesión y no consulta el catálogo de empresas. El CRM contratado por una empresa conserva el embudo comercial aislado por empresa; reservas mantiene su ciclo `audience` fuera del CRM. Falta recorrer portal CRM con una cuenta real y comprobar que no hay selector, que URL/API no cambian la empresa y que las ocho etapas configurables se ven en tablero y lista.
16. **P1 — Proyecto de captación aún no es un campo persistido.** Make acepta nombre, teléfono, correo, campaña e identificador externo; no debe tratar `proyecto` como empresa ni usarlo para resolver el tenant. Para incorporar el campo MMT falta una entidad o catálogo de proyectos por empresa, migración, selector/filtro y resolución segura del código de proyecto desde la llave de integración. No se considera validado hasta cubrir ese contrato.
17. **Pendiente de prueba de ficha de lead.** Por cada una de dos empresas: editar contacto, tomar/reasignar, registrar interacción, abrir WhatsApp sin duplicar datos, crear/completar tarea, agendar visita, revisar calendario e historial. Debe verificarse persistencia tras recarga, aislamiento por URL/API y comportamiento del rol Setter frente a Jefatura.

## Arrastrar y soltar a validar

- Tablero de leads (dnd-kit), incluyendo movimiento válido, mismo estado, error del API, recarga y alternativa accesible de menú.
- Constructor de reservas: agregar campo desde biblioteca, reordenar campo, soltar fuera, campo protegido y persistencia al guardar/recargar.
- Oportunidades y automatizaciones se verifican como bloqueadas para no-desarrollo durante esta fase; desarrollo valida que no se rompan al arrastrar.
- Carga de logo/imagen: archivo válido, inválido, cancelación, reemplazo y error de red.

## Criterio de veredicto

La prueba solo queda aprobada si cada acción devuelve resultado verificable, no mezcla tenant, no pierde campos, no permite acceso por URL/API fuera del servicio contratado y mantiene consistencia ante concurrencia. Un fallo no detiene los demás casos: se registra, se continúa y se corrige en lote al final.
