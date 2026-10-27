/**
 * Una empresa puede leer a quién captó por sus propias reservas.
 *
 * El consentimiento se guarda donde la empresa no siempre lo alcanza: cuando un comensal marca la
 * casilla de marketing al reservar, su dirección entra en la lista con el texto que aceptó y la
 * fecha. Eso es correcto —honrar un «sí» no depende de lo que la empresa haya contratado—, pero
 * dejaba a la empresa **responsable** de esos datos sin poder verlos si no tenía Marketing, y por
 * tanto sin poder atender una solicitud de derechos sobre ellos.
 *
 * Lo que estas pruebas defienden son las dos cosas que hacen que la salida no sea un agujero:
 *
 *   1. Devuelve **sólo lo captado por reserva**. No es una segunda puerta a la lista de marketing:
 *      lo importado y lo captado por otras vías no sale por aquí.
 *   2. Recorta el correo según el nivel de datos protegidos en **Reservas**, que es la reja de
 *      quien mira. El correo del comensal ya está en su reserva; esto no lo expone más.
 *
 * Hay un detalle que costó y conviene que quede fijado: el **nivel** sale de Reservas y el **mapa
 * de campos** de Marketing. La fila es un suscriptor, así que su correo está en `email` y no en
 * `guestEmail`; con el mapa de Reservas no habría nada que recortar y el correo saldría entero con
 * cualquier nivel. Las dos mitades tienen que venir de sitios distintos.
 */

import { describe, expect, it, vi } from 'vitest';
import { SuscriptoresController } from '../../../src/modules/marketing/suscriptores.controller';
import { ORIGEN_RESERVA } from '../../../src/modules/marketing/alta-desde-reserva';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';

const PORTAL = { organizationId: 'org-1', user: { id: 'u1', role: 'client', clientId: 'centro', organizationId: 'org-1' } } as never;

function montar(nivel: 'oculto' | 'bajo_registro' | 'directo') {
  const capturados = [
    { id: 's1', email: 'comensal@correo.cl', name: 'Carla', source: ORIGEN_RESERVA, clientId: 'centro', sourceDetail: 'Centro' },
  ];
  const suscriptores = { listar: vi.fn().mockResolvedValue({ data: capturados, total: 1, origenes: [ORIGEN_RESERVA] }) };
  const acceso = { empresaElegida: vi.fn().mockResolvedValue('centro'), allowedClientIds: vi.fn().mockResolvedValue(['centro']), assertClient: vi.fn() };
  const niveles = { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos(nivel)) };
  // Una empresa que tiene Reservas y **no** tiene Marketing: es el caso que esta ruta existe para
  // atender, así que el doble rechaza `marketing` y acepta `reservations`.
  const capacidades = {
    assert: vi.fn(async (_org: string, _empresa: string, cual: string) => {
      if (cual !== 'reservations') throw new Error(`no contratado: ${cual}`);
    }),
  };
  const controller = new SuscriptoresController(
    suscriptores as never, capacidades as never, acceso as never, niveles as never, {} as never,
  );
  return { controller, suscriptores, niveles, capacidades };
}

describe('a quién captó esta empresa por sus reservas', () => {
  it('pide sólo lo captado por reserva, no la lista entera', async () => {
    const { controller, suscriptores } = montar('directo');

    await controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined);

    expect(suscriptores.listar).toHaveBeenCalledWith('org-1', expect.objectContaining({ origen: ORIGEN_RESERVA }));
  });

  /*
   * La reja es la de Reservas y no la de Marketing: de eso depende que una empresa sin Marketing
   * contratado pueda ver lo que se guardó a su nombre.
   */
  it('recorta según el nivel en Reservas, no en Marketing', async () => {
    const { controller, niveles } = montar('directo');

    await controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined);

    expect(niveles.nivelesDe).toHaveBeenCalledWith('org-1', 'u1', 'reservations');
  });

  it('con nivel directo entrega el correo', async () => {
    const { controller } = montar('directo');

    const salida = await controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined);

    expect(JSON.stringify(salida.data)).toContain('comensal@correo.cl');
  });

  it.each(['oculto', 'bajo_registro'] as const)('con nivel %s el correo no sale', async (nivel) => {
    const { controller } = montar(nivel);

    const salida = await controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined);

    expect(JSON.stringify(salida.data)).not.toContain('comensal@correo.cl');
  });

  /*
   * El punto de toda la ruta: una empresa con Reservas y sin Marketing contratado llega a sus
   * datos. Si alguien le exigiera `marketing` aquí —como hacía el encierro compartido—, volvería
   * a quedarse sin ver lo que se guardó a su nombre.
   */
  it('una empresa sin Marketing contratado sí entra, afirmando Reservas', async () => {
    const { controller, capacidades } = montar('directo');

    await expect(controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined)).resolves.toBeTruthy();
    expect(capacidades.assert).toHaveBeenCalledWith('org-1', 'centro', 'reservations');
    expect(capacidades.assert).not.toHaveBeenCalledWith('org-1', 'centro', 'marketing');
  });

  it('el nombre sigue saliendo: lo que se recorta es el dato de contacto', async () => {
    const { controller } = montar('oculto');

    const salida = await controller.captadosPorReservas(PORTAL, undefined, 'centro', undefined);

    expect(JSON.stringify(salida.data)).toContain('Carla');
  });
});
