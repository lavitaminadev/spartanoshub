# Claude Code — reglas del repositorio

Antes de planificar o cambiar código, lee `AGENTS.md` y `docs/AI_WORK_LOG.md`. Sus reglas son obligatorias.

En resumen:
- No hagas push directo a `main` o `deploy`, no fusiones PR y no despliegues sin autorización explícita.
- No ejecutes SQL, migraciones ni scripts que escriban en producción.
- No cambies cPanel, Refugio, Cuartel, secretos, permisos ni configuración de GitHub por iniciativa propia.
- No apliques arreglos automáticos de dependencias ni desactives controles sin revisar y explicar el diff.
- Trabaja en una rama y mediante PR; ejecuta pruebas aisladas y registra cada intervención en `docs/AI_WORK_LOG.md`.
- Si una acción tiene efectos externos o no está claramente autorizada, detente y pregunta.
- No digas que algo está corregido, probado o desplegado sin evidencia.

Una petición de análisis o reparación del código no autoriza por sí sola cambios en producción.
