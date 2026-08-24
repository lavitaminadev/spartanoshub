import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { CreateUserUseCase } from '../../../src/modules/users/create-user.use-case';
import { UpdateUserUseCase } from '../../../src/modules/users/update-user.use-case';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

const usersRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const clientsRepo = { findOne: vi.fn() };

describe('User management security', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate normalized emails', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue({ id: 'existing' });

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.ADMIN, role: UserRole.DESIGNER,
      name: 'Nueva Persona', email: ' PERSONA@EMPRESA.CL ', password: 'secure123',
    })).rejects.toThrow(ConflictException);
    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'persona@empresa.cl' } });
  });

  it('requires a valid organization client for portal accounts', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue(null);

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.ADMIN, role: UserRole.CLIENT,
      name: 'Cliente Portal', email: 'cliente@empresa.cl', password: 'secure123',
    })).rejects.toThrow(BadRequestException);
  });

  it('prevents operations directors from escalating privileges', async () => {
    const useCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);

    await expect(useCase.execute({
      organizationId: 'org-1', actorRole: UserRole.OPERATIONS_DIRECTOR, role: UserRole.ADMIN,
      name: 'Admin Nuevo', email: 'admin@empresa.cl', password: 'secure123',
    })).rejects.toThrow(ForbiddenException);
  });

  it('prevents commercial directors from creating or modifying privileged accounts', async () => {
    const createUseCase = new CreateUserUseCase(usersRepo as never, clientsRepo as never);
    await expect(createUseCase.execute({
      organizationId: 'org-1', actorRole: UserRole.COMMERCIAL_DIRECTOR, role: UserRole.ADMIN,
      name: 'Admin Nuevo', email: 'admin2@empresa.cl', password: 'secure123',
    })).rejects.toThrow(ForbiddenException);

    const updateUseCase = new UpdateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue({ id: 'director-1', organizationId: 'org-1', role: UserRole.COMMERCIAL_DIRECTOR, isActive: true });
    await expect(updateUseCase.execute({
      id: 'director-1', organizationId: 'org-1', actorId: 'commercial-1',
      actorRole: UserRole.COMMERCIAL_DIRECTOR, isActive: false,
    })).rejects.toThrow(ForbiddenException);
  });

  it('prevents administrators from disabling their own account', async () => {
    const useCase = new UpdateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: 'org-1', role: UserRole.ADMIN, isActive: true });

    await expect(useCase.execute({
      id: 'user-1', organizationId: 'org-1', actorId: 'user-1', actorRole: UserRole.ADMIN, isActive: false,
    })).rejects.toThrow(BadRequestException);
  });

  it('does not report a successful activation that was not persisted', async () => {
    const useCase = new UpdateUserUseCase(usersRepo as never, clientsRepo as never);
    usersRepo.findOne
      .mockResolvedValueOnce({ id: 'user-2', organizationId: 'org-1', role: UserRole.DESIGNER, isActive: false })
      .mockResolvedValueOnce({ id: 'user-2', isActive: false });
    usersRepo.save.mockResolvedValue({ id: 'user-2', isActive: true });

    await expect(useCase.execute({
      id: 'user-2', organizationId: 'org-1', actorId: 'admin-1', actorRole: UserRole.ADMIN, isActive: true,
    })).rejects.toThrow(ServiceUnavailableException);
  });
});
