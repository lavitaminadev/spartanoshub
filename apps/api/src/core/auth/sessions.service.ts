import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UserSession } from './user-session.entity';

/** Motivos por los que se cierra una sesión. Se guardan para poder explicar el cierre después. */
export const REVOKE_REASONS = {
  USER: 'cerrada_por_el_usuario',
  PASSWORD_CHANGE: 'cambio_de_contrasena',
  ADMIN: 'cerrada_por_administracion',
  ROTATION_REUSE: 'refresh_token_reutilizado',
} as const;

export type RevokeReason = (typeof REVOKE_REASONS)[keyof typeof REVOKE_REASONS];

/** Ventana dentro de la cual una confirmación de contraseña sigue valiendo. */
export const REAUTH_WINDOW_MINUTES = 15;

/**
 * Ventana para completar el primer acceso.
 *
 * Es más larga que la de reautenticación y a propósito: activar una cuenta significa leer cinco
 * condiciones y elegir una contraseña, y quince minutos alcanzan para que alguien que se detiene
 * a leer —que es exactamente lo que se le pide— llegue a crear su contraseña y reciba un rechazo
 * por sesión expirada, quedándose fuera de su propia cuenta recién invitada.
 *
 * No se amplía `REAUTH_WINDOW_MINUTES` para lograrlo: ese valor protege operaciones sensibles
 * sobre una cuenta ya activa, donde una ventana corta es la protección y no un estorbo. Son dos
 * riesgos distintos y por eso son dos números distintos.
 */
export const ONBOARDING_AUTH_WINDOW_MINUTES = 60;

/** Vista de una sesión para su dueño. Nunca incluye la huella del token. */
export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  /** Si es la sesión desde la que se está mirando la lista. */
  current: boolean;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sesiones abiertas de cada persona.
 *
 * Concentra acá el ciclo de vida —abrir, renovar, cerrar, comprobar— porque son operaciones que
 * tienen que ir juntas: cuando la renovación y la revocación viven en sitios distintos, una
 * termina renovando lo que la otra cerró.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
  ) {}

  /**
   * Abre una sesión para un ingreso.
   *
   * @param context - Agente y dirección de origen, para que la persona reconozca la sesión en
   * la lista. Se recortan porque llegan del cliente y no hay motivo para guardar más.
   */
  async open(
    userId: string,
    organizationId: string,
    refreshToken: string,
    expiresAt: Date,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<UserSession> {
    const session = this.sessions.create({
      userId,
      organizationId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      userAgent: context.userAgent?.slice(0, 400) ?? null,
      ipAddress: context.ipAddress?.slice(0, 45) ?? null,
      // Un ingreso con contraseña es una autenticación reciente por definición.
      reauthenticatedAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt,
    });
    return this.sessions.save(session);
  }

  /**
   * Encuentra la sesión viva de un refresh token, o `null`.
   *
   * Comprueba las tres condiciones juntas —existe, no está revocada, no venció— porque
   * separarlas invita a que un llamador olvide una.
   */
  async findLive(refreshToken: string): Promise<UserSession | null> {
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: IsNull() },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  }

  /** Rota la huella del token de una sesión y corre su vencimiento. */
  async rotate(sessionId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.sessions.update(
      { id: sessionId },
      { refreshTokenHash: hashRefreshToken(refreshToken), expiresAt, lastSeenAt: new Date() },
    );
  }

  /**
   * Indica si una sesión sigue siendo válida para usar su access token.
   *
   * Se llama en cada petición autenticada. Trae solo tres columnas a propósito: es la consulta
   * más caliente del sistema y no necesita la fila entera.
   */
  async isLive(sessionId: string): Promise<boolean> {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      select: { id: true, revokedAt: true, expiresAt: true },
    });
    return Boolean(session && !session.revokedAt && session.expiresAt.getTime() > Date.now());
  }

  /** Sesiones abiertas de una persona, la más reciente primero. */
  async listOpen(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
    const sessions = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return sessions
      .filter((session) => session.expiresAt.getTime() > Date.now())
      .map((session) => ({
        id: session.id,
        userAgent: session.userAgent ?? null,
        ipAddress: session.ipAddress ?? null,
        lastSeenAt: session.lastSeenAt ?? null,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        current: session.id === currentSessionId,
      }));
  }

  /**
   * Cierra una sesión concreta de una persona.
   *
   * El identificador de usuario va en la condición y no se comprueba después: así no existe el
   * camino en que alguien cierra la sesión de otro pasando un identificador ajeno.
   *
   * @returns `true` si había una sesión abierta que cerrar.
   */
  async revoke(sessionId: string, userId: string, reason: RevokeReason): Promise<boolean> {
    const result = await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Cierra todas las sesiones de una persona, opcionalmente conservando una.
   *
   * Es lo que hace «cerrar sesión en todos los demás dispositivos» y lo que debe pasar cuando
   * se cambia la contraseña: si el motivo del cambio es que alguien más entró, dejarle la
   * sesión abierta vacía el gesto.
   *
   * @returns Cuántas sesiones se cerraron.
   */
  async revokeAll(userId: string, reason: RevokeReason, exceptSessionId?: string): Promise<number> {
    const query = this.sessions.createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('user_id = :userId AND revoked_at IS NULL', { userId });
    if (exceptSessionId) query.andWhere('id != :exceptSessionId', { exceptSessionId });
    const result = await query.execute();
    return result.affected ?? 0;
  }

  /** Marca que la persona acaba de confirmar su contraseña en esta sesión. */
  async markReauthenticated(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { reauthenticatedAt: new Date() });
  }

  /**
   * Indica si la sesión confirmó la contraseña dentro de la ventana.
   *
   * Una sesión que no existe responde `false`: ante la duda, se vuelve a pedir la contraseña.
   */
  async hasRecentAuth(sessionId: string, windowMinutes = REAUTH_WINDOW_MINUTES): Promise<boolean> {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      select: { id: true, reauthenticatedAt: true },
    });
    if (!session?.reauthenticatedAt) return false;
    return Date.now() - session.reauthenticatedAt.getTime() < windowMinutes * 60_000;
  }

  /** Registra actividad, para que la lista diga cuándo se usó cada sesión por última vez. */
  async touch(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { lastSeenAt: new Date() });
  }

  /**
   * Borra las sesiones vencidas hace tiempo.
   *
   * Las revocadas recientes se conservan: son el dato que se mira al investigar un acceso
   * indebido, y perderlas justo cuando alguien pregunta «¿desde dónde entraron?» sería el peor
   * momento posible.
   */
  async purgeExpired(olderThanDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const result = await this.sessions.delete({ expiresAt: LessThan(cutoff), revokedAt: Not(IsNull()) });
    const removed = result.affected ?? 0;
    if (removed > 0) this.logger.log(`Sesiones vencidas eliminadas: ${removed}`);
    return removed;
  }
}
