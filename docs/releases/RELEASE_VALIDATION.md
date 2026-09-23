# Validación de Release

## Antes de desplegar
- [ ] Backup DB verificado
- [ ] Backup archivos verificado
- [ ] Migraciones revisadas
- [ ] Variables de entorno revisadas
- [ ] Build generado
- [ ] Rutas Passenger verificadas
- [ ] Permisos de archivos revisados
- [ ] Health local/staging PASS
- [ ] QA crítico = 0
- [ ] QA alto = 0 o aceptado formalmente
- [ ] Plan de rollback disponible

## Después de desplegar
- [ ] Health responde
- [ ] Login
- [ ] Roles/permisos
- [ ] Intake
- [ ] Reservas
- [ ] DB
- [ ] Archivos
- [ ] Integraciones esenciales
- [ ] Logs
- [ ] CPU/RAM/I/O
- [ ] No errores 5xx inesperados

## Rollback
Documentar versión anterior, DB compatible y pasos de reversión antes de liberar.
