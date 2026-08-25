import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../../users/user.entity';

/** Lo único que la ficha dibuja de una persona en el desplegable de responsable. */
export interface ResponsableDelCrm {
  id: string;
  name: string;
}

/**
 * Quién puede hacerse cargo de un lead, según de quién es el CRM que se está mirando.
 *
 * La pregunta no es «quién trabaja en Espartanos» sino «quién va a atender a esta persona»,
 * y esas dos listas dejaron de coincidir cuando las empresas empezaron a operar su propio CRM.
 * Asignar un lead a alguien fuera de la empresa no falla al guardar —la columna admite
 * cualquier usuario de la organización— pero el lead desaparece de su vista: su alcance de
 * cuenta no llega ahí. Queda asignado a alguien que no lo verá nunca.
 */
@Injectable()
export class ResponsablesDelCrmService {
  constructor(
    @InjectRepository(User) private readonly usuarios: Repository<User>,
  ) {}

  /**
   * Personas asignables en el CRM de una empresa.
   *
   * @param organizationId - Organización a la que pertenecen.
   * @param clientId - Empresa cuyo CRM se mira. Vacío para el embudo propio de la agencia.
   * @returns Personas activas, por nombre. Solo las inactivas se omiten: quien ya no entra no
   *   puede atender, y ofrecerla deja leads asignados a nadie.
   */
  async execute(organizationId: string, clientId?: string): Promise<ResponsableDelCrm[]> {
    const usuarios = await this.usuarios.find({
      where: {
        organizationId,
        isActive: true,
        // `IsNull()` y no omitir el campo: el embudo de la agencia es de su equipo interno, y
        // dejar el filtro fuera devolvía además a los usuarios de todas las empresas.
        clientId: clientId ? clientId : IsNull(),
      },
      order: { name: 'ASC' },
      select: { id: true, name: true },
    });

    return usuarios.map((usuario) => ({ id: usuario.id, name: usuario.name }));
  }
}
