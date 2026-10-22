# Instrucciones obligatorias para agentes de código

Estas reglas aplican a Claude Code, Codex, ChatGPT, asistentes de IDE y cualquier agente automatizado que trabaje en este repositorio.

## Regla principal: no actuar por cuenta propia en sistemas reales

Sin autorización humana explícita para esa acción concreta, el agente NO debe:
- fusionar Pull Requests, hacer push directo a `main` o `deploy`, ni cambiar la rama predeterminada;
- desplegar, reiniciar procesos, modificar variables de hosting, DNS, SSL, cPanel, Passenger o el servidor;
- conectarse a producción para ejecutar SQL, migraciones, scripts de mantenimiento o pruebas que escriban datos;
- borrar, truncar, anonimizar, migrar o modificar datos reales;
- cambiar secretos, tokens, permisos de GitHub, reglas de protección, facturación o configuración de seguridad;
- aplicar `npm audit fix`, actualizaciones masivas o cambios incompatibles sin revisar el diff y justificar su impacto;
- desactivar pruebas, escáneres o controles para conseguir que Actions quede verde;
- afirmar que algo fue probado, publicado o quedó corregido si no hay evidencia verificable.

Un pedido de analizar, revisar, proponer o corregir código NO equivale a permiso para desplegar ni para alterar producción. Si la acción puede tener efectos externos, detenerse y solicitar aprobación específica.

## Flujo obligatorio de trabajo

1. Inspeccionar el estado real: rama, cambios existentes, workflows, logs recientes y archivos relevantes. No asumir que el repositorio está limpio.
2. Explicar el problema con evidencia: ejecución de Actions, error exacto, archivos implicados y alcance.
3. Crear una rama de trabajo y un Pull Request. No escribir directamente en `main` ni `deploy`.
4. Hacer el cambio mínimo relacionado con la tarea; no mezclar refactors o actualizaciones no solicitadas.
5. Revisar el diff completo y comprobar que no contiene secretos, archivos locales, artefactos inesperados ni cambios de despliegue no autorizados.
6. Ejecutar las pruebas pertinentes en entorno aislado. Para migraciones, probar base vacía y ruta de actualización; nunca usar producción como entorno de prueba.
7. Registrar la intervención en `docs/AI_WORK_LOG.md` y en el commit/PR. Registrar también las pruebas que fallaron y las pendientes; no ocultar resultados.
8. Entregar resumen con enlaces al PR y a Actions, pruebas reales, riesgos, pasos manuales y cualquier aprobación pendiente.

## Despliegues y migraciones

- El frontend es Cuartel y la API es Refugio. La infraestructura productiva es independiente del runner de GitHub Actions.
- Un workflow exitoso no demuestra por sí solo que producción esté actualizada; verificar la rama y el mecanismo de despliegue.
- Nunca ejecutar una migración productiva sin respaldo comprobado, revisión de SQL, plan de recuperación y autorización explícita.
- Las migraciones nuevas deben ser compatibles con MariaDB del entorno objetivo. Verificar tipos, índices, claves foráneas, orden, idempotencia y comportamiento de rollback.
- No modificar el workflow de despliegue como parte de una tarea de seguridad salvo que el usuario lo pida expresamente.
- No incluir URLs, tokens, credenciales ni datos personales reales en los logs o artefactos.

## Registro de decisiones

Antes de editar, leer `docs/AI_WORK_LOG.md`. Después de cada lote de cambios, añadir una entrada con:
- fecha UTC, agente/herramienta y rama;
- solicitud y motivo;
- archivos cambiados y resumen del diff;
- pruebas ejecutadas y resultados, incluyendo fallos;
- riesgos, impacto esperado y limitaciones;
- acciones no realizadas por requerir autorización.

El registro es una bitácora de hechos, no una promesa. No declarar una tarea terminada si quedan comprobaciones críticas pendientes.

## Cuando falte información

No adivinar. Inspeccionar los archivos y logs disponibles; si no se puede verificar algo, decirlo claramente. Para operaciones irreversibles, producción, datos o despliegues, preguntar antes de actuar.
