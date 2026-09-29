import { describe, expect, it, vi } from 'vitest';
import { ResumenDiarioJob } from '../../../src/core/jobs/cron/resumen-diario.job';

/*
 * El resumen diario respeta la configuración de la empresa de cada persona.
 *
 * Se leía siempre el valor general: una empresa que apagaba el resumen para su equipo lo seguía
 * recibiendo, y su texto no se usaba nunca.
 */
function trabajo(encendidoPorEmpresa: Record<string, boolean>) {
  const usuarios = {
    find: vi.fn().mockResolvedValue([
      { id: 'u-agencia', name: 'Pablo', email: 'pablo@agencia.cl', organizationId: 'org-1', clientId: null },
      { id: 'u-bar', name: 'Rocío', email: 'rocio@bar.cl', organizationId: 'org-1', clientId: 'bar-ruperto' },
    ]),
  };
  const parametros = {
    get: vi.fn(async (clave: string, clientId: string | null) => {
      if (clave === 'email.daily_digest_enabled') return encendidoPorEmpresa[clientId ?? 'agencia'] ?? true;
      return null;
    }),
  };
  const correo = { send: vi.fn().mockResolvedValue(true) };
  const job = new ResumenDiarioJob({} as never, {} as never, usuarios as never, correo as never, parametros as never);
  // Cada persona tiene algo que leer: lo que se prueba es a quién le llega, no qué dice.
  (job as unknown as { cifrasDe: () => Promise<unknown> }).cifrasDe = async () => ({ pendientes: 2, parados: 1, nuevos: 0 });
  return { job, correo, parametros };
}

describe('resumen diario por empresa', () => {
  it('una empresa que lo apaga deja de mandárselo a su equipo; la agencia lo sigue recibiendo', async () => {
    const { job, correo } = trabajo({ 'bar-ruperto': false, agencia: true });
    await job.handle();

    const destinos = correo.send.mock.calls.map(([destino]) => destino);
    expect(destinos).toEqual(['pablo@agencia.cl']);
  });

  it('pregunta el interruptor con la empresa de cada persona', async () => {
    const { job, parametros } = trabajo({});
    await job.handle();

    expect(parametros.get).toHaveBeenCalledWith('email.daily_digest_enabled', 'bar-ruperto', null, 'org-1');
    expect(parametros.get).toHaveBeenCalledWith('email.daily_digest_enabled', null, null, 'org-1');
  });
});
