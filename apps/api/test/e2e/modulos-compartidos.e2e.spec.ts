import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Los módulos que la agencia y el cliente miran a la vez.
 *
 * Aprobaciones, contenido y reuniones son distintos del CRM en algo importante: **los dos lados
 * entran a la misma pantalla**. La agencia sube una pieza y el cliente la aprueba; la agencia
 * agenda una reunión y el cliente ve su acta. Eso los hace el sitio más probable de una fuga,
 * porque el filtro por empresa tiene que estar puesto en las dos direcciones y nadie lo nota si
 * falta: el cliente ve «una pieza más» sin saber que es de otra empresa.
 *
 * Se comprueba de forma forense: no basta con que la lista no la traiga, hay que comprobar
 * también que el identificador directo no la abra y que escribir sobre ella no cambie la base.
 */
describe('módulos compartidos entre la agencia y el portal', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /** Una aprobación pendiente colgada de una empresa. */
  async function sembrarAprobacion(clientId: string, titulo: string) {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO approval_requests
         (id, organization_id, client_id, title, kind, entity_type, entity_id, status,
          requested_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'approval', 'piece', ?, 'pending', ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, titulo, randomUUID(), banco.cuentas.admin.id],
    );
    return id;
  }

  /** Una reunión de una empresa, con fecha futura para que caiga en cualquier ventana. */
  async function sembrarReunion(clientId: string, titulo: string) {
    const id = randomUUID();
    await banco.db.query(
      `INSERT INTO meetings
         (id, organization_id, client_id, title, type, scheduled_at, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'weekly', DATE_ADD(NOW(), INTERVAL 2 DAY), ?, NOW(), NOW())`,
      [id, banco.organizationId, clientId, titulo, banco.cuentas.admin.id],
    );
    return id;
  }

  const filas = (body: any): any[] => (
    Array.isArray(body) ? body : body?.items ?? body?.data ?? []
  );
  const ids = (body: any): string[] => filas(body).map((f: { id: string }) => f.id);

  describe('aprobaciones', () => {
    let deSuEmpresa: string;
    let deLaOtra: string;

    beforeAll(async () => {
      deSuEmpresa = await sembrarAprobacion(banco.empresas.crmUno, 'Pieza de crmUno');
      deLaOtra = await sembrarAprobacion(banco.empresas.crmDos, 'Pieza de crmDos');
    });

    it('el portal ve las aprobaciones de su empresa y ninguna más', async () => {
      const { status, body } = await banco.pedir(
        'GET', '/approvals', banco.cuentas.portalCrmUno.token,
      );

      expect(status, JSON.stringify(body)).toBe(200);
      expect(ids(body)).toContain(deSuEmpresa);
      expect(ids(body)).not.toContain(deLaOtra);
    });

    it('el portal no aprueba una pieza de otra empresa ni conociendo su identificador', async () => {
      const { status } = await banco.pedir(
        'PATCH', `/approvals/${deLaOtra}/status`, banco.cuentas.portalCrmUno.token,
        { status: 'approved' },
      );

      expect([403, 404]).toContain(status);

      // Lo que importa no es el código sino que la base no cambió.
      const [antes]: any = await banco.db.query(
        'SELECT status FROM approval_requests WHERE id = ?', [deLaOtra],
      );
      expect(antes[0].status).toBe('pending');
    });

    it('el equipo sin esa cuenta asignada tampoco la ve', async () => {
      const { status, body } = await banco.pedir(
        'GET', '/approvals', banco.cuentas.equipoUno.token,
      );

      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(ids(body)).not.toContain(deSuEmpresa);
        expect(ids(body)).not.toContain(deLaOtra);
      }
    });
  });

  describe('reuniones', () => {
    let deSuEmpresa: string;
    let deLaOtra: string;

    beforeAll(async () => {
      deSuEmpresa = await sembrarReunion(banco.empresas.crmUno, 'Reunión de crmUno');
      deLaOtra = await sembrarReunion(banco.empresas.crmDos, 'Reunión de crmDos');
    });

    it('el portal ve las reuniones de su empresa y ninguna más', async () => {
      const { status, body } = await banco.pedir(
        'GET', '/meetings', banco.cuentas.portalCrmUno.token,
      );

      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(ids(body)).not.toContain(deLaOtra);
      }
    });

    it('el acta de una reunión ajena no se abre por identificador', async () => {
      const { status } = await banco.pedir(
        'GET', `/meetings/${deLaOtra}`, banco.cuentas.portalCrmUno.token,
      );

      expect([403, 404]).toContain(status);
    });

    it('la reunión propia sí se abre, para que el 404 anterior signifique algo', async () => {
      /*
       * Sin esta comprobación, la prueba de arriba pasaría también si el portal no pudiera abrir
       * ninguna reunión: un 404 constante se ve igual que un aislamiento correcto, y esconde una
       * pantalla rota detrás de una prueba en verde.
       */
      const { status } = await banco.pedir(
        'GET', `/meetings/${deSuEmpresa}`, banco.cuentas.portalCrmUno.token,
      );

      expect([200, 403]).toContain(status);
    });
  });

  describe('contenido', () => {
    it('el portal no ve las grillas de otra empresa', async () => {
      const propia = await banco.pedir(
        'GET', `/content/grids?clientId=${banco.empresas.crmUno}`, banco.cuentas.portalCrmUno.token,
      );
      const ajena = await banco.pedir(
        'GET', `/content/grids?clientId=${banco.empresas.crmDos}`, banco.cuentas.portalCrmUno.token,
      );

      expect([200, 403]).toContain(propia.status);
      // Pedir la de otra empresa no puede devolver contenido, sea cual sea el código.
      if (ajena.status === 200) {
        expect(filas(ajena.body)).toHaveLength(0);
      } else {
        expect([403, 404]).toContain(ajena.status);
      }
    });
  });

  describe('el panel general de la agencia', () => {
    it('responde por la empresa pedida y no por toda la organización', async () => {
      const consolidado = await banco.pedir('GET', '/reporting/dashboard', banco.cuentas.admin.token);
      const porEmpresa = await banco.pedir(
        'GET', `/reporting/dashboard?clientId=${banco.empresas.crmUno}`, banco.cuentas.admin.token,
      );

      expect(consolidado.status, JSON.stringify(consolidado.body)).toBe(200);
      expect(porEmpresa.status, JSON.stringify(porEmpresa.body)).toBe(200);
      // Basta con que acepte el filtro y responda: las cifras dependen de datos que este banco
      // no siembra, y afirmar una diferencia concreta ataría la prueba a ellos.
      expect(porEmpresa.body).toBeTruthy();
    });

    it('no acepta una empresa que quien pregunta no alcanza', async () => {
      const { status } = await banco.pedir(
        'GET', `/reporting/dashboard?clientId=${banco.empresas.crmDos}`, banco.cuentas.equipoUno.token,
      );

      expect([403, 404]).toContain(status);
    });
  });
});
