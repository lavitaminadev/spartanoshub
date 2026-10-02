# QA Plan Maestro — Spartanoshub

Este documento centraliza el criterio de QA funcional y no funcional.

## Principios
- Probar flujo feliz, errores, límites, permisos y concurrencia.
- Separar bug técnico, observación, mejora y pendiente de negocio.
- No marcar como incidente algo que nunca ocurrió.
- Todo hallazgo debe tener evidencia, estado y retest.

## Clasificación
- PASS
- FAIL
- BLOCKED
- PENDING BUSINESS
- OBSERVATION
- IMPROVEMENT
- NOT APPLICABLE

## Severidad
- CRÍTICA
- ALTA
- MEDIA
- BAJA

## Cobertura mínima por módulo
1. Crear
2. Leer
3. Editar
4. Cerrar/eliminar si aplica
5. Permisos UI/API/datos
6. Búsqueda
7. Filtros
8. Validaciones
9. Datos límite
10. Concurrencia si aplica
11. Auditoría
12. Responsive
13. Persistencia
14. Manejo de errores
15. Regresión

## Regla
Un flujo no se considera aprobado solo porque compila o responde. Debe funcionar para el rol correcto, sobre el dato correcto, con trazabilidad y sin filtraciones.
