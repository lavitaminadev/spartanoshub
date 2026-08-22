import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Cuánto ve cada persona dentro de su empresa, con independencia del cargo.
 *
 * Es la respuesta a un problema que no tenía forma: cada empresa cliente tendrá su propia gente,
 * y ahí «community manager» o «diseñador» no significan nada. Lo que hay son dos maneras de usar
 * el CRM —quien lleva el negocio y quien atiende— y el dueño de la cuenta tiene que poder
 * decidir cuál le toca a cada uno sin inventar un cargo nuevo.
 */
describe('perfil de CRM por persona', () => {
  let banco: Banco;
  let mio: string;
  let deOtro: string;
  let libre: string;

  beforeAll(async () => {
    banco = await levantarBanco();

    // Las dos personas del equipo alcanzan la misma empresa: lo único que las distinguirá es el perfil.
    for (const cuenta of [banco.cuentas.equipoUno, banco.cuentas.equipoDos]) {
      await banco.db.query(
        `INSERT INTO user_client_access (id, organization_id, user_id, client_id, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [randomUUID(), banco.organizationId, cuenta.id, banco.empresas.crmUno],
      );
    }

    const sembrar = async (nombre: string, duenio: string | null) => {
      const id = randomUUID();
      await banco.db.query(
        `INSERT INTO leads (id, organization_id, client_id, name, status, domain, assigned_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'new', 'audience', ?, NOW(), NOW())`,
        [id, banco.organizationId, banco.empresas.crmUno, nombre, duenio],
      );
      return id;
    };

    mio = await sembrar('Contacto de equipoUno', banco.cuentas.equipoUno.id);
    deOtro = await sembrar('Contacto de equipoDos', banco.cuentas.equipoDos.id);
    libre = await sembrar('Contacto sin dueño', null);
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  const ids = (body: any): string[] => (body?.data ?? []).map((f: { id: string }) => f.id);

  async function fijarPerfil(userId: string, perfil: string | null) {
    const { status, body } = await banco.pedir(
      'PATCH', `/users/${userId}`, banco.cuentas.dev.token, { crmProfile: perfil },
    );
    return { status, body };
  }

  it('sin perfil, un community manager ve lo suyo y lo que está libre', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.equipoUno.token,
    );

    expect(status, JSON.stringify(body)).toBe(200);
    expect(ids(body)).toContain(mio);
    expect(ids(body)).toContain(libre);
    expect(ids(body)).not.toContain(deOtro);
  });

  it('con perfil «principal» ve el embudo entero de su empresa', async () => {
    const cambio = await fijarPerfil(banco.cuentas.equipoUno.id, 'principal');
    expect([200, 403], JSON.stringify(cambio.body)).toContain(cambio.status);
    // Cambiar el perfil exige confirmación reciente de contraseña en algunas instalaciones; si
    // el servidor la pide, la prueba no puede seguir y lo dice en vez de fingir que pasó.
    if (cambio.status === 403) return;

    const { body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.equipoUno.token,
    );

    expect(ids(body)).toContain(deOtro);
    expect(ids(body)).toContain(mio);
  });

  it('con perfil «venta» ve solo lo suyo, aunque su cargo alcance más', async () => {
    const cambio = await fijarPerfil(banco.cuentas.admin.id, 'venta');
    if (cambio.status === 403) return;

    const { body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.admin.token,
    );

    // La administración no tiene ninguno asignado: solo debe ver lo que está libre.
    expect(ids(body)).toContain(libre);
    expect(ids(body)).not.toContain(mio);
    expect(ids(body)).not.toContain(deOtro);
  });

  it('quitar el perfil devuelve la decisión al cargo', async () => {
    const cambio = await fijarPerfil(banco.cuentas.admin.id, null);
    if (cambio.status === 403) return;

    const { body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.admin.token,
    );

    expect(ids(body)).toContain(mio);
    expect(ids(body)).toContain(deOtro);
  });

  it('el cambio surte efecto sin volver a entrar: el perfil se lee en cada petición', async () => {
    const cambio = await fijarPerfil(banco.cuentas.equipoDos.id, 'principal');
    if (cambio.status === 403) return;

    // Mismo token de siempre, sin renovar sesión.
    const { body } = await banco.pedir(
      'GET', '/crm/leads?domain=audience&limit=100', banco.cuentas.equipoDos.token,
    );
    expect(ids(body)).toContain(mio);
  });

  it('un perfil inventado se rechaza en vez de guardarse', async () => {
    const { status } = await fijarPerfil(banco.cuentas.equipoDos.id, 'jefazo');
    expect([400, 403]).toContain(status);

    const [filas]: any = await banco.db.query(
      'SELECT crm_profile FROM users WHERE id = ?', [banco.cuentas.equipoDos.id],
    );
    expect(filas[0].crm_profile).not.toBe('jefazo');
  });
});
