import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserPermissionOverride } from '../../core/authorization/user-permission-override.entity';
import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';

/** El permiso que convierte a alguien en administrador del equipo de su empresa. */
const MODULO = 'users';
const NIVEL = 'manage';

/**
 * Quién administra el equipo de una empresa.
 *
 * Es el mismo permiso por empresa de siempre, con un nombre que se entiende desde la pantalla
 * de cuentas. Se expone aparte para que dar de alta a alguien y decir qué será sea un solo
 * paso: cuando eran dos, en dos pantallas distintas, olvidar el segundo dejaba a la empresa
 * sin nadie que pudiera crear cuentas y sin nada que lo explicara.
 */
@Injectable()
export class AdministradoresDeEmpresaService {
  constructor(
    @InjectRepository(UserPermissionOverride) private readonly overrides: Repository<UserPermissionOverride>,
    private readonly permisos: PermissionResolverService,
  ) {}

  /** Ids de quienes administran el equipo de esa empresa. */
  async quienesAdministran(organizationId: string, clientId: string): Promise<string[]> {
    const filas = await this.overrides.find({
      where: { organizationId, module: MODULO, level: NIVEL, clientId },
      select: { userId: true },
    });
    return filas.map((fila) => fila.userId);
  }

  /**
   * Las empresas cuyo equipo administra esa persona.
   *
   * Es la pregunta inversa y hace falta al abrir su ficha: quien atiende tres locales puede
   * administrar uno y en los otros solo mirar, y sin esta lista la ficha tendría que elegir una
   * empresa cualquiera para preguntar por ella.
   */
  async empresasQueAdministra(organizationId: string, userId: string): Promise<string[]> {
    const filas = await this.overrides.find({
      where: { organizationId, userId, module: MODULO, level: NIVEL },
      select: { clientId: true },
    });
    return filas.map((fila) => fila.clientId).filter((id): id is string => Boolean(id));
  }

  /**
   * Concede o retira la administración del equipo de una empresa.
   *
   * @param puede - `true` concede, `false` retira. Retirar borra la excepción en vez de
   *   guardarla en «ninguno»: así, si mañana el cargo concediera el módulo, esta persona lo
   *   recibiría como cualquier otra en vez de quedar denegada para siempre sin que se note.
   */
  async definir(
    organizationId: string,
    userId: string,
    clientId: string,
    puede: boolean,
    grantedBy: string,
  ): Promise<void> {
    const existente = await this.overrides.findOne({ where: { organizationId, userId, module: MODULO, clientId } });
    if (!puede) {
      if (existente) await this.overrides.remove(existente);
      this.permisos.invalidateUser(userId);
      return;
    }
    await this.overrides.save({
      ...(existente ?? {}),
      organizationId,
      userId,
      module: MODULO,
      clientId,
      level: NIVEL,
      reason: 'Administra el equipo de su empresa',
      expiresAt: null,
      grantedBy,
    });
    this.permisos.invalidateUser(userId);
  }

  /** Si esa empresa se quedó sin nadie que administre su equipo. */
  async sinAdministrador(organizationId: string, clientId: string): Promise<boolean> {
    const total = await this.overrides.count({ where: { organizationId, module: MODULO, level: NIVEL, clientId } });
    return total === 0;
  }
}
