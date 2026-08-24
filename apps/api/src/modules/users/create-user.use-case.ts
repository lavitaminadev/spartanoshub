import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { Client } from '../clients/client.entity';
import { ClientCapabilities, normalizeClientCapabilities } from '../clients/client-capabilities';

/**
 * Datos requeridos para crear un usuario.
 */
interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  organizationId: string;
  role?: UserRole;
  phone?: string;
  clientId?: string;
  newClientName?: string;
  capabilities?: Partial<ClientCapabilities>;
  workMode?: 'presential' | 'hybrid' | 'remote';
  weeklyCapacityUd?: number;
  actorRole: UserRole;
}

/**
 * Crea un nuevo usuario con una contraseña hasheada.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Hashea la contraseña y persiste el usuario.
   *
   * @param data - Datos de creación del usuario.
   * @returns Entidad del usuario guardada.
   */
  async execute(data: CreateUserInput): Promise<User> {
    const normalizedRole = data.role || UserRole.DESIGNER;
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedName = data.name.trim();
    const normalizedPhone = data.phone?.replace(/[^\d+]/g, '');
    if ([UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR].includes(data.actorRole)
      && [UserRole.ADMIN, UserRole.DEV, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR].includes(normalizedRole)) {
      throw new ForbiddenException('Este cargo no puede crear cuentas de administración, desarrollo o dirección');
    }
    if (normalizedRole === UserRole.DEV) {
      if (data.actorRole !== UserRole.ADMIN) throw new ForbiddenException('Solo administración puede asignar el cargo de desarrollo');
      const existingDev = await this.repo.findOne({ where: { organizationId: data.organizationId, role: UserRole.DEV, isActive: true } });
      if (existingDev) throw new ConflictException('Ya existe una cuenta con el cargo de desarrollo');
    }
    const existing = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('Ya existe una cuenta con este email');
    const newClientName = data.newClientName?.trim().replace(/\s+/g, ' ');
    if (normalizedRole === UserRole.CLIENT && !data.clientId && (!newClientName || newClientName.length < 2)) {
      throw new BadRequestException('Las cuentas cliente requieren una empresa asignada');
    }
    const hashed = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 10));
    return this.dataSource.transaction(async (manager) => {
      let clientId = data.clientId
        ? await this.resolveClientId(data.organizationId, normalizedRole, data.clientId)
        : undefined;
      if (normalizedRole === UserRole.CLIENT && !clientId && newClientName) {
        const client = manager.create(Client, {
          organizationId: data.organizationId,
          name: newClientName,
          capabilities: normalizeClientCapabilities(data.capabilities),
        });
        const savedClient = await manager.save(Client, client);
        clientId = savedClient.id;
      }
      const user = manager.create(User, {
        email: normalizedEmail,
        password: hashed,
        name: normalizedName,
        organizationId: data.organizationId,
        role: normalizedRole,
        phone: normalizedPhone,
        clientId,
        workMode: data.workMode,
        weeklyCapacityUd: data.weeklyCapacityUd ?? 20,
        invitedAt: new Date(),
        mustChangePassword: true,
        mustCompleteProfile: true,
      });
      return manager.save(User, user);
    });
  }

  private async resolveClientId(organizationId: string, role: UserRole, clientId?: string): Promise<string | undefined> {
    if (role !== UserRole.CLIENT) return undefined;
    if (!clientId) throw new BadRequestException('Las cuentas cliente requieren una empresa asignada');
    const client = await this.clientsRepo.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('La empresa seleccionada no pertenece a esta organizacion');
    return client.id;
  }
}
