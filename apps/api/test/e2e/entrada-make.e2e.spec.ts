import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * La puerta por la que Make entrega los leads.
 *
 * Es la única entrada del sistema que atiende sin sesión: la autoriza una llave, no una persona.
 * Eso la convierte en la superficie más expuesta del producto —cualquiera en internet puede
 * llamarla— y a la vez en la más crítica, porque decide **a qué empresa** queda atribuido cada
 * contacto que entra.
 *
 * Se comprueban las dos caras: que la llave correcta deposite el lead en su empresa y en su
 * campaña, y que ninguna variante —llave ajena, apagada, ausente, malformada— consiga escribir.
 */
describe('entrada de leads por API', () => {
  let banco: Banco;
  const llaves: Record<string, string> = {};

  /**
   * Crea un origen con su llave, tal como lo hace la pantalla de campañas.
   *
   * La huella se calcula igual que en el servicio: solo se guarda eso, nunca el valor, así que
   * la prueba tiene que generarlo y quedárselo como haría quien la copia al configurar Make.
   */
  async function crearLlave(
    nombre: string,
    clientId: string | null,
    campaignName: string | null,
    activa = true,
  ) {
    const token = `esp_in_${randomBytes(24).toString('hex')}`;
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO lead_ingest_sources
         (id, organization_id, client_id, name, source, campaign_name, token_hash, token_hint,
          is_active, received_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'meta_lead_ads', ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        id, banco.organizationId, clientId, nombre, campaignName,
        createHash('sha256').update(token).digest('hex'), token.slice(-6), activa ? 1 : 0,
      ],
    );
    llaves[nombre] = token;
    return { id, token };
  }

  /** Entrega un lead como lo haría Make: sin sesión, con la llave en la cabecera. */
  async function entregar(token: string | undefined, cuerpo: Record<string, unknown>) {
    return banco.pedir('POST', '/public/ingest/leads', token, cuerpo);
  }

  beforeAll(async () => {
    banco = await levantarBanco();

    await banco.db.query(
      `INSERT INTO crm_campaigns (id, organization_id, client_id, name, source, investment, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Verano 2026', 'meta_lead_ads', 500000, 'active', NOW(), NOW())`,
      [randomUUID(), banco.organizationId, banco.empresas.crmUno],
    );

    await crearLlave('registrada', banco.empresas.crmUno, 'Verano 2026');
    await crearLlave('sinRegistrar', banco.empresas.crmUno, 'Campaña que nadie registró');
    await crearLlave('deLaOtra', banco.empresas.crmDos, 'Verano 2026');
    await crearLlave('apagada', banco.empresas.crmUno, 'Verano 2026', false);
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  describe('lo que debe funcionar', () => {
    it('el lead entra en la empresa de la llave, no en la que diga el cuerpo', async () => {
      const { status, body } = await entregar(llaves.registrada, {
        nombre: 'Ana de Make',
        telefono: '+56911111111',
        // Un intento de redirigirlo: el cuerpo no decide la empresa, la llave sí.
        clientId: banco.empresas.crmDos,
      });

      expect([200, 201], JSON.stringify(body)).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT client_id, campaign_name, domain FROM leads WHERE id = ?', [body.leadId],
      );
      expect(filas[0].client_id).toBe(banco.empresas.crmUno);
      expect(filas[0].campaign_name).toBe('Verano 2026');
    });

    it('avisa cuando la campaña está registrada, para saber que el costo se calculará', async () => {
      const { body } = await entregar(llaves.registrada, {
        nombre: 'Beto de Make', telefono: '+56922222222',
      });

      expect(body.campaign).toMatchObject({ name: 'Verano 2026', recognized: true });
      expect(body.campaign.hint).toBeUndefined();
    });

    it('avisa cuando NO lo está, que es el fallo silencioso que nadie nota', async () => {
      const { status, body } = await entregar(llaves.sinRegistrar, {
        nombre: 'Carla de Make', telefono: '+56933333333',
      });

      // El lead entra igual: perderlo por un nombre mal escrito sería peor que la cifra perdida.
      expect([200, 201]).toContain(status);
      expect(body.leadId).toBeTruthy();
      expect(body.campaign.recognized).toBe(false);
      expect(body.campaign.hint).toMatch(/Administración → Campañas/);
    });

    it('acepta los nombres de campo que manda Meta, no solo los propios', async () => {
      const { status, body } = await entregar(llaves.registrada, {
        full_name: 'Diego de Meta',
        phone_number: '+56944444444',
        created_time: '2026-08-01T10:00:00Z',
        leadgen_id: 'lg-12345',
        campaign_id: 'camp-999',
      });

      expect([200, 201], JSON.stringify(body)).toContain(status);
      const [filas]: any = await banco.db.query(
        'SELECT name, phone, external_lead_id FROM leads WHERE id = ?', [body.leadId],
      );
      expect(filas[0].name).toBe('Diego de Meta');
      expect(filas[0].external_lead_id).toBeTruthy();
    });

    it('el mismo envío dos veces no crea dos leads', async () => {
      const cuerpo = {
        nombre: 'Elena Repetida', telefono: '+56955555555', idExterno: 'lg-repetido-1',
      };
      const primera = await entregar(llaves.registrada, cuerpo);
      const segunda = await entregar(llaves.registrada, cuerpo);

      expect(primera.body.leadId).toBe(segunda.body.leadId);
    });
  });

  describe('lo que no debe funcionar', () => {
    it('sin llave no entra nada', async () => {
      const { status } = await entregar(undefined, { nombre: 'Colado', telefono: '+56999999999' });
      expect(status).toBe(401);
    });

    it('una llave inventada no entra', async () => {
      const { status } = await entregar(`esp_in_${randomBytes(24).toString('hex')}`, {
        nombre: 'Colado dos', telefono: '+56999999998',
      });
      expect(status).toBe(401);
    });

    it('una llave apagada no entra, y no dice que existe', async () => {
      const { status, body } = await entregar(llaves.apagada, {
        nombre: 'Colado tres', telefono: '+56999999997',
      });

      expect(status).toBe(401);
      // El mensaje no distingue «no existe» de «está apagada»: decirlo confirmaría a un tercero
      // que la llave que tiene es válida y solo hay que esperar a que la enciendan.
      expect(String(body?.message ?? '')).not.toMatch(/apagad|desactivad|inactiv/i);
    });

    it('nada de lo rechazado dejó rastro en la base', async () => {
      const [filas]: any = await banco.db.query(
        "SELECT COUNT(*) AS n FROM leads WHERE name LIKE 'Colado%'",
      );
      expect(Number(filas[0].n)).toBe(0);
    });

    it('un lead sin forma de contactar se rechaza diciendo qué falta', async () => {
      const { status, body } = await entregar(llaves.registrada, { nombre: 'Sin contacto' });

      expect(status).toBe(400);
      expect(String(body?.message ?? '')).toMatch(/teléfono o correo/i);
    });

    it('la llave de una empresa no puede escribir en otra ni cambiando el cuerpo', async () => {
      const { body } = await entregar(llaves.deLaOtra, {
        nombre: 'Intento cruzado',
        telefono: '+56966666666',
        clientId: banco.empresas.crmUno,
        organizationId: randomUUID(),
      });

      const [filas]: any = await banco.db.query(
        'SELECT client_id, organization_id FROM leads WHERE id = ?', [body.leadId],
      );
      expect(filas[0].client_id).toBe(banco.empresas.crmDos);
      expect(filas[0].organization_id).toBe(banco.organizationId);
    });
  });
});
