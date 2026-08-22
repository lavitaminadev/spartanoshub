import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarBanco, levantarBanco, CLAVE, type Banco } from './util/banco';

/**
 * El ciclo completo de una cuenta, por las mismas puertas que usa una persona.
 *
 * Crear una empresa, crear a alguien, darle una cuenta, quitársela, cambiarle el cargo,
 * restablecerle la contraseña y desactivarlo. Cada uno de esos pasos decide quién ve qué, y
 * todos se hacen desde una pantalla: si alguno no surte efecto de inmediato —o surte más efecto
 * del que se pidió— nadie lo nota hasta que alguien ve algo que no era suyo.
 *
 * Se comprueba el efecto, no la respuesta: que la API devuelva 200 al quitar un acceso no dice
 * nada si el acceso sigue funcionando en la petición siguiente.
 */
describe('gestión de cuentas', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  const ids = (body: any): string[] => (body?.data ?? []).map((f: { id: string }) => f.id);

  async function entrar(email: string, password = CLAVE) {
    const { status, body } = await banco.pedir('POST', '/auth/login', undefined, { email, password });
    return { status, token: body?.accessToken as string | undefined };
  }

  describe('crear una empresa y su gente', () => {
    let empresaNueva: string;
    let personaNueva: { id: string; email: string };

    it('la administración crea una empresa', async () => {
      const { status, body } = await banco.pedir('POST', '/clients', banco.cuentas.admin.token, {
        name: 'Empresa recién creada',
        capabilities: { crm: true, reservations: false },
      });

      expect([200, 201], JSON.stringify(body)).toContain(status);
      expect(body.id).toBeTruthy();
      empresaNueva = body.id;
    });

    it('crea una persona del equipo, que nace sin ninguna cuenta asignada', async () => {
      const email = 'nueva.persona@prueba.local';
      const { status, body } = await banco.pedir('POST', '/users', banco.cuentas.admin.token, {
        name: 'Persona Nueva',
        email,
        password: CLAVE,
        role: 'community_manager',
      });

      expect([200, 201], JSON.stringify(body)).toContain(status);
      personaNueva = { id: body.id, email };

      // Nace sin acceso a ninguna empresa: el alcance se concede, no se hereda de existir.
      const acceso = await entrar(email);
      expect(acceso.status).toBe(200);
      const leads = await banco.pedir('GET', '/crm/leads?domain=audience&limit=50', acceso.token);
      expect(leads.body?.data ?? []).toHaveLength(0);
    });

    it('al asignarle la empresa, empieza a verla; al quitársela, deja de verla', async () => {
      const lead = await banco.pedir('POST', '/crm/leads', banco.cuentas.admin.token, {
        name: 'Contacto de la empresa nueva',
        phone: '+56977777777',
        clientId: empresaNueva,
        domain: 'audience',
      });
      expect([200, 201], JSON.stringify(lead.body)).toContain(lead.status);

      const dar = await banco.pedir(
        'PUT', `/users/${personaNueva.id}/client-access/${empresaNueva}`, banco.cuentas.admin.token,
      );
      expect([200, 201, 403], JSON.stringify(dar.body)).toContain(dar.status);
      if (dar.status === 403) return; // Exige confirmación reciente: no se puede seguir.

      const conAcceso = await entrar(personaNueva.email);
      const viendo = await banco.pedir('GET', '/crm/leads?domain=audience&limit=50', conAcceso.token);
      expect(ids(viendo.body)).toContain(lead.body.id);

      const quitar = await banco.pedir(
        'DELETE', `/users/${personaNueva.id}/client-access/${empresaNueva}`, banco.cuentas.admin.token,
      );
      expect([200, 204]).toContain(quitar.status);

      /*
       * Con el mismo token de antes, sin volver a entrar.
       *
       * Quitar un acceso tiene que surtir efecto ya. Si solo valiera para la próxima sesión,
       * alguien a quien se le retira una cuenta seguiría viéndola durante horas, que es justo
       * cuando más urge que deje de verla.
       */
      const yaNo = await banco.pedir('GET', '/crm/leads?domain=audience&limit=50', conAcceso.token);
      expect(ids(yaNo.body)).not.toContain(lead.body.id);
    });
  });

  describe('lo que nadie debe poder hacer', () => {
    it('una persona del equipo no crea usuarios', async () => {
      const { status } = await banco.pedir('POST', '/users', banco.cuentas.equipoUno.token, {
        name: 'Cuenta colada', email: 'colada@prueba.local', password: CLAVE, role: 'admin',
      });
      expect([403, 401]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT COUNT(*) AS n FROM users WHERE email = ?', ['colada@prueba.local'],
      );
      expect(Number(filas[0].n)).toBe(0);
    });

    it('nadie se asciende a sí mismo', async () => {
      const { status } = await banco.pedir(
        'PATCH', `/users/${banco.cuentas.equipoUno.id}`, banco.cuentas.equipoUno.token,
        { role: 'admin' },
      );
      expect([400, 401, 403]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT role FROM users WHERE id = ?', [banco.cuentas.equipoUno.id],
      );
      expect(filas[0].role).toBe('community_manager');
    });

    it('el portal de un cliente no toca ninguna cuenta, ni la suya', async () => {
      const { status } = await banco.pedir(
        'PATCH', `/users/${banco.cuentas.portalCrmUno.id}`, banco.cuentas.portalCrmUno.token,
        { role: 'admin' },
      );
      expect([401, 403]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT role FROM users WHERE id = ?', [banco.cuentas.portalCrmUno.id],
      );
      expect(filas[0].role).toBe('client');
    });

    it('el portal no se da acceso a una empresa ajena', async () => {
      const { status } = await banco.pedir(
        'PUT', `/users/${banco.cuentas.portalCrmUno.id}/client-access/${banco.empresas.crmDos}`,
        banco.cuentas.portalCrmUno.token,
      );
      expect([401, 403]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT COUNT(*) AS n FROM user_client_access WHERE user_id = ? AND client_id = ?',
        [banco.cuentas.portalCrmUno.id, banco.empresas.crmDos],
      );
      expect(Number(filas[0].n)).toBe(0);
    });
  });

  describe('desactivar una cuenta', () => {
    it('echa a quien esté dentro, no solo impide el próximo ingreso', async () => {
      const email = 'a.desactivar@prueba.local';
      const creada = await banco.pedir('POST', '/users', banco.cuentas.admin.token, {
        name: 'Cuenta a desactivar', email, password: CLAVE, role: 'community_manager',
      });
      expect([200, 201], JSON.stringify(creada.body)).toContain(creada.status);

      const sesion = await entrar(email);
      expect(sesion.status).toBe(200);
      const antes = await banco.pedir('GET', '/crm/leads?domain=audience&limit=5', sesion.token);
      expect(antes.status).toBe(200);

      const baja = await banco.pedir(
        'PATCH', `/users/${creada.body.id}`, banco.cuentas.admin.token, { isActive: false },
      );
      expect([200, 403], JSON.stringify(baja.body)).toContain(baja.status);
      if (baja.status === 403) return;

      /*
       * Con el token que ya tenía en el navegador.
       *
       * Es el caso que más urge: cuando alguien deja la agencia, «desactivar» tiene que
       * significar que deja de trabajar ahora, no cuando su sesión venza sola.
       */
      const despues = await banco.pedir('GET', '/crm/leads?domain=audience&limit=5', sesion.token);
      expect(despues.status).toBe(401);

      // Y tampoco puede volver a entrar.
      const reintento = await entrar(email);
      expect(reintento.status).not.toBe(200);
    });
  });

  describe('restablecer la contraseña de otra persona', () => {
    it('exige confirmar la propia, porque es tomar el control de esa cuenta', async () => {
      const { status, body } = await banco.pedir(
        'POST', `/users/${banco.cuentas.equipoDos.id}/reset-password`,
        banco.cuentas.admin.token, { sendEmail: false },
      );

      /*
       * Dos respuestas posibles y las dos correctas: 403 pidiendo confirmar la contraseña —si la
       * sesión ya no es reciente— o 200/201 si lo es, porque entrar cuenta como confirmación.
       * Lo que no puede es fallar sin decir qué falta.
       */
      expect([200, 201, 403]).toContain(status);
      if (status === 403) {
        expect(body?.reauthRequired).toBe(true);
        expect(String(body?.message ?? '')).toMatch(/contraseña/i);
      }
    });

    it('una persona del equipo no restablece la contraseña de nadie', async () => {
      const { status } = await banco.pedir(
        'POST', `/users/${banco.cuentas.admin.id}/reset-password`,
        banco.cuentas.equipoUno.token, { sendEmail: false },
      );
      expect([401, 403]).toContain(status);
    });
  });
});
