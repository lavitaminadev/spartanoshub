import { BadRequestException, Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Lead } from './lead.entity';
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
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
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
  @Roles(UserRole.DEV, UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
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
  @Roles(UserRole.DEV, UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Renombrar las etapas de una empresa' })
  async put(
    @Req() req: AuthenticatedRequest,
    @Body() cuerpo: { labels?: RotulosDeEtapa },
    @Query('clientId') clientId?: string,
  ) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return { labels: await this.rotulos.set(req.organizationId!, clientId ?? null, cuerpo?.labels ?? {}) };
  }

  /**
   * Etapas que esta empresa decidió no usar.
   *
   * Leer no exige cargo, igual que los rótulos: el tablero lo necesita para saber qué columnas
   * dibujar, y sin esto las pintaría todas.
   */
  @Get('hidden')
  @ApiOperation({ summary: 'Etapas ocultas de una empresa' })
  async ocultas(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return { hidden: await this.rotulos.ocultas(req.organizationId!, clientId ?? null) };
  }

  /**
   * Enciende y apaga etapas del embudo de una empresa.
   *
   * **Se niega a ocultar una etapa que tenga leads dentro**, y dice cuántos. La alternativa
   * —moverlos a otra etapa por su cuenta— cambiaría el estado de leads reales sin que nadie lo
   * pidiera; y ocultarla sin más los haría desaparecer del tablero sin borrarlos, que es peor:
   * no falla nada, simplemente dejan de verse. Eso ya pasó en este CRM con la etapa «Visitó».
   *
   * Volver a mostrar una etapa nunca se impide: no puede romper nada.
   */
  @Put('hidden')
  @Roles(UserRole.DEV, UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Elegir qué etapas usa una empresa' })
  async guardarOcultas(
    @Req() req: AuthenticatedRequest,
    @Body() cuerpo: { hidden?: string[] },
    @Query('clientId') clientId?: string,
  ) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    const pedidas = cuerpo?.hidden ?? [];
    const yaOcultas = await this.rotulos.ocultas(req.organizationId!, clientId ?? null);

    // Solo se comprueban las que se apagan ahora: una que ya estaba oculta no puede haber
    // recibido leads nuevos, y volver a comprobarla haría fallar el guardado de otra cosa.
    for (const estado of pedidas.filter((etapa) => !yaOcultas.includes(etapa))) {
      const dentro = await this.leads.count({
        where: {
          organizationId: req.organizationId!,
          status: estado,
          clientId: clientId ?? IsNull(),
        },
      });
      if (dentro > 0) {
        throw new BadRequestException(
          `No se puede ocultar esa etapa: hay ${dentro} ${dentro === 1 ? "lead" : "leads"} dentro. `
          + 'Muévelos primero y vuelve a intentarlo.',
        );
      }
    }

    return { hidden: await this.rotulos.ocultar(req.organizationId!, clientId ?? null, pedidas) };
  }
}
