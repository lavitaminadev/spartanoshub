/**
 * @fileoverview `@RequiereAccion('crm.importar')` y el guardia global que lo aplica.
 *
 * Corre después del guardia de módulo: primero hay que entrar al módulo, después poder hacer la
 * acción. Un endpoint sin el decorador no se ve afectado.
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { definicionDeAccion } from './acciones';
import { AccionesService } from './acciones.service';

export const REQUIERE_ACCION_KEY = 'requiere-accion';

export const RequiereAccion = (clave: string) => SetMetadata(REQUIERE_ACCION_KEY, clave);

@Injectable()
export class AccionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly acciones: AccionesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const clave = this.reflector.getAllAndOverride<string>(REQUIERE_ACCION_KEY, [context.getHandler(), context.getClass()]);
    if (!clave) return true;
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId: string | undefined = request.organizationId ?? user?.organizationId;
    if (!user?.id || !organizationId) throw new ForbiddenException('No se pudo determinar el usuario');
    // La misma empresa que mira el guardia de módulo: una acción que cuelga de un nivel
    // entregado por empresa no puede resolverse sin decir en cuál.
    const pedida = request.params?.clientId ?? request.query?.clientId ?? request.body?.clientId
      ?? (user.role === 'client' ? user.clientId : undefined);
    const empresa = typeof pedida === 'string' && pedida ? pedida : undefined;
    if (await this.acciones.puede(organizationId, user.id, user.role as UserRole, clave, empresa)) return true;
    throw new ForbiddenException(`No tienes permiso para ${definicionDeAccion(clave)?.nombre.toLowerCase() ?? 'esta acción'}`);
  }
}
