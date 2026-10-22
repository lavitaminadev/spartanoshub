import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinatariosDeAvisosController } from '../../../src/core/notifications/destinatarios-de-avisos.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Quién puede tocar las casillas del equipo de un local.
 *
 * Son correos de trabajadores de esa empresa: quien los lee sabe quién trabaja ahí, y quien los
 * borra deja al turno sin avisos. Las tres rejas del sistema tienen que aplicar —cargo, alcance de
 * la cuenta y servicio contratado— y la tercera es la que faltaba: esta pantalla nombra la empresa
 * en `empresa` y no en `clientId`, así que el guardia central no la veía y para una cuenta de la
 * agencia la comprobación del servicio no corría.
 */
function controlador(opciones: { alcanzables?: string[]; contratado?: boolean } = {}) {
  const destinatarios = {
    listar: vi.fn(async () => []),
    guardar: vi.fn(async (fila: unknown) => fila),
    borrar: vi.fn(async () => undefined),
  };
  const acceso = {
    allowedClientIds: vi.fn(async () => opciones.alcanzables),
    // Responde 404 fuera de alcance, como el servicio real: decir «no la alcanzas» ya confirma
    // que la empresa existe y que la agencia la atiende.
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (opciones.alcanzables !== undefined && !opciones.alcanzables.includes(clientId)) {
        throw new NotFoundException('Client not found');
      }
    }),
  };
  const capacidades = {
    assert: vi.fn(async () => {
      if (opciones.contratado === false) throw new ForbiddenException('Sin el servicio contratado');
    }),
  };
  return {
    ctrl: new DestinatariosDeAvisosController(destinatarios as never, acceso as never, capacidades as never),
    destinatarios, acceso, capacidades,
  };
}

const agencia = { organizationId: 'org-1', user: { id: 'u-1', organizationId: 'org-1', role: UserRole.COMMERCIAL_DIRECTOR } } as never;
const empresa = (clientId?: string) => ({
  organizationId: 'org-1',
  user: { id: 'u-2', organizationId: 'org-1', role: UserRole.CLIENT, clientId },
}) as never;

describe('acceso a las casillas del equipo', () => {
  beforeEach(() => vi.clearAllMocks());

  /*
   * Una cuenta de portal puede atender más de un local, así que la empresa que declara se honra
   * si la alcanza, y un local que no alcanza da 404 en vez de devolverle el suyo.
   *
   * Esta prueba decía lo contrario: que la cuenta «queda en la suya, diga lo que diga la
   * dirección». Con un solo local por cuenta daba igual; con dos, quien atiende Centro y
   * Providencia abría las casillas de Providencia, veía las de Centro y guardaba en Centro, de
   * modo que los avisos del segundo turno llegaban al equipo del primero.
   *
   * Lo que el criterio anterior protegía —que la dirección no abra un local sin Reservas— lo
   * siguen haciendo las dos comprobaciones que van después: el alcance y el servicio contratado.
   * Es la misma resolución que ya usa el inicio del portal.
   */
  it('una cuenta de empresa que atiende dos locales reparte las del que declara', async () => {
    const { ctrl, destinatarios } = controlador({ alcanzables: ['c-propia', 'c-segunda'] });

    await ctrl.listar(empresa('c-propia'), 'c-segunda');

    expect(destinatarios.listar).toHaveBeenCalledWith('org-1', 'c-segunda');
  });

  it('un local que no alcanza da 404, y no se cambia por el suyo', async () => {
    const { ctrl, destinatarios } = controlador({ alcanzables: ['c-propia'] });

    await expect(ctrl.listar(empresa('c-propia'), 'c-ajena')).rejects.toBeInstanceOf(NotFoundException);
    expect(destinatarios.listar).not.toHaveBeenCalled();
  });

  it('sin declarar nada, la cuenta de empresa reparte las suyas', async () => {
    const { ctrl, destinatarios } = controlador({ alcanzables: ['c-propia'] });

    await ctrl.listar(empresa('c-propia'));

    expect(destinatarios.listar).toHaveBeenCalledWith('org-1', 'c-propia');
  });

  it('una cuenta de empresa sin empresa asociada no entra, en vez de caer en otra', async () => {
    const { ctrl } = controlador();

    await expect(ctrl.listar(empresa(undefined))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('la agencia no alcanza una empresa que no tiene asignada', async () => {
    const { ctrl } = controlador({ alcanzables: ['c-uno'] });

    await expect(ctrl.listar(agencia, 'c-dos')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin decir de qué empresa, no se adivina ninguna', async () => {
    const { ctrl } = controlador({ alcanzables: ['c-uno'] });

    await expect(ctrl.listar(agencia)).rejects.toBeInstanceOf(ForbiddenException);
  });

  /*
   * El hueco que esto cierra: los avisos del equipo son de Reservas, así que una empresa que no lo
   * tiene contratado no tiene equipo al que avisar. Escondiendo la pantalla no basta.
   */
  it('sin el servicio contratado no se mantiene el equipo de esa empresa', async () => {
    const { ctrl } = controlador({ alcanzables: undefined, contratado: false });

    await expect(ctrl.listar(agencia, 'c-uno')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el servicio se comprueba también al anotar y al quitar, no sólo al mirar', async () => {
    const { ctrl, capacidades } = controlador();

    await ctrl.guardar(agencia, { email: 'garzon@local.cl' } as never, 'c-uno');
    await ctrl.borrar(agencia, 'd-1', 'c-uno');

    expect(capacidades.assert).toHaveBeenCalledTimes(2);
    expect(capacidades.assert).toHaveBeenCalledWith('org-1', 'c-uno', 'reservations');
  });

  /*
   * El servicio se comprueba sobre el local en el que se acaba trabajando, no sobre el de la
   * sesión: declarar el segundo no sirve de nada si ese segundo no tiene Reservas contratado.
   */
  it('a una cuenta de empresa se le comprueba el servicio del local que declara', async () => {
    const { ctrl, capacidades } = controlador({ alcanzables: ['c-propia', 'c-segunda'] });

    await ctrl.listar(empresa('c-propia'), 'c-segunda');

    expect(capacidades.assert).toHaveBeenCalledWith('org-1', 'c-segunda', 'reservations');
  });
});
