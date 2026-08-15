#!/usr/bin/env node
/**
 * Carga la cola de trabajo audiovisual desde la planilla operativa.
 *
 * La fuente es "Pendientes Audiovisual", exportada a CSV. No es un histórico cerrado: son los
 * trabajos que el área tiene pendientes, así que cada fila entra como solicitud en estado
 * `new`, conservando su fecha original de solicitud para que los tiempos por etapa se midan
 * desde cuando de verdad se pidió y no desde el día de la carga.
 *
 * Dos columnas de la planilla se descartan como dato y se conservan como referencia:
 *
 * - `editor` mezcla nombres de persona con números de fila de otra hoja;
 * - `marca` se llama "Status" pero contiene una secuencia creciente de números de fila, con
 *   solo dos valores reales (`EDICIÓN`, `URGENTE`).
 *
 * Ninguna de las dos es interpretable de forma fiable, así que se guardan íntegras en
 * `operational_fields` en vez de adivinar. Quien las necesite las tiene; nadie construye
 * lógica sobre ellas.
 *
 * Es idempotente: cada solicitud recuerda su fila de origen y una segunda corrida la omite.
 * Sin `--apply` no escribe nada y solo informa qué haría.
 *
 * Uso:
 *
 *   node scripts/import/pendientes-audiovisual.cjs <archivo.csv>
 *   node scripts/import/pendientes-audiovisual.cjs <archivo.csv> --apply
 *   node scripts/import/pendientes-audiovisual.cjs <archivo.csv> --apply --solicitante correo@dominio
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');

const { assertNotProduction, connectDatabase, loadEnvironment, repositoryRoot } = require('../local/environment.cjs');

const ORIGEN = 'pendientes-audiovisual';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/** Nombre de cliente comparable: la planilla trae "Farmacia Vittae" y "farmacia Vittae". */
function clientKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/** Título legible. La planilla casi nunca lo trae, así que se deriva de la descripción. */
function buildTitle(row) {
  const explicit = (row.titulo || '').trim();
  if (explicit) return explicit.slice(0, 200);
  const fromDescription = (row.descripcion || '').replace(/\s+/g, ' ').trim();
  if (fromDescription) return fromDescription.slice(0, 90);
  return `Pendiente audiovisual (fila ${row.fila})`;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test((value || '').trim());
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || csvPath.startsWith('--')) {
    console.error('Indica el archivo CSV. Ver el encabezado de este script para el uso.');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`No existe el archivo: ${csvPath}`);
    process.exit(1);
  }

  loadEnvironment();
  assertNotProduction();

  const apply = process.argv.includes('--apply');
  const solicitanteEmail = arg('solicitante');

  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter((row) => (row.cliente || '').trim() || (row.descripcion || '').trim());

  console.log(`\nArchivo: ${path.relative(repositoryRoot, csvPath) || csvPath}`);
  console.log(`Filas con contenido: ${rows.length}`);
  if (parsed.errors.length) console.log(`Avisos del parser: ${parsed.errors.length}`);

  const db = await connectDatabase({ withDatabase: true });
  try {
    const [orgs] = await db.query('SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1');
    if (!orgs.length) throw new Error('No hay organización. Corre `npm run local:seed` primero.');
    const organizationId = orgs[0].id;

    const requesterSql = solicitanteEmail
      ? ['SELECT id, email FROM users WHERE organization_id = ? AND email = ? LIMIT 1', [organizationId, solicitanteEmail]]
      : ['SELECT id, email FROM users WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1', [organizationId]];
    const [requesters] = await db.query(...requesterSql);
    if (!requesters.length) throw new Error(`No se encontró el usuario solicitante${solicitanteEmail ? ` ${solicitanteEmail}` : ''}.`);
    const requestedBy = requesters[0].id;

    console.log(`Organización: ${orgs[0].name}`);
    console.log(`Solicitante que se atribuye: ${requesters[0].email}`);
    console.log(apply ? '\nMODO ESCRITURA\n' : '\nSIMULACIÓN — no se escribe nada. Agrega --apply para cargar.\n');

    const [existingClients] = await db.query('SELECT id, name FROM clients WHERE organization_id = ?', [organizationId]);
    const clientsByKey = new Map(existingClients.map((row) => [clientKey(row.name), row.id]));

    const [imported] = await db.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(operational_fields, '$.origenFila')) AS fila
         FROM work_requests
        WHERE organization_id = ?
          AND JSON_UNQUOTE(JSON_EXTRACT(operational_fields, '$.origen')) = ?`,
      [organizationId, ORIGEN],
    );
    const already = new Set(imported.map((row) => String(row.fila)));

    const [[{ maxCode }]] = await db.query(
      "SELECT MAX(CAST(REPLACE(code, 'SOL-', '') AS UNSIGNED)) AS maxCode FROM work_requests WHERE organization_id = ?",
      [organizationId],
    );
    let next = Number(maxCode || 0) + 1;

    const nuevosClientes = [];
    const omitidas = [];
    const sinFecha = [];
    let cargadas = 0;

    for (const row of rows) {
      if (already.has(String(row.fila))) {
        omitidas.push(row.fila);
        continue;
      }

      const nombreCliente = (row.cliente || '').trim().replace(/\s+/g, ' ');
      if (!nombreCliente) {
        sinFecha.push(`fila ${row.fila}: sin cliente`);
        continue;
      }

      let clientId = clientsByKey.get(clientKey(nombreCliente));
      if (!clientId) {
        clientId = crypto.randomUUID();
        clientsByKey.set(clientKey(nombreCliente), clientId);
        nuevosClientes.push(nombreCliente);
        if (apply) {
          await db.query(
            'INSERT INTO clients (id, organization_id, name, status, currency, default_ud_budget, daily_reservation_cap, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())',
            [clientId, organizationId, nombreCliente, 'active', 'CLP', 20, 0],
          );
        }
      }

      const solicitud = isValidDate(row.fecha_solicitud) ? `${row.fecha_solicitud} 12:00:00` : null;
      const entrega = isValidDate(row.fecha_entrega) ? row.fecha_entrega : null;
      if (!solicitud) sinFecha.push(`fila ${row.fila}: sin fecha de solicitud, se usa la de hoy`);

      const operationalFields = {
        origen: ORIGEN,
        origenFila: String(row.fila),
        // Se conservan tal cual llegaron: la planilla los usaba para otra cosa y no son fiables.
        editorPlanilla: row.editor || null,
        solicitantePlanilla: row.solicitante || null,
        marcaPlanilla: row.marca || null,
        referencia: row.referencia || null,
      };

      if (apply) {
        await db.query(
          `INSERT INTO work_requests
             (id, organization_id, client_id, code, area, title, description, priority, status,
              needed_by, requested_by, operational_fields, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?, NOW()), NOW())`,
          [
            crypto.randomUUID(), organizationId, clientId, `SOL-${String(next).padStart(5, '0')}`,
            'audiovisual', buildTitle(row), (row.descripcion || '').trim() || null,
            /urgente/i.test(row.marca || '') ? 'urgent' : 'normal', 'new',
            entrega, requestedBy, JSON.stringify(operationalFields), solicitud,
          ],
        );
      }
      next += 1;
      cargadas += 1;
    }

    console.log(`Solicitudes ${apply ? 'cargadas' : 'a cargar'}: ${cargadas}`);
    console.log(`Clientes ${apply ? 'creados' : 'a crear'}: ${nuevosClientes.length}${nuevosClientes.length ? ` — ${nuevosClientes.join(', ')}` : ''}`);
    if (omitidas.length) console.log(`Omitidas por estar ya cargadas: ${omitidas.length} (filas ${omitidas.join(', ')})`);
    if (sinFecha.length) {
      console.log('\nAvisos:');
      for (const aviso of sinFecha) console.log(`  ${aviso}`);
    }
    if (!apply) console.log('\nNada se escribió. Repite con --apply cuando el resumen calce.');
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
