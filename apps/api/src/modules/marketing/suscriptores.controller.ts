import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../core/auth/decorators/public.decorator';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { SuscriptoresService } from './suscriptores.service';

/** Lo que se necesita para importar una lista sin dejarla sin procedencia. */
class ImportarSuscriptoresDto {
  /** El CSV entero como texto. */
  contenido: string;
  /** De dónde salió: `google_forms`, `landing_verano`, `csv_evento_marzo`. */
  origen: string;
  /** El formulario, el archivo o la campaña concreta. */
  detalle?: string;
  /** El texto de la casilla que la persona aceptó, si lo hubo. */
  textoConsentimiento?: string;
  clientId?: string | null;
}

/**
 * La lista de correo comercial: quién está, de dónde salió y quién dijo que sí.
 *
 * Importar y ver la lista es de Dirección Comercial y Administración: es comunicación de la
 * empresa y la responsabilidad de que cada dirección tenga respaldo es de quien la usa.
 */
@ApiTags('marketing')
@Controller('marketing/suscriptores')
@ModuleScope('marketing')
export class SuscriptoresController {
  constructor(private readonly suscriptores: SuscriptoresService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
  @ApiOperation({ summary: 'Lista de suscriptores con su procedencia y estado' })
  listar(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.suscriptores.listar(
      req.organizationId || req.user.organizationId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('importar')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
  @ApiOperation({ summary: 'Importar una lista de correos declarando su origen' })
  importar(@Req() req: AuthenticatedRequest, @Body() dto: ImportarSuscriptoresDto) {
    return this.suscriptores.importarCsv(
      req.organizationId || req.user.organizationId,
      dto.contenido,
      dto.origen,
      dto.detalle,
      dto.textoConsentimiento,
      dto.clientId ?? null,
    );
  }

  /**
   * Baja desde el enlace del correo.
   *
   * **Pública y sin sesión a propósito.** Quien recibe un correo comercial no tiene por qué tener
   * cuenta en el sistema, y una baja que exige iniciar sesión no es una baja: es un obstáculo, y
   * los obstáculos a la baja son exactamente lo que la normativa persigue.
   *
   * Con límite de frecuencia porque el token va en un correo y acaba en sitios donde lo ven
   * terceros; sin límite, alguien podría probar tokens al azar.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('baja/:token')
  @ApiOperation({ summary: 'Darse de baja de la lista de correo' })
  async baja(@Param('token') token: string) {
    const { email } = await this.suscriptores.darDeBaja(token);
    return { ok: true, email, mensaje: 'Ya no recibirás más correos comerciales nuestros.' };
  }
}
