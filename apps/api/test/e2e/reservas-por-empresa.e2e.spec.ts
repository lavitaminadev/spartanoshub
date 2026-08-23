import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Reservas y CRM son dos servicios que no se hablan.
 *
 * Una empresa contrata uno, el otro o los dos, y lo que ocurre en uno no aparece en el otro ni
 * en el de otra empresa. Es la parte del negocio más fácil de romper sin notarlo: las dos cosas
 * viven en la misma base y comparten la tabla de clientes, así que basta con que una consulta
 * olvide el filtro para que la agenda de un local aparezca en el CRM de otra empresa.
 */
describe('reservas por empresa', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /** Un formulario por empresa: toda reserva cuelga de uno, y es lo que la ata a su local. */
  const formularios: Record<string, string> = {};

  async function sembrarFormulario(clientId: string, nombre: string) {
    if (formularios[clientId]) return formularios[clientId];
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO reservation_forms
         (id, organization_id, client_id, name, public_slug, field_schema, design_config,
          schedule_config, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '{}', '{}', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, nombre, `${nombre}-${id.slice(0, 8)}`, banco.cuentas.admin.id],
    );
    formularios[clientId] = id;
    return id;
  }

  /** Siembra una reserva directamente: crearla por la vía pública exige un formulario publicado. */
  async function sembrarReserva(clientId: string, nombre: string) {
    const formId = await sembrarFormulario(clientId, `form-${clientId.slice(0, 8)}`);
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO reservations
         (id, organization_id, client_id, form_id, reference_code, guest_name, guest_email,
          guest_phone, party_size, starts_at, ends_at, answers, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '+56900000000', 2,
               DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 25 HOUR), '{}', 'confirmed', NOW(), NOW())`,
      [
        id, banco.organizationId, clientId, formId, id.slice(0, 8).toUpperCase(),
        nombre, `${nombre.toLowerCase().replace(/\W/g, '')}@prueba.local`,
      ],
    );
    return id;
  }

  // La bandeja de reservas responde en `items` y el CRM en `data`: se aceptan las dos formas
  // para que la prueba no dependa de cuál devuelve cada módulo.
  const filas = (body: any): any[] => (Array.isArray(body) ? body : body?.items ?? body?.data ?? []);

  it('cada empresa ve sus reservas y no las de la vecina', async () => {
    const propia = await sembrarReserva(banco.empresas.reservasUno, 'Comensal Uno');
    const ajena = await sembrarReserva(banco.empresas.reservasDos, 'Comensal Dos');

    const { status, body } = await banco.pedir(
      'GET', `/reservations?clientId=${banco.empresas.reservasUno}`, banco.cuentas.admin.token,
    );

    expect(status, JSON.stringify(body)).toBe(200);
    const ids = filas(body).map((r: { id: string }) => r.id);
    expect(ids).toContain(propia);
    expect(ids).not.toContain(ajena);
  });

  it('el portal de un local no ve las reservas de otro', async () => {
    const ajena = await sembrarReserva(banco.empresas.reservasDos, 'Comensal Ajeno');

    const { status, body } = await banco.pedir(
      'GET', '/reservations', banco.cuentas.portalReservasUno.token,
    );

    expect([200, 403]).toContain(status);
    if (status === 200) {
      expect(filas(body).map((r: { id: string }) => r.id)).not.toContain(ajena);
    }
  });

  it('una reserva no aparece como lead en el CRM de otra empresa', async () => {
    await sembrarReserva(banco.empresas.reservasUno, 'Comensal Que No Es Lead');

    const { body } = await banco.pedir(
      'GET', `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
    );

    const nombres = (body?.data ?? []).map((l: { name: string }) => l.name);
    expect(nombres).not.toContain('Comensal Que No Es Lead');
  });

  it('el portal de un local no alcanza el CRM aunque tenga sesión válida', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.portalReservasUno.token,
    );

    // Su empresa no contrató CRM: se niega explícitamente, no se disimula como una lista vacía.
    expect(status).toBe(403);
    expect(body?.message).toMatch(/módulo/i);
  });

  it('el equipo asignado a un CRM no ve por eso las reservas de un local', async () => {
    await banco.db.query(
      `INSERT INTO user_client_access (id, organization_id, user_id, client_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [randomUUID(), banco.organizationId, banco.cuentas.equipoUno.id, banco.empresas.crmUno],
    );
    const deLocal = await sembrarReserva(banco.empresas.reservasUno, 'Comensal Fuera De Alcance');

    const { status, body } = await banco.pedir(
      'GET', '/reservations', banco.cuentas.equipoUno.token,
    );

    expect([200, 403]).toContain(status);
    if (status === 200) {
      expect(filas(body).map((r: { id: string }) => r.id)).not.toContain(deLocal);
    }
  });

  it('crear una reserva en una empresa no toca el CRM de ninguna', async () => {
    const [antes]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');

    await sembrarReserva(banco.empresas.reservasDos, 'Comensal Nuevo');

    const [despues]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');
    expect(Number(despues[0].n)).toBe(Number(antes[0].n));
  });
});
