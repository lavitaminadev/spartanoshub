# Punto de retorno — salida del 18 de agosto de 2026

Cómo volver atrás si esta salida sale mal, y qué se puede revertir en cada momento.

## Punto de retorno

| Dato | Valor |
|---|---|
| Tag | `punto-retorno-2026-08-18` |
| Commit | `25309384d280a5a5fcc669d0643b3e6bd14dd767` |
| Mensaje | `fix: keep internal dashboard available during permission hydration` |
| Rama de trabajo | `mejoras/crm-automatizaciones` (fusionada a `main` sin merge commit) |
| Commits de la salida | 18 |

**Ese commit es exactamente lo que estaba en producción antes de esta salida.** Al preparar la
salida, `origin/main` apuntaba a él, así que el tag y el estado desplegado coinciden. **No
borres el tag.**

## Cómo desplegar

`main` no se despliega directo. GitHub Actions compila en cada push y publica la rama `deploy`,
que es a la que apunta cPanel — compilar en el servidor no cabe en los 768 MB de la cuenta.

```
main  →  GitHub Actions (pruebas + build)  →  rama deploy  →  cPanel
```

1. `git push origin main`
2. En cPanel → *Git Version Control* → **Update from Remote**
3. **Deploy HEAD Commit**
4. Confirmar que `.cpanel.yml` termina sin errores y que aparecen las dos salidas
   `INODE GUARD: consumo dentro de la politica`

Passenger se reinicia solo al final de `.cpanel.yml` (`touch tmp/restart.txt` y `touch app.js`).

## Volver atrás, según el momento

### Aún no hiciste push

Nada salió de tu máquina.

```bash
git reset --hard punto-retorno-2026-08-18
```

### Ya hiciste push, pero no desplegaste en cPanel

Producción sigue intacta: el push solo actualizó la rama `deploy`, y cPanel no despliega hasta
que alguien lo pide.

```bash
git revert --no-commit punto-retorno-2026-08-18..HEAD
git commit -m "revert: salida del 18 de agosto"
git push origin main
```

Se prefiere `revert` sobre `reset --hard` porque la rama ya es compartida: reescribir su
historia rompe la copia de cualquiera que la haya bajado.

### Ya desplegaste y algo falla

Volver al commit estable y desplegar de nuevo:

```bash
git revert --no-commit punto-retorno-2026-08-18..HEAD
git commit -m "revert: salida del 18 de agosto"
git push origin main
```

Después, en cPanel: **Update from Remote** → **Deploy HEAD Commit**.

**No hace falta revertir las migraciones.** Las cinco de esta salida son aditivas —tablas,
columnas e índices nuevos— y el código anterior funciona con el esquema nuevo: simplemente
ignora lo que no conoce. Revertirlas borraría datos sin necesidad.

Si aun así hubiera que revertir una, es de a una y verificando antes cuál va a caer:

```bash
npm run migration:revert
```

## Qué cambia en la base

| Migración | Qué crea | Reversible sin pérdida |
|---|---|---|
| `0093-opportunity-stage-changes` | Tabla `crm_opportunity_stage_changes` | Sí, pero se pierde el historial de etapas registrado desde el despliegue |
| `0094-crm-interactions-index` | Índice en `crm_interactions` | Sí, sin pérdida |
| `0095-automations` | Tablas `automations`, `automation_runs`, `automation_run_steps` | Sí, se pierden las automatizaciones creadas |
| `0096-automation-webhooks` | Tabla `automation_webhook_deliveries` | Sí, se pierden los envíos en cola |
| `0097-pending-tasks` | Columna `kind` e índices en `approval_requests` | El `down` **no borra la columna** a propósito: distinguir lo que era aprobación de lo que era tarea no se puede reconstruir |

Ninguna renombra ni elimina nada existente.

## Cambios de comportamiento — avisar antes de desplegar

Tres cosas dejan de funcionar como antes. No son fallos, son las reglas nuevas:

1. **Agendar una sesión audiovisual exige un moodboard aprobado.** Si hoy se agenda sin él, ese
   hábito se detiene. Los moodboards se aprueban en la pantalla de Audiovisual, que esta misma
   salida abre por eso mismo.
2. **La ruta `/workflows` pasa a `/process-templates`.** El frontend se copia unos segundos
   antes de que Passenger reinicie, así que en esa ventana la sección de flujos de Gobierno
   puede dar 404. Se resuelve sola al reiniciar.
3. **Todos los módulos quedan disponibles, pero apagados.** Nadie ve nada nuevo hasta que se
   encienda su interruptor desde el panel de Desarrollo, y eso requiere el cargo `dev`.

**Las automatizaciones nacen desactivadas.** Mientras nadie active una, el motor no ejecuta
nada y el sistema se comporta igual que antes.

## Qué revisar después de desplegar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://refugio.espartanos.cl/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://cuartel.espartanos.cl
```

La API responde `200` si está sana, o `503` si una dependencia crítica quedó caída. El frontend,
`200`.

Después, entrando **como `operations_director`** —`admin` no alcanza estos módulos—:

| Ruta | Qué comprobar |
|---|---|
| `/intake` | El formulario único; los campos cambian al elegir área; «No aplica» deshabilita el campo |
| `/intake` → convertir una solicitud audiovisual | Solo ofrece moodboards aprobados del cliente |
| `/crm/pipeline` | El tablero; arrastrar un trato lo mueve de etapa |
| `/production/<id>` | La pestaña **Bitácora** carga y deja escribir |
| `/crm/leads` | El botón **Importar CSV** abre, previsualiza y reporta el resultado |
| Una reserva de prueba | Abre, guarda y vuelve a listar |

## Principios que se siguieron

1. **Todas las migraciones son aditivas.** El código anterior sigue siendo compatible con el
   esquema nuevo, que es lo que hace barato volver atrás.
2. **No se tocó `workflow_templates` ni sus `code`.** El módulo se renombró en el código, pero
   cuatro procesos operativos leen esas plantillas por su código; renombrar la tabla habría
   exigido migrar datos para no ganar nada.
3. **Nada nuevo llama a un tercero en línea.** Todo lo que sale a la red pasa por una bandeja
   de salida, como ya hacían Meta y Google.
4. **Las pantallas nuevas conviven con las viejas.** El tablero de pipeline se suma a la tabla;
   no la reemplaza.

## Verificación antes de desplegar

```bash
npm run test
npm run lint:api
npm run lint:web
npm run build:cpanel
```

En esta salida: **618 pruebas de servidor y 131 de interfaz en verde**, lint limpio y build
correcto. GitHub Actions repite las pruebas antes de publicar la rama `deploy`, así que un
fallo detiene la salida antes de que llegue nada al servidor.

## Una nota sobre `dist/`

`apps/api/dist`, `apps/web/dist` y `packages/shared/dist` **se versionan a propósito** —
`.gitignore` lo explica: el servidor recibe lo que hay en el commit. Al preparar una salida hay
que recompilar y confirmar los artefactos junto con el código, o `main` quedaría con código
nuevo y artefactos viejos.

El comentario de cabecera de `.github/workflows/deploy-branch.yml` afirma lo contrario —que
`dist` está en `.gitignore`—. Está desactualizado; no rompe nada porque Actions recompila de
todos modos, pero no describe el repositorio.
