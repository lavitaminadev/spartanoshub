import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';
import { SessionsService } from './sessions.service';

/**
 * Estrategia JWT de Passport para NestJS.
 *
 * Valida el token bearer, carga el usuario desde la base de datos y adjunta un
 * objeto de usuario saneado al request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  /**
   * Valida un payload de JWT decodificado y devuelve la forma del usuario autenticado.
   *
   * @param payload - Payload de JWT decodificado.
   * @returns Objeto de usuario saneado adjuntado a `req.user`.
   * @throws UnauthorizedException cuando el usuario no existe o está inactivo.
   */
  async validate(payload: { sub: string; email: string; organizationId: string; role: UserRole; clientId?: string; sid?: string; iat?: number }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    // Un cambio/reset de contraseña revoca el refresh token, pero los access tokens
    // ya emitidos siguen funcionando hasta que expiran. Se rechaza cualquier access
    // token emitido antes del último cambio de contraseña para que un token robado
    // muera en el momento en que se rota la contraseña, en vez de sobrevivir hasta
    // JWT_EXPIRES_IN más tarde.
    if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new UnauthorizedException('Session invalidated by a password change');
    }
    // Cerrar una sesión tiene que surtir efecto ahora, no cuando el access token venza solo.
    // Un token sin `sid` es anterior a las sesiones: se acepta hasta que expire, porque
    // rechazarlo echaría de golpe a todos los que estuvieran dentro al desplegar.
    if (payload.sid && !(await this.sessions.isLive(payload.sid))) {
      throw new UnauthorizedException('La sesión fue cerrada');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      name: user.name,
      sessionId: payload.sid,
      tenantId: user.organizationId,
    };
  }
}
