# Traspaso técnico — CRM multiempresa de Espartanos

Fecha de corte: 25 de agosto de 2026  
Repositorio: `lavitaminadev/spartanoshub`  
Rama funcional: `main`  
Último commit validado: `5aff8e73c58929a9dc836d96de509b5e9e6df837`

## Instrucción para continuar

Este documento describe el estado comprobado del CRM. Antes de modificar:

1. Actualizar `main` y confirmar que HEAD sea `5aff8e73` o posterior.
2. No recuperar el modelo anterior donde el portal cliente solo podía mirar el CRM.
3. No mezclar Reservas con CRM: comparten personas, pero tienen capacidades, rutas y ciclos distintos.
4. No confiar en `clientId`, empresa o embudo enviados por un portal. La sesión determina su empresa.
5. Separar siempre: implementado, probado localmente, validado por CI y validado visualmente en producción.
6. No incluir `apps/*/dist` ni `packages/shared/dist` en commits funcionales.

## Modelo de producto vigente

### Espartanos

- `dev`: acceso técnico total.
- Administración y equipo interno: ven módulos según permiso efectivo, ciclo de módulo y empresas asignadas.
- La administración de campañas, llaves, vocabulario y conexiones pertenece a Espartanos.
- Convertir un prospecto en empresa cliente es una acción de la agencia, no una etapa normal del CRM de un cliente.

### Empresa cliente

- Solo ve servicios contratados mediante sus capacidades (`crm`, `reservations`, etc.).
- Si tiene CRM, sus usuarios pueden crear leads, importar, editar ficha, cambiar etapas, asignar/desasignar, registrar actividades y administrar tareas dentro de su empresa.
- No puede leer ni escribir otra empresa, aunque manipule URL, query string o cuerpo JSON.
- No puede administrar empresas, usuarios internos, campañas, llaves ni configuración de Espartanos.
- Un cliente con solo CRM no recibe Reservas; uno con solo Reservas no recibe CRM.

### Embudos

- CRM operativo: dominio `commercial`, también cuando pertenece a una empresa cliente; `clientId` proporciona el aislamiento.
- Reservas/audiencia: dominio `audience`, reservado al ciclo derivado de reservas.
- Marcar un lead CRM como `won` significa Venta y no crea una empresa de Espartanos.
- `POST /crm/leads/:id/convert` solo corresponde al embudo propio de la agencia, exige `crm:manage` y rechaza leads asociados a una empresa cliente.

## Correcciones aplicadas

### 1. Acceso y aislamiento multiempresa

- El rol cliente con CRM pasó de `view` a `edit`.
- Listado, detalle, actualización, actividades y tareas verifican organización, empresa accesible y capacidad CRM.
- Crear e importar desde un portal derivan `clientId` desde `req.user.clientId`.
- Para un portal, el servidor fuerza dominio `commercial` aunque el cuerpo declare `audience`.
- Manipular u omitir `clientId` no permite sacar un lead de la empresa.
- Mover un lead a otra empresa desde el portal responde 403.
- Los usuarios con perfil de venta pueden limitarse a leads propios; el perfil principal ve el CRM de su empresa.
- Administración del CRM se oculta al cliente.

Archivos centrales:

- `apps/api/src/core/authorization/role-permissions.ts`
- `apps/api/src/modules/crm/leads/lead.controller.ts`
- `apps/api/test/e2e/crm-por-empresa.e2e.spec.ts`
- `apps/api/test/e2e/usuarios-de-cliente.e2e.spec.ts`
- `apps/api/test/e2e/aislamiento-cuentas.e2e.spec.ts`
- `apps/api/test/e2e/matriz-de-acceso.e2e.spec.ts`

### 2. Ficha completa y catálogo MMT

Se incorporó el flujo observado en MMT sin copiar su infraestructura:

- Etapas: Nuevo, Contactado, Calificado, Visita agendada, Visitó, Negociación, Venta y Descartado.
- Calificación independiente: Pendiente, Calificado y No calificado.
- Semáforo manual independiente del puntaje: Sin etiqueta, Verde, Amarillo y Rojo.
- Puntaje automático visible como número, no convertido artificialmente en semáforo.
- Nombre, teléfono, correo, notas, etapa, responsable, monto, fuente, etiquetas, empresa, calificación, semáforo y descarte participan en la detección de cambios.
- Vaciar responsable persiste `assignedTo = null` y devuelve el lead a Sin asignar.
- El botón Guardar funciona también cuando solo cambia semáforo, etiqueta, fuente o motivo.

Catálogo de descarte:

1. Precio fuera de presupuesto.
2. Sin financiamiento / no calificó crédito.
3. Compró en otro proyecto.
4. Nunca respondió.
5. Datos de contacto erróneos.
6. Ubicación no le acomoda.
7. Solo consultaba (sin intención).
8. No es el perfil buscado.
9. Otro, con detalle obligatorio.

Archivos centrales:

- `packages/shared/src/types/lead.ts`
- `apps/api/src/modules/crm/leads/lead.entity.ts`
- `apps/api/src/modules/crm/leads/use-cases/update-lead.use-case.ts`
- `apps/web/src/features/crm/LeadDetailDrawer.tsx`
- `apps/web/src/features/crm/LeadsBoardPage.tsx`

### 3. Drag-and-drop

- El overlay del Kanban se monta en `document.body` mediante portal.
- Conserva ancho y alto de la tarjeta tomada.
- Se agregó detección `pointerWithin` con fallback para que el destino corresponda al cursor.
- El tablero usa las etapas del dominio vigente y no ofrece estados imposibles.
- El movimiento actualiza el servidor y refresca tablero, ficha y consultas relacionadas.

Archivo central: `apps/web/src/shared/KanbanBoard.tsx`.

### 4. Actividades y contacto

- Registrar contacto y Agendar visita abren el mismo formulario y usan la misma persistencia.
- Una llamada sobre un lead nuevo del CRM lo avanza a Contactado.
- Una reunión futura puede avanzar a Visita agendada sin retroceder leads que ya estén más adelante.
- Los controles de escritura se ocultan si el permiso efectivo no permite editar.
- El portal no consulta `/users`; solo ofrece tomarse a sí mismo o dejar el lead Sin asignar.

### 5. Tareas

- Crear una tarea sobre un lead deriva la empresa desde el lead; ignora un `clientId` falsificado.
- Listar, crear y completar tareas hereda permisos, alcance de empresa y capacidad CRM del lead.
- Una tarea creada invalida ficha, tablero y bandeja personal, por lo que permanece tras refrescar.
- Un portal no puede usar tareas genéricas de otros módulos ni tareas de leads ajenos.

Archivos centrales:

- `apps/api/src/modules/approvals/tasks.controller.ts`
- `apps/api/src/modules/approvals/tasks.service.ts`
- `apps/api/src/modules/approvals/approvals.module.ts`

### 6. Importación CSV/XLSX de Meta

- Admite CSV y XLSX.
- Acepta encabezados habituales descargados desde Meta.
- El archivo se interpreta en el navegador; se envían filas normalizadas, no el archivo original.
- La importación usa exclusivamente el CRM seleccionado en la barra superior.
- Se eliminó el segundo selector de empresa/embudo que podía mandar el lote a otra cuenta.
- El portal ya no consulta `/clients`, eliminando el 403 al abrir la importación.
- El servidor vuelve a imponer empresa y dominio desde la sesión, aunque el frontend sea manipulado.
- Máximo actual: 500 filas por petición; archivos mayores deben enviarse en tandas.

Campos mapeados:

- Nombre, correo, teléfono, empresa y notas.
- Campaña/formulario, origen, detalle del origen, etiquetas y teléfono alternativo.
- Fecha original del lead.
- Identificadores de lead, formulario, campaña, anuncio y página para entrada Make/API.
- Preguntas y respuestas de Meta quedan en metadatos normalizados.

Archivos centrales:

- `apps/web/src/features/crm/ImportLeadsModal.tsx`
- `apps/web/src/features/crm/import-field-mapping.ts`
- `apps/api/src/modules/crm/leads/dto/ingest-lead.dto.ts`
- `apps/api/src/modules/crm/leads/normalizar-cuerpo-entrada.ts`
- `apps/api/src/modules/crm/leads/lead-ingest.service.ts`

### 7. Make y llaves por campaña

- Flujo previsto: Meta Lead Ads → Make → HTTP POST → API de Espartanos.
- Cada origen/campaña tiene una llave propia; no existe una llave global compartida.
- La llave resuelve organización, empresa, origen y campaña en servidor.
- La campaña fijada en la llave prevalece sobre el nombre enviado en el cuerpo.
- La llave se almacena como hash y solo se muestra al crear o rotar.
- La administración muestra empresa, campaña, pista de llave, contador, último uso y último error.
- Renombrar o mover una campaña actualiza su conexión.
- Pausar una campaña apaga su origen.
- Eliminar una campaña apaga la llave para que no siga recibiendo hacia una campaña inexistente.
- Los conteos y costo por lead se acotan por organización y `clientId`; campañas homónimas de empresas diferentes no se mezclan.
- Se añadió vínculo estable `campaign_id` para no depender de nombres modificables.

No colocar llaves en este documento, repositorio, frontend ni capturas.

### 8. Navegación reducida

- El CRM visible queda concentrado en Inicio, Leads/Prospectos, Tablero, Calendario, Panel y Administración cuando corresponda.
- Administración no aparece en el portal cliente.
- Opportunities, Contacts e Interactions dejaron de anunciarse en la paleta de comandos.
- Las entidades internas pueden conservarse en backend para una fase posterior, pero no deben reaparecer en menú sin decisión de producto y pruebas de permiso.

### 9. PWA

- El build web genera `manifest.webmanifest`, `sw.js` y precache correctamente.
- Los cambios de sesión y permisos ya incluyen correcciones anteriores de limpieza/actualización.
- Esto certifica generación, no instalación visual en cada dispositivo; la prueba final requiere navegador normal, incógnito y móvil después del despliegue.

## Migraciones nuevas

Ejecutar después de actualizar código y antes de validar producción:

- `0108-lead-traffic-light.ts`
  - Agrega `leads.traffic_light`.
  - Migra `fit_status = discarded` a `unqualified`.
- `0109-ingest-source-campaign-link.ts`
  - Agrega `lead_ingest_sources.campaign_id`.
  - Vincula conexiones existentes por organización, empresa y nombre de campaña.
  - Crea índice por organización y campaña.

Comando del proyecto para producción:

```bash
npm run migration:run:prod
```

No ejecutar contra producción antes de que cPanel tenga el commit correspondiente y el build API actualizado.

## Commits relevantes

- `73ca0edb` — separa Venta de conversión a empresa.
- `075b4113` — acceso del cliente a su calendario CRM.
- `8756c187` — corrige límite de paginación del calendario.
- `09ad970a` — capacidades del portal cliente.
- `c0026301` — alineación del overlay drag-and-drop.
- `242dcb19` — campos de entrada Make/Meta.
- `562a315e` — flujo CRM multiempresa, catálogo MMT, tareas, campañas y permisos.
- `5aff8e73` — contratos E2E y empresa derivada de sesión en creación/importación.

## Evidencia de validación

En el corte de este documento:

- Build API: aprobado.
- Build web/PWA: aprobado.
- Lint API: aprobado.
- Lint web: aprobado con cinco advertencias preexistentes no bloqueantes.
- Unitarias API: 116 archivos y 792 pruebas aprobadas en la ejecución previa al último ajuste; después del ajuste, build y lint API volvieron a aprobar.
- Unitarias web: 36 archivos y 212 pruebas aprobadas.
- CI con MariaDB del commit `5aff8e73`: éxito.
- Rama de despliegue del commit `5aff8e73`: éxito.

Ejecuciones:

- CI: `https://github.com/lavitaminadev/spartanoshub/actions/runs/32873516479`
- Rama de despliegue: `https://github.com/lavitaminadev/spartanoshub/actions/runs/32873516473`

## Estado real y pendientes

### Terminado en código y CI

- Acceso editable del cliente a su CRM contratado.
- Aislamiento entre empresas para lecturas y escrituras cubiertas.
- Creación/importación con empresa derivada de sesión.
- Drag-and-drop corregido.
- Desasignación persistente.
- Ficha, semáforo, puntaje y catálogo MMT.
- Actividades y tareas persistentes.
- Venta separada de conversión a empresa.
- Campañas y llaves vinculadas sin mezcla entre empresas.
- Menú/paleta reducidos para el alcance actual.

### Pendiente operativo en producción

1. Actualizar el repositorio de cPanel desde remoto.
2. Confirmar que cPanel despliegue un SHA que contenga `5aff8e73`.
3. Ejecutar migraciones de producción.
4. Reiniciar la aplicación Node/Passenger.
5. Confirmar `/api/health` y carga HTTPS del frontend.
6. Validación visual con al menos:
   - dev;
   - una persona interna con empresas asignadas;
   - empresa A con CRM;
   - empresa B sin CRM o con Reservas solamente.
7. En empresa A: crear manual, importar CSV/XLSX, buscar, abrir ficha, corregir teléfono/correo, tomar, desasignar, mover por drag-and-drop, marcar Venta, descartar con motivo, registrar actividad, agendar visita, crear/completar tarea y recargar.
8. Confirmar que todo persiste después de cerrar sesión, cambiar de cuenta y volver a entrar.
9. Confirmar que empresa B no ve menú CRM y recibe 403 por URL/API directa.
10. Probar una entrada Make real con una llave de prueba por campaña y confirmar atribución a la empresa/campaña correctas.

### Fuera de este cierre

- Prueba de carga real con 1.000, 5.000 y 10.000 leads en el hosting compartido.
- Medición de concurrencia y capacidad exacta del servidor.
- Activación pública de Opportunities u otros módulos futuros.
- Envío automático de correo al entrar un lead.
- Validación legal definitiva con datos completos del responsable del tratamiento.
- Limpieza de las cinco advertencias de lint antiguas.

## Criterio para declarar producción lista

No declarar “100 % listo” solo porque CI esté verde. El cierre requiere simultáneamente:

- SHA correcto desplegado.
- Migraciones aplicadas.
- Health check sano.
- Prueba visual y API con dos empresas sin mezcla.
- Persistencia comprobada tras recarga y cambio de sesión.
- Entrada Make real atribuida a su campaña.
- Sin 403 inesperados en el CRM contratado y con 403/404 correctos fuera de alcance.

