#!/usr/bin/env node
/**
 * Detiene los servidores que dejó `npm run local:start`.
 *
 * Se detiene el árbol completo y no solo el proceso anotado: quien queda escuchando el puerto es
 * el hijo que lanzó npm, de modo que señalar únicamente al padre devolvería el control a la
 * terminal dejando el 3000 y el 5173 ocupados.
 *
 * Uso:
 *
 *   npm run local:stop
 */

const { SERVICES, clearPid, isPortOpen, isRunning, readPid, stopProcessTree } = require('./environment.cjs');

async function main() {
  let stopped = 0;

  for (const service of SERVICES) {
    const pid = readPid(service.name);

    if (!pid) {
      console.log(`${service.label}: no habia ninguno anotado.`);
      continue;
    }
    if (!isRunning(pid)) {
      // El proceso murió por su cuenta —un fallo, o un reinicio del equipo— y el archivo quedó.
      clearPid(service.name);
      console.log(`${service.label}: ya no estaba corriendo, se descarta el registro.`);
      continue;
    }

    stopProcessTree(pid);
    clearPid(service.name);
    stopped += 1;
    console.log(`${service.label}: detenido (pid ${pid}).`);
  }

  // Un puerto que sigue ocupado tras detener significa que hay otro proceso encima, y saberlo
  // ahora evita que el siguiente arranque falle sin explicación.
  for (const service of SERVICES) {
    if (await isPortOpen(service.port)) {
      console.log(`Aviso: el puerto ${service.port} sigue ocupado por un proceso ajeno a local:start.`);
    }
  }

  if (stopped === 0) console.log('\nNo habia nada que detener.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
