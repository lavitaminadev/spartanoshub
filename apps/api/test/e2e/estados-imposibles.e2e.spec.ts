import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Ningún lead puede quedar en un estado que su embudo no admite.
 *
 * La regla vivía solo en el código, así que protegía la puerta por la que pasa el equipo y
 * ninguna otra: una importación antigua, la integración de Meta o un `UPDATE` a mano podían
 * dejar un contacto de campaña en `won`. Y eso no da error en ningún sitio: el lead se queda
 * **sin columna donde dibujarse**, desaparece de la pantalla sin haberse borrado, y sigue
 * contando en los totales.
 *
 * Desde la migración 0106 la restricción está en la propia tabla. Estas pruebas comprueban las
 * dos direcciones: que la aplicación siga rechazándolo con un mensaje entendible, y que la base
 * lo rechace aunque nadie pase por la aplicación.
 */
describe('estados imposibles', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  async function sembrarLead(clientId: string | null, domain: 'audience' | 'commercial') {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO leads (id, organization_id, client_id, name, status, domain, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, `Lead ${id.slice(0, 8)}`, domain],
    );
    return id;
  }

  it('la aplicación rechaza mover un contacto de campaña al embudo comercial, y lo explica', async () => {
    const contacto = await sembrarLead(banco.empresas.crmUno, 'audience');

    const { status, body } = await banco.pedir(
      'PUT', `/crm/leads/${contacto}`, banco.cuentas.admin.token, { status: 'negotiation' },
    );

    expect(status).toBe(400);
    expect(String(body?.message ?? '')).toMatch(/no corresponde a un lead de/i);
  });

  it('la base lo rechaza aunque nadie pase por la aplicación', async () => {
    const contacto = await sembrarLead(banco.empresas.crmUno, 'audience');

    await expect(
      banco.db.query('UPDATE leads SET status = ? WHERE id = ?', ['won', contacto]),
    ).rejects.toThrow(/CHK_leads_status_domain/);
  });

  it('tampoco deja crear uno ya nacido en un estado imposible', async () => {
    const id = randomUUID();
    await expect(
      banco.db.query(
        `INSERT INTO leads (id, organization_id, client_id, name, status, domain, created_at, updated_at)
         VALUES (?, ?, ?, 'Imposible de nacimiento', 'quote_sent', 'audience', NOW(), NOW())`,
        [id, banco.organizationId, banco.empresas.crmUno],
      ),
    ).rejects.toThrow(/CHK_leads_status_domain/);
  });

  it('en el sentido contrario también: un prospecto de la agencia no reserva mesa', async () => {
    const prospecto = await sembrarLead(null, 'commercial');

    await expect(
      banco.db.query('UPDATE leads SET status = ? WHERE id = ?', ['reserved', prospecto]),
    ).rejects.toThrow(/CHK_leads_status_domain/);
  });

  it('los estados válidos siguen pasando, o la restricción sobraría', async () => {
    const contacto = await sembrarLead(banco.empresas.crmUno, 'audience');
    const prospecto = await sembrarLead(null, 'commercial');

    for (const estado of ['reserved', 'attended', 'no_show', 'lost']) {
      await banco.db.query('UPDATE leads SET status = ? WHERE id = ?', [estado, contacto]);
    }
    // Sin 'visited': la etapa se retiro del embudo comercial y la restriccion ya no la admite.
    for (const estado of ['contacted', 'quote_sent', 'meeting_scheduled', 'negotiation', 'lost']) {
      await banco.db.query('UPDATE leads SET status = ? WHERE id = ?', [estado, prospecto]);
    }

    const [filas]: any = await banco.db.query(
      'SELECT status FROM leads WHERE id IN (?, ?)', [contacto, prospecto],
    );
    expect(filas).toHaveLength(2);
  });
});
