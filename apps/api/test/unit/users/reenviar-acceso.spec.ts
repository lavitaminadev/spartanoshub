import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ResetUserPasswordUseCase } from '../../../src/modules/users/reset-user-password.use-case';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Reenviar el acceso: otra clave temporal por correo, solo mientras la persona no haya elegido
 * la suya, y sin devolver la clave a quien reenvía.
 */
function caso(persona: Record<string, unknown>, enviado = true) {
  const users = { findOne: vi.fn(async () => ({ id: 'u-1', name: 'Diego', email: 'diego@casa.cl', organizationId: 'org', ...persona })), save: vi.fn(async (u: unknown) => u) };
  const email = { sendTemporaryPassword: vi.fn(async () => enviado) };
  // Resetear la clave cierra las sesiones abiertas: el doble deja comprobar que se llamó.
  const sessions = { revokeAll: vi.fn(async () => 0) };
  return { uso: new ResetUserPasswordUseCase(users as never, email as never, sessions as never), users, email, sessions };
}

describe('reenviar acceso', () => {
  it('con la clave temporal pendiente genera otra, la envía y no la devuelve', async () => {
    const { uso, email, users } = caso({ role: UserRole.CLIENT, mustChangePassword: true });
    const resultado = await uso.reenviarAcceso({ id: 'u-1', organizationId: 'org', actorRole: UserRole.COMMERCIAL_DIRECTOR });
    expect(resultado).toEqual({ userId: 'u-1', emailSent: true });
    expect(resultado).not.toHaveProperty('temporaryPassword');
    expect(email.sendTemporaryPassword).toHaveBeenCalledOnce();
    expect(users.save).toHaveBeenCalledOnce();
  });

  it('dice la verdad si el correo no salió', async () => {
    const { uso } = caso({ role: UserRole.CLIENT, mustChangePassword: true }, false);
    await expect(uso.reenviarAcceso({ id: 'u-1', organizationId: 'org', actorRole: UserRole.DEV })).resolves.toEqual({ userId: 'u-1', emailSent: false });
  });

  it('a quien ya eligió su contraseña no se le cambia', async () => {
    const { uso, users } = caso({ role: UserRole.CLIENT, mustChangePassword: false });
    await expect(uso.reenviarAcceso({ id: 'u-1', organizationId: 'org', actorRole: UserRole.DEV })).rejects.toThrow(BadRequestException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('dirección comercial no reenvía el acceso de un dev o de administración', async () => {
    const { uso, users } = caso({ role: UserRole.ADMIN, mustChangePassword: true });
    await expect(uso.reenviarAcceso({ id: 'u-1', organizationId: 'org', actorRole: UserRole.COMMERCIAL_DIRECTOR })).rejects.toThrow(ForbiddenException);
    expect(users.save).not.toHaveBeenCalled();
  });

  /*
   * La pantalla dice «se cerrarán las sesiones activas». Esto es lo que lo sostiene.
   *
   * `passwordChangedAt` sólo invalida los access tokens ya emitidos; las filas de
   * `user_sessions` siguen vivas y `refreshToken()` emite uno nuevo para cualquiera de ellas sin
   * volver a mirar la contraseña. Sin revocarlas, resetear la clave de una cuenta tomada no la
   * recupera, y la frase de la pantalla es falsa.
   */
  it('resetear la clave cierra las sesiones abiertas', async () => {
    const { uso, sessions } = caso({ role: UserRole.CLIENT, mustChangePassword: true });
    await uso.execute({ id: 'u-1', organizationId: 'org', actorRole: UserRole.ADMIN });
    expect(sessions.revokeAll).toHaveBeenCalledWith('u-1', 'cerrada_por_administracion');
  });

  /*
   * Los cuatro cargos que pueden abrir o cambiar la matriz de accesos.
   *
   * Dirección comercial faltaba, y es quien ahora consulta la matriz: resetear su clave es
   * quedarse con su cuenta, y desde ahí con lo que esa cuenta alcanza.
   */
  it('dirección de operaciones no resetea a dirección comercial ni a desarrollo', async () => {
    for (const cargo of [UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR]) {
      const { uso, users } = caso({ role: cargo, mustChangePassword: true });
      await expect(uso.execute({ id: 'u-1', organizationId: 'org', actorRole: UserRole.OPERATIONS_DIRECTOR }))
        .rejects.toThrow(ForbiddenException);
      expect(users.save).not.toHaveBeenCalled();
    }
  });
});
