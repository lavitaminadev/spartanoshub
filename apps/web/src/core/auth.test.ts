import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, setApiToken, clearQueryCache } = vi.hoisted(() => ({
  post: vi.fn(),
  setApiToken: vi.fn(),
  clearQueryCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./api', () => ({
  api: { post, get: vi.fn() },
  setApiToken,
}));

vi.mock('./query-persistence', () => ({
  claimQueryCache: vi.fn(),
  clearQueryCache,
}));

import { useAuth } from './auth';

describe('logout del navegador', () => {
  beforeEach(() => {
    post.mockReset();
    setApiToken.mockReset();
    clearQueryCache.mockClear();
    window.history.replaceState({}, '', '/login');
    useAuth.setState({
      user: { id: 'u1', name: 'Ana', email: 'ana@prueba.local', role: 'admin' },
      token: 'token-vivo', loading: false, error: null,
    });
  });

  it('retira usuario y token antes de que el servidor termine de revocar la cookie', async () => {
    let terminar!: () => void;
    post.mockReturnValue(new Promise<void>((resolve) => { terminar = resolve; }));

    const salida = useAuth.getState().logout();

    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().token).toBeNull();
    expect(setApiToken).toHaveBeenCalledWith(null);
    expect(clearQueryCache).toHaveBeenCalledTimes(1);

    terminar();
    await salida;
  });
});
