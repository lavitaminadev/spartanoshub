import { Controller, Post, Get, Param, Body, UseGuards, Req, Query, BadRequestException , Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MetaPixelService } from './meta-pixel.service';
import { MetaConversionsService } from './meta-conversions.service';
import { MetaOAuthService } from './meta-oauth.service';
import { MetaAssetDiscoveryService } from './meta-asset-discovery.service';
import { MetaLeadAdsService } from './meta-lead-ads.service';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { toIntegrationResponse } from '../integration-response';
import { MetaAssetSelectionDto, MetaClientPixelDto, MetaClientPixelSetupDto, MetaPixelCredentialDto, MetaAgencyPixelDto, MetaLeadSyncDto, MetaOAuthCallbackDto, MetaPixelDto } from './dto/meta-integration.dto';
import { createOAuthState, verifyOAuthState } from '../../../shared/security/oauth-state';
import { MetaInsightsService } from './meta-insights.service';
import { resolveOAuthRedirect } from '../../../shared/security/oauth-redirect';
import { MetaClientPixelService } from './meta-client-pixel.service';
import { MetaConversionOutboxService } from './meta-conversion-outbox.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { RequiresRecentAuth } from '../../../core/auth/requires-recent-auth.decorator';

@Controller('integrations/meta')
@UseGuards(AuthGuard('jwt'))
@ModuleScope('integrations')
export class MetaPixelController {
  constructor(
    private pixel: MetaPixelService,
    private conversions: MetaConversionsService,
    private oauth: MetaOAuthService,
    private assetDiscovery: MetaAssetDiscoveryService,
    private metaLeadAds: MetaLeadAdsService,
    private insights: MetaInsightsService,
    private clientPixels: MetaClientPixelService,
    private conversionOutbox: MetaConversionOutboxService,
  ) {}

  @Get('client-pixels/catalog')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  clientPixelCatalog(@Req() req: AuthenticatedRequest) {
    return this.clientPixels.catalog(req.organizationId);
  }

  /**
   * Estado de la cola de conversiones. Hasta ahora solo era visible por el endpoint de
   * cron con secreto, asi que un evento atascado no se notaba desde la aplicacion.
   */
  @Get('conversions/outbox')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Estado de la cola de conversiones a Meta' })
  async conversionsOutbox(@Req() req: AuthenticatedRequest) {
    const [stats, problems] = await Promise.all([
      this.conversionOutbox.stats(req.organizationId),
      this.conversionOutbox.recentProblems(req.organizationId),
    ]);
    return {
      stats,
      problems: problems.map((item) => ({
        id: item.id,
        eventId: item.eventId,
        pixelId: item.pixelId,
        eventName: (item.eventData as { eventName?: string })?.eventName ?? null,
        status: item.status,
        attempts: item.attempts,
        lastError: item.lastError ?? null,
        nextAttemptAt: item.nextAttemptAt ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }


  /**
   * Devuelve a la cola los eventos que se dieron por perdidos.
   *
   * Sin identificadores reintenta todo lo fallido de la organización, que es lo que se quiere
   * después de arreglar una causa común. El `event_id` no cambia, así que Meta deduplica lo que
   * hubiera llegado pese al error.
   */
  @Post('conversions/outbox/reintentar')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Reintentar eventos de conversión fallidos' })
  async reintentarConversiones(
    @Req() req: AuthenticatedRequest,
    @Body() cuerpo: { ids?: string[] },
  ) {
    return this.conversionOutbox.reintentar(req.organizationId, cuerpo?.ids);
  }

  @Post('client-pixels/setup')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  setupClientPixel(@Body() dto: MetaClientPixelSetupDto, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.setup(req.organizationId, dto.clientId, dto.mode, dto);
  }

  /**
   * Registra un Pixel con su credencial, sin asignarlo a ninguna empresa.
   *
   * Va aparte de `client-pixels/setup` porque son dos decisiones distintas: ésta dice **con qué
   * permiso se escribe en un Pixel** y cambia cuando Meta caduca el token; aquélla dice **quién
   * lo usa** y cambia cuando cambia la operación. Juntas obligaban a reescribir la asignación
   * para tocar el token, y dejaban sin credencial al Pixel que una campaña usa por su cuenta.
   */
  @Post('pixels')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  guardarCredencialDePixel(@Body() dto: MetaPixelCredentialDto, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.guardarCredencial(req.organizationId, dto.pixelId, dto);
  }

  /** Cortar el envío a un Pixel sin tocar a qué empresa está asignado. */
  /**
   * Marca el Pixel con el que la agencia mide su propio embudo.
   *
   * Espartanos no es cliente de sí misma, asi que no tiene Pixel por empresa. Sin esta marca su
   * conversión propia se resolvía contra el Pixel del cliente recién creado, y publicaba en la
   * cuenta de ese cliente un evento valorado en lo que le paga a la agencia.
   */
  @Post('pixels/agencia')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  marcarPixelDeAgencia(@Body() dto: MetaAgencyPixelDto, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.marcarPixelDeAgencia(req.organizationId, dto.pixelId ?? null);
  }

  @Delete('pixels/:pixelId')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
  quitarCredencialDePixel(@Param('pixelId') pixelId: string, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.quitarCredencial(req.organizationId, pixelId);
  }

  @Get(':id/client-pixels')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  listClientPixels(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.list(id, req.organizationId);
  }

  @Post(':id/client-pixels')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  configureClientPixel(@Param('id') id: string, @Body() dto: MetaClientPixelDto, @Req() req: AuthenticatedRequest) {
    return this.clientPixels.configure(id, req.organizationId, dto.clientId, dto.pixelId, dto.accessToken, dto.pixelName);
  }

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Meta OAuth authorization URL' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  getAuthUrl(@Req() req: AuthenticatedRequest, @Query('redirect_uri') redirectUri?: string) {
    const uri = resolveOAuthRedirect('meta', redirectUri);
    const state = createOAuthState('meta', req.organizationId, uri);
    return { url: this.oauth.getAuthorizationUrl(uri, state) };
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Meta integration configuration status' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  getStatus() {
    return {
      configured: this.oauth.isConfigured(),
      appId: this.oauth.getAppId() || null,
    };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle Meta OAuth callback' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  handleCallback(
    @Body() dto: MetaOAuthCallbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const redirectUri = resolveOAuthRedirect('meta', dto.redirectUri);
    verifyOAuthState(dto.state, { provider: 'meta', organizationId: req.organizationId, redirectUri });
    return this.oauth.connectWithCode(req.organizationId, dto.code, redirectUri).then(toIntegrationResponse);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh Meta access token' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  refresh(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.oauth.refreshIntegration(id, req.organizationId).then(toIntegrationResponse);
  }

  // Desconectar corta el envío de conversiones y deja las credenciales sin efecto: la campaña
  // sigue gastando y deja de optimizar, y nadie se entera hasta el reporte.
  @RequiresRecentAuth('desconectar la integración con Meta')
  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Unsubscribe Meta pages and clear credentials' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  disconnect(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.oauth.disconnectIntegration(id, req.organizationId).then(toIntegrationResponse);
  }

  @Get(':id/assets')
  @ApiOperation({ summary: 'Discover available Meta assets and current selection' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  assets(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assetDiscovery.discoverAssets(id, req.organizationId);
  }

  @Post(':id/assets')
  @ApiOperation({ summary: 'Persist selected Meta assets' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  saveAssets(@Param('id') id: string, @Body() dto: MetaAssetSelectionDto, @Req() req: AuthenticatedRequest) {
    return this.assetDiscovery.saveSelectedAssets(id, req.organizationId, dto);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get Meta integration health' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  health(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.oauth.getIntegrationHealth(id, req.organizationId);
  }

  @Post(':id/insights/sync')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @ApiOperation({ summary: 'Sincronizar 30 dias de Meta Ads Insights' })
  syncInsights(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.insights.sync(id, req.organizationId!);
  }

  @Post('leads/sync')
  @ApiOperation({ summary: 'Manually sync a Meta lead by page and leadgen id' })
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  syncLead(@Body() dto: MetaLeadSyncDto, @Req() req: AuthenticatedRequest) {
    const pageId = dto.pageId?.trim();
    const leadgenId = dto.leadgenId?.trim();
    if (!pageId || !leadgenId) {
      throw new BadRequestException('pageId and leadgenId are required');
    }
    return this.metaLeadAds.syncSingleLead(pageId, leadgenId, req.organizationId);
  }

  @Post(':id/pixel/validate')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  async validate(
    @Param('id') id: string,
    @Body() dto: MetaPixelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const accessToken = await this.oauth.getSecureAccessToken(id, req.organizationId);
    const valid = await this.pixel.validatePixel(dto.pixelId, accessToken);
    if (valid) await this.oauth.savePixelId(id, req.organizationId, dto.pixelId);
    return { valid };
  }

  @Post(':id/conversions/test')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendConversionTest(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const pixelId = await this.oauth.getPixelId(id, req.organizationId);
    if (!pixelId) throw new BadRequestException('Validate a Meta pixel before sending a test event');
    if (!process.env.META_TEST_EVENT_CODE) throw new BadRequestException('META_TEST_EVENT_CODE is required for test events');
    const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN
      || await this.oauth.getSecureAccessToken(id, req.organizationId);
    return this.conversions.sendServerEvent(pixelId, accessToken, {
      eventName: 'Lead',
      eventTime: Math.floor(Date.now() / 1000),
      actionSource: 'system_generated',
      userData: { externalId: [`espartanos-test-${id}`] },
      eventId: `espartanos-test-${Date.now()}`,
    });
  }
}
