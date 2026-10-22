# Bitácora de cambios asistidos por IA

Este archivo registra intervenciones realizadas por agentes de código. Cada agente debe leerlo antes de editar y añadir una entrada después de cada lote de cambios. No reemplaza el historial de Git, los commits, los PR ni los logs de Actions.

## 2026-10-22 — Revisión de seguridad y fallos de CI

- **Agente/herramienta:** ChatGPT mediante GitHub connector.
- **Rama:** `security/automated-scans`.
- **Solicitud:** proponer escaneos automatizados sin modificar `main`, el despliegue ni producción.
- **Cambios propuestos en el PR #20:** `.github/workflows/security.yml` y `.github/dependabot.yml`; el workflow de seguridad incluye CodeQL, Gitleaks, OSV-Scanner y ZAP Baseline pasivo. Se corrigió el job OSV para usar workflows reutilizables documentados y fijados a un SHA.
- **Evidencia:** PR https://github.com/lavitaminadev/spartanoshub/pull/20. Ejecución de seguridad tras la corrección: https://github.com/lavitaminadev/spartanoshub/actions/runs/39811056047. La ejecución terminó correctamente: Gitleaks, CodeQL y OSV-Scanner terminaron correctamente. Los jobs ZAP se omitieron por diseño en el evento pull_request; no equivale a un análisis ZAP de producción.
- **CI del PR:** https://github.com/lavitaminadev/spartanoshub/actions/runs/39811055442 — falló en `npm audit --omit=dev --audit-level=high` por `follow-redirects@1.16.0`, con avisos GHSA-q3jh-wrc6-jgq8 y GHSA-8r9p-f939-6h3c. La corrección disponible indicada por npm debe revisarse en el lockfile antes de actualizar.
- **Fallos previos observados:** los CI #562, #561 y #560 fallaron en `lint:web` por cuatro errores de Hooks de React (tres llamadas condicionales a `useState` y una a `useMutation`), además de 42 advertencias. Los CI #565 y #566 y los despliegues #545 y #546 fallaron al ejecutar migraciones en base vacía: `PerfilesPorEmpresaEInvitaciones1790000000182` no pudo crear `perfiles` por una clave foránea mal formada (`errno: 150`). En los logs, `clients.id` se crea como `uuid`, mientras `perfiles.client_id` se define como `CHAR(36)`; confirmar compatibilidad real de tipos/charset/collation antes de modificar la migración.
- **Pruebas anteriores:** CI #559 falló en cinco tests de API relacionados con el acceso a empresas y los filtros de encuestas: dependencias/mocks indefinidos (`empresasQueAdministra` y `filtros.clientId`). No se considera resuelto por el solo hecho de que después haya pasado otro job.
- **Rama de despliegue:** el run #548 falló en migraciones. El historial mostrado en GitHub indica que el último despliegue automático exitoso corresponde al commit `634a8e1` (run #544); verificar el estado real del servidor antes de afirmar qué versión sirve producción.
- **Dependencias:** logs de npm muestran además paquetes `glob` obsoletos y vulnerabilidades totales. No ejecutar `npm audit fix` automáticamente: identificar primero la ruta de dependencia, la versión corregida y los posibles cambios incompatibles.
- **Cambios no realizados:** no se modificaron `main`, `deploy`, cPanel, Refugio, Cuartel ni la base productiva. No se fusionó el PR. No se cambió código funcional de la aplicación para resolver los errores detectados.
- **Pendientes:** revisar y corregir las migraciones en una rama separada; investigar los errores de lint y tests por archivo; resolver la vulnerabilidad de `follow-redirects`; configurar las variables de staging de ZAP y confirmar los controles de seguridad en la configuración del repositorio.
