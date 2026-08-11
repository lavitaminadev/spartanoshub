#!/usr/bin/env node
/**
 * Piezas comunes de los comandos `local:*`.
 *
 * Los cuatro comandos necesitan lo mismo: saber dónde está la raíz, leer el `.env`, ubicar los
 * archivos de estado y decidir si un proceso sigue vivo. Vive acá para que arrancar, detener y
 * consultar coincidan siempre en dónde miran; si cada uno resolviera esas rutas por su cuenta,
 * `local:stop` podría buscar el proceso en un sitio distinto del que `local:start` escribió.
 *
 * Todo lo que se genera al ejecutar va a `.local/`, que está en `.gitignore`: son identificadores
 * de proceso y registros de una máquina concreta, sin sentido en el repositorio.
 */

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

/** Raíz del repositorio, dos niveles por encima de este archivo. */
const repositoryRoot = path.resolve(__dirname, '..', '..');

/** Directorio de estado en ejecución. Ignorado por git. */
const runtimeDirectory = path.join(repositoryRoot, '.local');

/** Servicios que el entorno local levanta, en el orden en que deben arrancar. */
const SERVICES = [
  { name: 'api', label: 'API', script: 'dev:api', port: 3000, url: 'http://localhost:3000/api' },
  { name: 'web', label: 'Interfaz', script: 'dev:web', port: 5173, url: 'http://localhost:5173' },
];

/** Carga el `.env` de la raíz, el mismo que lee la API al arrancar. */
function loadEnvironment() {
  require(path.join(repositoryRoot, 'node_modules', 'dotenv'))
    .config({ path: path.join(repositoryRoot, '.env'), quiet: true });
}

/** Crea `.local/` si falta y devuelve su ruta. */
function ensureRuntimeDirectory() {
  fs.mkdirSync(runtimeDirectory, { recursive: true });
  return runtimeDirectory;
}

function pidFile(service) {
  return path.join(runtimeDirectory, `${service}.pid`);
}

function logFile(service) {
  return path.join(runtimeDirectory, `${service}.log`);
}

/** Identificador de proceso anotado para un servicio, o `null` si no hay ninguno. */
function readPid(service) {
  try {
    const value = Number(fs.readFileSync(pidFile(service), 'utf8').trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writePid(service, pid) {
  fs.writeFileSync(pidFile(service), String(pid), 'utf8');
}

function clearPid(service) {
  fs.rmSync(pidFile(service), { force: true });
}

/**
 * Indica si el proceso sigue vivo.
 *
 * La señal 0 no lo interrumpe: solo comprueba que exista y que este usuario pueda señalarlo.
 */
function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM significa que existe pero pertenece a otro usuario, y para lo que nos importa
    // —saber si el puerto va a estar ocupado— cuenta como vivo.
    return error.code === 'EPERM';
  }
}

/** Indica si alguien está escuchando en el puerto. */
function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const settle = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(700);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

/**
 * Espera a que el puerto acepte conexiones.
 *
 * @returns `true` si respondió dentro del plazo, `false` si se agotó.
 */
async function waitForPort(port, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * Detiene un proceso y los que haya lanzado.
 *
 * `npm` deja al servidor real como proceso hijo, así que señalar solo al que anotamos dejaría
 * el puerto ocupado. En Windows se delega en `taskkill /T`; en el resto se señala al grupo
 * completo, que es lo que `detached: true` permite al arrancar.
 */
function stopProcessTree(pid) {
  if (process.platform === 'win32') {
    const { spawnSync } = require('node:child_process');
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* ya no existe */ }
  }
}

/**
 * Impide que un comando pensado para el computador de alguien toque un entorno productivo.
 *
 * Los comandos `local:*` crean datos de prueba y reinician servicios; ejecutarlos contra la base
 * de producción sería destructivo, y basta un `.env` copiado por error para que ocurra.
 */
function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    console.error('NODE_ENV=production: los comandos local:* no operan sobre un entorno productivo.');
    process.exit(1);
  }
}

/** Abre una conexión a MySQL con las credenciales del `.env`. */
async function connectDatabase({ withDatabase = true } = {}) {
  const mysql = require(path.join(repositoryRoot, 'node_modules', 'mysql2', 'promise'));
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'espartanos',
    password: process.env.DB_PASSWORD || '',
    ...(withDatabase ? { database: process.env.DB_DATABASE || 'espartanos' } : {}),
    multipleStatements: false,
  });
}

module.exports = {
  SERVICES,
  assertNotProduction,
  clearPid,
  connectDatabase,
  ensureRuntimeDirectory,
  isPortOpen,
  isRunning,
  loadEnvironment,
  logFile,
  pidFile,
  readPid,
  repositoryRoot,
  runtimeDirectory,
  stopProcessTree,
  waitForPort,
  writePid,
};
