---
name: desplegar
description: El despliegue de Espartanos, de punta a punta: compilar dist, quitar el .js de 0179, comprobar coherencia, comprometer, PR, CI, fusionar y verificar el sha en el servidor. Usar al desplegar, al publicar, al subir a produccion, o cuando haya que recompilar dist despues de tocar codigo.
---

# Desplegar Espartanos

Diez pasos, en orden, y ninguno se da por hecho. Este ritual se hizo a mano cinco veces en una
semana y cada vez se olvidó algo distinto: una vez el `dist`, otra el `.js` de la `0179`, otra el
respaldo.

**Subir no despliega.** Empujar a `main` dispara un workflow que publica en la rama `deploy`, y
cPanel tiene Git Version Control apuntando ahí. El servidor ejecuta `dist`, no el fuente.

---

## 1 · Antes de compilar, que el código esté sano

```bash
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -b apps/web
npm run lint:api && npm run lint:web && npm run lint:shared
npm run test:api && npm run test:web
```

En `apps/web` es `tsc -b`. `tsc -p tsconfig.json` no compila nada ahí —`files: []`— y devuelve 0
sin mirar una línea.

Si se tocó un módulo, un proveedor o una entidad, además:

```bash
npx vitest run --root apps/api test/unit/app-module-boot.spec.ts
```

Es la única prueba que detecta un fallo de registro de módulo o de DI. Esos fallos compilan, pasan
las otras 1.975 pruebas, y luego la aplicación no arranca.

## 2 · Compilar

```bash
npm run build:cpanel
```

Se compila acá porque la cuenta tiene **768 MB para todos sus procesos** y `tsc` pide unos 600:
compilar en el servidor puede matar a los procesos que están atendiendo reservas. Por eso los
`dist` se versionan.

## 3 · Quitar el `.js` de la 0179

```bash
rm -f apps/api/dist/infrastructure/migrations/0179-soltar-las-tablas-retiradas.js \
      apps/api/dist/infrastructure/migrations/0179-soltar-las-tablas-retiradas.js.map \
      apps/api/dist/infrastructure/migrations/0179-soltar-las-tablas-retiradas.d.ts
```

Suelta tablas y espera confirmación de que hay respaldo fuera del hosting. Las migraciones se
cargan por glob, así que su ausencia no rompe ningún import.

Comprobar que no quedó rastro:

```bash
ls apps/api/dist/infrastructure/migrations/ | grep -c 0179    # tiene que dar 0
```

## 4 · Comprobar que el `dist` dice lo que el fuente dice

No basta con que el build salga 0. Buscar en el compilado lo que se acaba de arreglar:

```bash
grep -c "<algo que cambiaste>" apps/api/dist/<ruta del archivo>.js
ls apps/web/dist/assets/ | grep <ComponenteQueCambiaste>
```

Si una pantalla cambió, el *hash* de su activo tiene que ser distinto al anterior. Un `dist` que
no cambió es un despliegue que no hace nada, y es lo que pasó durante seis días.

## 5 · Preparar, mirando qué entra

```bash
git add -A apps/api/dist apps/web/dist packages/shared/dist
git add <los fuentes que tocaste>          # uno por uno, no -A sobre src
git diff --cached --name-only | grep -c 0179    # tiene que dar 0
```

**`git add -A apps/api/src` agrega la 0179**, que está sin seguir a propósito. El gancho
`PreToolUse` de `.claude/settings.json` lo bloquea, pero conviene no llegar ahí.

## 6 · Comprometer

El mensaje dice **qué lleva este build**, no «actualizar dist»: las migraciones que correrán por
primera vez, el arreglo que entra, y que la `0179` queda fuera y por qué.

## 7 · Rama y PR

```bash
git push origin <rama>
gh pr create --repo lavitaminadev/spartanoshub --base main --head <rama> --title "..." --body "..."
```

El CI sólo corre en empujes a `main` y en pull requests. Una rama sin PR no ejecuta nada, así que
el PR no es trámite: es la única prueba de que las migraciones corren sobre una base limpia.

## 8 · Esperar el CI entero

```bash
gh run list --repo lavitaminadev/spartanoshub --branch <rama> --limit 1
gh run watch <id> --repo lavitaminadev/spartanoshub --exit-status
```

Los 14 pasos, con «Migraciones sobre una base limpia» entre ellos. Si falla:

```bash
gh run view <id> --repo lavitaminadev/spartanoshub --log-failed
```

## 9 · Respaldo, y recién entonces fusionar

**Si corre alguna migración nueva, el respaldo de la base va antes de la fusión.** Preguntar, no
suponer: una migración que altera una tabla con datos vivos no se deshace con `down` si ya pasó por
encima de las filas.

```bash
gh pr merge <n> --repo lavitaminadev/spartanoshub --merge
```

Empujar a `main` publica. Desde ahí el servidor se actualiza cuando cPanel trae la rama `deploy`.

## 10 · Comprobar el servidor, no el workflow

```bash
gh api repos/lavitaminadev/spartanoshub/branches/deploy -q '.commit.commit.message'
curl -sS https://refugio.espartanos.cl/api/health
```

El `commit` de la respuesta tiene que ser el sha nuevo. Si dice `desconocido`, o uno viejo, cPanel
todavía no trajo la rama: eso lo hace el usuario desde Git Version Control.

**Que el workflow pase no significa que el servidor cambió.** Son dos cosas y la segunda es la que
el cliente usa.

---

## Lo que no se hace nunca

- Conectar a la base de datos de producción.
- Comprometer la `0179` ni su `.js`.
- Compilar en el servidor.
- Regenerar `package-lock.json` desde cero en Windows: pierde los binarios opcionales de Linux y el
  CI cae con `Cannot find module '@oxlint/binding-linux-x64-gnu'`. Aplicar el cambio sobre el lock
  existente.
- Añadir miles de archivos sin contarlos: hay límite de inodes, y el workflow corta en 4.000.

## Si el servidor devuelve 500 y `passenger-error.log` está en silencio

Es Apache, no la aplicación. WordPress vive en la raíz del hosting: mirar el `.htaccess` del
directorio padre.
