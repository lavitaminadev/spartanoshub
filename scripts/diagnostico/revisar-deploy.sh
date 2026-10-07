#!/usr/bin/env bash
# Por qué el Git Version Control de cPanel no desplegó.
#
# Uso:   bash scripts/diagnostico/revisar-deploy.sh
#
# El despliegue tiene dos mitades y fallan por motivos distintos, así que el orden importa:
#
#   1. cPanel hace `git checkout` de la rama `deploy`. Esto se rompe cuando el árbol de trabajo
#      tiene archivos seguidos modificados —un `npm install` sin `--no-save`, una compilación que
#      escribió dentro de `dist`—, porque el checkout no puede pisarlos.
#   2. cPanel ejecuta las tareas del `.cpanel.yml`, en orden y deteniéndose en la primera que
#      devuelva algo distinto de cero. Un fallo aquí **no avisa**: el despliegue aparece hecho,
#      el código nuevo está en disco, y las migraciones y la publicación del frontend no corrieron.
#
# El caso 2 es el que no se ve. Por eso lo primero que mira este script es el registro de la
# última ejecución y su código de salida, y no el estado de git.
#
# Solo lee. No cambia nada, no despliega y no reinicia.
set -uo pipefail

readonly APP_ROOT="${APP_DIR:-$HOME/repositories/spartanoshub}"
readonly FRONTEND="$HOME/public_html/cuartel.espartanos.cl"
readonly SALUD="https://refugio.espartanos.cl/api/health"
readonly NODE_BIN="$HOME/nodevenv/repositories/spartanoshub/22/bin"

titulo() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

titulo "1. Última ejecución del despliegue"
# Los registros de cPanel viven fuera del repositorio y no se rotan: el más reciente es el que
# importa. Un tamaño muy por debajo de los anteriores ya indica que se cortó temprano.
ultimo="$(ls -t "$HOME"/.cpanel/logs/*git_deploy.log 2>/dev/null | head -1)"
if [ -z "$ultimo" ]; then
  echo "No hay registros de despliegue. El Git Version Control nunca ejecutó las tareas."
else
  echo "Archivo:  $ultimo"
  echo "Fecha:    $(date -r "$ultimo" '+%Y-%m-%d %H:%M:%S')"
  echo "Tamaño:   $(wc -c < "$ultimo") bytes   (un despliegue completo ronda los 5.000–8.500)"
  echo
  echo "--- Resultado final ---"
  grep -E 'Build completed with exit code' "$ultimo" | tail -1
  echo
  echo "--- Tareas que fallaron ---"
  # Cada tarea imprime su código al terminar; la que no sea 0 es donde se detuvo todo lo demás.
  grep -B12 'Task completed with exit code [^0]' "$ultimo" | tail -30 \
    || echo "Ninguna tarea devolvió un código distinto de cero."
fi

titulo "2. Qué quedó en disco"
cd "$APP_ROOT" 2>/dev/null || { echo "No existe $APP_ROOT"; exit 1; }
echo "Commit:   $(git log -1 --format='%h  %ci  %s' 2>/dev/null)"
echo "Rama:     $(cat .git/HEAD 2>/dev/null)"
echo
echo "--- Archivos seguidos modificados (si hay alguno, el próximo checkout falla) ---"
sucio="$(git status --short 2>/dev/null)"
if [ -n "$sucio" ]; then echo "$sucio"; else echo "Ninguno: el árbol está limpio."; fi

titulo "3. Fechas de lo compilado y lo publicado"
# La fecha de git no basta: git no reescribe un archivo cuyo contenido no cambió. Lo que delata
# un despliegue a medias es que el frontend publicado sea más viejo que el compilado.
stat -c '%y  %n' \
  "$APP_ROOT/apps/api/dist/main.js" \
  "$APP_ROOT/apps/web/dist/index.html" \
  "$FRONTEND/index.html" 2>/dev/null
echo
echo "--- ¿El HTML publicado pide archivos que existen? ---"
# Una pantalla en blanco sin error de servidor casi siempre es esto: el index nuevo pide un
# bundle que la copia no alcanzó a recibir, y Apache responde el propio index con tipo erróneo.
grep -o 'assets/[A-Za-z0-9._-]*\.js' "$FRONTEND/index.html" 2>/dev/null | head -3 \
  | while read -r archivo; do
      [ -f "$FRONTEND/$archivo" ] && echo "existe: $archivo" || echo "FALTA:  $archivo"
    done

titulo "4. Entorno que necesitan las tareas"
# Git Deployment no activa el entorno del Node.js Selector: sin esto, `npm` puede no existir
# durante el despliegue aunque funcione al entrar por SSH.
if [ -x "$NODE_BIN/node" ] && [ -x "$NODE_BIN/npm" ]; then
  echo "Node 22 de cPanel: presente ($("$NODE_BIN/node" --version))"
else
  echo "Node 22 de cPanel: FALTA en $NODE_BIN — las tareas se detienen aquí."
fi
# En CloudLinux la raíz de node_modules es un enlace al entorno virtual. Si alguien lo convirtió
# en carpeta, la aplicación arranca a medias y falla en un `require` distinto cada vez.
if [ -L "$APP_ROOT/node_modules" ]; then
  echo "node_modules:      enlace, como corresponde"
elif [ -e "$APP_ROOT/node_modules" ]; then
  echo "node_modules:      ES UNA CARPETA — CloudLinux lo exige como enlace."
else
  echo "node_modules:      no existe"
fi

titulo "5. Migraciones pendientes"
# Es el síntoma de que las tareas se cortaron antes de llegar al paso de migraciones: el código
# nuevo queda corriendo contra una base que no tiene sus columnas.
if [ -x "$NODE_BIN/node" ]; then
  PATH="$NODE_BIN:$PATH" npm run migration:run:prod --silent 2>&1 \
    | grep -E 'migrations are new|No migrations are pending|is the last executed' \
    || echo "No se pudo consultar el estado de las migraciones."
else
  echo "Sin el entorno Node no se puede consultar."
fi

titulo "6. Inodos"
# El guardián aborta el despliegue cuando la cuenta se acerca al límite, y es un fallo que no se
# parece a uno: las tareas simplemente dejan de ejecutarse.
bash "$APP_ROOT/scripts/deploy/check-inodes.sh" 2>&1 | tail -3

titulo "7. ¿Responde la aplicación?"
printf 'API %s\n' "$(curl -s -o /dev/null -w 'HTTP %{http_code} en %{time_total}s' "$SALUD")"
# Un 500 sin nada en el registro de Passenger es Apache heredando el .htaccess de WordPress,
# no la aplicación: el síntoma y la causa están en sitios distintos.
echo
echo "--- Últimos errores de Passenger ---"
tail -n 15 "$HOME/logs/passenger-error.log" 2>/dev/null | grep -iE 'error|cannot|failed' \
  || echo "Sin errores recientes."

printf '\n\033[1m== Cómo leerlo ==\033[0m\n'
cat <<'FIN'
  Registro pequeño y «exit code 1»   -> una tarea falló; el bloque de la sección 1 dice cuál.
  Sin registros                      -> cPanel ni siquiera ejecutó el despliegue.
  Árbol sucio                        -> el checkout no puede pisar esos archivos: revísalos.
  Frontend más viejo que lo compilado-> las tareas se cortaron antes de publicar.
  Migraciones pendientes             -> se cortaron antes del paso de la base de datos.
  Falta un assets/*.js               -> la copia del frontend quedó incompleta.
FIN
