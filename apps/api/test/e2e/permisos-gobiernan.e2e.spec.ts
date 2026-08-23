import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Qué alcanza de verdad un cargo del equipo, hoy.
 *
 * Conviene saber cómo está montado, porque no es lo que parece al leer `REPARTO_NO_APLICADO`: la
 * matriz efectiva **concede el catálogo completo a todos los cargos internos**, y se recorta
 * desde la pantalla de permisos. Lo que de verdad restringe es la lista de cargos que cada
 * controlador declara con `@Roles`.
 *
 * Es decir: las listas de cargos no son una segunda reja redundante sobre la matriz. **Son la
 * reja.** Quitarlas para «dejar que gobierne la matriz» no abre la lectura: abre todo.
 *
 * Estas pruebas fijan ese comportamiento para que se vea de un vistazo, y para que cualquier
 * intento de simplificarlo —el mío incluido— falle aquí antes de llegar a producción.
 */
describe('la pantalla de permisos gobierna', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  describe('un community manager con su módulo concedido', () => {
    it('lee la cartera de clientes, acotada a las suyas', async () => {
      const { status, body } = await banco.pedir('GET', '/clients', banco.cuentas.equipoUno.token);

      expect(status, JSON.stringify(body)).toBe(200);
      // Sin cuentas asignadas ve la lista vacía, no un 403: la diferencia importa, porque una es
      // «no tienes nada» y la otra «no puedes mirar».
      expect(body?.data ?? []).toHaveLength(0);
    });

    it('no alcanza las plantillas de proceso: su controlador las cierra por cargo', async () => {
      const { status } = await banco.pedir('GET', '/process-templates', banco.cuentas.equipoUno.token);
      expect([401, 403]).toContain(status);
    });

    it('tampoco los pods, por el mismo motivo', async () => {
      const { status } = await banco.pedir('GET', '/pods', banco.cuentas.equipoUno.token);
      expect([401, 403]).toContain(status);
    });

    it('no crea un cliente: leer no es escribir', async () => {
      const { status } = await banco.pedir('POST', '/clients', banco.cuentas.equipoUno.token, {
        name: 'Empresa que no debe existir',
      });
      expect([401, 403]).toContain(status);

      const [filas]: any = await banco.db.query(
        'SELECT COUNT(*) AS n FROM clients WHERE name = ?', ['Empresa que no debe existir'],
      );
      expect(Number(filas[0].n)).toBe(0);
    });

    it('no borra un pod: eso exige administrar, no mirar', async () => {
      const { status } = await banco.pedir(
        'DELETE', '/pods/00000000-0000-4000-8000-000000000000', banco.cuentas.equipoUno.token,
      );
      expect([401, 403, 404]).toContain(status);
    });
  });

  describe('leer los propios permisos', () => {
    /*
     * Es la primera petición que hace la aplicación al arrancar: con ella arma el menú.
     *
     * Estaba colgada del módulo `users`, que el portal de un cliente no tiene, así que respondía
     * 403 **antes de que se viera una sola pantalla** y el arranque se quedaba dando vueltas.
     * Apareció al restablecer una contraseña y entrar como cliente.
     *
     * Exigir un módulo para leer los propios permisos es además circular: haría falta permiso
     * para saber qué permisos se tienen.
     */
    it('cualquiera con sesión puede leer los suyos, sea cual sea su cargo', async () => {
      for (const quien of ['dev', 'admin', 'equipoUno', 'portalCrmUno', 'portalReservasUno'] as const) {
        const { status, body } = await banco.pedir('GET', '/me/permissions', banco.cuentas[quien].token);
        expect(status, `${quien}: ${JSON.stringify(body)}`).toBe(200);
        expect(body?.permissions, quien).toBeTruthy();
      }
    });

    it('sin sesión no', async () => {
      const { status } = await banco.pedir('GET', '/me/permissions');
      expect(status).toBe(401);
    });

    it('devuelve los de quien pregunta, no los de otro', async () => {
      const portal = await banco.pedir('GET', '/me/permissions', banco.cuentas.portalCrmUno.token);
      const admin = await banco.pedir('GET', '/me/permissions', banco.cuentas.admin.token);

      // La administración alcanza módulos que el portal no: si fueran iguales, alguien estaría
      // recibiendo los permisos de otro.
      expect(JSON.stringify(portal.body)).not.toBe(JSON.stringify(admin.body));
    });
  });

  describe('lo que sigue cerrado', () => {
    it('el registro de auditoría no lo mira cualquiera', async () => {
      const { status } = await banco.pedir('GET', '/audit', banco.cuentas.equipoUno.token);
      expect([401, 403, 404]).toContain(status);
    });

    it('la configuración de la organización tampoco', async () => {
      const { status } = await banco.pedir('GET', '/settings', banco.cuentas.equipoUno.token);
      expect([401, 403, 404]).toContain(status);
    });

    it('y quien administra sí entra, o el filtro sobraría', async () => {
      const { status } = await banco.pedir('GET', '/settings', banco.cuentas.admin.token);
      expect([200, 404]).toContain(status);
    });
  });
});
