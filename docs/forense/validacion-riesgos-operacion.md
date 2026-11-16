# Validación, riesgos y operación

[Volver al resumen](gobierno-modulos-legales.md) · [Índice de documentación](../README.md)

## Qué se debe comprobar

| Área | Prueba positiva | Prueba negativa |
|---|---|---|
| Configuración | Dirección Comercial obtiene 200 | Admin legado obtiene 403 |
| Módulos | Dirección Comercial y Desarrollo modifican | Operaciones y client no modifican |
| Matriz | Propietario y Desarrollo administran | Admin legado no gobierna |
| Empresa | `client + users:manage` administra su empresa | No administra otra empresa |
| Legales | Aceptación apunta a versión vigente | Una versión publicada no se sobrescribe |
| Correos | Procedencia y fundamento presentes | Exclusiones impiden el envío |

## Orden de validación

```text
npm run build --workspace packages/shared
npm run lint --workspace apps/api
npm run lint --workspace apps/web
npm run build --workspace apps/web
npm run test --workspace apps/api
npm run test --workspace apps/web
npm run test:e2e --workspace apps/api
```

Los E2E necesitan MariaDB y las variables del entorno de pruebas. Un `EACCES` de conexión local no demuestra una falla funcional; CI debe ejecutar esos casos con sus servicios disponibles.

## Riesgos abiertos

- `admin` todavía aparece en rutas heredadas: retirarlo por etapas, nunca mediante reemplazo masivo sin analizar cada endpoint.
- Las capas de menú, permiso, feature flag y API pueden divergir si se cambian por separado.
- La configuración legal por empresa necesita una única fuente vigente por tipo y alcance.
- Un módulo activo sin datos mínimos debe fallar cerrado y explicar qué falta.
- Las advertencias de calidad deben mantenerse visibles para que una regresión nueva no quede oculta.

## Procedimiento para cambios

1. Definir dueño, alcance y módulo.
2. Cambiar permiso base y guardas de API juntos.
3. Alinear navegación y acciones visibles.
4. Agregar una prueba positiva y una negativa.
5. Probar aislamiento entre empresas.
6. Compilar Shared antes de API y Web.
7. Ejecutar E2E con MariaDB.
8. Publicar y conservar el resultado de CI.

## Criterio de terminado

Un cambio está terminado cuando compila, pasa pruebas, conserva el aislamiento multiempresa, genera auditoría, está documentado y CI publica la rama de despliegue. Que la pantalla se vea o que una prueba aislada pase no es suficiente.

