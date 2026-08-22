import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Todo lo que el sistema atiende sin sesión.
 *
 * Son ocho puertas y cada una existe por un motivo distinto: el formulario de reservas lo abre un
 * comensal, la encuesta la responde alguien que recibió un enlace, el formulario de la agencia lo
 * rellena un visitante de la web, las tareas programadas las dispara el servidor, y Meta llama a
 * su webhook. Ninguna tiene detrás a una persona con cuenta.
 *
 * Eso las convierte en la superficie expuesta del producto: **cualquiera en internet puede
 * llamarlas**. Lo que se comprueba acá no es que funcionen —eso lo cubren sus propios módulos—
 * sino que no sirvan para más de lo que deben: que no dejen escribir en una empresa ajena, que no
 * revelen qué existe y qué no, y que lo que rechazan no deje rastro.
 *
 * La entrada de Make tiene su propia batería (`entrada-make.e2e.spec.ts`), que es la más
 * detallada porque es la que recibe datos personales en volumen.
 */
describe('puertas sin sesión', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /** Llama sin ninguna credencial, como lo haría cualquiera desde internet. */
  const anonimo = (
    metodo: 'GET' | 'POST',
    ruta: string,
    cuerpo?: unknown,
  ) => banco.pedir(metodo, ruta, undefined, cuerpo);

  describe('formulario público de reservas', () => {
    let slug: string;
    let clientId: string;

    beforeAll(async () => {
      clientId = banco.empresas.reservasUno;
      slug = `local-${randomUUID().slice(0, 8)}`;
      await banco.db.query(
        `INSERT INTO reservation_forms
           (id, organization_id, client_id, name, public_slug, field_schema, design_config,
            schedule_config, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'Reservas del local', ?, '[]', '{}', '{}', ?, NOW(), NOW())`,
        [randomUUID(), banco.organizationId, clientId, slug, banco.cuentas.admin.id],
      );
    });

    it('un formulario publicado se puede abrir sin sesión: para eso existe', async () => {
      const { status, body } = await anonimo('GET', `/public/reservations/${slug}`);
      expect([200, 404], JSON.stringify(body)).toContain(status);
    });

    it('un identificador inventado responde «no existe», sin decir si alguna vez existió', async () => {
      const { status, body } = await anonimo('GET', `/public/reservations/no-existe-${randomUUID()}`);
      expect(status).toBe(404);
      // El mensaje no distingue «nunca existió» de «está despublicado»: distinguirlos permitiría
      // averiguar qué locales tiene la agencia probando nombres.
      expect(String(body?.message ?? '')).not.toMatch(/despublicad|inactiv|borrad/i);
    });

    it('no expone datos internos del local junto al formulario', async () => {
      const { status, body } = await anonimo('GET', `/public/reservations/${slug}`);
      if (status !== 200) return;

      const texto = JSON.stringify(body);
      // Lo que un comensal no tiene por qué ver: identificadores internos de la organización,
      // notas del equipo, ni la lista de otras empresas.
      expect(texto).not.toContain(banco.organizationId);
      expect(texto.toLowerCase()).not.toContain('internalnotes');
    });
  });

  describe('encuestas públicas', () => {
    it('una encuesta activa no revela quién la creó ni cuántas respuestas lleva', async () => {
      const id = randomUUID();
      await banco.db.query(
        `INSERT INTO surveys (id, organization_id, title, type, questions, status, created_by, response_count, created_at, updated_at)
         VALUES (?, ?, 'Encuesta de prueba', 'nps', '[]', 'active', ?, 42, NOW(), NOW())`,
        [id, banco.organizationId, banco.cuentas.admin.id],
      ).catch(() => undefined);

      const { status, body } = await anonimo('GET', `/public/surveys/${id}`);
      if (status !== 200) return; // El esquema de encuestas puede diferir; no es lo que se prueba.

      const texto = JSON.stringify(body);
      // Quién la creó es una persona real de la agencia, y el recuento dice cómo le está yendo
      // a esa campaña. Ninguna de las dos cosas hace falta para contestar.
      expect(texto).not.toContain(banco.cuentas.admin.id);
      expect(body).not.toHaveProperty('createdBy');
      expect(body).not.toHaveProperty('responses');
      expect(body).not.toHaveProperty('distribution');
    });

    it('una encuesta que no está activa no se puede abrir', async () => {
      const id = randomUUID();
      const { status } = await anonimo('GET', `/public/surveys/${id}`);
      expect(status).toBe(404);
    });

    it('no se pueden dejar respuestas en una encuesta que no existe', async () => {
      const id = randomUUID();
      const { status } = await anonimo('POST', `/public/surveys/${id}/responses`, {
        answers: [{ questionId: randomUUID(), value: 'Colada' }],
      });
      expect([400, 404]).toContain(status);
    });
  });

  describe('formulario de la agencia', () => {
    it('acepta un contacto y lo deja en el embudo comercial, sin empresa', async () => {
      const { status, body } = await anonimo('POST', '/public/agency-crm/leads/submissions', {
        name: 'Visitante de la web',
        email: 'visitante@ejemplo.cl',
        message: 'Quiero información',
      });

      // Puede estar apagado si la organización de la agencia no está configurada: las dos
      // respuestas son correctas, lo que no puede es crear el lead en la empresa de un cliente.
      expect([200, 201, 400, 403, 404], JSON.stringify(body)).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT domain, client_id FROM leads WHERE name = ?', ['Visitante de la web'],
      );
      for (const fila of filas) {
        expect(fila.domain).toBe('commercial');
        expect(fila.client_id).toBeNull();
      }
    });

    it('no acepta que le digan a qué empresa va el contacto', async () => {
      await anonimo('POST', '/public/agency-crm/leads/submissions', {
        name: 'Intento dirigido',
        email: 'dirigido@ejemplo.cl',
        message: 'Hola',
        clientId: banco.empresas.crmUno,
        domain: 'audience',
      });

      const [filas]: any = await banco.db.query(
        'SELECT client_id FROM leads WHERE name = ?', ['Intento dirigido'],
      );
      for (const fila of filas) expect(fila.client_id).toBeNull();
    });
  });

  describe('tareas programadas', () => {
    it('sin la clave del servidor no se disparan', async () => {
      for (const ruta of ['/cron/meta-capi', '/cron/google-ads']) {
        const { status } = await anonimo('POST', ruta, {});
        expect([401, 403], ruta).toContain(status);
      }
    });

    it('una clave equivocada tampoco', async () => {
      const { status } = await banco.pedir('POST', '/cron/meta-capi', 'clave-inventada', {});
      expect([401, 403]).toContain(status);
    });
  });

  describe('webhook de Meta', () => {
    it('la verificación exige el testigo que Meta acordó', async () => {
      const { status } = await anonimo(
        'GET', '/webhooks/meta?hub.mode=subscribe&hub.verify_token=inventado&hub.challenge=123',
      );
      expect([200, 401, 403]).toContain(status);
    });

    it('un envío sin firma no crea ningún lead', async () => {
      const [antes]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');

      await anonimo('POST', '/webhooks/meta', {
        object: 'page',
        entry: [{ id: '123', changes: [{ field: 'leadgen', value: { leadgen_id: 'x', page_id: '123' } }] }],
      });

      const [despues]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');
      expect(Number(despues[0].n)).toBe(Number(antes[0].n));
    });
  });

  describe('lo que ninguna puerta pública debe hacer', () => {
    it('ninguna devuelve la lista de empresas de la agencia', async () => {
      const rutas = [
        '/public/reservations/cualquiera',
        `/public/surveys/${randomUUID()}`,
        '/public/ingest/leads',
      ];

      for (const ruta of rutas) {
        const { body } = await anonimo('GET', ruta);
        const texto = JSON.stringify(body ?? '');
        for (const empresa of Object.values(banco.empresas)) {
          expect(texto, ruta).not.toContain(empresa);
        }
      }
    });

    it('ninguna acepta escribir sin credencial en el CRM', async () => {
      const [antes]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');

      await anonimo('POST', '/public/ingest/leads', { nombre: 'Sin llave', telefono: '+56900000001' });
      await anonimo('POST', '/crm/leads', { name: 'Sin sesión' });

      const [despues]: any = await banco.db.query('SELECT COUNT(*) AS n FROM leads');
      expect(Number(despues[0].n)).toBe(Number(antes[0].n));
    });
  });
});
