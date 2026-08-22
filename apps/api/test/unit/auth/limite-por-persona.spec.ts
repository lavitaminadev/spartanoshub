import { describe, expect, it } from 'vitest';
import { ResourceThrottlerGuard } from '../../../src/core/resource-throttler.guard';

/**
 * El cupo se reparte por persona, no por oficina.
 *
 * Una oficina entera sale a internet por una sola dirección, así que contando solo por IP los
 * cinco intentos por minuto del acceso se repartían entre todo el equipo: con la gente llegando a
 * la misma hora, al sexto le respondía «demasiadas peticiones» y lo leía como sistema caído.
 *
 * El freno real contra quien prueba contraseñas no es este límite sino el bloqueo de la cuenta
 * —cinco fallos y queda cerrada—, que actúa sobre la cuenta atacada y no sobre quien esté sentado
 * al lado.
 */
function rastro(guard: ResourceThrottlerGuard, req: Record<string, unknown>): Promise<string> {
  return (guard as unknown as { getTracker: (r: unknown) => Promise<string> }).getTracker(req);
}

describe('cupo del limitador', () => {
  const guard = new ResourceThrottlerGuard({} as never, {} as never, {} as never);

  it('dos personas de la misma oficina no se quitan el cupo entre ellas', async () => {
    const ana = await rastro(guard, { ip: '200.1.1.1', body: { email: 'ana@espartanos.cl' } });
    const beto = await rastro(guard, { ip: '200.1.1.1', body: { email: 'beto@espartanos.cl' } });

    expect(ana).not.toBe(beto);
  });

  it('la misma persona desde la misma oficina comparte cupo consigo misma', async () => {
    const uno = await rastro(guard, { ip: '200.1.1.1', body: { email: 'ana@espartanos.cl' } });
    const dos = await rastro(guard, { ip: '200.1.1.1', body: { email: 'ana@espartanos.cl' } });

    expect(uno).toBe(dos);
  });

  it('el correo se normaliza: mayúsculas y espacios no dan un cupo nuevo', async () => {
    const normal = await rastro(guard, { ip: '200.1.1.1', body: { email: 'ana@espartanos.cl' } });
    const raro = await rastro(guard, { ip: '200.1.1.1', body: { email: '  ANA@Espartanos.CL ' } });

    expect(raro).toBe(normal);
  });

  it('la misma persona desde otra red tiene su propio cupo', async () => {
    const oficina = await rastro(guard, { ip: '200.1.1.1', body: { email: 'ana@espartanos.cl' } });
    const casa = await rastro(guard, { ip: '190.2.2.2', body: { email: 'ana@espartanos.cl' } });

    expect(oficina).not.toBe(casa);
  });

  it('el formulario público sigue contando por local, que es lo que ya hacía', async () => {
    const local = await rastro(guard, { ip: '200.1.1.1', params: { slug: 'fundo-los-aromos' } });
    const otro = await rastro(guard, { ip: '200.1.1.1', params: { slug: 'fundo-la-esperanza' } });

    expect(local).not.toBe(otro);
  });

  it('sin correo ni recurso cuenta por dirección, como el de serie', async () => {
    const solo = await rastro(guard, { ip: '200.1.1.1', body: {} });
    expect(solo).toBe('200.1.1.1');
  });

  it('un cuerpo sin correo no rompe el rastro', async () => {
    await expect(rastro(guard, { ip: '200.1.1.1' })).resolves.toBe('200.1.1.1');
    await expect(rastro(guard, { ip: '200.1.1.1', body: { email: 42 } })).resolves.toBe('200.1.1.1');
  });

  it('detrás de un proxy se usa la dirección real de quien llama', async () => {
    const conProxy = await rastro(guard, { ips: ['190.9.9.9', '10.0.0.1'], ip: '10.0.0.1', body: {} });
    expect(conProxy).toBe('190.9.9.9');
  });
});
