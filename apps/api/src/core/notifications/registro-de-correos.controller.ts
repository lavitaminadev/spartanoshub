import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Roles } from '../authorization/roles.decorator';
import { ModuleScope } from '../authorization/module-scope.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { RegistroDeCorreo } from './registro-de-correo.entity';

/**
 * Qué correos salieron de la plataforma, a quién y si el servidor de correo los aceptó.
 *
 * Solo para el cargo de desarrollo: es una herramienta de diagnóstico, no una pantalla de la
 * operación, y los asuntos nombran a clientes y leads de todas las empresas.
 */
@ApiTags('Registro de correos')
@ApiBearerAuth()
@Controller('registro-de-correos')
@Roles(UserRole.DEV)
// Va bajo «Configuración técnica», el módulo donde vive el resto del diagnóstico, en vez de quedar
// exento: así la matriz de permisos lo gobierna como a cualquier otra pantalla. El cargo lo acota
// además a desarrollo.
@ModuleScope('settings')
export class RegistroDeCorreosController {
  constructor(@InjectRepository(RegistroDeCorreo) private readonly registro: Repository<RegistroDeCorreo>) {}

  @Get()
  @ApiOperation({ summary: 'Últimos correos enviados, con su resultado' })
  async listar(@Query('q') q?: string, @Query('resultado') resultado?: string) {
    const texto = q?.trim().slice(0, 120);
    const filtroResultado = ['enviado', 'rechazado', 'fallido', 'omitido'].includes(resultado ?? '') ? { resultado: resultado as RegistroDeCorreo['resultado'] } : {};
    const where = texto
      ? [{ destinatario: Like(`%${texto}%`), ...filtroResultado }, { asunto: Like(`%${texto}%`), ...filtroResultado }]
      : filtroResultado;
    return this.registro.find({ where, order: { createdAt: 'DESC' }, take: 300 });
  }
}
