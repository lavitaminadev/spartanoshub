import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Que una empresa no vea lo de otra, ni por la lista ni por el identificador.
 *
 * La agencia vende servicios sueltos: hay empresas que solo llevan el CRM y otras que solo llevan
 * reservas, y entre ellas no comparten nada —ni datos, ni personas, ni pantallas—. El equipo
 * interno sí atraviesa varias, pero solo las que tiene asignadas.
 *
 * Se comprueba contra la API de verdad y una base real, porque el aislamiento no vive en una
 * función sino en la suma de guardias, permisos, filtros y consultas: probarlo con dobles
 * comprueba el doble, no el sistema.
 */
describe('aislamiento entre cuentas', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /** Siembra un lead directamente, para no depender de la pantalla que lo crea. */
  async function sembrarLead(clientId: string | null, nombre: string, domain: 'audience' | 'commercial') {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO leads (id, organization_id, client_id, name, status, domain, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'new', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, nombre, domain],
    );
    return id;
  }

  /** Asigna una cuenta a una persona del equipo, que es la vía de excepción sin mover pods. */
  async function asignarCuenta(userId: string, clientId: string) {
    await banco.db.query(
      `INSERT INTO user_client_access (id, organization_id, user_id, client_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [randomUUID(), banco.organizationId, userId, clientId],
    );
  }

  const ids = (body: any): string[] => (body?.data ?? []).map((fila: { id: string }) => fila.id);

  describe('el equipo ve solo las cuentas que tiene asignadas', () => {
    let leadUno: string;
    let leadDos: string;

    beforeAll(async () => {
      leadUno = await sembrarLead(banco.empresas.crmUno, 'Contacto de crmUno', 'audience');
      leadDos = await sembrarLead(banco.empresas.crmDos, 'Contacto de crmDos', 'audience');
      await asignarCuenta(banco.cuentas.equipoUno.id, banco.empresas.crmUno);
      await asignarCuenta(banco.cuentas.equipoDos.id, banco.empresas.crmDos);
    });

    it('cada persona ve los leads de su cuenta y no los de la otra', async () => {
      const uno = await banco.pedir('GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.equipoUno.token);
      const dos = await banco.pedir('GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.equipoDos.token);

      expect(uno.status, JSON.stringify(uno.body)).toBe(200);
      expect(dos.status, JSON.stringify(dos.body)).toBe(200);

      expect(ids(uno.body)).toContain(leadUno);
      expect(ids(uno.body)).not.toContain(leadDos);
      expect(ids(dos.body)).toContain(leadDos);
      expect(ids(dos.body)).not.toContain(leadUno);
    });

    it('pedir una cuenta ajena por parámetro no devuelve sus leads', async () => {
      const { status, body } = await banco.pedir(
        'GET',
        `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.crmDos}`,
        banco.cuentas.equipoUno.token,
      );

      // Da igual si responde 403 o una lista vacía; lo que no puede es devolver el lead ajeno.
      expect(ids(body)).not.toContain(leadDos);
      expect([200, 403, 404]).toContain(status);
    });

    it('el lead de una cuenta ajena no se alcanza por su identificador', async () => {
      const { status } = await banco.pedir(
        'GET', `/crm/leads/${leadDos}`, banco.cuentas.equipoUno.token,
      );
      // 404 y no 403: decir que existe ya es contar algo de una cuenta ajena.
      expect(status).toBe(404);
    });

    it('tampoco se puede modificar el lead de una cuenta ajena', async () => {
      const { status } = await banco.pedir(
        'PUT', `/crm/leads/${leadDos}`, banco.cuentas.equipoUno.token, { status: 'contacted' },
      );
      expect(status).toBe(404);

      const [filas]: any = await banco.db.query('SELECT status FROM leads WHERE id = ?', [leadDos]);
      expect(filas[0].status).toBe('new');
    });

    it('mover un lead propio no toca ningún lead de otra cuenta', async () => {
      const antes: any = await banco.db.query(
        'SELECT id, status, updated_at FROM leads WHERE id = ?', [leadDos],
      );

      const { status } = await banco.pedir(
        'PUT', `/crm/leads/${leadUno}`, banco.cuentas.equipoUno.token, { status: 'reserved' },
      );
      expect(status).toBe(200);

      const despues: any = await banco.db.query(
        'SELECT id, status, updated_at FROM leads WHERE id = ?', [leadDos],
      );
      expect(despues[0][0].status).toBe(antes[0][0].status);
      expect(String(despues[0][0].updated_at)).toBe(String(antes[0][0].updated_at));
    });
  });

  describe('la agencia y sus clientes son embudos distintos', () => {
    it('un prospecto de la agencia no aparece en el CRM de ninguna empresa', async () => {
      const prospecto = await sembrarLead(null, 'Prospecto de la agencia', 'commercial');

      const { body } = await banco.pedir(
        'GET',
        `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.crmUno}`,
        banco.cuentas.admin.token,
      );

      expect(ids(body)).not.toContain(prospecto);
    });

    it('el embudo comercial no arrastra contactos de campaña de los clientes', async () => {
      const contacto = await sembrarLead(banco.empresas.crmUno, 'Contacto de campaña', 'audience');

      const { body } = await banco.pedir(
        'GET', '/crm/leads?domain=commercial&limit=100', banco.cuentas.admin.token,
      );

      expect(ids(body)).not.toContain(contacto);
    });
  });

  describe('capacidades contratadas por empresa', () => {
    /*
     * Una empresa que solo contrató reservas no debería tener CRM, y al revés.
     *
     * La capacidad existe por empresa (`clients.capabilities`) y hoy solo la comprueba el módulo
     * de reservas. Estas pruebas dejan escrito qué se espera; si alguna falla, señala el hueco.
     */
    it('el módulo de reservas comprueba la capacidad de la empresa', async () => {
      const { status, body } = await banco.pedir(
        'GET', `/reservations/forms?clientId=${banco.empresas.reservasUno}`, banco.cuentas.admin.token,
      );
      expect([200, 403], JSON.stringify(body)).toContain(status);
    });

    it('pedir el CRM de una empresa que no lo contrató lo dice, en vez de devolverlo', async () => {
      await sembrarLead(banco.empresas.reservasUno, 'Contacto de local', 'audience');

      const { status, body } = await banco.pedir(
        'GET',
        `/crm/leads?domain=audience&limit=100&clientId=${banco.empresas.reservasUno}`,
        banco.cuentas.admin.token,
      );

      expect(status).toBe(403);
      // El aviso nombra el servicio: quien lo lee tiene que poder distinguir «no lo contrataste»
      // de «no tienes permiso», que se arreglan de formas distintas.
      expect(String(body?.message ?? '')).toMatch(/CRM/i);
    });

    it('sin empresa elegida, el CRM no mezcla leads de empresas que no lo contrataron', async () => {
      const deLocal = await sembrarLead(banco.empresas.reservasDos, 'Otro contacto de local', 'audience');
      const deCliente = await sembrarLead(banco.empresas.crmUno, 'Contacto con CRM', 'audience');

      const { status, body } = await banco.pedir(
        'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.admin.token,
      );

      expect(status).toBe(200);
      expect(ids(body)).toContain(deCliente);
      expect(ids(body)).not.toContain(deLocal);
    });

    it('el embudo de la agencia no depende de ninguna capacidad contratada', async () => {
      // Sus prospectos no tienen empresa: la agencia no se contrata servicios a sí misma, y
      // acotar por capacidad los dejaría a todos fuera.
      const prospecto = await sembrarLead(null, 'Prospecto propio', 'commercial');

      const { status, body } = await banco.pedir(
        'GET', '/crm/leads?domain=commercial&limit=100', banco.cuentas.admin.token,
      );

      expect(status).toBe(200);
      expect(ids(body)).toContain(prospecto);
    });
  });

  describe('el portal del cliente', () => {
    it('ve los contactos de su empresa, y solo los de su empresa', async () => {
      const propio = await sembrarLead(banco.empresas.crmUno, 'Contacto del portal', 'audience');
      const ajeno = await sembrarLead(banco.empresas.crmDos, 'Contacto de la otra', 'audience');

      const { status, body } = await banco.pedir(
        'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.portalCrmUno.token,
      );

      expect(status, JSON.stringify(body)).toBe(200);
      expect(ids(body)).toContain(propio);
      expect(ids(body)).not.toContain(ajeno);
    });

    it('no ve el embudo comercial de la agencia', async () => {
      const prospecto = await sembrarLead(null, 'Prospecto de la agencia', 'commercial');

      const { body } = await banco.pedir(
        'GET', '/crm/leads?domain=commercial&limit=100', banco.cuentas.portalCrmUno.token,
      );

      expect(ids(body)).not.toContain(prospecto);
    });

    it('mira pero no mueve: el portal no puede cambiar la etapa de un contacto', async () => {
      const propio = await sembrarLead(banco.empresas.crmUno, 'Contacto que no debe moverse', 'audience');

      const { status } = await banco.pedir(
        'PUT', `/crm/leads/${propio}`, banco.cuentas.portalCrmUno.token, { status: 'reserved' },
      );

      /*
       * En qué etapa está cada contacto y quién lo trabaja son decisiones del equipo. Abrir el
       * portal en lectura le muestra a la empresa lo que es suyo; dejarlo escribir lo convertiría
       * en un segundo puesto de mando sobre el trabajo de la agencia.
       */
      expect(status).toBe(403);

      const [filas]: any = await banco.db.query('SELECT status FROM leads WHERE id = ?', [propio]);
      expect(filas[0].status).toBe('new');
    });

    it('una empresa que no contrató CRM no lo ve desde su portal', async () => {
      await sembrarLead(banco.empresas.reservasUno, 'Contacto de local', 'audience');

      const { status, body } = await banco.pedir(
        'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.portalReservasUno.token,
      );

      // Sin empresa pedida la lista se acota a las que sí lo tienen: la suya no está, así que
      // no hay nada que mostrar. Ni un error confuso ni datos de otra empresa.
      expect(status).toBe(200);
      expect(body?.data ?? []).toHaveLength(0);
    });

    it('el portal de una empresa no ve las reservas de otra', async () => {
      const propias = await banco.pedir(
        'GET', '/reservations', banco.cuentas.portalReservasUno.token,
      );
      expect([200, 403]).toContain(propias.status);

      if (propias.status === 200) {
        const ajenas = (propias.body?.data ?? []).filter(
          (r: { clientId?: string }) => r.clientId && r.clientId !== banco.empresas.reservasUno,
        );
        expect(ajenas).toHaveLength(0);
      }
    });
  });
});
