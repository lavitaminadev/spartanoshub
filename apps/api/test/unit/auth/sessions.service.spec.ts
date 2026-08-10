import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { REAUTH_WINDOW_MINUTES, REVOKE_REASONS, SessionsService, hashRefreshToken } from '../../../src/core/auth/sessions.service';

const repo = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
};

function build() {
  return new SessionsService(repo as never);
}

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 1000);

describe('SessionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.create.mockImplementation((data) => data);
    repo.save.mockImplementation(async (data) => ({ id: 'session-1', ...data }));
    repo.update.mockResolvedValue({ affected: 1 });
  });

  describe('open', () => {
    it('guarda la huella del token, nunca el token', async () => {
      const session = await build().open('user-1', 'org-1', 'token-en-claro', future());

      expect(session.refreshTokenHash).toBe(createHash('sha256').update('token-en-claro').digest('hex'));
      expect(JSON.stringify(session)).not.toContain('token-en-claro');
    });

    it('un ingreso con contraseña cuenta como autenticación reciente', async () => {
      const session = await build().open('user-1', 'org-1', 'token', future());

      expect(session.reauthenticatedAt).toBeInstanceOf(Date);
    });

    it('recorta el agente y la dirección, que llegan del cliente', async () => {
      const session = await build().open('user-1', 'org-1', 'token', future(), {
        userAgent: 'x'.repeat(600),
        ipAddress: 'y'.repeat(80),
      });

      expect(session.userAgent).toHaveLength(400);
      expect(session.ipAddress).toHaveLength(45);
    });
  });

  describe('findLive', () => {
    it('busca por la huella, no por el token', async () => {
      repo.findOne.mockResolvedValue({ id: 'session-1', expiresAt: future() });

      await build().findLive('token-en-claro');

      const where = repo.findOne.mock.calls[0][0].where;
      expect(where.refreshTokenHash).toBe(hashRefreshToken('token-en-claro'));
    });

    it('una sesión vencida no está viva aunque no esté revocada', async () => {
      repo.findOne.mockResolvedValue({ id: 'session-1', expiresAt: past() });

      expect(await build().findLive('token')).toBeNull();
    });
  });

  describe('isLive', () => {
    it('AUTH-18 · una sesión revocada deja de valer de inmediato', async () => {
      repo.findOne.mockResolvedValue({ id: 'session-1', revokedAt: new Date(), expiresAt: future() });

      expect(await build().isLive('session-1')).toBe(false);
    });

    it('una sesión que no existe no vale', async () => {
      repo.findOne.mockResolvedValue(null);

      expect(await build().isLive('inventada')).toBe(false);
    });

    it('una sesión abierta y vigente vale', async () => {
      repo.findOne.mockResolvedValue({ id: 'session-1', revokedAt: null, expiresAt: future() });

      expect(await build().isLive('session-1')).toBe(true);
    });
  });

  describe('revoke', () => {
    it('AUTH-17 · el usuario va en la condición, no se comprueba después', async () => {
      await build().revoke('session-9', 'user-1', REVOKE_REASONS.USER);

      // Sin esto existiria el camino para cerrar la sesion de otro pasando su identificador.
      const [criteria] = repo.update.mock.calls[0];
      expect(criteria).toMatchObject({ id: 'session-9', userId: 'user-1' });
    });

    it('informa si no había nada que cerrar', async () => {
      repo.update.mockResolvedValue({ affected: 0 });

      expect(await build().revoke('session-9', 'user-1', REVOKE_REASONS.USER)).toBe(false);
    });
  });

  describe('revokeAll', () => {
    it('conserva la sesión indicada al cerrar las demás', async () => {
      const query = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 3 }),
      };
      repo.createQueryBuilder.mockReturnValue(query);

      const closed = await build().revokeAll('user-1', REVOKE_REASONS.USER, 'session-actual');

      expect(closed).toBe(3);
      expect(query.andWhere).toHaveBeenCalledWith('id != :exceptSessionId', { exceptSessionId: 'session-actual' });
    });

    it('sin excepción cierra todas', async () => {
      const query = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 2 }),
      };
      repo.createQueryBuilder.mockReturnValue(query);

      await build().revokeAll('user-1', REVOKE_REASONS.PASSWORD_CHANGE);

      expect(query.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('listOpen', () => {
    it('no expone la huella del token y marca la sesión actual', async () => {
      repo.find.mockResolvedValue([
        { id: 'session-1', refreshTokenHash: 'secreto', createdAt: new Date(), expiresAt: future(), userAgent: 'Chrome', ipAddress: '1.2.3.4', lastSeenAt: null },
        { id: 'session-2', refreshTokenHash: 'secreto', createdAt: new Date(), expiresAt: future(), userAgent: null, ipAddress: null, lastSeenAt: null },
      ]);

      const list = await build().listOpen('user-1', 'session-2');

      expect(JSON.stringify(list)).not.toContain('secreto');
      expect(list.find((s) => s.id === 'session-2')?.current).toBe(true);
      expect(list.find((s) => s.id === 'session-1')?.current).toBe(false);
    });

    it('deja fuera las vencidas', async () => {
      repo.find.mockResolvedValue([
        { id: 'viva', createdAt: new Date(), expiresAt: future() },
        { id: 'vencida', createdAt: new Date(), expiresAt: past() },
      ]);

      const list = await build().listOpen('user-1');

      expect(list.map((s) => s.id)).toEqual(['viva']);
    });
  });

  describe('hasRecentAuth', () => {
    it('AUTH-19 · vale dentro de la ventana', async () => {
      repo.findOne.mockResolvedValue({ id: 'session-1', reauthenticatedAt: new Date(Date.now() - 60_000) });

      expect(await build().hasRecentAuth('session-1')).toBe(true);
    });

    it('AUTH-19 · deja de valer pasada la ventana', async () => {
      const expired = new Date(Date.now() - (REAUTH_WINDOW_MINUTES + 1) * 60_000);
      repo.findOne.mockResolvedValue({ id: 'session-1', reauthenticatedAt: expired });

      expect(await build().hasRecentAuth('session-1')).toBe(false);
    });

    it('una sesión que no existe no confirma nada', async () => {
      repo.findOne.mockResolvedValue(null);

      expect(await build().hasRecentAuth('inventada')).toBe(false);
    });
  });

  describe('purgeExpired', () => {
    it('conserva las revocadas recientes, que son las que se miran al investigar', async () => {
      repo.delete.mockResolvedValue({ affected: 5 });

      await build().purgeExpired(90);

      const criteria = repo.delete.mock.calls[0][0];
      expect(criteria.expiresAt).toBeDefined();
      expect(criteria.revokedAt).toBeDefined();
    });
  });
});
