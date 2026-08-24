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

1. **P1 — Leads no escala más de 100 registros en tablero.** `LeadsBoardPage` pide `limit=100` y no implementa paginación. Una empresa con 1.000 o más contactos no verá el conjunto completo.
2. **P1 — Teléfono y correo aparecen concatenados en la tabla de leads.** Confirmado visualmente en producción: no hay separador ni columnas independientes. El código los agrupa intencionalmente, pero el flujo operativo exige columnas separadas para copiar, filtrar y revisar cada dato sin ambigüedad.
3. **P1 — Módulos futuros requerían refuerzo en API.** Aprobaciones, reuniones y contenido podían quedar accesibles según controlador. El cierre central ya fue publicado en `4997f234`; falta validación visual tras despliegue.
4. **P1 — La capacidad del hosting no está medida.** Los límites de 1.000/5.000/10.000 contactos y 5/10/20 operaciones concurrentes no se deben asumir: se medirán con datos de prueba y se registrarán tiempos, errores y consumo.
5. **P2 — Tablero genérico no limpia el estado si se cancela el arrastre.** `KanbanBoard` maneja fin de arrastre, pero no cancelación; Escape o una interrupción puede dejar la superposición visual activa hasta el siguiente gesto.
6. **Validado — El constructor de reservas sí ofrece alternativa accesible.** Cada campo ya expone botones Subir/Bajar; se verificará visualmente junto al arrastre y la persistencia, pero no requiere corrección de accesibilidad.
7. **P0 — Alta de empresa no queda verificablemente persistida.** En producción, `POST /clients` devolvió `201 Created` con un UUID y organización correctos para `QA Creation Probe 02`; el `GET /clients` inmediatamente posterior devolvió el mismo total de cinco, sin ese UUID ni el nombre. La interfaz además mostró “Cliente creado correctamente”. Puede ser escritura no persistida o lectura/escritura contra estados distintos. El lote de 20 se detiene: sin una empresa recuperable no es posible certificar aislamiento, cuentas ni capacidad.

## Arrastrar y soltar a validar

- Tablero de leads (dnd-kit), incluyendo movimiento válido, mismo estado, error del API, recarga y alternativa accesible de menú.
- Constructor de reservas: agregar campo desde biblioteca, reordenar campo, soltar fuera, campo protegido y persistencia al guardar/recargar.
- Oportunidades y automatizaciones se verifican como bloqueadas para no-desarrollo durante esta fase; desarrollo valida que no se rompan al arrastrar.
- Carga de logo/imagen: archivo válido, inválido, cancelación, reemplazo y error de red.

## Criterio de veredicto

La prueba solo queda aprobada si cada acción devuelve resultado verificable, no mezcla tenant, no pierde campos, no permite acceso por URL/API fuera del servicio contratado y mantiene consistencia ante concurrencia. Un fallo no detiene los demás casos: se registra, se continúa y se corrige en lote al final.
