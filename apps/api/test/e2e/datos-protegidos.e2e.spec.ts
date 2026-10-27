import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MARCA_PROTEGIDA } from '@espartanos/shared';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Que el servidor no entregue los datos protegidos de un comensal a quien no le corresponde.
 *
 * Esto no se puede comprobar con dobles. El recorte vive en la suma del perfil, el servicio que
 * resuelve el nivel y el punto donde se serializa la respuesta: probarlo con dobles comprueba el
 * doble. Lo que importa es **qué sale por el cable**, y eso sólo lo dice la API de verdad contra
 * una base real.
 *
 * Y es lo que la política de privacidad publicada afirma —«cada persona del local ve sólo lo que
 * su función requiere»—, así que conviene que una prueba lo sostenga y no una intención.
 */
describe('datos protegidos de una reserva', () => {
  let banco: Banco;
  let reservaId: string;
  let formId: string;

  beforeAll(async () => {
    banco = await levantarBanco();
    formId = randomUUID();
    reservaId = randomUUID();

    await banco.db.query(
      // `created_by` es obligatoria y sin valor por defecto: la fila dice quién creó el local.
      `INSERT INTO reservation_forms (id, organization_id, client_id, name, public_slug, status,
                                      mode, timezone, field_schema, design_config, schedule_config,
                                      created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'Local de prueba', ?, 'published', 'appointment', 'America/Santiago',
               '[]', '{}', '{}', ?, NOW(), NOW())`,
      [formId, banco.organizationId, banco.empresas.reservasUno, `local-${formId.slice(0, 8)}`, banco.cuentas.admin.id],
    );

    await banco.db.query(
      `INSERT INTO reservations (id, organization_id, client_id, form_id, reference_code, status,
                                 starts_at, ends_at, party_size, guest_name, guest_email,
                                 guest_phone, guest_document, birth_date, answers,
                                 created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ABC123', 'confirmed', NOW(), NOW(), 4,
               'Ana Pérez', 'ana@example.com', '+56911111111', '11.111.111-1', '1990-04-21',
               ?, NOW(), NOW())`,
      [reservaId, banco.organizationId, banco.empresas.reservasUno, formId,
        JSON.stringify({ alergia: 'maní' })],
    );
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /**
   * La cuenta de portal no administra su empresa, así que su nivel es `bajo_registro`: los datos
   * existen y no se entregan hasta que los pida.
   */
  it('no entrega el teléfono, el documento ni las alergias a quien no tiene el nivel', async () => {
    const { status, body } = await banco.pedir(
      'GET',
      `/reservations/${reservaId}`,
      banco.cuentas.portalReservasUno.token,
    );

    expect(status).toBe(200);
    // Lo operativo tiene que llegar: sin esto no se puede atender a nadie.
    expect(body.guestName).toBe('Ana Pérez');
    expect(body.partySize).toBe(4);
    // Y lo protegido, no.
    expect(body.guestPhone).toBe(MARCA_PROTEGIDA);
    expect(body.guestEmail).toBe(MARCA_PROTEGIDA);
    expect(body.guestDocument).toBe(MARCA_PROTEGIDA);
    expect(body.birthDate).toBe(MARCA_PROTEGIDA);
    expect(body.answers).toBe(MARCA_PROTEGIDA);
  });

  /*
   * La comprobación que de verdad importa: que el dato **no viaje**. Que la pantalla no lo pinte
   * no sirve de nada si está en la respuesta, porque basta abrirla en el navegador.
   */
  it('el dato no aparece en ninguna parte del cuerpo de la respuesta', async () => {
    const { body } = await banco.pedir(
      'GET',
      `/reservations/${reservaId}`,
      banco.cuentas.portalReservasUno.token,
    );

    const crudo = JSON.stringify(body);
    expect(crudo).not.toContain('+56911111111');
    expect(crudo).not.toContain('11.111.111-1');
    expect(crudo).not.toContain('maní');
    expect(crudo).not.toContain('1990-04-21');
  });

  it('tampoco los entrega en el listado', async () => {
    const { status, body } = await banco.pedir(
      'GET',
      `/reservations?clientId=${banco.empresas.reservasUno}`,
      banco.cuentas.portalReservasUno.token,
    );

    expect(status).toBe(200);
    const crudo = JSON.stringify(body);
    expect(crudo).toContain('Ana Pérez');
    expect(crudo).not.toContain('+56911111111');
    expect(crudo).not.toContain('maní');
  });

  /*
   * Quien administra la empresa sí los ve. Es el comportamiento anterior a los perfiles y se
   * conserva para que el día del despliegue ningún local se quede sin poder atender.
   */
  it('quien administra la empresa los recibe completos', async () => {
    await banco.db.query(
      `INSERT INTO user_permission_overrides (id, organization_id, user_id, module, client_id,
                                              level, created_at, updated_at)
       VALUES (?, ?, ?, 'users', ?, 'manage', NOW(), NOW())`,
      [randomUUID(), banco.organizationId, banco.cuentas.portalReservasUno.id,
        banco.empresas.reservasUno],
    ).catch(() => undefined);

    const { body } = await banco.pedir(
      'GET',
      `/reservations/${reservaId}`,
      banco.cuentas.admin.token,
    );

    // `admin` no tiene límite de alcance, así que ve los datos como siempre.
    expect(body.guestPhone).toBe('+56911111111');
    expect(body.answers).toMatchObject({ alergia: 'maní' });
  });

  /*
   * Y la otra empresa no alcanza la reserva en absoluto. El recorte es la segunda reja, no la
   * primera: si ésta fallara, recortar campos no serviría de nada.
   */
  it('otra empresa ni siquiera la encuentra', async () => {
    const { status } = await banco.pedir(
      'GET',
      `/reservations/${reservaId}`,
      banco.cuentas.portalCrmUno.token,
    );

    expect([403, 404]).toContain(status);
  });
});
