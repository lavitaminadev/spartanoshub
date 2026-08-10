#!/usr/bin/env node
/**
 * Crea la organización y la primera cuenta de administración en una base recién migrada.
 *
 * Sin esto, después de correr las migraciones no hay a quién entrar: no existe ninguna
 * organización, no existe ningún usuario, y el registro público está cerrado en producción
 * (`ALLOW_PUBLIC_REGISTRATION=false`). La base queda correcta y a la vez inservible.
 *
 * **No usar `database/seeds/seed.sql` para esto.** Ese archivo es de demostración local: sus
 * contraseñas están escritas en el repositorio, que además es público. Sirve para probar la
 * aplicación en el computador, nunca para un servidor que mira a Internet.
 *
 * Es idempotente y se niega a actuar si ya hay usuarios: correrlo dos veces por error no puede
 * pisar una organización en marcha ni crear un administrador de más.
 *
 * Uso:
 *
 *   node scripts/deploy/bootstrap-production.cjs \
 *     --org "La Vitamina" --code VITAHUB \
 *     --email nico@midominio.cl --name "Nico Salinas"
 *
 * La contraseña se genera acá y se imprime **una sola vez**. Nace marcada como temporal, así que
 * el primer ingreso obliga a cambiarla; no queda ninguna contraseña definitiva en el historial
 * de la terminal.
 */

const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

const bcrypt = require(path.join(root, 'node_modules', 'bcryptjs'));
const mysql = require(path.join(root, 'node_modules', 'mysql2', 'promise'));

/** Lee `--clave valor` de la línea de comandos. */
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

/**
 * Contraseña temporal legible al dictarla por teléfono.
 *
 * Sin caracteres que se confundan al leerlos en voz alta o en una tipografía cualquiera: nada de
 * l/I/1 ni de O/0. Vive minutos —el primer ingreso la cambia—, así que la longitud compensa el
 * alfabeto más corto.
 */
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  // Se asegura un símbolo y un dígito para satisfacer cualquier política de complejidad.
  return `${body}7!`;
}

function uuid() {
  return crypto.randomUUID();
}

async function main() {
  const orgName = arg('org');
  const orgCode = (arg('code') || 'VITAHUB').toUpperCase();
  const email = (arg('email') || '').trim().toLowerCase();
  const name = arg('name') || 'Administración';

  if (!orgName || !email) {
    console.error('Faltan datos. Uso:\n  node scripts/deploy/bootstrap-production.cjs --org "La Vitamina" --code VITAHUB --email tu@dominio.cl --name "Tu Nombre"');
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`El correo "${email}" no parece válido.`);
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = ? AND table_name IN ('organizations','users')`,
      [process.env.DB_DATABASE],
    );
    if (Number(tables[0].total) < 2) {
      throw new Error('Faltan las tablas base. Corre primero `npm run migration:run`.');
    }

    // La comprobación que evita el accidente: si ya hay gente adentro, este script no tiene
    // nada que hacer y cualquier cosa que hiciera sería un daño.
    const [users] = await connection.query('SELECT COUNT(*) AS total FROM users');
    if (Number(users[0].total) > 0) {
      console.log(`Ya hay ${users[0].total} usuario(s): la base no está vacía y no se toca nada.`);
      console.log('Para agregar personas, usa la pantalla de Usuarios dentro de la aplicación.');
      return;
    }

    const organizationId = uuid();
    const userId = uuid();
    const password = temporaryPassword();
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO organizations (id, name, code, currency, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'CLP', 1, NOW(), NOW())`,
      [organizationId, orgName, orgCode],
    );
    await connection.query(
      `INSERT INTO users (id, organization_id, name, email, password, role, is_active,
                          must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, NOW(), NOW())`,
      [userId, organizationId, name, email, hash],
    );
    await connection.commit();

    console.log('\nOrganización y administración creadas.\n');
    console.log(`  Organización     ${orgName} (${orgCode})`);
    console.log(`  AGENCY_ORGANIZATION_ID   ${organizationId}`);
    console.log(`  Correo           ${email}`);
    console.log(`  Contraseña       ${password}`);
    console.log('\nDos cosas antes de cerrar esta terminal:');
    console.log('  1. Copia AGENCY_ORGANIZATION_ID al .env; sin eso el formulario público de la agencia responde 403.');
    console.log('  2. Entra y cambia la contraseña. Es temporal y el primer ingreso te la va a pedir.\n');
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    console.error(`\nNo se pudo inicializar: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

void main();
