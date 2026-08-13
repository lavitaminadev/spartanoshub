# Guía de redacción y unificación de términos

> Criterios para que toda la interfaz hable el mismo español formal, sin mezclar inglés ni
> inventar nombres nuevos. Cuando dos palabras hacen lo mismo, se usa **una sola**.

## 1. Reglas generales

- **Siempre en español**, formal, con acentos y signos de puntuación correctos. Nada de
  "lifecycle", "status", "flow", "mode", "feature" ni "default" a la vista del usuario.
- **Tuteo suave, sin llegar a coloquial**: "Intenta nuevamente", "Revisa tu conexión",
  "Guarda los cambios". Nunca "dale", "dale click", "chequea".
- **Errores sin culpa del usuario**: primero el contexto, después la instrucción. Nada de
  "¡Error!" suelto ni de exponer mensajes técnicos en inglés (por ejemplo los que devuelve
  axios: "Network Error", "timeout exceeded").
- Una acción siempre con el mismo nombre en todo el producto.

## 2. Términos canónicos (una sola palabra por concepto)

| Concepto | Se usa | Ya no se usa |
|---|---|---|
| Pantalla principal de un área | **Panel** / **Inicio** | dashboard |
| Encuesta de satisfacción post-servicio | **Encuesta** | survey, post venta |
| Revisión de encuestas mal calificadas | **Revisión de encuestas** | post venta, seguimiento |
| Ciclo de vida de un módulo | **Ciclo de vida** | lifecycle |
| Estado de una entidad | **Estado** | status |
| Tipo o modalidad de un flujo | **Tipo** | mode |
| Valor inicial | **Por defecto** | default |
| Secuencia de pasos de un proceso | **Flujo** | flow |
| Componente del producto que se enciende/apaga | **Módulo** | feature, módulo de producto |
| Puesto o función de una persona | **Cargo** | rol, role, puesto |
| Persona que representa a una empresa | **Cliente** | empresa (salvo el registro) |
| Fecha y hora reservadas | **Cita** / **Reserva** | booking, agenda (según contexto) |
| Acción de guardar un cambio | **Guardar** | save |
| Acción de eliminar | **Eliminar** | borrar (solo "Borrador" como estado) |
| Volver a intentar | **Intentar nuevamente** | retry, reintentar |
| Mensaje de éxito temporal | **Aviso** / **Notificación** | toast |

## 3. Estados de ciclo de vida de un módulo

| Valor interno | Texto para el usuario |
|---|---|
| `development` | **En desarrollo** |
| `pilot` | **Piloto** |
| `active` | **Activo** |
| `maintenance` | **En mantenimiento** |
| `disabled` | **Deshabilitado** |

## 4. Estados comunes de entidades

| Valor interno | Texto para el usuario |
|---|---|
| `published` | **Publicado** |
| `paused` | **Pausado** |
| `draft` | **Borrador** |
| `pending` | **Pendiente** |
| `confirmed` | **Confirmado** |
| `cancelled` | **Cancelado** |
| `active` / `inactive` | **Activo** / **Inactivo** |

## 5. Mensajes de error estándar

- Sin conexión: *"No pudimos conectar con Espartanos. Revisa tu conexión a internet e
  inténtalo nuevamente en unos segundos."* (nunca mencionar "servicio local").
- Servidor lento: *"El servidor está tardando más de lo esperado. Intenta nuevamente en
  unos segundos."*
- Muchas solicitudes seguidas: *"Se realizaron muchas solicitudes seguidas. Espera unos
  segundos antes de volver a intentar."*
- Error del servidor: *"El servidor encontró un problema y la acción no se completó."*
- Fallo genérico: *"El servidor no pudo completar la solicitud. Inténtalo nuevamente en
  unos segundos."*
- Acceso denegado: *"No tienes permisos para esta acción."*

## 6. Palabras que se corrigen siempre

| Incorrecto | Correcto |
|---|---|
| asignacion | **asignación** |
| operacion | **operación** |
| direccion | **dirección** |
| informacion | **información** |
| configuracion | **configuración** |
| seccion | **sección** |
| accion | **acción** |
| asistencia | **asistencia** (acento) |
| aqui | **aquí** |
| proximo | **próximo** |
| tambien / ademas | **también** / **además** |
| servicio local | (eliminar: no hay entorno local en producción) |

## 7. Qué no debe aparecer en la interfaz

- Términos técnicos crudos: `lifecycle`, `feature`, `mode`, `status`, `default`, `pilot`
  (sin traducir), `booking`, `survey`, `flow`, `toast`, `role`.
- Mensajes crudos de librerías (axios, recharts, react-router).
- Emojis como reemplazo de iconos.
- Nombres de archivos o rutas internas en textos visibles.
