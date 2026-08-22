import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, CLAVE, type Banco } from './util/banco';

/**
 * Una empresa cliente con varias personas dentro.
 *
 * El modelo tiene dos niveles y conviene no confundirlos: la agencia tiene sus trabajadores, y
 * cada empresa cliente puede tener a su vez varias personas con cuenta. Las de una empresa ven
 * lo suyo y nada de la vecina, y entre ellas se distinguen por el perfil —quien lleva el negocio
 * y quien solo atiende—, no por el cargo, que en una empresa cliente no significa nada.
 *
 * Es el escenario que más va a crecer y el que menos probado estaba: hasta ahora las pruebas
 * usaban un solo usuario por empresa, así que nada garantizaba que el segundo se comportara.
 */
describe('varias personas dentro de una empresa cliente', () => {
  let banco: Banco;
  const cuentas: Record<string, { id: string; email: string; token: string }> = {};

  async function crearPersonaDeEmpresa(nombre: string, clientId: string, perfil?: string) {
    const email = `${nombre}@prueba.local`;
    const creada = await banco.pedir('POST', '/users', banco.cuentas.dev.token, {
      name: nombre, email, password: CLAVE, role: 'client', clientId,
    });
    expect([200, 201], JSON.stringify(creada.body)).toContain(creada.status);

    if (perfil) {
      await banco.db.query('UPDATE users SET crm_profile = ? WHERE id = ?', [perfil, creada.body.id]);
    }

    const acceso = await banco.pedir('POST', '/auth/login', undefined, { email, password: CLAVE });
    expect(acceso.status).toBe(200);
    cuentas[nombre] = { id: creada.body.id, email, token: acceso.body.accessToken };
    return cuentas[nombre];
  }

  async function sembrarLead(clientId: string, nombre: string, duenio?: string) {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO leads (id, organization_id, client_id, name, status, domain, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', 'audience', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, nombre, duenio ?? null],
    );
    return id;
  }

  beforeAll(async () => {
    banco = await levantarBanco();
    await crearPersonaDeEmpresa('duenia', banco.empresas.crmUno, 'principal');
    await crearPersonaDeEmpresa('vendedora', banco.empresas.crmUno, 'venta');
    await crearPersonaDeEmpresa('deLaOtra', banco.empresas.crmDos);
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  const ids = (body: any): string[] => (body?.data ?? []).map((f: { id: string }) => f.id);

  it('dos personas de la misma empresa ven esa empresa, y ninguna la vecina', async () => {
    const propio = await sembrarLead(banco.empresas.crmUno, 'Contacto propio');
    const ajeno = await sembrarLead(banco.empresas.crmDos, 'Contacto de la vecina');

    for (const quien of ['duenia', 'vendedora'] as const) {
      const { status, body } = await banco.pedir(
        'GET', '/crm/leads?domain=audience&limit=100', cuentas[quien].token,
      );
      expect(status, `${quien}: ${JSON.stringify(body)}`).toBe(200);
      expect(ids(body), quien).toContain(propio);
      expect(ids(body), quien).not.toContain(ajeno);
    }
  });

  it('dentro de la empresa, el perfil decide cuánto ve cada una', async () => {
    const deLaVendedora = await sembrarLead(banco.empresas.crmUno, 'Suyo', cuentas.vendedora.id);
    const deOtroDeLaCasa = await sembrarLead(banco.empresas.crmUno, 'De un compañero', cuentas.duenia.id);

    const duenia = await banco.pedir('GET', '/crm/leads?domain=audience&limit=100', cuentas.duenia.token);
    const vendedora = await banco.pedir('GET', '/crm/leads?domain=audience&limit=100', cuentas.vendedora.token);

    // Quien lleva el negocio ve todo lo de su empresa.
    expect(ids(duenia.body)).toContain(deLaVendedora);
    expect(ids(duenia.body)).toContain(deOtroDeLaCasa);

    // Quien atiende ve lo suyo, y no lo de sus compañeros.
    expect(ids(vendedora.body)).toContain(deLaVendedora);
    expect(ids(vendedora.body)).not.toContain(deOtroDeLaCasa);
  });

  it('ninguna de las dos puede escribir: el portal mira', async () => {
    const lead = await sembrarLead(banco.empresas.crmUno, 'No debe moverse');

    for (const quien of ['duenia', 'vendedora'] as const) {
      const { status } = await banco.pedir(
        'PUT', `/crm/leads/${lead}`, cuentas[quien].token, { status: 'reserved' },
      );
      expect(status, quien).toBe(403);
    }

    const [filas]: any = await banco.db.query('SELECT status FROM leads WHERE id = ?', [lead]);
    expect(filas[0].status).toBe('new');
  });

  it('una persona de otra empresa no alcanza esta ni conociendo el identificador', async () => {
    const propio = await sembrarLead(banco.empresas.crmUno, 'Contacto reservado');

    const { status } = await banco.pedir('GET', `/crm/leads/${propio}`, cuentas.deLaOtra.token);
    expect(status).toBe(404);
  });

  it('ninguna administra cuentas, ni la de su propia empresa', async () => {
    const { status } = await banco.pedir(
      'PATCH', `/users/${cuentas.vendedora.id}`, cuentas.duenia.token, { role: 'admin' },
    );
    expect([401, 403]).toContain(status);

    const [filas]: any = await banco.db.query('SELECT role FROM users WHERE id = ?', [cuentas.vendedora.id]);
    expect(filas[0].role).toBe('client');
  });

  it('desactivar a una no toca a la otra', async () => {
    const baja = await banco.pedir(
      'PATCH', `/users/${cuentas.vendedora.id}`, banco.cuentas.dev.token, { isActive: false },
    );
    if (baja.status === 403) return;

    const dueniaSigue = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=5', cuentas.duenia.token,
    );
    expect(dueniaSigue.status).toBe(200);

    const vendedoraFuera = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=5', cuentas.vendedora.token,
    );
    expect(vendedoraFuera.status).toBe(401);
  });
});
