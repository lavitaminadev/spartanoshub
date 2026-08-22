import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Convertir un lead crea una **empresa cliente**, y eso no vale para cualquiera.
 *
 * Una empresa cliente es alguien a quien la agencia presta servicios y factura. Un contacto de
 * campaña es otra cosa: una persona que respondió al anuncio del local de un cliente. Convertir
 * al segundo metía a un comensal en la cartera de la agencia, con su nombre como razón social,
 * y de paso lo dejaba en un estado que su embudo no admite —convertir fuerza «venta», que el
 * ciclo de reserva no tiene—, con lo que desaparecía del tablero de su local.
 *
 * Nada fallaba. La cartera se ensuciaba de a uno.
 */
describe('convertir un lead en empresa cliente', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  async function sembrarLead(clientId: string | null, domain: 'audience' | 'commercial', nombre: string) {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO leads (id, organization_id, client_id, name, status, domain, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, nombre, domain],
    );
    return id;
  }

  it('un prospecto de la agencia sí se convierte', async () => {
    const prospecto = await sembrarLead(null, 'commercial', 'Estudio Jurídico Pérez');

    const { status, body } = await banco.pedir(
      'POST', `/crm/leads/${prospecto}/convert`, banco.cuentas.admin.token,
    );

    expect([200, 201], JSON.stringify(body)).toContain(status);

    const [empresas]: any = await banco.db.query(
      'SELECT name FROM clients WHERE lead_id = ?', [prospecto],
    );
    expect(empresas).toHaveLength(1);
    expect(empresas[0].name).toBe('Estudio Jurídico Pérez');
  });

  it('un contacto de campaña no: es un comensal, no una empresa', async () => {
    const comensal = await sembrarLead(banco.empresas.crmUno, 'audience', 'María Comensal');

    const { status, body } = await banco.pedir(
      'POST', `/crm/leads/${comensal}/convert`, banco.cuentas.admin.token,
    );

    expect(status).toBe(400);
    expect(String(body?.message ?? '')).toMatch(/contacto de campaña/i);
  });

  it('y no queda ninguna empresa creada a su nombre', async () => {
    const [empresas]: any = await banco.db.query(
      'SELECT COUNT(*) AS n FROM clients WHERE name = ?', ['María Comensal'],
    );
    expect(Number(empresas[0].n)).toBe(0);
  });

  it('el contacto sigue en su tablero, en el estado en que estaba', async () => {
    const comensal = await sembrarLead(banco.empresas.crmUno, 'audience', 'Pedro Comensal');
    await banco.pedir('POST', `/crm/leads/${comensal}/convert`, banco.cuentas.admin.token);

    const [filas]: any = await banco.db.query(
      'SELECT status, converted_to_client_id FROM leads WHERE id = ?', [comensal],
    );
    expect(filas[0].status).toBe('new');
    expect(filas[0].converted_to_client_id).toBeNull();
  });

  it('el mismo prospecto no se convierte dos veces', async () => {
    const prospecto = await sembrarLead(null, 'commercial', 'Panadería Dos Veces');
    const primera = await banco.pedir('POST', `/crm/leads/${prospecto}/convert`, banco.cuentas.admin.token);
    expect([200, 201]).toContain(primera.status);

    const segunda = await banco.pedir('POST', `/crm/leads/${prospecto}/convert`, banco.cuentas.admin.token);
    expect(segunda.status).toBe(409);

    const [empresas]: any = await banco.db.query(
      'SELECT COUNT(*) AS n FROM clients WHERE name = ?', ['Panadería Dos Veces'],
    );
    expect(Number(empresas[0].n)).toBe(1);
  });

  it('el portal de un cliente no convierte nada', async () => {
    const prospecto = await sembrarLead(null, 'commercial', 'Intento Del Portal');

    const { status } = await banco.pedir(
      'POST', `/crm/leads/${prospecto}/convert`, banco.cuentas.portalCrmUno.token,
    );
    expect([401, 403, 404]).toContain(status);

    const [empresas]: any = await banco.db.query(
      'SELECT COUNT(*) AS n FROM clients WHERE name = ?', ['Intento Del Portal'],
    );
    expect(Number(empresas[0].n)).toBe(0);
  });
});
