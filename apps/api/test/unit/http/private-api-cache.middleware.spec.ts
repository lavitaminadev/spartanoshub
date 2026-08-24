import { describe, expect, it, vi } from 'vitest';
import { privateApiCacheMiddleware } from '../../../src/core/http/private-api-cache.middleware';

describe('privateApiCacheMiddleware', () => {
  it('prohíbe caché compartida y varía por las credenciales', () => {
    const response = {
      setHeader: vi.fn(),
      vary: vi.fn(),
    };
    const next = vi.fn();

    privateApiCacheMiddleware({} as never, response as never, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, max-age=0, must-revalidate',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.setHeader).toHaveBeenCalledWith('Expires', '0');
    expect(response.vary).toHaveBeenCalledWith('Authorization');
    expect(response.vary).toHaveBeenCalledWith('Cookie');
    expect(next).toHaveBeenCalledOnce();
  });
});
