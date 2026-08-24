import { BadRequestException, Injectable, Logger, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  buildDefaultOrganizationModuleLifecycleMap,
  moduleLifecycleSettingKey,
  type AuthResponse,
  type ModuleLifecycleStatus,
  type OrganizationModuleLifecycleMap,
  type UserRole as SharedUserRole,
} from '@espartanos/shared';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { Client } from '../../modules/clients/client.entity';
import { ClientStatus } from '../../modules/clients/client-status.enum';
import { normalizeClientCapabilities } from '../../modules/clients/client-capabilities';
import { OrganizationFeatures, normalizeOrganizationFeatures } from '../../modules/organizations/organization-features';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { config } from '../../config';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../notifications/email.service';
import { DataConsent } from '../data-protection/consent.entity';
import { CompleteOnboardingDto, REQUIRED_CONSENTS, TERMS_VERSION } from './dto/onboarding.dto';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
import { REAUTH_WINDOW_MINUTES, REVOKE_REASONS, SessionsService, type SessionSummary, ONBOARDING_AUTH_WINDOW_MINUTES } from './sessions.service';

const REFRESH_TOKEN_EXPIRES_IN = config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'];

/** Intentos fallidos consecutivos antes de bloquear la cuenta. */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/**
 * Duración del bloqueo. Temporal para no convertir el ataque en una denegación de servicio.
 *
 * Cinco minutos y no quince. El límite existe para frenar a quien prueba contraseñas en serie, y
 * a esa escala la diferencia es irrelevante: cinco intentos cada cinco minutos son sesenta por
 * hora, un ritmo con el que nadie adivina una contraseña de ocho caracteres con mayúscula,
 * minúscula y número.
 *
 * A quien sí castigaba quince minutos era a la persona que se equivocó de contraseña cinco veces
 * seguidas, que es lo que pasa de verdad todos los días. Un cuarto de hora sin poder trabajar por
 * escribir mal su clave es una penalización que no protege de nada.
 */
const LOCKOUT_MINUTES = 5;

/**
 * Hash de descarte con el que se compara cuando el correo no existe.
 *
 * Sin esta comparación, un correo inexistente respondería mucho más rápido que uno real y
 * permitiría enumerar qué cuentas están registradas midiendo el tiempo de respuesta.
 */
const ABSENT_USER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Convierte el enum interno de TypeORM a la unión de string-literal compartida.
 *
 * Los valores en tiempo de ejecución son idénticos; este helper satisface al
 * compilador sin debilitar el tipado.
 */
function toSharedRole(role: UserRole): SharedUserRole {
  return role as unknown as SharedUserRole;
}

/**
 * Payload embebido en los JWT de access/refresh token.
 */
interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  clientId?: string;
  /**
   * Sesión que emitió este token.
   *
   * Es lo que permite que cerrar una sesión mate también los access tokens que ya se habían
   * emitido desde ella. Sin este dato, revocar no surtía efecto hasta que el token vencía solo.
   */
  sid?: string;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Milisegundos que dura un refresh token, para fijar el vencimiento de la sesión. */
function refreshLifetimeMs(): number {
  const match = /^(\d+)([smhd])$/.exec(String(config.jwt.refreshExpiresIn).trim());
  if (!match) return 7 * 86_400_000;
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * units[match[2] as keyof typeof units];
}

/** Datos del dispositivo desde el que se abre la sesión, para poder reconocerla en la lista. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Lógica de negocio de autenticación: validación de contraseña, emisión de
 * tokens, registro y búsqueda de perfil.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(PasswordResetToken) private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly parameters: ParameterResolver,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Valida un par email/contraseña y devuelve el usuario si es válido.
   *
   * @param email - Email del usuario.
   * @param password - Contraseña en texto plano.
   * @returns La entidad del usuario autenticado.
   * @throws UnauthorizedException cuando las credenciales son inválidas.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail, isActive: true },
      select: ['id', 'email', 'name', 'password', 'role', 'organizationId', 'avatarUrl', 'clientId', 'mustChangePassword', 'mustCompleteProfile', 'failedLoginAttempts', 'lockedUntil'],
    });
    // Se compara igual contra un hash ficticio cuando el correo no existe, para que el
    // tiempo de respuesta no revele qué cuentas están registradas.
    if (!user) {
      await bcrypt.compare(password, ABSENT_USER_HASH);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Cuenta bloqueada por intentos fallidos. Vuelve a intentar en ${minutes} minuto(s).`);
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Un acceso correcto cierra el episodio: se borra el contador y cualquier bloqueo.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    await this.assertClientPortalIsActive(user);
    return user;
  }

  /**
   * Una cuenta portal puede entrar durante el onboarding para terminar la
   * puesta en marcha de su empresa. Pausada o terminada no puede conservar
   * acceso; el formulario público, en cambio, exige `active` estrictamente.
   */
  private async assertClientPortalIsActive(user: Pick<User, 'role' | 'clientId' | 'organizationId'>): Promise<void> {
    if (user.role !== UserRole.CLIENT) return;
    if (!user.clientId) throw new UnauthorizedException('Credenciales inválidas');
    const client = await this.clientRepo.findOne({
      where: { id: user.clientId, organizationId: user.organizationId },
      select: ['id', 'status'],
    });
    if (!client || ![ClientStatus.ONBOARDING, ClientStatus.ACTIVE].includes(client.status)) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  /**
   * Suma un intento fallido y bloquea la cuenta al alcanzar el límite.
   *
   * El bloqueo es temporal a propósito: uno permanente convierte un ataque en una
   * denegación de servicio contra la persona legítima, que es justo lo que busca quien
   * ataca. La cuenta se libera sola pasada la ventana.
   */
  private async registerFailedAttempt(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const reached = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    await this.userRepo.update(user.id, {
      failedLoginAttempts: reached ? 0 : attempts,
      lockedUntil: reached ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil ?? null,
    });
    if (reached) {
      this.logger.warn(`Cuenta ${user.id} bloqueada ${LOCKOUT_MINUTES} min tras ${MAX_FAILED_LOGIN_ATTEMPTS} intentos fallidos`);
    }
  }

  /**
   * Emite tokens de access y refresh para un usuario autenticado.
   *
   * @param user - Entidad del usuario autenticado.
   * @returns Tokens más el resumen del usuario.
   */
  async login(user: User, context: SessionContext = {}): Promise<AuthResponse> {
    // La sesión se abre antes de firmar porque su identificador viaja dentro de los dos tokens.
    // El refresh token se firma dos veces: una para calcular la huella con la que se guarda, y
    // otra ya con el `sid`. Firmar es barato; el orden inverso obligaría a un update extra.
    const expiresAt = new Date(Date.now() + refreshLifetimeMs());
    const session = await this.sessions.open(user.id, user.organizationId, randomUUID(), expiresAt, context);

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      sid: session.id,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
    await this.sessions.rotate(session.id, refreshToken, expiresAt);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: toSharedRole(user.role),
        organizationId: user.organizationId,
        clientId: user.clientId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Renueva un access token a partir de un refresh token válido.
   *
   * @param token - Refresh token.
   * @returns Nuevo access token.
   * @throws UnauthorizedException cuando el refresh token es inválido o fue revocado.
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token);
      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        select: ['id', 'refreshToken', 'email', 'role', 'organizationId', 'clientId'],
      });
      if (!user) throw new UnauthorizedException();
      await this.assertClientPortalIsActive(user);

      const session = await this.sessions.findLive(token);
      if (!session || session.userId !== user.id) {
        // Sin sesión viva quedan dos posibilidades: la sesión se cerró, o el token es de antes
        // de que existieran las sesiones. La segunda se atiende una sola vez, comparando contra
        // la columna vieja de `users`, y se aprovecha para abrir la sesión que le faltaba.
        const legacyHash = hashRefreshToken(token);
        if (user.refreshToken !== legacyHash && user.refreshToken !== token) {
          throw new UnauthorizedException();
        }
        return this.issueForNewSession(user);
      }

      const newPayload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        clientId: user.clientId,
        sid: session.id,
      };
      const accessToken = this.jwtService.sign(newPayload);
      const refreshToken = this.jwtService.sign(newPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
      await this.sessions.rotate(session.id, refreshToken, new Date(Date.now() + refreshLifetimeMs()));
      return { accessToken, refreshToken };
    } catch {
      throw new UnauthorizedException('Token de actualización inválido');
    }
  }

  /**
   * Emite tokens abriendo una sesión nueva, para un refresh token anterior a las sesiones.
   *
   * Se limpia la columna vieja al hacerlo: el token de transición vale una sola vez, de modo
   * que un refresh token filtrado antes del cambio no sirve dos veces.
   */
  private async issueForNewSession(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const expiresAt = new Date(Date.now() + refreshLifetimeMs());
    const session = await this.sessions.open(user.id, user.organizationId, randomUUID(), expiresAt);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      sid: session.id,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
    await this.sessions.rotate(session.id, refreshToken, expiresAt);
    await this.userRepo.update(user.id, { refreshToken: null });
    return { accessToken, refreshToken };
  }

  /**
   * Registra un usuario dentro de la organización de la agencia.
   *
   * Espartanos opera una sola organización, así que el registro no la elige ni la crea: se
   * incorpora a `AGENCY_ORGANIZATION_ID`. Sin esa variable configurada el registro no
   * procede, porque la alternativa —inventar una organización— es precisamente el
   * comportamiento multi-empresa que el sistema no tiene.
   *
   * La cuenta nace con el cargo de menor alcance y con `mustCompleteProfile`, de modo que
   * quien administra decide después qué cargo le corresponde. Un registro que se otorgara a
   * sí mismo la administración sería una escalada de privilegios abierta a Internet.
   *
   * @param data - Datos de registro.
   * @returns Tokens recién creados y resumen del usuario.
   */
  async register(data: { email: string; password: string; name: string }): Promise<AuthResponse> {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new ForbiddenException('El registro publico esta desactivado; solicita tu cuenta a un administrador');
    }
    const organizationId = process.env.AGENCY_ORGANIZATION_ID;
    if (!organizationId) {
      throw new ForbiddenException('El registro no está disponible por ahora');
    }
    const organization = await this.orgRepo.findOne({ where: { id: organizationId, isActive: true }, select: ['id'] });
    if (!organization) {
      throw new ForbiddenException('El registro no está disponible por ahora');
    }

    const email = data.email.trim().toLowerCase();
    const name = data.name.trim().replace(/\s+/g, ' ');
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('El correo ya está registrado');

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hashed = await bcrypt.hash(data.password, rounds);
    const user = this.userRepo.create({
      email,
      password: hashed,
      name,
      organizationId,
      role: UserRole.DESIGNER,
      mustCompleteProfile: true,
    });
    const saved = await this.userRepo.save(user);
    const payload: TokenPayload = {
      sub: saved.id,
      email: saved.email,
      role: saved.role,
      organizationId: saved.organizationId,
      clientId: saved.clientId,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN, jwtid: randomUUID() });
    await this.userRepo.update(saved.id, { refreshToken: hashRefreshToken(refreshToken) });
    return {
      accessToken,
      refreshToken,
      user: {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        role: toSharedRole(saved.role),
        organizationId: saved.organizationId,
        clientId: saved.clientId,
        mustChangePassword: saved.mustChangePassword,
      },
    };
  }

  /**
   * Cierra la sesión desde la que se pide, no todas.
   *
   * Cerrar sesión en el teléfono no tiene por qué cerrarla en el computador. Para cerrarlas
   * todas está `DELETE /auth/sessions`, que es una acción distinta y se pide aparte.
   *
   * @param sessionId - Sesión del token con que se llama; si falta, se cierran todas, que es el
   * comportamiento seguro para un token anterior a las sesiones.
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.sessions.revoke(sessionId, userId, REVOKE_REASONS.USER);
    } else {
      await this.sessions.revokeAll(userId, REVOKE_REASONS.USER);
    }
    await this.userRepo.update(userId, { refreshToken: null });
  }

  /** Sesiones abiertas de una persona, marcando cuál es la que pregunta. */
  async listSessions(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
    return this.sessions.listOpen(userId, currentSessionId);
  }

  /**
   * Cierra una sesión propia.
   *
   * El identificador de usuario forma parte de la condición de la actualización, así que una
   * sesión ajena simplemente no coincide. Se responde igual cuando no coincide nada: distinguir
   * «no era tuya» de «ya estaba cerrada» permitiría averiguar qué identificadores existen.
   */
  async closeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, userId, REVOKE_REASONS.USER);
  }

  /** Cierra todas las sesiones menos la actual. Devuelve cuántas cerró. */
  async closeOtherSessions(userId: string, currentSessionId?: string): Promise<number> {
    return this.sessions.revokeAll(userId, REVOKE_REASONS.USER, currentSessionId);
  }

  /**
   * Confirma la contraseña de la sesión en curso.
   *
   * Sin sesión —token anterior a las sesiones— no hay dónde anotar la confirmación, así que se
   * rechaza en vez de aceptar en el vacío: dar por buena una reautenticación que no se registra
   * en ninguna parte es peor que pedir volver a entrar.
   */
  async reauthenticate(userId: string, sessionId: string | undefined, password: string): Promise<{ confirmed: true; validUntil: Date }> {
    if (!sessionId) throw new UnauthorizedException('Vuelve a iniciar sesión para confirmar tu identidad');
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'password'] });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('La contraseña no es correcta');
    }
    await this.sessions.markReauthenticated(sessionId);
    return { confirmed: true, validUntil: new Date(Date.now() + REAUTH_WINDOW_MINUTES * 60_000) };
  }

  /**
   * Devuelve el perfil del usuario por id.
   *
   * @param userId - Identificador del usuario.
   * @returns Entidad del usuario o null.
   */
  /**
   * Perfil del usuario mas los modulos habilitados en su organizacion.
   *
   * Los `features` viajan aca para que el frontend construya el menu con la misma verdad
   * que aplica el backend, en vez de una lista paralela que puede divergir.
   */
  async me(userId: string): Promise<(User & { features: OrganizationFeatures; moduleLifecycle: OrganizationModuleLifecycleMap; mustAcceptTerms: boolean; capabilities?: Record<string, boolean> }) | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    const organization = await this.orgRepo.findOne({ where: { id: user.organizationId }, select: ['id', 'features'] });
    const client = user.clientId
      ? await this.clientRepo.findOne({ where: { id: user.clientId, organizationId: user.organizationId }, select: ['id', 'capabilities'] })
      : null;
    return Object.assign(user, {
      features: normalizeOrganizationFeatures(organization?.features),
      moduleLifecycle: await this.organizationModuleLifecycle(user.organizationId),
      mustAcceptTerms: await this.termsPending(user),
      // El menú del portal recibe la misma contratación que aplican los controladores.
      capabilities: client ? normalizeClientCapabilities(client.capabilities) : undefined,
    });
  }

  private async organizationModuleLifecycle(organizationId: string): Promise<OrganizationModuleLifecycleMap> {
    const defaults = buildDefaultOrganizationModuleLifecycleMap();
    const values = await Promise.all(
      Object.keys(defaults).map(async (module) => {
        const key = moduleLifecycleSettingKey(module as keyof OrganizationModuleLifecycleMap);
        const value = await this.parameters.get(key, null, null, organizationId);
        return [module, value] as const;
      }),
    );
    for (const [module, value] of values) {
      if (typeof value === 'string') defaults[module as keyof OrganizationModuleLifecycleMap] = value as ModuleLifecycleStatus;
    }
    return defaults;
  }

  /**
   * Registra una re-aceptación de condiciones sin tocar la contraseña.
   *
   * Es el caso de una renovación: la persona ya tiene su clave y solo debe aceptar el
   * texto vigente porque dirección publicó una versión nueva o venció el plazo. Pedirle la
   * contraseña temporal aquí no tendría sentido, porque hace tiempo que no la usa.
   */
  async acceptCurrentTerms(userId: string, acceptedConsents: string[], ipAddress?: string, shownVersion?: string): Promise<{ accepted: true }> {
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'organizationId'] });
    if (!user) throw new BadRequestException('Usuario no disponible');

    const missing = REQUIRED_CONSENTS.filter((key) => !acceptedConsents.includes(key));
    if (missing.length > 0) throw new BadRequestException('Debes aceptar todas las condiciones para continuar');

    const version = String(await this.parameters.get('compliance.terms_version', null, null, user.organizationId) ?? TERMS_VERSION);

    // Misma protección que en el primer acceso: no se registra que alguien aceptó una versión
    // distinta de la que tuvo a la vista. Re-aceptar ocurre justo cuando el texto acaba de
    // cambiar, así que es donde el desajuste es más probable.
    if (shownVersion && shownVersion !== version) {
      throw new ConflictException('Las condiciones fueron actualizadas. Recarga la página para revisar la versión vigente.');
    }

    const now = new Date();
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(User, userId, { termsAcceptedAt: now, termsVersion: String(version) });
      await manager.save(
        DataConsent,
        REQUIRED_CONSENTS.map((action) => manager.create(DataConsent, {
          userId,
          action: `${action}@${version}`,
          granted: true,
          ipAddress: ipAddress ?? null,
        })),
      );
    });
    this.logger.log(`Usuario ${userId} re-aceptó las condiciones ${version}`);
    return { accepted: true };
  }

  /**
   * Indica si la persona debe (volver a) aceptar las condiciones.
   *
   * Dirección controla tres parámetros: si la exigencia está activa, cuál es la versión
   * vigente y cada cuántos meses hay que renovar la aceptación. Publicar una actualización
   * es cambiar la versión: al hacerlo, todo el equipo vuelve a aceptar la próxima vez que
   * entre, sin tocar código ni desplegar.
   *
   * Ante un fallo al leer los parámetros no se bloquea el acceso: se registra y se deja
   * pasar, porque dejar al equipo fuera de la herramienta es peor que un día sin re-aceptar.
   */
  private async termsPending(user: User): Promise<boolean> {
    try {
      const [enforced, version, renewalMonths] = await Promise.all([
        this.parameters.get('compliance.terms_enforced', null, null, user.organizationId),
        this.parameters.get('compliance.terms_version', null, null, user.organizationId),
        this.parameters.get('compliance.terms_renewal_months', null, null, user.organizationId),
      ]);
      if (enforced === false) return false;
      if (!user.termsAcceptedAt) return true;
      const currentVersion = version === null || version === undefined ? null : String(version);
      if (currentVersion && user.termsVersion !== currentVersion) return true;

      const months = Number(renewalMonths) || 0;
      if (months <= 0) return false;
      const dueAt = new Date(user.termsAcceptedAt);
      dueAt.setMonth(dueAt.getMonth() + months);
      return dueAt.getTime() <= Date.now();
    } catch (error) {
      this.logger.warn(`No se pudo evaluar la vigencia de condiciones de ${user.id}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   *
   * @param userId - Identificador del usuario.
   * @param data - Campos del perfil a actualizar.
   * @returns Entidad del usuario actualizada.
   */
  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User | null> {
    const patch = {
      ...(data.name !== undefined ? { name: data.name.trim().replace(/\s+/g, ' ') } : {}),
      ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
    };
    await this.userRepo.update(userId, patch);
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async requestPasswordReset(rawEmail: string): Promise<{ accepted: true }> {
    const user = await this.userRepo.findOne({ where: { email: rawEmail.trim().toLowerCase(), isActive: true } });
    if (!user) return { accepted: true };

    const now = new Date();
    await this.resetRepo.update({ userId: user.id, usedAt: IsNull() }, { usedAt: now });
    const token = randomBytes(32).toString('base64url');
    await this.resetRepo.save(this.resetRepo.create({
      organizationId: user.organizationId,
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    }));
    const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    await this.emailService.sendPasswordReset(user.name, user.email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
    return { accepted: true };
  }

  async completePasswordReset(token: string, password: string): Promise<{ changed: true }> {
    const now = new Date();
    const record = await this.resetRepo.findOne({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        usedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
    if (!record) throw new BadRequestException('El enlace no es válido o ya venció');
    const user = await this.userRepo.findOne({ where: { id: record.userId, organizationId: record.organizationId, isActive: true } });
    if (!user) throw new BadRequestException('La cuenta ya no está disponible');
    user.password = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.refreshToken = null;
    record.usedAt = now;
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.save(User, user);
      await manager.save(PasswordResetToken, record);
    });
    // Si el motivo del restablecimiento es que alguien más entró, dejarle sesiones abiertas
    // vacía el gesto: la contraseña nueva no le quita el acceso que ya tenía.
    await this.sessions.revokeAll(user.id, REVOKE_REASONS.PASSWORD_CHANGE);
    return { changed: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ changed: true }> {
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true }, select: ['id', 'password', 'mustChangePassword'] });
    if (!user || !await bcrypt.compare(currentPassword, user.password)) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (await bcrypt.compare(newPassword, user.password)) throw new BadRequestException('La nueva contraseña debe ser diferente');
    await this.userRepo.update(userId, {
      password: await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      refreshToken: null,
    });
    // Cambiar la contraseña cierra todas las sesiones, incluida la propia: quien la cambia
    // vuelve a entrar, y quien hubiera entrado con la anterior queda fuera.
    await this.sessions.revokeAll(userId, REVOKE_REASONS.PASSWORD_CHANGE);
    return { changed: true };
  }

  /**
   * Completa el primer acceso: contraseña propia, consentimientos y datos personales.
   *
   * Las tres cosas ocurren en una transacción porque describen un mismo acto. Antes la
   * aceptación de términos solo controlaba la interfaz y no se guardaba en ningún lado, de
   * modo que no había forma de demostrar que alguien había aceptado nada.
   *
   * El endpoint exige una sesión autenticada recientemente, así que no vuelve a pedir la clave
   * temporal que la persona acaba de usar para ingresar. Todas las sesiones se invalidan al
   * terminar para que esa clave deje de servir de inmediato.
   *
   * @param ipAddress - Origen de la aceptación, parte del registro de consentimiento.
   */
  async completeOnboarding(userId: string, sessionId: string | undefined, dto: CompleteOnboardingDto, ipAddress?: string): Promise<{ completed: true }> {
    if (!sessionId || !(await this.sessions.hasRecentAuth(sessionId, ONBOARDING_AUTH_WINDOW_MINUTES))) {
      throw new ForbiddenException('Tu sesión de activación expiró. Vuelve a ingresar con la contraseña temporal.');
    }
    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
      select: ['id', 'password', 'organizationId'],
    });
    if (!user) throw new BadRequestException('Usuario no disponible');
    if (await bcrypt.compare(dto.newPassword, user.password)) {
      /*
       * El mensaje nombra la contraseña temporal a propósito.
       *
       * «Debe ser diferente» no dice diferente de qué, y en el primer acceso la persona acaba de
       * recibir una clave por correo: escribe esa, que es la única que recuerda, la ve rechazada
       * sin entender por qué, y vuelve a intentar lo mismo. La activación nunca se completa y la
       * pantalla la devuelve al inicio, que es como se produce la sensación de quedar pegado.
       */
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta de la temporal que recibiste. Elige una que no hayas usado antes.',
      );
    }

    const missing = REQUIRED_CONSENTS.filter((key) => !dto.acceptedConsents.includes(key));
    if (missing.length > 0) {
      throw new BadRequestException('Debes aceptar todas las condiciones para continuar');
    }

    const now = new Date();
    const termsVersion = String(
      await this.parameters.get('compliance.terms_version', null, null, user.organizationId)
        ?? TERMS_VERSION,
    );

    /*
     * El texto que la persona leyó tiene que ser el que se registra que aceptó.
     *
     * La versión vigente puede cambiar mientras alguien tiene el formulario abierto: entonces el
     * navegador muestra un texto y el servidor guarda que aceptó otro. Eso no es un desajuste
     * cosmético —es un consentimiento que dice algo que nunca se le mostró—, y ante una
     * reclamación no habría forma de demostrar qué leyó.
     *
     * Se compara solo cuando el navegador declara su versión, para no romper a un cliente que
     * todavía no la envía: si no la declara, se registra la vigente como hasta ahora.
     */
    if (dto.termsVersion && dto.termsVersion !== termsVersion) {
      throw new ConflictException('Las condiciones fueron actualizadas. Recarga la página para revisar la versión vigente.');
    }
    await this.userRepo.manager.transaction(async (manager) => {
      await manager.update(User, userId, {
        name: dto.profile.name.trim(),
        phone: dto.profile.phone?.replace(/[^\d+]/g, '') || null,
        password: await bcrypt.hash(dto.newPassword, Number(process.env.BCRYPT_ROUNDS || 10)),
        mustChangePassword: false,
        mustCompleteProfile: false,
        passwordChangedAt: now,
        termsAcceptedAt: now,
        termsVersion,
        refreshToken: null,
      });
      await manager.save(
        DataConsent,
        REQUIRED_CONSENTS.map((action) => manager.create(DataConsent, {
          userId,
          action: `${action}@${termsVersion}`,
          granted: true,
          ipAddress: ipAddress ?? null,
        })),
      );
    });

    await this.sessions.revokeAll(userId, REVOKE_REASONS.PASSWORD_CHANGE);
    this.logger.log(`Usuario ${userId} completó el primer acceso y aceptó ${termsVersion}`);
    return { completed: true };
  }
}
