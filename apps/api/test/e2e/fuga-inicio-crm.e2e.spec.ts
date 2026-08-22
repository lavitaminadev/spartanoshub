import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * El inicio y el panel del CRM, sin empresa elegida.
 *
 * Son los dos únicos endpoints del CRM que responden por «todo lo que alcanzo» en vez de por una
 * empresa concreta, y por eso son los que más fácil se saltan el alcance: no hay un identificador
 * que comprobar, así que un control escrito como «comprueba la empresa pedida» no comprueba nada
 * cuando no se pide ninguna.
 *
 * Importa desde que el portal del cliente puede entrar al CRM: si estas respuestas no se acotan,
 * una empresa ve cifras y nombres de las demás **sin adivinar nada**, solo omitiendo un parámetro.
 */
describe('el inicio y el panel no se saltan el alcance por cuenta', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();

    // Leads en dos empresas distintas, ninguna de ellas la del portal que va a preguntar.
    for (const [empresa, cuantos] of [[banco.empresas.crmDos, 4], [banco.empresas.crmUno, 1]] as const) {
      for (let i = 0; i < cuantos; i += 1) {
        await banco.db.query(
          `INSERT INTO leads (id, organization_id, client_id, name, status, domain, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'new', 'audience', NOW(), NOW())`,
          [randomUUID(), banco.organizationId, empresa, `Contacto de ${empresa === banco.empresas.crmDos ? 'crmDos' : 'crmUno'} ${i}`],
        );
      }
    }
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  it('el portal no recibe cifras de empresas ajenas al pedir el inicio sin empresa', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/home?domain=audience', banco.cuentas.portalCrmUno.token,
    );

    expect(status, JSON.stringify(body)).toBe(200);

    // Su empresa tiene un lead; la vecina, cuatro. Contar cinco sería estar contando los ajenos.
    expect(body.month.leads).toBeLessThanOrEqual(1);

    const nombres = (body.alerts ?? []).flatMap((a: any) => (a.items ?? []).map((l: any) => l.name));
    expect(nombres.filter((n: string) => n.includes('crmDos'))).toEqual([]);
  });

  it('el portal no recibe el panel de toda la organización', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/home/dashboard?days=365&domain=audience', banco.cuentas.portalCrmUno.token,
    );

    expect(status).toBe(200);
    expect(body.totals.leads).toBeLessThanOrEqual(1);
  });

  it('el equipo sin cuentas asignadas tampoco ve las cifras de la organización', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/home?domain=audience', banco.cuentas.equipoDos.token,
    );

    expect(status).toBe(200);
    expect(body.month.leads).toBe(0);
    const nombres = (body.alerts ?? []).flatMap((a: any) => (a.items ?? []).map((l: any) => l.name));
    expect(nombres).toEqual([]);
  });

  it('quien sí alcanza las cuentas las sigue viendo, o el filtro sobraría', async () => {
    const { status, body } = await banco.pedir(
      'GET', '/crm/home?domain=audience', banco.cuentas.admin.token,
    );

    expect(status).toBe(200);
    expect(body.month.leads).toBeGreaterThanOrEqual(5);
  });
});
