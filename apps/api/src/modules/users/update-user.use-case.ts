import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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
  crmProfile?: string | null;
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

    if ([UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR].includes(data.actorRole)) {
      const protectedRoles = [UserRole.ADMIN, UserRole.DEV, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR];
      if (protectedRoles.includes(user.role)) {
        throw new ForbiddenException('No puedes administrar esta cuenta');
      }
      if (data.role && protectedRoles.includes(data.role)) {
        throw new ForbiddenException('No puedes asignar este nivel de acceso');
      }
    }
    if (data.actorId === user.id && (data.isActive === false || (data.role && data.role !== user.role))) {
      throw new BadRequestException('No puedes desactivar ni cambiar el rol de tu propia cuenta');
    }
    if (data.role === UserRole.DEV || user.role === UserRole.DEV) {
      if (![UserRole.ADMIN, UserRole.DEV].includes(data.actorRole)) throw new ForbiddenException('Solo administración o desarrollo puede asignar o gestionar el cargo de desarrollo');
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
     * Vacío devuelve la decisión al cargo, que es distinto de no mandar el campo —eso lo deja
     * como estaba— y es la única forma de deshacer sin recordar qué tenía antes.
     */
    if (data.crmProfile !== undefined) user.crmProfile = data.crmProfile || null;
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

    const saved = await this.usersRepo.save(user);

    // Un 200 solo es válido si el cambio crítico se puede leer de vuelta. Así
    // evitamos que una respuesta optimista deje en pantalla una cuenta "activa"
    // mientras la base conserva el estado anterior.
    if (typeof data.isActive === 'boolean') {
      const persisted = await this.usersRepo.findOne({
        where: { id: user.id, organizationId: data.organizationId },
        select: ['id', 'isActive'],
      });
      if (!persisted || persisted.isActive !== data.isActive) {
        throw new ServiceUnavailableException('No se pudo confirmar el cambio de acceso. Intenta nuevamente.');
      }
    }
    return saved;
  }
}
