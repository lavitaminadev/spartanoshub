import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { CampanasService } from './campanas.service';
import { recortarListaProtegidos } from '@espartanos/shared';
import { NivelDeDatosService } from '../../core/client-scope/nivel-de-datos.service';

/**
 * Filtros de la lista de campañas.
 *
 * `cupon` es el que faltaba: la campaña guarda el código que reparte y su vencimiento desde la
 * migración 0164, y no había forma de preguntar «qué campañas llevaban este cupón» sin abrirlas
 * una por una.
 */
class ListarCampanasDto {
  @IsOptional() @IsIn(['draft', 'sending', 'sent']) estado?: 'draft' | 'sending' | 'sent';
  /** Coincide por fragmento, igual que en cupones: se recuerda la mitad del código. */
  @IsOptional() @IsString() @MaxLength(40) cupon?: string;
  /** `true` deja sólo las que reparten algún cupón; `false`, sólo las que no. */
  @IsOptional() @IsIn(['true', 'false']) conCupon?: 'true' | 'false';
  @IsOptional() @IsUUID() clientId?: string;
  /** Por fragmento: es como se busca una campaña de la que se recuerda media frase. */
  @IsOptional() @IsString() @MaxLength(200) asunto?: string;
  /** La lista de marketing y quienes administran son dos correos muy distintos. */
  @IsOptional() @IsIn(['lista', 'administradores']) destino?: 'lista' | 'administradores';
  /** Acotan por cuándo salió, así que dejan fuera los borradores. */
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

class CrearCampanaDto {
  @IsString() @MinLength(3) @MaxLength(200) asunto: string;
  @IsString() @MinLength(3) cuerpo: string;
  /** Vacío o `agencia` es la lista propia de Espartanos. */
  @IsOptional() @IsString() clientId?: string | null;
  /** Código de un cupón que ya exista en Cupones: de esta misma empresa, activo y sin vencer. */
  @IsOptional() @IsString() @MaxLength(40) cupon?: string | null;
  /** `lista` son los suscritos de la empresa; `administradores`, las cuentas que la administran. */
  @IsOptional() @IsIn(['lista', 'administradores']) destino?: 'lista' | 'administradores';
}

class EditarCampanaDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) asunto?: string;
  @IsOptional() @IsString() @MinLength(3) cuerpo?: string;
  @IsOptional() @IsString() @MaxLength(40) cupon?: string | null;
  @IsOptional() @IsIn(['lista', 'administradores']) destino?: 'lista' | 'administradores';
}

/**
 * Escribir a la lista. Sólo la agencia.
 *
 * Una cuenta de empresa mira su lista y se la descarga para escribir por su cuenta; enviar desde
 * aquí no. No es desconfianza: quien aprieta el botón responde de que cada dirección de esa lista
 * tenga respaldo, y ese respaldo lo lleva la agencia. Por eso el cargo cliente no aparece en
 * ningún `@Roles` de este controlador ni tiene nivel para el verbo que hace falta.
 */
@ApiTags('marketing')
@Controller('marketing/campanas')
@ModuleScope('marketing')
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
export class CampanasController {
  constructor(
    private readonly campanas: CampanasService,
    private readonly niveles: NivelDeDatosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Campañas escritas, enviadas y en borrador' })
  listar(@Req() req: AuthenticatedRequest, @Query() filtros: ListarCampanasDto) {
    return this.campanas.listar(req.organizationId || req.user.organizationId, undefined, filtros);
  }

  @Get('destinatarios')
  @ApiOperation({ summary: 'A cuántos llegaría la campaña si se enviara ahora' })
  async destinatarios(
    @Req() req: AuthenticatedRequest,
    @Query('empresa') empresa?: string,
    @Query('destino') destino?: string,
  ) {
    const organizationId = req.organizationId || req.user.organizationId;
    const resultado = await this.campanas.destinatarios(organizationId, empresa, destino === 'administradores' ? 'administradores' : 'lista');
    // La muestra enseña direcciones: sale recortada según el nivel de esta persona en la empresa elegida.
    const niveles = await this.niveles.nivelesDe(organizationId, req.user.id, 'marketing');
    const nivel = niveles.de(empresa && empresa !== 'agencia' ? empresa : null);
    return { ...resultado, muestra: recortarListaProtegidos(resultado.muestra, 'marketing', nivel).datos };
  }

  /**
   * Componer el correo para verlo, sin guardarlo ni enviarlo.
   *
   * Recibe el texto que se está escribiendo y no un id: sirve para mirar un borrador antes de
   * guardarlo, que es justo cuando hace falta.
   */
  @Post('vista-previa')
  @ApiOperation({ summary: 'Ver cómo queda la campaña, sin enviarla' })
  vistaPrevia(@Body() dto: EditarCampanaDto) {
    return this.campanas.vistaPrevia(dto.asunto ?? '', dto.cuerpo ?? '');
  }

  @Post()
  @ApiOperation({ summary: 'Escribir una campaña, en borrador' })
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearCampanaDto) {
    return this.campanas.crear({
      organizationId: req.organizationId || req.user.organizationId,
      clientId: dto.clientId,
      asunto: dto.asunto,
      cuerpo: dto.cuerpo,
      cupon: dto.cupon,
      destino: dto.destino,
      createdBy: req.user.id,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Corregir una campaña que todavía no se ha enviado' })
  editar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: EditarCampanaDto) {
    return this.campanas.editar(id, req.organizationId || req.user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Descartar un borrador' })
  async borrar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.campanas.borrar(id, req.organizationId || req.user.organizationId);
    return { borrada: true };
  }

  /**
   * El envío.
   *
   * Exige `manage` y no el `edit` que le tocaría al verbo: mandar un correo a una lista entera no
   * se deshace, y no es lo mismo que escribir el borrador. Quien puede redactar no manda por eso.
   */
  @Post(':id/enviar')
  @RequiresPermission('marketing', 'manage')
  @ApiOperation({ summary: 'Poner la campaña en cola para salir' })
  enviar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.enviar(id, req.organizationId || req.user.organizationId);
  }

  /** Cómo va una campaña que está saliendo. La pantalla lo pregunta mientras dura. */
  @Get(':id/avance')
  @ApiOperation({ summary: 'Avance del envío de una campaña' })
  avance(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.avance(id, req.organizationId || req.user.organizationId);
  }

  /**
   * A quiénes no les llegó el correo, y por qué.
   *
   * El avance da tres números; esto da los nombres. `last_error` se escribía en cada intento
   * fallido y no lo leía nadie, así que un dominio mal escrito y una casilla llena eran el
   * mismo silencio.
   */
  @Get(':id/fallidos')
  @ApiOperation({ summary: 'Destinatarios a los que no les llegó, con el motivo' })
  async fallidos(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const organizationId = req.organizationId || req.user.organizationId;
    const { clientId, ...resultado } = await this.campanas.fallidos(id, organizationId);
    const niveles = await this.niveles.nivelesDe(organizationId, req.user.id, 'marketing');
    return { ...resultado, fallidos: recortarListaProtegidos(resultado.fallidos, 'marketing', niveles.de(clientId)).datos };
  }

  /** Qué trajo la campaña: los canjes de su cupón desde que salió. */
  @Get(':id/retorno')
  @ApiOperation({ summary: 'Canjes del cupón de la campaña desde su envío' })
  retorno(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.retorno(id, req.organizationId || req.user.organizationId);
  }
}
