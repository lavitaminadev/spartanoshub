#!/usr/bin/env node
/**
 * Crea la organización y una cuenta de administración para poder entrar en el computador.
 *
 * Una base recién migrada queda correcta y a la vez inservible: no hay organización, no hay
 * usuarios y el registro público está cerrado, así que no hay forma de ver una sola pantalla
 * más allá del acceso. Esto resuelve exactamente eso y nada más.
 *
 * A diferencia de `scripts/deploy/bootstrap-production.cjs`, acá la contraseña es fija y
 * conocida: es una base local que se borra y se rehace a diario, y recordar una contraseña
 * generada en cada reinstalación solo estorba. Por lo mismo el comando se niega a ejecutarse
 * con `NODE_ENV=production`.
 *
 * Es idempotente: si ya hay usuarios no toca nada.
 *
 * Uso:
 *
 *   npm run local:seed
 *   npm run local:seed -- --email otra@persona.cl
 */

const crypto = require('node:crypto');
const path = require('node:path');

const { assertNotProduction, connectDatabase, loadEnvironment, repositoryRoot } = require('./environment.cjs');

const bcrypt = require(path.join(repositoryRoot, 'node_modules', 'bcryptjs'));

/** Credenciales de desarrollo. Solo sirven contra una base local. */
const DEFAULT_EMAIL = 'admin@espartanos.local';
const DEFAULT_PASSWORD = 'Espartanos2026!';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  loadEnvironment();
  assertNotProduction();

  const email = arg('email', DEFAULT_EMAIL).trim().toLowerCase();
  const password = arg('password', DEFAULT_PASSWORD);
  const connection = await connectDatabase();

  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('organizations','users')`,
    );
    if (Number(tables[0].total) < 2) {
      throw new Error('Faltan las tablas base. Corre primero `npm run migration:run`.');
    }

    const [users] = await connection.query('SELECT COUNT(*) AS total FROM users');
    if (Number(users[0].total) > 0) {
      console.log(`Ya hay ${users[0].total} usuario(s): no se toca nada.`);
      console.log('Para empezar de cero, borra la base y corre `npm run local:start` seguido de este comando.');
      return;
    }

    const organizationId = crypto.randomUUID();
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO organizations (id, name, code, currency, is_active, created_at, updated_at)
       VALUES (?, 'La Vitamina', 'ESPARTANOS', 'CLP', 1, NOW(), NOW())`,
      [organizationId],
    );
    await connection.query(
      `INSERT INTO users (id, organization_id, name, email, password, role, is_active,
                          must_change_password, created_at, updated_at)
       VALUES (?, ?, 'Administración', ?, ?, 'admin', 1, 0, NOW(), NOW())`,
      [crypto.randomUUID(), organizationId, email, hash],
    );
    await connection.commit();

    // `must_change_password` queda en 0 a propósito: en producción el primer ingreso obliga a
    // cambiarla, pero acá eso solo agrega un paso entre arrancar y ver la aplicación.
    console.log('\nListo. Entra en http://localhost:5173 con:\n');
    console.log(`  Correo       ${email}`);
    console.log(`  Contraseña   ${password}`);
    console.log(`\nAGENCY_ORGANIZATION_ID=${organizationId}`);
    console.log('Copialo al .env si vas a probar el formulario publico de la agencia.\n');
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    console.error(`\nNo se pudo preparar la base: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

void main();
