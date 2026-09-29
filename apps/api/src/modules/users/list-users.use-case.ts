import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserClientAccess } from '../../core/client-scope/user-client-access.entity';
import { UserRole } from '../organizations/user-role.enum';

interface ListUsersFilters {
  organizationId: string;
  role?: UserRole;
  clientId?: string;
  isActive?: boolean;
  q?: string;
  /**
   * Con empresa, sumar a quienes la atienden por asignación aunque su cuenta sea de otra.
   *
   * Sin esto el equipo de un local mostraba sólo las cuentas creadas en él: quien atiende dos
   * locales aparecía en uno y en el otro no, aunque entrara y trabajara en los dos.
   */
  incluirAsignados?: boolean;
}

/**
 * Lista usuarios filtrados por organización.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  /**
   * Devuelve los usuarios de la organización dada, ordenados por nombre.
   *
   * @param filters - Filtros de listado acotados.
   * @returns Lista de entidades de usuario.
   */
  async execute(filters: ListUsersFilters): Promise<User[]> {
    const where: FindOptionsWhere<User> = {
      organizationId: filters.organizationId,
    };

    if (filters.role) where.role = filters.role;
    if (filters.clientId) where.clientId = filters.clientId;
    if (typeof filters.isActive === 'boolean') where.isActive = filters.isActive;

    let users = await this.repo.find({
      where,
      order: { name: 'ASC' },
    });

    if (filters.clientId && filters.incluirAsignados) {
      const asignaciones = await this.repo.manager.getRepository(UserClientAccess).find({
        where: { organizationId: filters.organizationId, clientId: filters.clientId },
        select: { userId: true },
      });
      const yaEstan = new Set(users.map((user) => user.id));
      const faltan = asignaciones.map((fila) => fila.userId).filter((id) => !yaEstan.has(id));
      if (faltan.length) {
        const { clientId: _empresa, ...sinEmpresa } = where;
        const asignados = await this.repo.find({ where: { ...sinEmpresa, id: In(faltan) } });
        users = [...users, ...asignados].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));
      }
    }

    const normalizeSearch = (value: unknown) => String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const q = normalizeSearch(filters.q);
    if (!q) return users;

    return users.filter((user) =>
      [user.name, user.email, user.phone, user.role]
        .filter(Boolean)
        .some((value) => normalizeSearch(value).includes(q)),
    );
  }
}
