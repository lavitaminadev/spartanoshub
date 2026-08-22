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
