#!/usr/bin/env node
/**
 * Levanta la aplicación completa en el computador: API en el 3000, interfaz en el 5173.
 *
 * Antes de arrancar comprueba lo que suele faltar —el `.env`, la base, las migraciones— y lo
 * dice con la orden exacta para resolverlo, en vez de dejar que el fallo aparezca más tarde
 * como un error de conexión sin contexto.
 *
 * Los servidores quedan en segundo plano con su salida en `.local/*.log`, de modo que la
 * terminal queda libre. Se detienen con `npm run local:stop` y se consultan con
 * `npm run local:status`.
 *
 * Uso:
 *
 *   npm run local:start
 *   npm run local:start -- --no-migrate   # omite las migraciones
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  SERVICES,
  assertNotProduction,
  connectDatabase,
  ensureRuntimeDirectory,
  isPortOpen,
  isRunning,
  loadEnvironment,
  logFile,
  readPid,
  repositoryRoot,
  waitForPort,
  writePid,
} = require('./environment.cjs');

const envPath = path.join(repositoryRoot, '.env');

/**
 * Crea un `.env` de desarrollo si no existe.
 *
 * Los secretos se generan en el momento y no se copian de la plantilla: los valores de ejemplo
 * son marcadores que `validateEnvironment` rechaza, y uno copiado sin mirar es exactamente el
 * accidente que la lista de secretos prohibidos existe para evitar.
 */
function ensureEnvFile() {
  if (fs.existsSync(envPath)) return false;

  const secret = () => crypto.randomBytes(32).toString('hex');
  const contents = [
    '# Entorno de desarrollo, generado por `npm run local:start`.',
    '# No es el de produccion: los secretos son de esta maquina y la base es local.',
    'NODE_ENV=development',
    'PORT=3000',
    '',
    'DB_HOST=localhost',
    'DB_PORT=3306',
    'DB_USERNAME=root',
    'DB_PASSWORD=',
    'DB_DATABASE=espartanos_dev',
    'DB_SSL=false',
    'DB_CONNECTION_LIMIT=5',
    '',
    'CORS_ORIGIN=http://localhost:5173',
    'APP_PUBLIC_URL=http://localhost:5173',
    'API_PUBLIC_URL=http://localhost:3000/api',
    'VITE_API_URL=http://localhost:3000/api',
    'VITE_APP_PUBLIC_URL=http://localhost:5173',
    'ENABLE_SWAGGER=true',
    'ALLOW_PUBLIC_REGISTRATION=false',
    'ENABLE_INTERNAL_SCHEDULER=false',
    '',
    `JWT_SECRET=${secret()}`,
    'JWT_EXPIRES_IN=15m',
    'JWT_REFRESH_EXPIRES_IN=7d',
    `CRON_SECRET=${secret()}`,
    'BCRYPT_ROUNDS=10',
    `INTEGRATION_ENCRYPTION_KEY=${secret()}`,
    `OAUTH_STATE_SECRET=${secret()}`,
    '',
    `UPLOAD_DIR=${path.join(repositoryRoot, '.local', 'uploads').replace(/\\/g, '/')}`,
    'MAX_UPLOAD_BYTES=20971520',
    'SMTP_ENABLED=false',
    '',
  ].join('\n');

  fs.writeFileSync(envPath, contents, 'utf8');
  console.log('Creado .env de desarrollo con secretos nuevos (esta ignorado por git).');
  return true;
}

/**
 * Comprueba que MySQL responda y que la base exista, creándola si falta.
 *
 * @returns `true` si la base quedó disponible.
 */
async function ensureDatabase() {
  const name = process.env.DB_DATABASE || 'espartanos_dev';
  let connection;
  try {
    connection = await connectDatabase({ withDatabase: false });
  } catch (error) {
    // mysql2 deja el mensaje vacio en un rechazo de conexion y solo rellena `code`.
    const detail = [error.code, error.message].filter(Boolean).join(' · ') || 'sin detalle';
    console.error(`\nNo hay MySQL escuchando en ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}.`);
    console.error(`Detalle: ${detail}`);
    console.error('\nInstala MySQL o MariaDB y vuelve a intentar. Las credenciales se ajustan en .env');
    console.error('(DB_USERNAME, DB_PASSWORD, DB_DATABASE).');
    return false;
  }

  try {
    // El nombre viene del `.env` de quien ejecuta, no de una petición: se valida igual antes de
    // interpolarlo, porque `CREATE DATABASE` no admite parametros ligados.
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      console.error(`DB_DATABASE contiene caracteres no admitidos: ${name}`);
      return false;
    }
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Base de datos disponible: ${name}`);
    return true;
  } finally {
    await connection.end();
  }
}

/** Ejecuta un comando de npm esperando a que termine. */
function runNpm(args, description) {
  console.log(`\n${description}...`);
  const result = spawnSync('npm', args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

/**
 * Arranca un servicio en segundo plano.
 *
 * Queda desligado de esta terminal —`detached`— para que cerrarla no lo interrumpa, y su salida
 * va al registro del servicio para poder revisarla después.
 */
function startService(service) {
  const output = fs.openSync(logFile(service.name), 'a');
  const child = spawn('npm', ['run', service.script], {
    cwd: repositoryRoot,
    detached: true,
    stdio: ['ignore', output, output],
    shell: process.platform === 'win32',
  });
  child.unref();
  writePid(service.name, child.pid);
  return child.pid;
}

async function main() {
  assertNotProduction();
  ensureRuntimeDirectory();

  const created = ensureEnvFile();
  loadEnvironment();
  assertNotProduction();

  if (!(await ensureDatabase())) process.exit(1);

  if (!process.argv.includes('--no-migrate')) {
    if (!runNpm(['run', 'migration:run'], 'Aplicando migraciones pendientes')) {
      console.error('\nLas migraciones fallaron. Los servidores no se levantan sobre un esquema incompleto.');
      process.exit(1);
    }
  }

  for (const service of SERVICES) {
    const existing = readPid(service.name);
    if (isRunning(existing)) {
      console.log(`${service.label} ya estaba corriendo (pid ${existing}).`);
      continue;
    }
    if (await isPortOpen(service.port)) {
      console.error(`El puerto ${service.port} esta ocupado por otro proceso. Libéralo antes de arrancar ${service.label}.`);
      process.exit(1);
    }
    const pid = startService(service);
    console.log(`${service.label} arrancando (pid ${pid}), registro en .local/${service.name}.log`);
  }

  console.log('\nEsperando a que respondan...');
  for (const service of SERVICES) {
    const ready = await waitForPort(service.port);
    console.log(ready
      ? `  ${service.label}: ${service.url}`
      : `  ${service.label}: no respondio a tiempo. Revisa .local/${service.name}.log`);
  }

  if (created) {
    console.log('\nLa base esta vacia: corre `npm run local:seed` para crear la organizacion y tu cuenta.');
  }
  console.log('\nDetener: npm run local:stop   ·   Estado: npm run local:status');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
