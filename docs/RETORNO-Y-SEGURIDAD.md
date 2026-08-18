# Cómo volver atrás

Documento de seguridad para el trabajo de la rama `mejoras/crm-automatizaciones`.

## Punto de retorno

| Dato | Valor |
|---|---|
| Rama estable | `main` |
| Commit estable | `25309384d280a5a5fcc669d0643b3e6bd14dd767` |
| Tag de retorno | `punto-retorno-2026-08-18` |
| Rama de trabajo | `mejoras/crm-automatizaciones` |
| Fecha | 18 de agosto de 2026 |

El tag `punto-retorno-2026-08-18` apunta exactamente al último commit conocido como bueno,
el mismo que estaba desplegado antes de empezar. **No lo borres.**

## Volver atrás

### Si todavía no desplegaste

Basta con cambiar de rama. Nada de lo hecho toca `main`.

```bash
git checkout main
```

La rama de trabajo queda intacta por si quieres retomarla.

### Si ya desplegaste y algo falla

```bash
git checkout main
git reset --hard punto-retorno-2026-08-18
npm ci --include=dev
npm run build:cpanel
```

Y desplegar. Como `.cpanel.yml` corre `migration:run:prod` en cada despliegue y TypeORM
solo aplica las pendientes, volver al código anterior **no revierte las migraciones ya
aplicadas**. Eso es intencional y seguro: todas las migraciones de esta rama son aditivas
(columnas y tablas nuevas), así que el código viejo funciona sin problema con el esquema
nuevo — simplemente ignora lo que no conoce.

### Revertir una migración concreta

Solo si hiciera falta, y de a una:

```bash
npm run migration:revert
```

Revierte **la última** migración aplicada. Ejecutarlo varias veces retrocede varias.
Verifica siempre qué va a revertir antes de correrlo.

## Principios que se siguieron en esta rama

1. **Todas las migraciones son aditivas.** No se renombra ni se borra ninguna columna ni
   tabla existente. El código anterior sigue siendo compatible con el esquema nuevo.
2. **No se toca `workflow_templates` ni sus `code`.** Cuatro procesos operativos en
   producción leen esas plantillas por su código; renombrarlos rompería onboarding,
   producción, audiovisual y el ciclo mensual.
3. **Nada nuevo se llama en línea contra un tercero.** Todo lo que habla con un servicio
   externo pasa por una bandeja de salida, como ya hacían Meta y Google.
4. **Las pantallas nuevas conviven con las viejas.** El tablero de pipeline se suma a la
   tabla; no la reemplaza hasta que la valides.

## Verificación antes de desplegar

```bash
npm run lint:api
npm run lint:web
npm run test
npm run build:cpanel
```

El build es también la verificación de tipos: `tsc` falla si algo quedó inconsistente.
