import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { REQUIRES_RECENT_AUTH_KEY } from './requires-recent-auth.decorator';
import { REAUTH_WINDOW_MINUTES, SessionsService } from './sessions.service';

/**
 * Exige una confirmación de contraseña reciente en los endpoints marcados.
 *
 * Se registra como guardia global pero solo actúa donde hay marca: un endpoint sin
 * `@RequiresRecentAuth` pasa de largo sin consultar nada. Eso mantiene el costo en cero para la
 * inmensa mayoría de las peticiones y concentra la decisión en el propio endpoint, que es donde
 * se puede juzgar si la operación lo amerita.
 */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reason = this.reflector.getAllAndOverride<string>(REQUIRES_RECENT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!reason) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = request.user?.sessionId;

    // Sin sesión no se puede confirmar nada: es un token anterior a las sesiones. Se pide
    // entrar de nuevo en vez de dejar pasar, que es la decisión segura cuando la comprobación
    // no se puede hacer.
    if (!sessionId || !(await this.sessions.hasRecentAuth(sessionId))) {
      throw new ForbiddenException({
        message: `Confirma tu contraseña para ${reason}`,
        reauthRequired: true,
        windowMinutes: REAUTH_WINDOW_MINUTES,
      });
    }
    return true;
  }
}
