import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const post = vi.fn();
  let rejectResponse: ((error: unknown) => Promise<unknown>) | undefined;
  const client = {
    post,
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: {
        use: vi.fn((_success, failure) => {
          rejectResponse = failure;
        }),
      },
    },
  };
  return { post, client, responseFailure: () => rejectResponse! };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mocks.client),
    isAxiosError: vi.fn(() => false),
  },
}));

import { getApiToken, setApiToken } from './api';

describe('cambio de identidad durante una renovación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setApiToken(null);
  });

  it('ignora el refresh de la cuenta anterior cuando ya se cerró sesión', async () => {
    let finishRefresh!: (value: { data: { accessToken: string } }) => void;
    mocks.post.mockReturnValueOnce(new Promise((resolve) => { finishRefresh = resolve; }));
    setApiToken('token-desarrollo');

    const pendingRequest = mocks.responseFailure()({
      response: { status: 401, data: {} },
      config: { url: '/clients', headers: {} },
    });
    await Promise.resolve();

    setApiToken(null);
    finishRefresh({ data: { accessToken: 'token-desarrollo-renovado' } });

    await expect(pendingRequest).rejects.toThrow('La sesión cambió');
    expect(getApiToken()).toBeNull();
  });
});
