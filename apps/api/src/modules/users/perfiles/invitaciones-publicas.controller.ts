import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { AceptarInvitacionDto } from './perfiles.dto';
import { InvitacionesService } from './invitaciones.service';

/**
 * El enlace que llega por correo. Quien lo tiene es el dueño de esa dirección, y por eso puede
 * ver a qué empresa lo invitan y si necesita crear la cuenta. No abre sesión: tras aceptar entra
 * por el acceso de siempre.
 */
@Public()
@ApiTags('Invitaciones al equipo')
@Controller('public/invitaciones-equipo')
export class InvitacionesPublicasController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  vistaPrevia(@Param('token') token: string) {
    return this.invitaciones.vistaPrevia(token);
  }

  @Post(':token/aceptar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  aceptar(@Param('token') token: string, @Body() dto: AceptarInvitacionDto) {
    return this.invitaciones.aceptar(token, dto);
  }
}
