import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Roles } from '../authorization/roles.decorator';
import { ModuleScope } from '../authorization/module-scope.decorator';
import { RequiresPermission } from '../authorization/requires-permission.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { User } from '../../modules/users/user.entity';
import { AuditService } from '../audit/audit.service';
import { OrganizationSettingsService } from '../parameters/organization-settings.service';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
import { ConsentVersion } from './consent-version.entity';
import { PublishConsentVersionDto } from './dto/publish-consent-version.dto';
import type { AuthenticatedRequest } from '../../shared/types/request';

/** Etiqueta con la que una versión numérica se guarda en `compliance.terms_version`. */
function versionTag(version: number): string {
  return `v${version}`;
}

/** Número de versión que representa una etiqueta, o `null` si no tiene esa forma. */
function versionNumber(tag?: string | null): number | null {
  const match = /^v(\d+)$/.exec(tag ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Administración del consentimiento informado.
 *
 * Publica el texto que el equipo debe aceptar y muestra quién lo aceptó. La exigencia en sí
 * la aplica `AuthService.termsPending` al entrar; acá solo se decide qué texto rige y se deja
 * constancia de las excepciones.
 *
 * Se declara sobre `settings` y no sobre `governance` porque publicar una versión es cambiar
 * `compliance.terms_version`, que es un ajuste de la organización: son la misma decisión vista
 * desde dos pantallas. `governance` además está en fase `development`, así que declararlo ahí
 * habría dejado el panel respondiendo 403 a quien sí administra la organización.
 */
@ApiTags('Consentimiento')
@Controller('consent')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ModuleScope('settings')
export class ConsentController {
  constructor(
    @InjectRepository(ConsentVersion) private readonly versions: Repository<ConsentVersion>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly settings: OrganizationSettingsService,
    private readonly parameters: ParameterResolver,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Versión vigente, o `null` si todavía no se ha publicado ninguna.
   *
   * Se devuelve `null` en vez de un 404 porque «aún no hay texto publicado» es un estado
   * normal de una organización recién creada, no un error que la pantalla deba tratar.
   */
  @Get('active')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Versión vigente del consentimiento' })
  async active(@Req() req: AuthenticatedRequest) {
    const version = await this.versions.findOne({
      where: { organizationId: req.organizationId, active: true },
      order: { version: 'DESC' },
    });
    return version ?? null;
  }

  @Get('versions')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Historial de versiones publicadas' })
  async list(@Req() req: AuthenticatedRequest) {
    const items = await this.versions.find({
      where: { organizationId: req.organizationId },
      order: { version: 'DESC' },
    });
    // `data`, como todas las listas del sistema.
    return { data: items };
  }

  /**
   * Publica un texto nuevo y lo pone en vigor.
   *
   * Retirar la versión anterior, guardar la nueva y mover `compliance.terms_version` van en
   * una transacción: si el parámetro no llegara a cambiar, quedaría publicado un texto que
   * nadie tendría que aceptar, que es justo lo contrario de lo que se pidió.
   */
  @Post('versions')
  @Roles(UserRole.ADMIN)
  @RequiresPermission('settings', 'manage')
  @ApiOperation({ summary: 'Publicar una versión nueva del consentimiento' })
  async publish(@Req() req: AuthenticatedRequest, @Body() dto: PublishConsentVersionDto) {
    const title = dto.title?.trim();
    const text = dto.text?.trim();
    if (!title || !text) throw new BadRequestException('El título y el texto del consentimiento son obligatorios');

    const saved = await this.dataSource.transaction(async (manager) => {
      const last = await manager.findOne(ConsentVersion, {
        where: { organizationId: req.organizationId },
        order: { version: 'DESC' },
      });
      const next = (last?.version ?? 0) + 1;

      await manager.update(ConsentVersion, { organizationId: req.organizationId, active: true }, { active: false });
      const created = await manager.save(manager.create(ConsentVersion, {
        organizationId: req.organizationId,
        version: next,
        title,
        text,
        publishedBy: req.user.id,
        active: true,
      }));

      await this.settings.update(req.organizationId, req.user.id, {
        'compliance.terms_version': versionTag(next),
      });
      return created;
    });

    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'ConsentVersion',
      entityId: saved.id,
      action: 'published',
      after: { version: saved.version, title: saved.title },
    });
    return saved;
  }

  /**
   * Estado de aceptación de cada persona frente a la versión vigente.
   *
   * `pending` incluye a quien nunca aceptó y a quien aceptó una versión anterior; `expired`
   * distingue el segundo caso, que es el que se resuelve solo cuando la persona vuelve a
   * entrar y acepta.
   */
  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Estado de aceptación por persona' })
  async byUser(@Req() req: AuthenticatedRequest) {
    const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
    const people = await this.users.find({
      where: { organizationId: req.organizationId },
      select: { id: true, name: true, termsVersion: true, termsAcceptedAt: true },
      order: { name: 'ASC' },
    });

    // `data`, como todas las listas del sistema.
    return {
      data: people.map((person) => ({
        userId: person.id,
        userName: person.name,
        acceptedVersion: versionNumber(person.termsVersion),
        acceptedAt: person.termsAcceptedAt ? person.termsAcceptedAt.toISOString() : undefined,
        status: !person.termsAcceptedAt
          ? 'pending'
          : current && person.termsVersion !== current
            ? 'expired'
            : 'accepted',
      })),
    };
  }

  @Get('pending-count')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Cuántas personas faltan por aceptar' })
  async pendingCount(@Req() req: AuthenticatedRequest) {
    const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
    const people = await this.users.find({
      where: { organizationId: req.organizationId },
      select: { id: true, termsVersion: true, termsAcceptedAt: true },
    });
    const pending = people.filter((person) => !person.termsAcceptedAt || (current && person.termsVersion !== current));
    return { pending: pending.length, total: people.length };
  }

  /**
   * Da por aceptada la versión vigente en nombre de una persona.
   *
   * Es una excepción, no un atajo: existe para desbloquear a quien no puede aceptar por sí
   * mismo. Queda en auditoría con quién la otorgó, porque una aceptación que la persona no
   * hizo tiene que poder distinguirse de las demás al revisarlas.
   */
  @Post('users/:id/grant')
  @Roles(UserRole.ADMIN)
  @RequiresPermission('settings', 'manage')
  @ApiOperation({ summary: 'Otorgar acceso sin aceptación' })
  async grant(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const person = await this.users.findOne({ where: { id, organizationId: req.organizationId } });
    if (!person) throw new NotFoundException('La persona no existe en esta organización');

    const current = String(await this.parameters.get('compliance.terms_version', null, null, req.organizationId) ?? '');
    const before = { termsVersion: person.termsVersion, termsAcceptedAt: person.termsAcceptedAt };
    await this.users.update(id, { termsVersion: current || person.termsVersion, termsAcceptedAt: new Date() });

    await this.audit.log({
      organizationId: req.organizationId,
      actorId: req.user.id,
      entityType: 'User',
      entityId: id,
      action: 'consent_granted_without_acceptance',
      before,
      after: { termsVersion: current },
      reason: 'Acceso otorgado por administración sin aceptación de la persona',
      ipAddress: req.ip,
    });
    return { granted: true, version: current };
  }
}
