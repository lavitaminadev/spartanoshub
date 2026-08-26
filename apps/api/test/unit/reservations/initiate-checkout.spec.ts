import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Meta solo veía dos momentos del formulario: quien aterriza y quien reserva. Entre ambos puede
 * haber semanas de campaña sin señal, y sin el paso intermedio no puede optimizar hacia gente
 * que se interesa —solo hacia tráfico—.
 *
 * `start` ya se registraba para la analítica propia; estas pruebas fijan que además viaje a Meta
 * como `InitiateCheckout`, con el identificador que permite deduplicarlo contra el Pixel, y que
 * nada de eso pueda romper el registro del evento.
 */
const formQuery = { where: vi.fn(), setLock: vi.fn(), getOne: vi.fn() };
formQuery.where.mockReturnValue(formQuery);
formQuery.setLock.mockReturnValue(formQuery);

const forms = { findOne: vi.fn(), exist: vi.fn(), create: vi.fn((v) => v), save: vi.fn((v) => v), find: vi.fn(), createQueryBuilder: vi.fn(() => formQuery) };
const reservations = { find: vi.fn(), createQueryBuilder: vi.fn() };
const blocks = { findOne: vi.fn(), find: vi.fn(), remove: vi.fn(), save: vi.fn(), create: vi.fn((v: unknown) => v), createQueryBuilder: vi.fn() };
const events = { create: vi.fn((v) => v), save: vi.fn((v) => v), find: vi.fn() };
const formEvents = {
  create: vi.fn((v) => v),
  save: vi.fn((v) => ({ ...v, id: 'evento-1', createdAt: new Date('2026-08-19T12:00:00Z') })),
  findOne: vi.fn(),
};
const coupons = { findOne: vi.fn(), create: vi.fn((v) => v), save: vi.fn((v) => v), createQueryBuilder: vi.fn() };
const dataSource = { transaction: vi.fn(), query: vi.fn() };
const leadIntake = { captureLead: vi.fn() };
const calendar = { createEvent: vi.fn() };
const metaOutbox = { enqueue: vi.fn(), processPending: vi.fn() };
const clientPixels = { resolve: vi.fn(), resolveForScope: vi.fn() };
const notifications = { notifyMultiple: vi.fn() };
const emails = { send: vi.fn() };
const audit = { log: vi.fn() };

function formularioPublicado(overrides: Record<string, unknown> = {}) {
  return {
    id: 'form-1', organizationId: 'org-1', clientId: 'client-1', createdBy: 'user-1',
    name: 'Cocina Norte', publicSlug: 'cocina-norte', status: 'published', mode: 'appointment',
    timezone: 'America/Santiago', durationMinutes: 60, bufferMinutes: 0, capacityPerSlot: 1,
    minimumNoticeHours: 1, maximumAdvanceDays: 60, confirmationMode: 'automatic',
    fieldSchema: [
      { id: 'name', type: 'text', label: 'Nombre', required: true },
      { id: 'consent', type: 'consent', label: 'Acepto', required: true },
    ],
    designConfig: {}, scheduleConfig: { windows: [{ day: 1, start: '09:00', end: '18:00' }] },
    servicesConfig: [], resourcesConfig: [],
    metaCapiEnabled: true,
    ...overrides,
  };
}

describe('inicio del formulario hacia Meta', () => {
  let service: ReservationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    dataSource.query.mockReset();
    dataSource.query.mockResolvedValue([{ status: 'active', capabilities: { reservations: true, metaConversions: true } }]);
    formQuery.where.mockReturnValue(formQuery);
    formQuery.setLock.mockReturnValue(formQuery);
    formQuery.getOne.mockResolvedValue(formularioPublicado());
    formEvents.findOne.mockResolvedValue(null);
    clientPixels.resolveForScope.mockResolvedValue({ pixelId: 'pixel-1', accessToken: 'token-1' });
    service = new ReservationsService(forms as never, reservations as never, blocks as never, events as never, formEvents as never, coupons as never, dataSource as never, leadIntake as never, calendar as never, metaOutbox as never, clientPixels as never, notifications as never, emails as never, audit as never);
  });

  it('encola InitiateCheckout cuando alguien empieza a llenar', async () => {
    await service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' }, '1.2.3.4', 'Mozilla');

    expect(metaOutbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'InitiateCheckout',
      actionSource: 'website',
    }));
  });

  /** Sin el mismo identificador en ambos lados, Meta cuenta el inicio dos veces. */
  it('usa el identificador que el navegador puede repetir', async () => {
    await service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' });

    expect(metaOutbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventId: 'initiatecheckout:evento-1',
    }));
  });

  /** Abrir la página no es interesarse: mandar ambos haría indistinguibles las dos cosas. */
  it('no encola nada cuando solo se abrió la página', async () => {
    await service.trackPublicEvent('cocina-norte', { type: 'view', sessionId: 's-1' });
    expect(metaOutbox.enqueue).not.toHaveBeenCalled();
  });

  /**
   * En este momento no hay correo ni teléfono, así que lo único con lo que Meta puede emparejar
   * es lo que trae el navegador. La IP y el user-agent salen de la petición, no del cuerpo.
   */
  it('manda las señales del navegador para poder emparejar', async () => {
    await service.trackPublicEvent(
      'cocina-norte',
      { type: 'start', sessionId: 's-1', fbp: 'fb.1.123', fbc: 'fb.1.456' },
      '1.2.3.4',
      'Mozilla/5.0',
    );

    expect(metaOutbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      userData: expect.objectContaining({
        fbp: 'fb.1.123', fbc: 'fb.1.456',
        client_ip_address: '1.2.3.4', client_user_agent: 'Mozilla/5.0',
      }),
    }));
  });

  it('no encola si el formulario tiene la integración apagada', async () => {
    formQuery.getOne.mockResolvedValue(formularioPublicado({ metaCapiEnabled: false }));
    await service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' });
    expect(metaOutbox.enqueue).not.toHaveBeenCalled();
  });

  it('no encola si el cliente no tiene Pixel configurado', async () => {
    clientPixels.resolveForScope.mockResolvedValue({ pixelId: '', accessToken: undefined });
    await service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' });
    expect(metaOutbox.enqueue).not.toHaveBeenCalled();
  });

  /**
   * La analítica propia del formulario no puede depender de que Meta esté configurado ni de que
   * responda: es el dato con el que se mide el embudo aunque la integración esté caída.
   */
  it('registra el evento aunque encolar falle', async () => {
    metaOutbox.enqueue.mockRejectedValueOnce(new Error('Meta caído'));

    await expect(
      service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' }),
    ).resolves.toMatchObject({ id: 'evento-1' });
    expect(formEvents.save).toHaveBeenCalled();
  });

  /** Repetir gasta una llamada que Meta descarta igual al otro lado. */
  it('no reenvía un inicio ya registrado en la misma sesión', async () => {
    formEvents.findOne.mockResolvedValue({ id: 'evento-previo', type: 'start' });
    await service.trackPublicEvent('cocina-norte', { type: 'start', sessionId: 's-1' });
    expect(metaOutbox.enqueue).not.toHaveBeenCalled();
  });
});
