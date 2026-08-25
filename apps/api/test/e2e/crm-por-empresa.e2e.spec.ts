import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * El CRM responde por la empresa que se está mirando, y por ninguna otra.
 *
 * No basta con que la lista de leads esté filtrada: el inicio, el panel y la importación
 * responden por empresa y cada uno cuenta por su cuenta. Si uno de ellos se olvida del filtro,
 * la pantalla enseña por arriba —en forma de totales o de avisos— justo lo que la lista oculta
 * por abajo, y nadie lo nota porque las cifras no llevan nombre.
 *
 * También se comprueba lo contrario de una fuga: que trabajar en el CRM de una empresa no
 * aparezca en la cuenta principal de la agencia.
 */
describe('el CRM responde por empresa', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /** Importa filas por la misma vía que la pantalla: el endpoint, no la base. */
  async function importar(clientId: string | undefined, nombres: string[], token: string) {
    return banco.pedir('POST', '/crm/leads/import', token, {
      source: 'archivo_prueba',
      domain: clientId ? 'audience' : 'commercial',
      clientId,
      rows: nombres.map((name, indice) => ({
        name,
        email: `${name.toLowerCase().replace(/\W/g, '')}@prueba.local`,
        phone: `+5690000${String(indice).padStart(4, '0')}`,
      })),
    });
  }

  const ids = (body: any): string[] => (body?.data ?? []).map((fila: { id: string }) => fila.id);

  describe('importación', () => {
    it('los contactos importados quedan en la empresa elegida y no en otra', async () => {
      const respuesta = await importar(banco.empresas.crmUno, ['Ana Importada', 'Beto Importado'], banco.cuentas.admin.token);
      expect([200, 201], JSON.stringify(respuesta.body)).toContain(respuesta.status);

      const enSuEmpresa = await banco.pedir(
        'GET', `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );
      const enLaOtra = await banco.pedir(
        'GET', `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      const nombres = (body: any) => (body?.data ?? []).map((l: { name: string }) => l.name);
      expect(nombres(enSuEmpresa.body)).toContain('Ana Importada');
      expect(nombres(enLaOtra.body)).not.toContain('Ana Importada');
    });

    it('no se puede importar a una empresa que no se alcanza', async () => {
      // `equipoUno` no tiene ninguna cuenta asignada en este fichero.
      const { status } = await importar(banco.empresas.crmDos, ['Colado'], banco.cuentas.equipoUno.token);
      expect([403, 404]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT COUNT(*) AS n FROM leads WHERE name = ?', ['Colado'],
      );
      expect(Number(filas[0].n)).toBe(0);
    });

    it('no se puede importar al CRM de una empresa que no lo contrató', async () => {
      const { status } = await importar(banco.empresas.reservasUno, ['De local'], banco.cuentas.admin.token);
      expect(status).toBe(403);

      const [filas]: any = await banco.db.query(
        'SELECT COUNT(*) AS n FROM leads WHERE name = ?', ['De local'],
      );
      expect(Number(filas[0].n)).toBe(0);
    });
  });

  describe('embudo comercial multiempresa', () => {
    it('la agencia y una empresa usan el mismo CRM sin compartir leads', async () => {
      const agencia = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Prospecto propio Espartanos', domain: 'commercial', source: 'manual',
      });
      const empresa = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Prospecto CRM Empresa Uno', domain: 'commercial', source: 'manual',
        clientId: banco.empresas.crmUno,
      });
      expect([200, 201]).toContain(agencia.status);
      expect([200, 201]).toContain(empresa.status);

      const listaAgencia = await banco.pedir(
        'GET', '/crm/leads?domain=commercial&limit=100', banco.cuentas.admin.token,
      );
      const listaEmpresa = await banco.pedir(
        'GET', `/crm/leads?domain=commercial&limit=100&clientId=${banco.empresas.crmUno}`,
        banco.cuentas.admin.token,
      );
      const nombres = (body: any) => (body?.data ?? []).map((lead: { name: string }) => lead.name);
      expect(nombres(listaAgencia.body)).toContain('Prospecto propio Espartanos');
      expect(nombres(listaAgencia.body)).not.toContain('Prospecto CRM Empresa Uno');
      expect(nombres(listaEmpresa.body)).toContain('Prospecto CRM Empresa Uno');
      expect(nombres(listaEmpresa.body)).not.toContain('Prospecto propio Espartanos');

      const inicioAgencia = await banco.pedir(
        'GET', '/crm/home?domain=commercial', banco.cuentas.admin.token,
      );
      const inicioEmpresa = await banco.pedir(
        'GET', `/crm/home?domain=commercial&clientId=${banco.empresas.crmUno}`,
        banco.cuentas.admin.token,
      );
      const panelAgencia = await banco.pedir(
        'GET', '/crm/home/dashboard?domain=commercial&days=30', banco.cuentas.admin.token,
      );
      const panelEmpresa = await banco.pedir(
        'GET', `/crm/home/dashboard?domain=commercial&days=30&clientId=${banco.empresas.crmUno}`,
        banco.cuentas.admin.token,
      );
      expect(inicioAgencia.body.month.leads).toBe(1);
      expect(inicioEmpresa.body.month.leads).toBe(1);
      expect(panelAgencia.body.totals.leads).toBe(1);
      expect(panelEmpresa.body.totals.leads).toBe(1);
    });

    it('el portal usa la empresa de su sesión aunque manipule el query string', async () => {
      const propia = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Visible solo portal CRM Uno', domain: 'commercial', source: 'manual',
        clientId: banco.empresas.crmUno,
      });
      const ajena = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Oculta portal CRM Uno', domain: 'commercial', source: 'manual',
        clientId: banco.empresas.crmDos,
      });
      expect([200, 201]).toContain(propia.status);
      expect([200, 201]).toContain(ajena.status);

      const manipulada = await banco.pedir(
        'GET', `/crm/leads?domain=commercial&limit=100&clientId=${banco.empresas.crmDos}`,
        banco.cuentas.portalCrmUno.token,
      );
      expect(manipulada.status, JSON.stringify(manipulada.body)).toBe(200);
      const nombres = (manipulada.body?.data ?? []).map((lead: { name: string }) => lead.name);
      expect(nombres).toContain('Visible solo portal CRM Uno');
      expect(nombres).not.toContain('Oculta portal CRM Uno');

      const inicioManipulado = await banco.pedir(
        'GET', `/crm/home?domain=commercial&clientId=${banco.empresas.crmDos}`,
        banco.cuentas.portalCrmUno.token,
      );
      const panelManipulado = await banco.pedir(
        'GET', `/crm/home/dashboard?domain=commercial&days=30&clientId=${banco.empresas.crmDos}`,
        banco.cuentas.portalCrmUno.token,
      );
      expect(inicioManipulado.status, JSON.stringify(inicioManipulado.body)).toBe(200);
      expect(panelManipulado.status, JSON.stringify(panelManipulado.body)).toBe(200);
      expect(inicioManipulado.body.month.leads).toBe(2);
      expect(panelManipulado.body.totals.leads).toBe(2);
    });
  });

  describe('inicio y panel', () => {
    beforeAll(async () => {
      await importar(banco.empresas.crmUno, ['Uno A', 'Uno B', 'Uno C'], banco.cuentas.admin.token);
      await importar(banco.empresas.crmDos, ['Dos A'], banco.cuentas.admin.token);
    });

    it('el inicio cuenta los de la empresa elegida, no los de todas', async () => {
      const uno = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );
      const dos = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      expect(uno.status, JSON.stringify(uno.body)).toBe(200);
      expect(dos.status, JSON.stringify(dos.body)).toBe(200);
      // Las cifras tienen que diferenciarse: si fueran iguales, el selector no llegaría al servidor.
      expect(uno.body.month.leads).toBeGreaterThan(dos.body.month.leads);
    });

    it('los avisos del inicio nombran solo contactos de la empresa elegida', async () => {
      const { body } = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      const nombres = (body.alerts ?? []).flatMap((aviso: any) => (aviso.items ?? []).map((l: any) => l.name));
      for (const nombre of nombres) {
        expect(nombre.startsWith('Dos '), `"${nombre}" no es de esta empresa`).toBe(true);
      }
    });

    it('el panel cuenta por empresa', async () => {
      const uno = await banco.pedir(
        'GET', `/crm/home/dashboard?days=30&domain=audience&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );
      const dos = await banco.pedir(
        'GET', `/crm/home/dashboard?days=30&domain=audience&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      expect(uno.status).toBe(200);
      expect(dos.status).toBe(200);
      expect(uno.body.totals.leads).toBeGreaterThan(dos.body.totals.leads);
    });

    it('el inicio y el panel de una empresa sin CRM no se dibujan vacíos: lo dicen', async () => {
      const inicio = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.reservasUno}`, banco.cuentas.admin.token,
      );
      const panel = await banco.pedir(
        'GET', `/crm/home/dashboard?days=30&domain=audience&clientId=${banco.empresas.reservasUno}`, banco.cuentas.admin.token,
      );

      expect(inicio.status).toBe(403);
      expect(panel.status).toBe(403);
    });
  });

  describe('calendario del portal', () => {
    it('muestra las actividades de su CRM y nunca las de otra empresa', async () => {
      const propia = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Reunión propia del portal', domain: 'commercial', source: 'manual',
        clientId: banco.empresas.crmUno,
      });
      const ajena = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Reunión de empresa vecina', domain: 'commercial', source: 'manual',
        clientId: banco.empresas.crmDos,
      });
      expect([200, 201]).toContain(propia.status);
      expect([200, 201]).toContain(ajena.status);

      const actividadPropia = await banco.pedir('POST', '/crm/interactions', banco.cuentas.admin.token, {
        leadId: propia.body.id, type: 'meeting', description: 'Agenda visible del cliente',
        date: '2026-08-24T15:00:00.000Z',
      });
      const actividadAjena = await banco.pedir('POST', '/crm/interactions', banco.cuentas.admin.token, {
        leadId: ajena.body.id, type: 'meeting', description: 'Agenda de otra empresa',
        date: '2026-08-24T16:00:00.000Z',
      });
      expect([200, 201], JSON.stringify(actividadPropia.body)).toContain(actividadPropia.status);
      expect([200, 201], JSON.stringify(actividadAjena.body)).toContain(actividadAjena.status);

      // Aunque el navegador mande otra empresa, la API toma la firmada en la sesión.
      const calendario = await banco.pedir(
        'GET', `/crm/interactions?limit=100&clientId=${banco.empresas.crmDos}`,
        banco.cuentas.portalCrmUno.token,
      );
      expect(calendario.status, JSON.stringify(calendario.body)).toBe(200);
      const descripciones = (calendario.body?.data ?? []).map((item: { description?: string }) => item.description);
      expect(descripciones).toContain('Agenda visible del cliente');
      expect(descripciones).not.toContain('Agenda de otra empresa');
    });

    it('el portal consulta el calendario pero no fabrica actividades internas', async () => {
      const intento = await banco.pedir('POST', '/crm/interactions', banco.cuentas.portalCrmUno.token, {
        type: 'meeting', description: 'Actividad inventada por el portal',
      });
      expect(intento.status).toBe(403);
    });
  });

  describe('lo que pasa en el CRM de una empresa no sale de ahí', () => {
    it('mover un contacto de una empresa no cambia las cifras de la otra', async () => {
      const antes = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      const lista = await banco.pedir(
        'GET', `/crm/leads?domain=audience&limit=1&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );
      const alguno = ids(lista.body)[0];
      expect(alguno).toBeDefined();

      const movido = await banco.pedir(
        'PUT', `/crm/leads/${alguno}`, banco.cuentas.admin.token, { status: 'reserved' },
      );
      expect(movido.status, JSON.stringify(movido.body)).toBe(200);

      const despues = await banco.pedir(
        'GET', `/crm/home?domain=audience&clientId=${banco.empresas.crmDos}`, banco.cuentas.admin.token,
      );

      expect(despues.body.month).toEqual(antes.body.month);
      expect(despues.body.urgentCount).toBe(antes.body.urgentCount);
    });

    it('el recorrido de un contacto queda en su lead, no en un registro común', async () => {
      const lista = await banco.pedir(
        'GET', `/crm/leads?domain=audience&limit=1&clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );
      const alguno = ids(lista.body)[0];

      await banco.pedir('PUT', `/crm/leads/${alguno}`, banco.cuentas.admin.token, { status: 'attended' });

      const historial = await banco.pedir(
        'GET', `/crm/leads/${alguno}/historial`, banco.cuentas.admin.token,
      );
      expect(historial.status).toBe(200);
      expect(Array.isArray(historial.body) ? historial.body.length : 0).toBeGreaterThan(0);

      // Y ningún lead de la otra empresa tiene recorrido escrito por esto.
      const [filas]: any = await banco.db.query(
        `SELECT COUNT(*) AS n FROM process_stage_changes psc
         JOIN leads l ON l.id = psc.subject_id
         WHERE l.client_id = ?`,
        [banco.empresas.crmDos],
      );
      expect(Number(filas[0].n)).toBe(0);
    });
  });
});
