import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { CLAVE_VOCABULARIO, StageLabelsService, type RotulosDeEtapa } from './stage-labels.service';

/**
 * Cómo llama cada empresa a las etapas de su embudo.
 *
 * Leer no exige cargo: el tablero lo necesita para dibujarse, y sin rótulos se vería con el
 * vocabulario de otro negocio. Escribir sí, porque cambia lo que ve todo el equipo de esa
 * empresa a la vez.
 */
@Controller('crm/stage-labels')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class StageLabelsController {
  constructor(
    private readonly rotulos: StageLabelsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Rótulos de etapa de una empresa' })
  async get(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return { labels: await this.rotulos.get(req.organizationId!, clientId ?? null) };
  }

  /**
   * Vocabulario: cómo llama esta empresa a las cosas del CRM.
   *
   * Una inmobiliaria trabaja por proyectos, una agencia por clientes y un local por sucursales.
   * Es la misma columna con tres nombres, y obligar a las tres al mismo hace que la pantalla
   * parezca de otro negocio. Solo cambia el rótulo: nada de lo guardado se mueve.
   */
  @Get('vocabulary')
  @ApiOperation({ summary: 'Vocabulario del CRM de una empresa' })
  async vocabulario(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return { labels: await this.rotulos.get(req.organizationId!, clientId ?? null, CLAVE_VOCABULARIO) };
  }

  @Put('vocabulary')
  @Roles(UserRole.DEV, UserRole.ADMIN)
  @ApiOperation({ summary: 'Renombrar las cosas del CRM de una empresa' })
  async guardarVocabulario(
    @Req() req: AuthenticatedRequest,
    @Body() cuerpo: { labels?: RotulosDeEtapa },
    @Query('clientId') clientId?: string,
  ) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return {
      labels: await this.rotulos.set(
        req.organizationId!, clientId ?? null, cuerpo?.labels ?? {}, CLAVE_VOCABULARIO,
      ),
    };
  }

  @Put()
  @Roles(UserRole.DEV, UserRole.ADMIN)
  @ApiOperation({ summary: 'Renombrar las etapas de una empresa' })
  async put(
    @Req() req: AuthenticatedRequest,
    @Body() cuerpo: { labels?: RotulosDeEtapa },
    @Query('clientId') clientId?: string,
  ) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return { labels: await this.rotulos.set(req.organizationId!, clientId ?? null, cuerpo?.labels ?? {}) };
  }
}
