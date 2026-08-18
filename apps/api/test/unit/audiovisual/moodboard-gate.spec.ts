import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudiovisualService } from '../../../src/modules/audiovisual/audiovisual.service';

/**
 * La regla del flujo audiovisual: sin moodboard aprobado no se agenda.
 *
 * La community manager crea el moodboard, la dirección creativa lo aprueba y la dirección
 * audiovisual asigna equipo. Agendar antes de esa aprobación convoca a un equipo a grabar algo
 * que todavía no está definido, y el rodaje se pierde o se repite.
 *
 * Antes de estas pruebas el moodboard era opcional —la validación retornaba sin comprobar nada
 * si no venía— y cuando venía solo se verificaba que perteneciera al cliente: su estado no se
 * miraba en ningún punto del archivo.
 */
describe('agendar una sesión audiovisual', () => {
  const moodboardRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), findAndCount: vi.fn(), remove: vi.fn() };
  const sessionRepo = {
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: 'session-1', ...value })),
    createQueryBuilder: vi.fn(),
  };
  const clients = { findOne: vi.fn() };
  const users = { createQueryBuilder: vi.fn() };
  let service: AudiovisualService;

  const nuevaSesion = (moodboardId?: string) => ({
    clientId: 'client-1',
    type: 'reel',
    date: '2026-09-01',
    moodboardId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clients.findOne.mockResolvedValue({ id: 'client-1', name: 'Cocina Norte' });
    service = new AudiovisualService(moodboardRepo as never, sessionRepo as never, clients as never, users as never);
  });

  it('agenda cuando el moodboard del cliente está aprobado', async () => {
    moodboardRepo.findOne.mockResolvedValue({ id: 'mb-1', clientId: 'client-1', title: 'Verano', status: 'approved' });
    const result = await service.createSession(nuevaSesion('mb-1') as never, 'org-1');
    expect(result.id).toBe('session-1');
    expect(sessionRepo.save).toHaveBeenCalled();
  });

  it('no agenda sin moodboard', async () => {
    await expect(service.createSession(nuevaSesion() as never, 'org-1'))
      .rejects.toThrow(/necesita un moodboard aprobado/i);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('no agenda con un moodboard en borrador ni en revisión', async () => {
    for (const status of ['draft', 'review', 'rejected']) {
      moodboardRepo.findOne.mockResolvedValue({ id: 'mb-1', clientId: 'client-1', title: 'Verano', status });
      await expect(service.createSession(nuevaSesion('mb-1') as never, 'org-1'))
        .rejects.toThrow(/todavía no está aprobado/i);
    }
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('no agenda con un moodboard de otro cliente', async () => {
    // La consulta acota por `clientId`, así que uno de otro cliente simplemente no aparece.
    moodboardRepo.findOne.mockResolvedValue(null);
    await expect(service.createSession(nuevaSesion('mb-de-otro') as never, 'org-1'))
      .rejects.toThrow(/no pertenece al cliente/i);
  });

  /**
   * Las sesiones creadas antes de que existiera esta regla no tienen moodboard. Exigirlo en
   * cada cambio dejaría sin poder confirmarlas ni completarlas, que es trabajo real detenido
   * por una regla que no existía cuando se agendaron.
   */
  it('permite confirmar una sesión antigua que no tiene moodboard', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 'session-vieja', clientId: 'client-1', moodboardId: null, status: 'scheduled' });
    await expect(service.updateSession('session-vieja', { status: 'confirmed' } as never, 'org-1')).resolves.toBeTruthy();
  });

  it('pero si el cambio trae un moodboard, ese sí debe estar aprobado', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 'session-1', clientId: 'client-1', moodboardId: null, status: 'scheduled' });
    moodboardRepo.findOne.mockResolvedValue({ id: 'mb-2', clientId: 'client-1', title: 'Otoño', status: 'draft' });
    await expect(service.updateSession('session-1', { moodboardId: 'mb-2' } as never, 'org-1'))
      .rejects.toThrow(/todavía no está aprobado/i);
  });
});
