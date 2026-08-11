import { describe, expect, it, vi } from 'vitest';
import { retryOnDeadlock } from '../../../src/shared/retry-on-deadlock';

/** Error tal como lo entrega el driver de MySQL. */
function mysqlError(errno: number) {
  return Object.assign(new Error(`mysql errno ${errno}`), { errno });
}

describe('retryOnDeadlock', () => {
  it('devuelve el resultado sin reintentar cuando no hay error', async () => {
    const work = vi.fn().mockResolvedValue('ok');

    await expect(retryOnDeadlock('prueba', work)).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante interbloqueo y devuelve el resultado del segundo intento', async () => {
    // Es el caso real: dos reagendamientos que se cruzan. MySQL aborta uno para que el otro
    // siga, y el abortado normalmente pasa al reintentar.
    const work = vi.fn()
      .mockRejectedValueOnce(mysqlError(1213))
      .mockResolvedValue('ok');

    await expect(retryOnDeadlock('prueba', work)).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('reintenta tambien cuando se agota la espera de bloqueo', async () => {
    const work = vi.fn().mockRejectedValueOnce(mysqlError(1205)).mockResolvedValue('ok');

    await expect(retryOnDeadlock('prueba', work)).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('no reintenta un error que no es de bloqueo', async () => {
    // Reintentar una violacion de unicidad o una regla de negocio solo retrasa el error.
    const work = vi.fn().mockRejectedValue(mysqlError(1062));

    await expect(retryOnDeadlock('prueba', work)).rejects.toThrow('mysql errno 1062');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('no reintenta un error sin codigo de MySQL', async () => {
    const work = vi.fn().mockRejectedValue(new Error('conflicto de negocio'));

    await expect(retryOnDeadlock('prueba', work)).rejects.toThrow('conflicto de negocio');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras agotar los intentos y propaga el error original', async () => {
    const work = vi.fn().mockRejectedValue(mysqlError(1213));

    await expect(retryOnDeadlock('prueba', work, 3)).rejects.toThrow('mysql errno 1213');
    expect(work).toHaveBeenCalledTimes(3);
  });
});
