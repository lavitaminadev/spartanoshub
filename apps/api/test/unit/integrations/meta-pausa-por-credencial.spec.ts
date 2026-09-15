import { describe, expect, it, vi } from 'vitest';
import { MetaConversionOutboxService } from '../../../src/modules/integrations/meta/meta-conversion-outbox.service';

/**
 * Si Meta rechazó el acceso del Pixel, los eventos nuevos no se encolan: fallarían igual y
 * acumularían datos personales en una cola que no sale. Se reanuda con un envío exitoso posterior.
 */
function servicio({ rechazo, exitosDespues }: { rechazo: { updatedAt: Date } | null; exitosDespues: number }) {
  const consultas: Array<{ getOne?: unknown; getCount?: unknown }> = [];
  const outbox: Record<string, any> = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((valor: any) => valor),
    save: vi.fn(async (valor: any) => ({ id: 'nuevo', ...valor })),
    createQueryBuilder: vi.fn(() => {
      const builder: Record<string, any> = {};
      for (const metodo of ['where', 'andWhere', 'orderBy']) builder[metodo] = vi.fn(() => builder);
      builder.getOne = vi.fn().mockResolvedValue(rechazo);
      builder.getCount = vi.fn().mockResolvedValue(exitosDespues);
      consultas.push(builder);
      return builder;
    }),
  };
  const service = new MetaConversionOutboxService(outbox as any, {} as any, {} as any, { count: vi.fn() } as any);
  return { service, outbox };
}

const EVENTO = { eventName: 'Schedule', eventTime: 1, actionSource: 'website', eventId: 'schedule:r1', userData: {}, customData: {} } as any;

describe('pausa de Meta por credencial rechazada', () => {
  it('no encola mientras el rechazo es reciente y no hubo envíos después', async () => {
    const { service, outbox } = servicio({ rechazo: { updatedAt: new Date() }, exitosDespues: 0 });
    await expect(service.enqueue('org', 'pixel', EVENTO, 'cliente')).resolves.toBeNull();
    expect(outbox.save).not.toHaveBeenCalled();
  });

  it('se reanuda sola con un envío exitoso posterior', async () => {
    const { service, outbox } = servicio({ rechazo: { updatedAt: new Date(Date.now() - 3600000) }, exitosDespues: 1 });
    await expect(service.enqueue('org', 'pixel', EVENTO, 'cliente')).resolves.not.toBeNull();
    expect(outbox.save).toHaveBeenCalledTimes(1);
  });

  it('sin rechazos encola como siempre', async () => {
    const { service, outbox } = servicio({ rechazo: null, exitosDespues: 0 });
    await service.enqueue('org', 'pixel', EVENTO, 'cliente');
    expect(outbox.save).toHaveBeenCalledTimes(1);
  });
});
