import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PerfilesController } from '../../../src/modules/users/perfiles/perfiles.controller';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/**
 * Dirección comercial mira la configuración de un local y no la decide.
 *
 * El responsable de los datos de los comensales es el restaurante; la agencia los trata por cuenta
 * suya y según sus instrucciones. Si la agencia pudiera cambiarle los perfiles —quién ve el
 * teléfono, quién ve las alergias— sin que el local lo pida, eso deja de ser cierto.
 *
 * No lo cubre `@RequiereArea`: `alcanzaArea` devuelve `true` a quien no tiene perfil en esa
 * empresa, y la gente de la agencia normalmente no lo tiene. Por eso la reja vive en el
 * controlador, y por eso se prueba acá y no a través del guard.
 */
const ORG = 'org-1';
const EMPRESA = 'local-1';

/** El controlador con sus colaboradores doblados: lo que se prueba es a quién deja pasar. */
function controlador(cargo: UserRole, administraSuEmpresa = false) {
  const perfiles = {
    crear: vi.fn(async () => ({ id: 'p-1' })),
    actualizar: vi.fn(async () => ({ id: 'p-1' })),
    borrar: vi.fn(async () => undefined),
    asignar: vi.fn(async () => undefined),
    listar: vi.fn(async () => []),
    quitarDelEquipo: vi.fn(async () => undefined),
    sugeridos: vi.fn(async () => ({ creados: 0 })),
  };
  const invitaciones = { crear: vi.fn(async () => ({ id: 'i-1' })), cancelar: vi.fn(async () => undefined), pendientes: vi.fn(async () => []) };
  const instancia = Object.assign(Object.create(PerfilesController.prototype), {
    perfiles,
    invitaciones,
    // Quien administra su empresa llega con ella fijada; la agencia nombra una y se comprueba.
    administracion: { alcance: vi.fn(async () => ({ soloEmpresa: administraSuEmpresa ? EMPRESA : undefined })) },
    accesos: { assertClient: vi.fn(async () => undefined) },
  });
  const req = { user: { id: 'u-1', role: cargo, organizationId: ORG }, organizationId: ORG, ip: '::1' };
  return { instancia, perfiles, invitaciones, req };
}

describe('soporte mira y no escribe', () => {
  it('dirección comercial no crea, no edita, no borra ni reparte perfiles de un local', async () => {
    const { instancia, perfiles, invitaciones, req } = controlador(UserRole.COMMERCIAL_DIRECTOR);
    const cuerpo = { nombre: 'Anfitrión', areas: {}, datosProtegidos: {} };

    await expect(instancia.crear(req, cuerpo, EMPRESA)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instancia.editar(req, 'p-1', cuerpo, EMPRESA)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instancia.borrar(req, 'p-1', '', EMPRESA)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instancia.asignar(req, 'u-2', { perfilId: 'p-1' }, EMPRESA)).rejects.toBeInstanceOf(ForbiddenException);

    // Y no llegó nada al servicio: la negativa es antes de tocar datos, no después.
    expect(perfiles.crear).not.toHaveBeenCalled();
    expect(perfiles.actualizar).not.toHaveBeenCalled();
    expect(perfiles.borrar).not.toHaveBeenCalled();
    expect(perfiles.asignar).not.toHaveBeenCalled();
    expect(invitaciones.crear).not.toHaveBeenCalled();
  });

  /*
   * Lo que la vista de soporte existe para responder: «qué ve esta persona hoy». Negarle también la
   * lectura dejaría la pantalla sin razón de ser, y a quien pide ayuda sin nadie que la mire.
   */
  it('pero sí los lista: para eso se abre la vista', async () => {
    const { instancia, perfiles, req } = controlador(UserRole.COMMERCIAL_DIRECTOR);
    await instancia.listar(req, EMPRESA);
    expect(perfiles.listar).toHaveBeenCalled();
  });

  it('quien administra el local sí los cambia', async () => {
    const { instancia, perfiles, req } = controlador(UserRole.CLIENT, true);
    await instancia.crear(req, { nombre: 'Anfitrión', areas: {}, datosProtegidos: {} }, undefined);
    expect(perfiles.crear).toHaveBeenCalled();
  });

  /*
   * Y los cargos cuyo trabajo es administrar, también. Sin esto, abrir un local nuevo o arreglarle
   * la configuración exigiría pedírselo al propio local, que es a quien se está ayudando.
   */
  for (const cargo of [UserRole.ADMIN, UserRole.DEV, UserRole.OPERATIONS_DIRECTOR]) {
    it(`${cargo} sí los cambia, porque administrar es su trabajo`, async () => {
      const { instancia, perfiles, req } = controlador(cargo);
      await instancia.crear(req, { nombre: 'Anfitrión', areas: {}, datosProtegidos: {} }, EMPRESA);
      expect(perfiles.crear).toHaveBeenCalled();
    });
  }
});
