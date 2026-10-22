import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPermissionOverride } from '../../core/authorization/user-permission-override.entity';
import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';

/** El permiso que convierte a alguien en administrador del equipo de su empresa. */
const MODULO = 'users';
const NIVEL = 'manage';

/** Quién retira y por qué cuando lo hace la agencia: lo único que permite quitar a la última persona. */
export interface IntervencionDeAgencia {
  esAgencia: boolean;
  motivo?: string;
  ip?: string;
}

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
    private readonly auditoria: AuditService,
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
    intervencion?: IntervencionDeAgencia,
  ): Promise<void> {
    const existente = await this.overrides.findOne({ where: { organizationId, userId, module: MODULO, clientId } });
    if (!puede) {
      if (existente) {
        await this.asegurarQueQuedeAlguien(organizationId, userId, clientId, grantedBy, intervencion);
        await this.overrides.remove(existente);
      }
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

  /**
   * Impide dejar a una empresa sin quien administre su equipo.
   *
   * Es la única puerta: todo retiro de administración pasa por `definir`. Si esa persona es la
   * última se rechaza y se dice qué hacer (nombrar primero a otro). La agencia puede saltarse la
   * regla sólo con motivo escrito, y el acto queda en auditoría; una empresa cuyo único
   * administrador desapareció no puede quedar bloqueada para siempre.
   */
  private async asegurarQueQuedeAlguien(
    organizationId: string,
    userId: string,
    clientId: string,
    actorId: string,
    intervencion?: IntervencionDeAgencia,
  ): Promise<void> {
    const quedan = (await this.quienesAdministran(organizationId, clientId)).filter((id) => id !== userId);
    if (quedan.length > 0) return;
    const motivo = (intervencion?.motivo ?? '').trim().slice(0, 300);
    if (!intervencion?.esAgencia) {
      throw new ConflictException('Es la última persona que administra el equipo de esta empresa. Nombra primero a otra y después retira a esta.');
    }
    if (motivo.length < 3) {
      throw new BadRequestException('Es la última persona que administra el equipo de esta empresa. Escribe el motivo para retirarla: queda en auditoría.');
    }
    await this.auditoria.log({
      organizationId,
      actorId,
      entityType: 'AdministradorDeEmpresa',
      entityId: userId,
      action: 'retirar_ultimo_administrador',
      before: { clientId, administradores: [userId] },
      after: { clientId, administradores: [], motivo },
      ipAddress: intervencion.ip,
    });
  }

  /** Si esa empresa se quedó sin nadie que administre su equipo. */
  async sinAdministrador(organizationId: string, clientId: string): Promise<boolean> {
    const total = await this.overrides.count({ where: { organizationId, module: MODULO, level: NIVEL, clientId } });
    return total === 0;
  }
}
