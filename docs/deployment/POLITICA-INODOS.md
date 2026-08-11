# Politica permanente de inodos

ESTADO: VIGENTE

FECHA: `2026-08-11`

CUENTA: `/home/espartanoscl`

## Objetivo

Mantener capacidad suficiente para Spartanoshub y futuras integraciones sin borrar datos de
forma automatica. Los unicos destinos web autorizados siguen siendo:

- frontend: `/home/espartanoscl/public_html/cuartel.espartanos.cl`;
- backend: `/home/espartanoscl/repositories/spartanoshub`, publicado por Refugio;
- el dominio principal y cualquier otra carpeta quedan fuera del despliegue.

## Limites obligatorios

| Control | Limite |
| --- | ---: |
| Cuenta completa antes de desplegar | 55.000 inodos |
| Papelera de cPanel | 2.000 inodos |
| Cache global `.npm/_cacache` | 500 inodos |
| `node_modules` productivo | 28.000 inodos |
| Archivos versionados en la rama `deploy` | 4.000 archivos |
| Reserva antes de una integracion nueva | 20.000 inodos libres |

`scripts/deploy/check-inodes.sh` solo cuenta metadatos. Si un limite se supera, detiene el
despliegue antes de migraciones, publicacion del frontend o reinicio de Passenger. Nunca
elimina archivos.

## Reglas de crecimiento

1. Existe un solo `node_modules` productivo y nunca se versiona en Git.
2. El frontend se compila en GitHub Actions; cPanel recibe solamente `dist`.
3. npm usa `tmp/npm-cache` durante la instalacion y lo elimina incluso si la instalacion falla.
4. No se guardan clones, despliegues anteriores, ZIP, respaldos del sitio ni carpetas `old` en
   la cuenta. Los respaldos de larga duracion deben almacenarse fuera del hosting.
5. La papelera no se vacia automaticamente. Si supera el limite, se audita su contenido y se
   solicita autorizacion antes de eliminarlo.
6. Toda integracion nueva debe estimar sus archivos instalados y conservar al menos 20.000
   inodos libres despues de su despliegue.
7. WordPress no debe instalar plugins de respaldo o cache que acumulen copias locales sin una
   politica de retencion comprobada.

El control tambien se ejecuta cada lunes a las 04:15. Su salida normal se descarta; cPanel
solo genera una notificacion si el script escribe un error. Esta revision es de solo lectura.

## Auditoria inicial y fase 1

La medicion del 11 de agosto de 2026 encontro `60.606` inodos usados de `75.000`. Los dos
consumidores principales eran el proyecto activo (`28.874`) y una copia antigua completa en
la papelera (`28.666`). La cache npm aportaba `1.752` y la cache de compilacion Node `559`.

Con autorizacion del propietario se realizaron exclusivamente estas operaciones:

- vaciado de `.trash` mediante la funcion oficial de cPanel;
- eliminacion de `.npm/_cacache`;
- eliminacion de `tmp/node-compile-cache`.

El conteo de archivos posterior quedo en `29.634` inodos: se liberaron `30.972`, equivalentes
al `51,1%` del consumo anterior. No se tocaron el `node_modules` activo, correo, bases de datos,
archivos de Cuartel ni la aplicacion de Refugio.

El indicador resumido de cPanel puede conservar temporalmente el valor anterior mientras
actualiza sus estadisticas. Para validar una limpieza se usa el conteo real de archivos y se
vuelve a consultar el indicador posteriormente.

## Capacidad para WordPress

Como referencia, WordPress base ocupa cerca de 4.400 inodos una vez extraido. Un sitio basico
suele requerir entre 6.000 y 8.000, y uno normal entre 10.000 y 18.000 al sumar tema, plugins y
cargas. Antes de instalarlo se debe repetir la auditoria y respetar la reserva minima; sus
respaldos deben quedar fuera de esta cuenta.

## Procedimiento ante una alerta

1. No borrar ni reiniciar servicios.
2. Medir por separado proyecto, papelera, cache, correo, temporales y respaldos.
3. Identificar si los archivos estan activos, son regenerables o son una copia.
4. Presentar cantidad recuperable, riesgo e impacto.
5. Ejecutar la limpieza solo con autorizacion explicita y volver a medir.
