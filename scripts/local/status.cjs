#!/usr/bin/env node
/**
 * Informa qué hay levantado y si la base responde.
 *
 * Distingue tres cosas que suelen confundirse en un solo «no funciona»: que el proceso viva, que
 * el puerto acepte conexiones y que la base conteste. Un servidor arrancado que todavía compila
 * cumple la primera y no la segunda, y esa diferencia es justo la que hace esperar en vez de
 * reiniciar sin motivo.
 *
 * Uso:
 *
 *   npm run local:status
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  SERVICES,
  connectDatabase,
  isPortOpen,
  isRunning,
  loadEnvironment,
  logFile,
  readPid,
  repositoryRoot,
} = require('./environment.cjs');

/** Estado de la base, como texto listo para mostrar. */
async function databaseStatus() {
  let connection;
  try {
    connection = await connectDatabase();
  } catch (error) {
    return `sin conexion (${error.code || error.message})`;
  }
  try {
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    const tables = Number(rows?.[0]?.total ?? 0);
    return tables === 0 ? 'conectada, sin tablas (falta migrar)' : `conectada, ${tables} tablas`;
  } finally {
    await connection.end();
  }
}

async function main() {
  if (!fs.existsSync(path.join(repositoryRoot, '.env'))) {
    console.log('No hay .env. Corre `npm run local:start`, que lo crea.');
    return;
  }
  loadEnvironment();

  console.log('Servicios');
  for (const service of SERVICES) {
    const pid = readPid(service.name);
    const alive = isRunning(pid);
    const listening = await isPortOpen(service.port);

    let state;
    if (alive && listening) state = `en linea · ${service.url}`;
    else if (alive) state = `arrancando, el puerto ${service.port} aun no responde`;
    else if (listening) state = `el puerto ${service.port} lo ocupa otro proceso`;
    else state = 'detenido';

    console.log(`  ${service.label.padEnd(9)} ${state}${alive ? ` (pid ${pid})` : ''}`);
    if (alive && !listening) console.log(`  ${' '.repeat(9)} registro: .local/${service.name}.log`);
  }

  console.log('\nBase de datos');
  console.log(`  ${(process.env.DB_DATABASE || 'espartanos_dev').padEnd(9)} ${await databaseStatus()}`);

  const missing = SERVICES.filter((service) => !fs.existsSync(logFile(service.name)));
  if (missing.length === SERVICES.length) console.log('\nTodavia no se ha arrancado nada en esta copia.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
