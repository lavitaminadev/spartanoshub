import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Roles } from '../../../core/authorization/roles.decorator';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { UserRole } from '../../organizations/user-role.enum';
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
 * Reservado a Desarrollo: crear un origen entrega una llave que permite escribir leads en la base
 * desde fuera, sin sesión. No es una preferencia de uso diario.
 */
@Controller('crm/ingest-sources')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.DEV)
@ModuleScope('integrations')
export class IngestSourcesController {
  constructor(
    @InjectRepository(LeadIngestSource) private readonly sources: Repository<LeadIngestSource>,
    private readonly ingest: LeadIngestService,
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
    const filas = await this.sources.find({
      where: { organizationId: req.organizationId! },
      order: { createdAt: 'DESC' },
    });

    return filas.map((fila) => ({
      id: fila.id,
      name: fila.name,
      source: fila.source,
      clientId: fila.clientId,
      isActive: fila.isActive,
      tokenHint: `…${fila.tokenHint}`,
      receivedCount: fila.receivedCount,
      lastReceivedAt: fila.lastReceivedAt,
      lastError: fila.lastError,
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

  /** Genera una llave nueva y descarta la anterior. La integración deja de recibir hasta actualizarla. */
  @Post(':id/rotate')
  @ApiOperation({ summary: 'Reemplazar la llave de un origen' })
  async rotate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const source = await this.find(id, req.organizationId!);
    const { token } = await this.ingest.issueToken(source);
    return {
      token,
      header: `Authorization: Bearer ${token}`,
      aviso: 'La llave anterior dejó de funcionar. Actualiza la integración antes de que lleguen más leads.',
    };
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
    const source = await this.find(id, req.organizationId!);
    source.isActive = dto.isActive;
    await this.sources.save(source);
    return { id: source.id, isActive: source.isActive };
  }

  /** Busca dentro de la organización de quien consulta: un identificador ajeno no debe alcanzar. */
  private async find(id: string, organizationId: string): Promise<LeadIngestSource> {
    const source = await this.sources.findOne({ where: { id, organizationId } });
    if (!source) throw new NotFoundException('Origen no encontrado');
    return source;
  }
}
