import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import type { AuthenticatedRequest } from '@shared/types/request';
import { LeadIngestSource } from './ingest-source.entity';
import { LeadIngestService } from './lead-ingest.service';

export class CreateIngestSourceDto {
  /** Nombre visible: «Portal inmobiliario», «Zapier — formulario del sitio». */
  @IsString() @MaxLength(120) name: string;

  /**
   * Valor que queda guardado como procedencia de cada lead.
   *
   * Se restringe a minúsculas y guion bajo porque termina en informes y comparaciones: con
   * «Portal», «portal» y «Portal Inmobiliario» conviviendo, el mismo origen aparece como tres.
   */
  @IsString() @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'Usa minúsculas y guion bajo, por ejemplo `portal_inmobiliario`' })
  source: string;

  /** Cliente al que se asignan sus leads. Sin él quedan sin cliente asignado. */
  @IsOptional() @IsString() clientId?: string;
}

export class ToggleIngestSourceDto {
  @IsBoolean() isActive: boolean;
}

/**
 * Administración de los orígenes de entrada de leads.
 *
 * Ya no está reservado a Desarrollo.
 *
 * Lo estaba porque crear un origen entrega una llave que escribe leads sin sesión, y eso no es
 * una preferencia de uso diario. Pero el efecto era que quien administra el CRM —quien da de
 * alta las campañas y a quien le preguntan por qué no entran leads— **no podía ver el estado de
 * sus propias conexiones**: ni el contador, ni el último lead, ni el último error. Tenía que
 * pedírselo a Desarrollo cada vez.
 *
 * El listado no expone ningún secreto: solo los últimos seis caracteres de la llave como pista.
 * Lo que sí hacía falta antes de abrirlo es acotarlo por empresa —devolvía todas las de la
 * organización—, porque si no, quien lleva una cuenta vería las conexiones de las demás.
 */
@Controller('crm/ingest-sources')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@RequiresPermission('crm', 'manage')
@ModuleScope('crm')
export class IngestSourcesController {
  constructor(
    @InjectRepository(LeadIngestSource) private readonly sources: Repository<LeadIngestSource>,
    private readonly ingest: LeadIngestService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  /**
   * Lista los orígenes con su diagnóstico.
   *
   * Nunca devuelve la llave, solo sus últimos caracteres: una pantalla que la muestre la deja en
   * capturas, en el historial del navegador y en la memoria de quien mire por encima del hombro.
   */
  @Get()
  @ApiOperation({ summary: 'Orígenes de entrada con su contador y último error' })
  async list(@Req() req: AuthenticatedRequest) {
    /*
     * Acotado a las empresas que esta persona alcanza.
     *
     * `undefined` significa que llega a toda la organización —dirección, administración— y
     * entonces se listan también los orígenes de la agencia, que no tienen empresa. Una lista
     * vacía de empresas permitidas no devuelve nada, que es lo correcto para quien no lleva
     * ninguna cuenta.
     */
    const permitidas = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    const todas = await this.sources.find({
      where: { organizationId: req.organizationId! },
      order: { createdAt: 'DESC' },
    });
    const filas = permitidas === undefined
      ? todas
      : todas.filter((fila) => fila.clientId && permitidas.includes(fila.clientId));

    return filas.map((fila) => ({
      id: fila.id,
      name: fila.name,
      source: fila.source,
      clientId: fila.clientId,
      campaignId: fila.campaignId,
      campaignName: fila.campaignName,
      isActive: fila.isActive,
      tokenHint: `…${fila.tokenHint}`,
      receivedCount: fila.receivedCount,
      lastReceivedAt: fila.lastReceivedAt,
      lastError: fila.lastError,
      // Para poder decir en pantalla que hay una llave anterior aun aceptando, y hasta cuando.
      anteriorCaducaEn: fila.previousTokenExpiresAt && fila.previousTokenExpiresAt.getTime() > Date.now()
        ? fila.previousTokenExpiresAt
        : null,
      lastErrorAt: fila.lastErrorAt,
      url: `${(process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/public/ingest/leads`,
    }));
  }

  /**
   * Crea un origen y devuelve su llave **una sola vez**.
   *
   * El aviso viaja en la respuesta y no solo en la pantalla porque quien consuma esta API desde
   * otro lado también necesita saber que no habrá una segunda oportunidad.
   */
  @Post()
  @ApiOperation({ summary: 'Crear un origen y emitir su llave' })
  async create(@Body() dto: CreateIngestSourceDto, @Req() req: AuthenticatedRequest) {
    const { source, token } = await this.ingest.issueToken(this.sources.create({
      organizationId: req.organizationId!,
      clientId: dto.clientId ?? null,
      name: dto.name.trim(),
      source: dto.source,
      isActive: true,
      createdBy: req.user.id,
    }));

    return {
      id: source.id,
      name: source.name,
      source: source.source,
      token,
      url: `${(process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/public/ingest/leads`,
      header: `Authorization: Bearer ${token}`,
      aviso: 'Copia la llave ahora: no se puede volver a ver. Si se pierde, se genera una nueva.',
    };
  }

  /**
   * Genera una llave nueva.
   *
   * La anterior **no muere en el acto**: sigue aceptando 48 horas para que la integración no
   * quede sin entregar mientras alguien pega la nueva. Si se rotó por una filtración, hay que
   * cortarla con `revoke-previous`.
   */
  @Post(':id/rotate')
  @ApiOperation({ summary: 'Reemplazar la llave de un origen' })
  async rotate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const source = await this.find(id, req.organizationId!, req);
    const { source: rotado, token } = await this.ingest.issueToken(source);
    return {
      token,
      header: `Authorization: Bearer ${token}`,
      /*
       * El aviso dice la verdad nueva: la anterior **sigue sirviendo** un tiempo.
       *
       * Decía que dejaba de funcionar de inmediato, y eso hacía que rotar diera miedo justo
       * cuando más urge. Ahora se entrega la fecha para que la pantalla pueda decir hasta cuándo
       * hay margen en vez de una frase genérica.
       */
      anteriorCaducaEn: rotado.previousTokenExpiresAt ?? null,
      aviso: rotado.previousTokenExpiresAt
        ? 'La llave anterior sigue aceptando leads durante 48 horas. Actualiza la integración dentro de ese plazo, o córtala ya si la rotaste porque se filtró.'
        : 'Copia la llave ahora: no se puede volver a ver.',
    };
  }

  /**
   * Corta la llave anterior sin esperar a que caduque.
   *
   * La gracia existe para no perder leads mientras se actualiza la integración. Cuando se rotó
   * **porque la llave se filtró**, esperar dos días es exactamente lo que no se quiere.
   */
  @Post(':id/revoke-previous')
  @ApiOperation({ summary: 'Cortar ya la llave anterior' })
  async revokePrevious(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const source = await this.find(id, req.organizationId!, req);
    await this.ingest.revokePreviousToken(source);
    return { id: source.id, anteriorCaducaEn: null };
  }

  /**
   * Enciende o apaga un origen.
   *
   * Apagar corta la entrada y conserva el historial: es lo que se hace cuando una llave se filtra,
   * y borrar el origen perdería el contador que dice cuántos leads entraron por ahí.
   */
  @Post(':id/active')
  @ApiOperation({ summary: 'Encender o apagar un origen' })
  async toggle(@Param('id') id: string, @Body() dto: ToggleIngestSourceDto, @Req() req: AuthenticatedRequest) {
    const source = await this.find(id, req.organizationId!, req);
    source.isActive = dto.isActive;
    await this.sources.save(source);
    return { id: source.id, isActive: source.isActive };
  }

  /**
   * Busca un origen y comprueba que quien lo pide alcance su empresa.
   *
   * Es la puerta de rotar y de apagar, no solo de leer: sin esta comprobación, abrir el
   * controlador a quien administra el CRM le habría permitido rotar la llave de una empresa que
   * no lleva con solo conocer su identificador —y rotar deja sin entregar a su integración.
   *
   * Se responde 404 y no 403: decir «existe pero no es tuyo» confirma que ese identificador
   * corresponde a algo real.
   */
  private async find(id: string, organizationId: string, req: AuthenticatedRequest): Promise<LeadIngestSource> {
    const source = await this.sources.findOne({ where: { id, organizationId } });
    if (!source) throw new NotFoundException('Origen no encontrado');

    const permitidas = await this.accountAccess.allowedClientIds(organizationId, req.user);
    if (permitidas !== undefined && (!source.clientId || !permitidas.includes(source.clientId))) {
      throw new NotFoundException('Origen no encontrado');
    }
    return source;
  }
}
