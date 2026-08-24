import { Controller, Post, Body, Get, Put, Delete, Param, HttpCode, HttpStatus, Ip, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './auth.guard';
import type { AuthUser } from '../../shared/types/request';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { Request, Response } from 'express';
import { config } from '../../config';
import { ChangePasswordDto, CompletePasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { AcceptTermsDto, CompleteOnboardingDto } from './dto/onboarding.dto';
import { ReauthenticateDto } from './dto/reauthenticate.dto';
import { ModuleExempt } from '../authorization/module-scope.decorator';

// Nombre versionado: evita que una cookie de instalaciones anteriores con el mismo nombre pero
// otra ruta restaure a la persona que usó el navegador antes. El login migra las anteriores sin
// obligar a cada cliente a limpiar manualmente sus datos del navegador.
const REFRESH_COOKIE = 'espartanos_refresh_v2';
/**
 * Nombre anterior de la cookie, aceptado solo al leer.
 *
 * Las sesiones abiertas antes del cambio de nombre siguen presentando la cookie vieja: se lee
 * como alternativa y el primer refresh la reemplaza por la nueva, de modo que nadie queda fuera
 * por un despliegue. Se puede retirar cuando haya pasado la vigencia de un refresh completo.
 */
const LEGACY_REFRESH_COOKIES = ['espartanos_refresh', 'vitahub_refresh'] as const;
const REFRESH_COOKIE_PATH = '/api/auth';
const LEGACY_REFRESH_COOKIE_PATHS = ['/api/auth', '/api', '/'] as const;

function sessionDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * units[match[2] as keyof typeof units];
}

const REFRESH_COOKIE_MAX_AGE_MS = sessionDurationMs(config.jwt.refreshExpiresIn);

/**
 * Intentos de acceso permitidos por minuto.
 *
 * El límite es **por dirección de origen, no por persona**: una oficina entera comparte una sola
 * salida a internet, así que cinco intentos por minuto se reparten entre todos los que estén
 * entrando a la vez. Con el equipo llegando a la misma hora, al sexto le responde 429 y lo lee
 * como que el sistema está caído.
 *
 * Se conserva el valor de siempre como predeterminado —bajarlo protege contra el probador de
 * contraseñas, que es para lo que está— y se hace ajustable para las instalaciones donde ese
 * reparto no da, y para las pruebas, que abren varias sesiones seguidas.
 */
const INTENTOS_DE_ACCESO = {
  limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
  ttl: Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000),
};

function readCookie(request: Request, name: string): string | undefined {
  const match = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Token de refresh presentado por el navegador, sea con el nombre actual o el anterior. */
function readRefreshCookie(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE)
    ?? LEGACY_REFRESH_COOKIES.map((name) => readCookie(request, name)).find(Boolean);
}

function cookieOptions(path: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path,
  };
}

function clearLegacyRefreshCookies(response: Response): void {
  for (const name of LEGACY_REFRESH_COOKIES) {
    for (const path of LEGACY_REFRESH_COOKIE_PATHS) {
      response.clearCookie(name, cookieOptions(path));
    }
  }
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(REFRESH_COOKIE_PATH),
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
  // Una sesión que venía con un nombre o ruta anterior queda con una sola cookie tras renovarse.
  clearLegacyRefreshCookies(response);
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, cookieOptions(REFRESH_COOKIE_PATH));
  clearLegacyRefreshCookies(response);
}

/**
 * Endpoints de autenticación: login, registro, refresh y perfil.
 */
@ApiTags('Autenticación')
@Controller('auth')
@ModuleExempt('Autoservicio de la propia cuenta: sesion, perfil y contrasena')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Registra un nuevo usuario y opcionalmente lo vincula a una organización.
   */
  @Public()
  @Post('register')
  @Throttle({ default: INTENTOS_DE_ACCESO })
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...session } = await this.auth.register(dto);
    setRefreshCookie(response, refreshToken);
    return session;
  }

  /**
   * Valida las credenciales y devuelve los tokens de acceso/refresh.
   */
  @Public()
  @Post('login')
  @Throttle({ default: INTENTOS_DE_ACCESO })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Ip() ip: string, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    // El agente y la direccion se guardan para que la persona reconozca la sesion en su lista.
    // Llegan del cliente y no se usan para decidir nada, solo para mostrarlos.
    const tokens = await this.auth.login(user, { userAgent: request.headers['user-agent'], ipAddress: ip });
    setRefreshCookie(response, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        clientId: user.clientId,
        organizationId: user.organizationId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Emite un nuevo access token a partir de un refresh token válido.
   */
  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar token de acceso' })
  @ApiBody({ type: RefreshDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readRefreshCookie(request) ?? dto?.refreshToken;
    const refreshed = await this.auth.refreshToken(token ?? '');
    setRefreshCookie(response, refreshed.refreshToken);
    return { accessToken: refreshed.accessToken };
  }

  /**
   * Restaura una sesión del navegador sin convertir la ausencia normal de cookie en un 401.
   * `/auth/refresh` conserva su semántica estricta para clientes de API; la interfaz usa este
   * endpoint al arrancar, cuando no saber todavía si existe una sesión es un estado esperado.
   */
  @Public()
  @Post('session')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Comprobar y restaurar la sesión del navegador' })
  async browserSession(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readRefreshCookie(request) ?? dto?.refreshToken;
    if (!token) return { authenticated: false as const };
    try {
      const refreshed = await this.auth.refreshToken(token);
      setRefreshCookie(response, refreshed.refreshToken);
      return { authenticated: true as const, accessToken: refreshed.accessToken };
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      clearRefreshCookie(response);
      return { authenticated: false as const };
    }
  }

  /** Revoca la sesión persistida y elimina la cookie del navegador. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesion y revocar credenciales' })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(user.id, user.sessionId);
    clearRefreshCookie(response);
  }

  /**
   * Cierra la sesión persistida del navegador incluso cuando su access token ya venció.
   *
   * El refresh token vive en una cookie HttpOnly y, por eso, la interfaz no puede borrarlo por
   * sí sola. Este endpoint siempre retira la cookie y revoca su sesión cuando aún existe. Así,
   * salir no puede restaurar silenciosamente la cuenta anterior en el siguiente arranque.
   */
  @Public()
  @Post('browser-logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Cerrar la sesión persistida del navegador' })
  async browserLogout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readRefreshCookie(request);
    try {
      if (token) await this.auth.logoutByRefreshToken(token);
    } finally {
      clearRefreshCookie(response);
    }
  }

  /**
   * Sesiones abiertas de quien pregunta.
   *
   * Solo las propias: no hay parámetro de usuario, así que no existe el camino para mirar las
   * de otro. Nunca incluye la huella del token — quien lea la respuesta no debe poder usarla.
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mis sesiones abiertas' })
  async listSessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  /**
   * Cierra el resto de sesiones y conserva la actual.
   *
   * Es lo que se usa cuando se sospecha que alguien más entró: se corta todo lo demás sin
   * quedarse fuera uno mismo en el intento.
   */
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar todas mis otras sesiones' })
  async closeOtherSessions(@CurrentUser() user: AuthUser) {
    return { closed: await this.auth.closeOtherSessions(user.id, user.sessionId) };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar una sesión concreta' })
  async closeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.auth.closeSession(user.id, id);
  }

  /**
   * Confirma la contraseña para habilitar operaciones críticas por un rato.
   *
   * Va limitado igual que el ingreso: es el mismo blanco para probar contraseñas, solo que
   * partiendo de una sesión ya abierta.
   */
  @Post('reauthenticate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar la contraseña para operaciones críticas' })
  async reauthenticate(@CurrentUser() user: AuthUser, @Body() dto: ReauthenticateDto) {
    return this.auth.reauthenticate(user.id, user.sessionId, dto.password);
  }

  /**
   * Devuelve el perfil del usuario autenticado.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del usuario' })
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Public()
  @Post('password/request-reset')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('password/reset')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @ApiOperation({ summary: 'Completar recuperación de contraseña' })
  completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    return this.auth.completePasswordReset(dto.token, dto.password);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña autenticada' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    clearRefreshCookie(response);
    return result;
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Completar el primer acceso: datos, condiciones y contraseña' })
  async completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteOnboardingDto,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.completeOnboarding(user.id, user.sessionId, dto, ipAddress);
    clearRefreshCookie(response);
    return result;
  }

  /** Renovación: la cuenta ya está activa y solo debe aceptar el texto vigente. */
  @Post('terms/accept')
  @UseGuards(JwtAuthGuard)
  @Roles(...Object.values(UserRole))
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aceptar la versión vigente de las condiciones' })
  acceptTerms(@CurrentUser() user: AuthUser, @Body() dto: AcceptTermsDto, @Ip() ipAddress: string) {
    return this.auth.acceptCurrentTerms(user.id, dto.acceptedConsents, ipAddress, dto.termsVersion);
  }
}
