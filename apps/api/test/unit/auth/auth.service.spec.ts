import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ONBOARDING_AUTH_WINDOW_MINUTES, REAUTH_WINDOW_MINUTES } from '../../../src/core/auth/sessions.service';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const mockUserRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  manager: {
    transaction: vi.fn(),
  },
};

const mockOrgRepo = {
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
};

const mockClientRepo = { findOne: vi.fn() };

/** Organizacion unica de la agencia; el registro se incorpora a ella y nunca crea otra. */
const AGENCY_ORGANIZATION_ID = 'org-1';

const mockJwtService = {
  sign: vi.fn(),
  verify: vi.fn(),
};
const mockResetRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), update: vi.fn(), manager: { transaction: vi.fn() } };
const mockEmailService = { sendPasswordReset: vi.fn() };
const mockParameters = { resolve: vi.fn(), get: vi.fn() };
const mockSessions = {
  open: vi.fn(),
  rotate: vi.fn(),
  findLive: vi.fn(),
  isLive: vi.fn(),
  revoke: vi.fn(),
  revokeAll: vi.fn(),
  listOpen: vi.fn(),
  markReauthenticated: vi.fn(),
  hasRecentAuth: vi.fn(),
};

const transactionManager = {
  update: vi.fn(),
  create: vi.fn((_entity, value) => value),
  save: vi.fn(),
};

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

import { AuthService } from '../../../src/core/auth/auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    process.env.AGENCY_ORGANIZATION_ID = AGENCY_ORGANIZATION_ID;
    mockOrgRepo.findOne.mockResolvedValue({ id: AGENCY_ORGANIZATION_ID });
    mockSessions.open.mockResolvedValue({ id: 'session-1' });
    mockSessions.rotate.mockResolvedValue(undefined);
    mockSessions.revokeAll.mockResolvedValue(0);
    mockSessions.revoke.mockResolvedValue(true);
    mockSessions.hasRecentAuth.mockResolvedValue(true);
    mockParameters.get.mockResolvedValue(null);
    mockUserRepo.manager.transaction.mockImplementation(async (callback) => callback(transactionManager));
    service = new AuthService(mockUserRepo as any, mockOrgRepo as any, mockClientRepo as any, mockResetRepo as any, mockEmailService as any, mockJwtService as any, mockParameters as any, mockSessions as any);
  });

  describe('register', () => {
    it('should create user, hash password, and return tokens', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed_password');
      mockUserRepo.create.mockReturnValue({
        id: 'user-1', email: 'test@example.com', name: 'Test', password: 'hashed_password',
        organizationId: 'org-1', role: 'designer',
      });
      mockUserRepo.save.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', name: 'Test',
        organizationId: 'org-1', role: 'designer',
      });
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.register({
        email: 'test@example.com', password: 'secret123', name: 'Test',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
      expect(result.accessToken).toBe('access-token');
      expect(result.user.email).toBe('test@example.com');
      // La cuenta se incorpora a la organizacion de la agencia y nace con el cargo de menor
      // alcance: un registro abierto que se otorgara la administracion seria una escalada de
      // privilegios accesible desde Internet.
      expect(mockOrgRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: AGENCY_ORGANIZATION_ID,
        role: 'designer',
        mustCompleteProfile: true,
      }));
    });

    it('no permite registrarse cuando la organización de la agencia no está configurada', async () => {
      delete process.env.AGENCY_ORGANIZATION_ID;

      await expect(service.register({
        email: 'nuevo@example.com', password: 'secret123', name: 'Nuevo',
      })).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.register({
        email: 'existing@example.com', password: 'secret123', name: 'Test',
      })).rejects.toThrow(ConflictException);
    });

    it('keeps public registration disabled unless explicitly enabled', async () => {
      process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
      await expect(service.register({
        email: 'nuevo@example.com', password: 'secret123', name: 'Nuevo',
      })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login / validateUser', () => {
    it('should validate credentials and return tokens', async () => {
      const mockUser = {
        id: 'user-1', email: 'a@b.com', name: 'A', password: 'hashed',
        role: 'designer', organizationId: 'org-1', avatarUrl: null,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('access-token');

      const user = await service.validateUser('a@b.com', 'password123');
      expect(user.email).toBe('a@b.com');

      const tokens = await service.login(user, { userAgent: 'Chrome', ipAddress: '1.2.3.4' });
      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('access-token');
      // El refresh token ya no vive en una columna de "users": cada ingreso abre su propia
      // sesion, de modo que entrar desde el telefono no cierra la del computador.
      expect(mockSessions.open).toHaveBeenCalledWith(
        'user-1', 'org-1', expect.any(String), expect.any(Date),
        { userAgent: 'Chrome', ipAddress: '1.2.3.4' },
      );
      expect(mockSessions.rotate).toHaveBeenCalledWith('session-1', 'access-token', expect.any(Date));
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', password: 'hashed',
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(service.validateUser('a@b.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.validateUser('no@user.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a portal account when its company is paused', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'portal-1', email: 'portal@empresa.cl', name: 'Portal', password: 'hashed',
        role: 'client', organizationId: 'org-1', clientId: 'client-1', avatarUrl: null,
      });
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1', status: 'paused' });
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(service.validateUser('portal@empresa.cl', 'password123')).rejects.toThrow(UnauthorizedException);
    });

    it('allows a portal account to complete its company onboarding', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'portal-1', email: 'portal@empresa.cl', name: 'Portal', password: 'hashed',
        role: 'client', organizationId: 'org-1', clientId: 'client-1', avatarUrl: null,
      });
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1', status: 'onboarding' });
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(service.validateUser('portal@empresa.cl', 'password123')).resolves.toMatchObject({ id: 'portal-1' });
    });
  });

  describe('completeOnboarding', () => {
    it('guarda perfil y consentimientos sin permitir que la persona defina su modalidad laboral', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', password: 'old-hash', organizationId: 'org-1' });
      (bcrypt.compare as any).mockResolvedValue(false);
      (bcrypt.hash as any).mockResolvedValue('new-hash');

      const result = await service.completeOnboarding('user-1', 'session-1', {
        newPassword: 'NuevaClave123!',
        acceptedConsents: ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        profile: { name: 'Demo Vitalis', phone: '+56 9 1234 5678' },
      }, '1.2.3.4');

      expect(result).toEqual({ completed: true });
      expect(transactionManager.update).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.not.objectContaining({ workMode: expect.anything() }));
      expect(mockSessions.revokeAll).toHaveBeenCalledWith('user-1', 'cambio_de_contrasena');
    });

    it('mide la ventana de activación con su propio plazo, no con el de reautenticación', async () => {
      // Quince minutos alcanzan para que alguien que se detiene a leer las cinco condiciones
      // —que es lo que se le pide— llegue a crear su contraseña y quede fuera de su cuenta.
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', password: 'old-hash', organizationId: 'org-1' });
      (bcrypt.compare as any).mockResolvedValue(false);
      (bcrypt.hash as any).mockResolvedValue('new-hash');

      await service.completeOnboarding('user-1', 'session-1', {
        newPassword: 'NuevaClave123!',
        acceptedConsents: ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        profile: { name: 'Demo Vitalis' },
      }, '1.2.3.4');

      expect(mockSessions.hasRecentAuth).toHaveBeenCalledWith('session-1', ONBOARDING_AUTH_WINDOW_MINUTES);
      expect(ONBOARDING_AUTH_WINDOW_MINUTES).toBeGreaterThan(REAUTH_WINDOW_MINUTES);
    });

    it('no registra el consentimiento si el texto mostrado no es el vigente', async () => {
      // Guardar que acepto una version que nunca vio es un consentimiento que dice algo que no
      // se le mostro: ante un reclamo no habria forma de demostrar que leyo.
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', password: 'old-hash', organizationId: 'org-1' });
      (bcrypt.compare as any).mockResolvedValue(false);
      mockParameters.get.mockResolvedValue('v2');

      await expect(service.completeOnboarding('user-1', 'session-1', {
        newPassword: 'NuevaClave123!',
        acceptedConsents: ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        profile: { name: 'Demo Vitalis' },
        termsVersion: 'v1',
      })).rejects.toThrow(ConflictException);

      expect(transactionManager.update).not.toHaveBeenCalled();
      expect(transactionManager.save).not.toHaveBeenCalled();
    });

    it('acepta cuando la version mostrada coincide con la vigente', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', password: 'old-hash', organizationId: 'org-1' });
      (bcrypt.compare as any).mockResolvedValue(false);
      (bcrypt.hash as any).mockResolvedValue('new-hash');
      mockParameters.get.mockResolvedValue('v1');

      const result = await service.completeOnboarding('user-1', 'session-1', {
        newPassword: 'NuevaClave123!',
        acceptedConsents: ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        profile: { name: 'Demo Vitalis' },
        termsVersion: 'v1',
      }, '1.2.3.4');

      expect(result).toEqual({ completed: true });
    });

    it('rechaza una sesión de activación que ya no es reciente', async () => {
      mockSessions.hasRecentAuth.mockResolvedValue(false);

      await expect(service.completeOnboarding('user-1', 'session-1', {
        newPassword: 'NuevaClave123!',
        acceptedConsents: ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        profile: { name: 'Demo Vitalis' },
      })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('termsPending', () => {
    it('no vuelve a pedir condiciones cuando la version configurada llega como numero', async () => {
      mockParameters.get.mockImplementation(async (key: string) => {
        if (key === 'compliance.terms_version') return 1;
        if (key === 'compliance.terms_renewal_months') return 0;
        return null;
      });

      const pending = await (service as any).termsPending({
        id: 'user-1',
        organizationId: 'org-1',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });

      expect(pending).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should return a new access token for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', email: 'a@b.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', refreshToken: 'valid-refresh', email: 'a@b.com', role: 'designer',
        organizationId: 'org-1',
      });
      mockJwtService.sign.mockReturnValue('new-access-token');

      mockSessions.findLive.mockResolvedValue({ id: 'session-1', userId: 'user-1' });

      const result = await service.refreshToken('valid-refresh');
      expect(result.accessToken).toBe('new-access-token');
      // Renovar rota la huella de la sesion existente; no crea una nueva ni toca "users".
      expect(mockSessions.rotate).toHaveBeenCalledWith('session-1', 'new-access-token', expect.any(Date));
      expect(mockSessions.open).not.toHaveBeenCalled();
    });

    it('AUTH-18 · un refresh token cuya sesion se cerro deja de servir', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', email: 'a@b.com', sid: 'session-1' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', refreshToken: null, email: 'a@b.com', role: 'designer', organizationId: 'org-1',
      });
      mockSessions.findLive.mockResolvedValue(null);

      await expect(service.refreshToken('token-de-sesion-cerrada')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error(); });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('cierra solo la sesion desde la que se pide', async () => {
      await service.logout('user-1', 'session-1');

      expect(mockSessions.revoke).toHaveBeenCalledWith('session-1', 'user-1', expect.any(String));
      expect(mockSessions.revokeAll).not.toHaveBeenCalled();
    });

    it('sin sesion en el token cierra todas, que es lo seguro', async () => {
      await service.logout('user-1');

      expect(mockSessions.revokeAll).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('cierra la sesión persistida del navegador usando su refresh token', async () => {
      mockSessions.findLive.mockResolvedValue({ id: 'session-1', userId: 'user-1' });

      await service.logoutByRefreshToken('refresh-token');

      expect(mockSessions.revoke).toHaveBeenCalledWith('session-1', 'user-1', expect.any(String));
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
    });

    it('trata una cookie vencida como una sesión ya cerrada', async () => {
      mockSessions.findLive.mockResolvedValue(null);

      await expect(service.logoutByRefreshToken('expired-token')).resolves.toBeUndefined();
      expect(mockSessions.revoke).not.toHaveBeenCalled();
    });
  });

    describe('acceptCurrentTerms', () => {
    it('tampoco registra una re-aceptación de un texto que no es el vigente', async () => {
      // Re-aceptar ocurre justo cuando el texto acaba de cambiar, así que es donde el desajuste
      // entre lo mostrado y lo vigente es más probable.
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: 'org-1' });
      mockParameters.get.mockResolvedValue('v2');

      await expect(service.acceptCurrentTerms(
        'user-1',
        ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        '1.2.3.4',
        'v1',
      )).rejects.toThrow(ConflictException);

      expect(transactionManager.save).not.toHaveBeenCalled();
    });

    it('registra cuando la versión mostrada es la vigente', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: 'org-1' });
      mockParameters.get.mockResolvedValue('v1');

      const result = await service.acceptCurrentTerms(
        'user-1',
        ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        '1.2.3.4',
        'v1',
      );
      expect(result).toEqual({ accepted: true });
    });

    it('sigue aceptando a un cliente que no declara versión, para no romperlo', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: 'org-1' });
      mockParameters.get.mockResolvedValue('v2');

      const result = await service.acceptCurrentTerms(
        'user-1',
        ['terms', 'dataTreatment', 'confidentiality', 'properUse', 'noDisclosure'],
        '1.2.3.4',
      );
      expect(result).toEqual({ accepted: true });
    });
  });

});
