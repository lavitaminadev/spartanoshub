# Registro de Riesgos

| ID | Fecha identificación | Riesgo | Probabilidad | Impacto | Mitigación | Estado | Incidente asociado |
|---|---|---|---|---|---|---|---|
| RISK-001 | 2026-08-16 | Agotamiento de conexiones MySQL con múltiples procesos Passenger si el pool por proceso excede la capacidad total del servidor | Media | Alta | Limitar `DB_CONNECTION_LIMIT`, observar `max_connections` y procesos | Mitigado parcialmente | Ninguno |
| RISK-002 | 2026-08-16 | Throttling efectivo multiplicado por proceso al usar almacenamiento en memoria | Media | Media | Parametrizar límite y evaluar almacenamiento compartido si escala horizontalmente | Abierto | Ninguno |
| RISK-003 | 2026-08-16 | Filtración entre cuentas si UI, API y scope de datos no se validan en conjunto | Baja/Media | Crítico | QA por rol, prueba IDOR y revisión de scope de cuenta | Abierto | Ninguno |
