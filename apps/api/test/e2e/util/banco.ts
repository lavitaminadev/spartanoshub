/**
 * @fileoverview Levanta la API de verdad, sobre una base real, y la puebla.
 *
 * Las pruebas que había bajo `e2e` montaban un servidor de mentira con `createServer` y
 * comprobaban que ese servidor devolvía lo que ellas mismas habían programado: pasaban aunque el
 * CRM entero estuviera roto.
 *
 * Acá se arranca **el proceso de la API tal cual**, con su `.env`, contra una base MariaDB
 * dedicada, y las pruebas hablan con ella por HTTP. Se hace así y no instanciando Nest dentro de
 * la prueba porque la aplicación carga sus entidades por patrón de archivo, y ese `require` no
 * pasa por el compilador de las pruebas. Además, hablar por HTTP recorre lo que de verdad
 * atraviesa una petición: prefijo, validación, guardias y filtros de error.
 *
 * El escenario que arma es el del negocio: una agencia con varias empresas cliente de capacidades
 * distintas —unas solo CRM, otras solo reservas—, cada una con su portal, y un equipo interno que
 * ve unas cuentas y no otras según su asignación.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

/** Contraseña de las cuentas del banco. Solo existe dentro de la base de pruebas. */
export const CLAVE = 'PruebaAislamiento2026!';

const RAIZ = resolve(__dirname, '../../..');

/**
 * Un puerto libre distinto en cada ejecución.
 *
 * Con un puerto fijo, una API que quedó viva de una ejecución anterior seguía respondiendo y las
 * pruebas hablaban con **el código de antes**: pasaban comprobando una corrección que no estaba
 * puesta, que es la peor forma de fallar. Pedirle uno libre al sistema lo hace imposible.
 */
async function puertoLibre(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();
    servidor.on('error', rechazar);
    servidor.listen(0, '127.0.0.1', () => {
      const direccion = servidor.address();
      const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
      servidor.close(() => resolver(puerto));
    });
  });
}

export interface CuentaDePrueba {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  token: string;
}

export interface Respuesta {
  status: number;
  body: any;
}

export interface Banco {
  organizationId: string;
  /** Empresas cliente, por el nombre corto con que las nombran las pruebas. */
  empresas: Record<string, string>;
  cuentas: Record<string, CuentaDePrueba>;
  db: mysql.Connection;
  pedir: (
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    token?: string,
    cuerpo?: unknown,
  ) => Promise<Respuesta>;
  /** Últimas líneas que escribió la API. Sirven para leer el error que hay detrás de un 500. */
  registro: () => string;
  cerrar: () => Promise<void>;
}

async function esperarPuerto(baseUrl: string, intentos = 150): Promise<void> {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      /*
       * Basta con que conteste, aunque sea 503.
       *
       * El chequeo de salud consulta la base, y con varias instancias levantadas a la vez el
       * grupo de conexiones se queda corto y responde 503 sin que la API esté mal: ya escucha y
       * ya atiende. Esperar un 200 dejaba la prueba colgada por una condición que no comprueba.
       */
      if (r.status < 600) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`La API no respondió en ${baseUrl}/health`);
}

/**
 * Arranca la API y deja la base en un estado conocido.
 *
 * Vacía las tablas que tocan las pruebas en vez de recrear el esquema: recrearlo son noventa y
 * tres migraciones por ejecución, y lo que hace falta es que no queden restos de la anterior.
 */
export async function levantarBanco(): Promise<Banco> {
  const base = process.env.DB_DATABASE || 'espartanos_test';
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: base,
    multipleStatements: true,
  });

  await limpiar(db);

  const puerto = await puertoLibre();
  const baseUrl = `http://127.0.0.1:${puerto}/api`;

  const proceso: ChildProcess = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['ts-node', 'src/main.ts'],
    {
      cwd: RAIZ,
      env: { ...process.env, PORT: String(puerto), DB_DATABASE: base, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    },
  );

  /*
   * La salida del arranque se guarda para poder contarla si no llega a escuchar.
   *
   * Sin esto, un fallo al arrancar —una entidad mal declarada, la base caída— se veía solo como
   * «la API no respondió», que manda a buscar el problema en el sitio equivocado.
   */
  let salida = '';
  const anotar = (trozo: Buffer) => { salida = (salida + trozo.toString()).slice(-4000); };
  proceso.stdout?.on('data', anotar);
  proceso.stderr?.on('data', anotar);

  try {
    await esperarPuerto(baseUrl);
  } catch (error) {
    proceso.kill();
    await db.end();
    throw new Error(`${(error as Error).message}
--- salida de la API ---
${salida}`);
  }

  const organizationId = randomUUID();
  await db.query(
    `INSERT INTO organizations (id, name, code, currency, is_active, created_at, updated_at)
     VALUES (?, 'La Vitamina', 'ESPARTANOS', 'CLP', 1, NOW(), NOW())`,
    [organizationId],
  );

  /*
   * Cuatro empresas con capacidades distintas, que es la situación real: la agencia vende
   * servicios sueltos. Dos llevan solo el CRM y dos solo reservas; ninguna debe ver nada de otra.
   */
  const empresas: Record<string, string> = {};
  const definicion: Array<[string, { crm: boolean; reservations: boolean }]> = [
    ['crmUno', { crm: true, reservations: false }],
    ['crmDos', { crm: true, reservations: false }],
    ['reservasUno', { crm: false, reservations: true }],
    ['reservasDos', { crm: false, reservations: true }],
  ];
  for (const [clave, capacidades] of definicion) {
    const id = randomUUID();
    empresas[clave] = id;
    await db.query(
      `INSERT INTO clients (id, organization_id, name, status, capabilities, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, NOW(), NOW())`,
      [id, organizationId, clave, JSON.stringify({
        ...capacidades, metaConversions: false, googleConversions: false, budgetVisibility: false,
      })],
    );
  }

  const hash = await bcrypt.hash(CLAVE, 10);
  const cuentas: Record<string, CuentaDePrueba> = {};

  async function crearCuenta(clave: string, role: string, clientId?: string) {
    const id = randomUUID();
    const email = `${clave.toLowerCase()}@prueba.local`;
    await db.query(
      `INSERT INTO users (id, organization_id, name, email, password, role, client_id, is_active,
                          must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
      [id, organizationId, clave, email, hash, role, clientId ?? null],
    );
    cuentas[clave] = { id, email, role, clientId, token: '' };
  }

  await crearCuenta('dev', 'dev');
  await crearCuenta('admin', 'admin');
  // Dos personas del equipo: cada una verá las cuentas que se le asignen, y solo esas.
  await crearCuenta('equipoUno', 'community_manager');
  await crearCuenta('equipoDos', 'community_manager');
  // Portales de cliente: cada uno atado a su empresa.
  await crearCuenta('portalCrmUno', 'client', empresas.crmUno);
  await crearCuenta('portalReservasUno', 'client', empresas.reservasUno);

  const pedir: Banco['pedir'] = async (metodo, ruta, token, cuerpo) => {
    const respuesta = await fetch(`${baseUrl}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    let body: unknown = texto;
    try { body = texto ? JSON.parse(texto) : null; } catch { /* respuesta no JSON */ }
    return { status: respuesta.status, body };
  };

  /*
   * El token se consigue entrando por la misma puerta que cualquiera.
   *
   * No se firma a mano: hacerlo saltaría el propio inicio de sesión, que es parte de lo que se
   * quiere comprobar, y dejaría pasar un fallo ahí sin que ninguna prueba lo notara.
   */
  for (const cuenta of Object.values(cuentas)) {
    const { status, body } = await pedir('POST', '/auth/login', undefined, {
      email: cuenta.email, password: CLAVE,
    });
    if (status !== 200 && status !== 201) {
      throw new Error(`No se pudo entrar con ${cuenta.email}: ${status} ${JSON.stringify(body)}`);
    }
    cuenta.token = body.accessToken;
  }

  return {
    organizationId,
    empresas,
    cuentas,
    db,
    pedir,
    registro: () => salida,
    cerrar: async () => {
      await db.end();
      await detener(proceso);
    },
  };
}

/**
 * Tablas que tocan estas pruebas.
 *
 * Se apagan las claves foráneas mientras se vacía: hacerlo en el orden exacto obliga a mantener
 * ese orden a mano cada vez que aparece una tabla nueva, y el primer olvido deja la prueba
 * fallando por un motivo que no tiene que ver con lo que comprueba.
 */
async function limpiar(db: mysql.Connection): Promise<void> {
  const tablas = [
    'leads', 'crm_contacts', 'user_client_access', 'pod_members', 'pods',
    'reservations', 'reservation_forms', 'clients', 'user_sessions', 'users', 'organizations',
    'approval_requests', 'process_stage_changes', 'audit_logs', 'campaigns', 'lead_ingest_sources',
  ];
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of tablas) {
    try {
      await db.query(`DELETE FROM \`${tabla}\``);
    } catch {
      // Una tabla ausente en este esquema no es un fallo de la prueba.
    }
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function cerrarBanco(banco: Banco): Promise<void> {
  await banco.cerrar();
}

/**
 * Detiene la API arrancada por el banco, con todo lo que colgaba de ella.
 *
 * En Windows, `npx` levanta un intérprete de comandos que a su vez levanta node: matar el padre
 * deja al hijo escuchando. Cada ejecución de las pruebas dejaba así una API viva, y en una tarde
 * de trabajo se acumularon noventa: consumían conexiones hasta que la base dejaba de dar más y
 * las pruebas empezaban a fallar por un motivo que no tenía nada que ver con lo que probaban.
 *
 * `taskkill /T` recorre el árbol completo. Fuera de Windows basta con matar el grupo.
 */
async function detener(proceso: ChildProcess): Promise<void> {
  if (!proceso.pid) return;
  if (process.platform === 'win32') {
    const { spawnSync } = await import('node:child_process');
    spawnSync('taskkill', ['/PID', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proceso.kill('SIGTERM');
  }
  // Un momento para que suelte el puerto y las conexiones antes de que arranque el siguiente.
  await new Promise((r) => setTimeout(r, 500));
}
