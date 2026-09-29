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
  return { uso: new ResetUserPasswordUseCase(users as never, email as never), users, email };
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
});
