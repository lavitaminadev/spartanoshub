import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Client } from '../clients/client.entity';
import { UserRole } from '../organizations/user-role.enum';
import * as bcrypt from 'bcryptjs';

interface UpdateUserInput {
  id: string;
  organizationId: string;
  actorId: string;
  actorRole: UserRole;
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  clientId?: string | null;
  isActive?: boolean;
  password?: string;
  workMode?: 'presential' | 'hybrid' | 'remote';
  weeklyCapacityUd?: number;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Client) private readonly clientsRepo: Repository<Client>,
  ) {}

  async execute(data: UpdateUserInput): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: data.id, organizationId: data.organizationId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (data.actorRole === UserRole.OPERATIONS_DIRECTOR) {
      if ([UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR].includes(user.role)) {
        throw new ForbiddenException('No puedes administrar esta cuenta');
      }
      if (data.role && [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR].includes(data.role)) {
        throw new ForbiddenException('No puedes asignar este nivel de acceso');
      }
    }
    if (data.actorId === user.id && (data.isActive === false || (data.role && data.role !== user.role))) {
      throw new BadRequestException('No puedes desactivar ni cambiar el rol de tu propia cuenta');
    }
    if (data.role === UserRole.DEV || user.role === UserRole.DEV) {
      if (data.actorRole !== UserRole.ADMIN) throw new ForbiddenException('Solo administración puede asignar o gestionar el cargo de desarrollo');
      if (data.role === UserRole.DEV && user.role !== UserRole.DEV) {
        const existingDev = await this.usersRepo.findOne({ where: { organizationId: data.organizationId, role: UserRole.DEV, isActive: true } });
        if (existingDev) throw new ConflictException('Ya existe una cuenta con el cargo de desarrollo');
      }
      if (data.isActive === false && user.role === UserRole.DEV) {
        throw new BadRequestException('La cuenta de desarrollo no puede desactivarse sin asignar antes otra a un cargo de desarrollo');
      }
    }

    if (typeof data.name === 'string') user.name = data.name.trim();
    if (typeof data.email === 'string') {
      const email = data.email.trim().toLowerCase();
      const duplicate = await this.usersRepo.findOne({ where: { email } });
      if (duplicate && duplicate.id !== user.id) throw new ConflictException('Ya existe una cuenta con este email');
      user.email = email;
    }
    if (typeof data.phone === 'string') user.phone = data.phone.replace(/[^\d+]/g, '') || undefined;
    /*
     * Desactivar tiene que echar a quien esté dentro, no solo impedir el próximo ingreso.
     *
     * `validateUser` filtra por `isActive`, así que la cuenta no puede volver a entrar. Pero el
     * token que ya tenía en el navegador seguía siendo válido: quien fue desactivado continuaba
     * trabajando con normalidad hasta que su sesión venciera sola, que es justo lo contrario de
     * lo que espera quien aprieta «desactivar» —y el caso en que más urge que surta efecto es
     * cuando alguien deja la agencia.
     *
     * `passwordChangedAt` es la marca contra la que `JwtStrategy` compara cada access token, así
     * que moverla los invalida todos de inmediato. Es el mismo mecanismo que ya usaba el cambio
     * de contraseña; lo que faltaba era aplicarlo también acá.
     */
    if (typeof data.isActive === 'boolean') {
      const desactivando = user.isActive && data.isActive === false;
      user.isActive = data.isActive;
      if (desactivando) {
        user.passwordChangedAt = new Date();
        user.refreshToken = null;
      }
    }
    if (data.role) user.role = data.role;
    if (data.password) {
      user.password = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 10));
      user.mustChangePassword = true;
      // Invalida los access tokens ya emitidos: `JwtStrategy` los compara contra esta marca.
      user.passwordChangedAt = new Date();
      user.refreshToken = null;
    }
    if (data.workMode !== undefined) user.workMode = data.workMode;
    if (data.weeklyCapacityUd !== undefined) user.weeklyCapacityUd = data.weeklyCapacityUd;

    if (data.clientId === null || data.clientId === '') {
      if (user.role === UserRole.CLIENT) throw new BadRequestException('Las cuentas cliente requieren una empresa asignada');
      user.clientId = undefined;
    } else if (data.clientId) {
      const client = await this.clientsRepo.findOne({ where: { id: data.clientId, organizationId: data.organizationId } });
      if (!client) throw new BadRequestException('La empresa seleccionada no pertenece a esta organizacion');
      user.clientId = client.id;
    }

    if (user.role !== UserRole.CLIENT) {
      user.clientId = undefined;
    } else if (!user.clientId) {
      throw new BadRequestException('Las cuentas cliente requieren una empresa asignada');
    }

    return this.usersRepo.save(user);
  }
}
