import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataProtectionService } from '../../../src/core/data-protection/data-protection.service';

/**
 * La anonimizacion tiene que alcanzar los datos del comensal, que viven en las reservas y
 * en los contactos de campana, no solo en los usuarios y prospectos. Y siempre debe dejar
 * rastro en la bitacora, porque el dato original ya no se puede recuperar.
 */
describe('DataProtectionService', () => {
  let reservationRepo: any;
  let contactRepo: any;
  let auditRepo: any;
  let service: DataProtectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditRepo = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
      update: vi.fn(),
    };
    reservationRepo = {
      findOneBy: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (value) => value),
    };
    contactRepo = {
      findOneBy: vi.fn(),
      save: vi.fn(async (value) => value),
    };
    service = new DataProtectionService(
      {} as never, {} as never, auditRepo as never, {} as never, contactRepo as never, reservationRepo as never,
    );
  });

  it('borra el contacto y los identificadores de match de una reserva, conservando fecha y estado', async () => {
    const startsAt = new Date('2026-01-15T20:00:00.000Z');
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000',
      organizationId: 'org-1',
      guestName: 'Ana Perez',
      guestEmail: 'ana@example.com',
      guestPhone: '+56911111111',
      answers: { alergia: 'mani' },
      internalNotes: 'Mesa junto a la ventana',
      fbc: 'fb.1.123', fbp: 'fb.1.456',
      clientIpAddress: '190.0.0.1', clientUserAgent: 'Mozilla/5.0',
      status: 'attended', startsAt,
    });

    const result = await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1');

    expect(result.guestName).toBe('Visitante anonimizado abcdef12');
    expect(result.guestEmail).toBeNull();
    expect(result.guestPhone).toBeNull();
    expect(result.answers).toEqual({});
    expect(result.internalNotes).toBeNull();
    expect(result.fbc).toBeNull();
    expect(result.fbp).toBeNull();
    expect(result.clientIpAddress).toBeNull();
    expect(result.clientUserAgent).toBeNull();
    // La analitica de asistencia depende de estos dos.
    expect(result.status).toBe('attended');
    expect(result.startsAt).toBe(startsAt);
  });

  /*
   * Un RUT identifica a una persona por si solo, y los identificadores de clic reconstruyen su
   * recorrido publicitario: una fila que los conserve no esta anonimizada, aunque el nombre y el
   * correo se hayan ido. Esta prueba fija la lista completa para que ninguno vuelva a quedarse.
   */
  it('borra el documento, la fecha de nacimiento y los identificadores de clic', async () => {
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000',
      organizationId: 'org-1',
      guestName: 'Ana Perez',
      answers: {},
      startsAt: new Date('2026-01-15T20:00:00.000Z'),
      birthDate: '1990-04-21',
      guestDocument: '11.111.111-1',
      guestDocumentType: 'rut',
      guestDocumentCountry: 'CL',
      fbclid: 'IwAR123', gclid: 'Cj0KCQ', gbraid: 'gb-1', wbraid: 'wb-1', clickId: 'legacy-1',
      reservationConsentText: '[v1] Acepto que se guarden mis datos para esta reserva',
    });

    const result = await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1');

    expect(result.birthDate).toBeNull();
    expect(result.guestDocument).toBeNull();
    expect(result.guestDocumentType).toBeNull();
    expect(result.guestDocumentCountry).toBeNull();
    expect(result.fbclid).toBeNull();
    expect(result.gclid).toBeNull();
    expect(result.gbraid).toBeNull();
    expect(result.wbraid).toBeNull();
    expect(result.clickId).toBeNull();
    // La constancia de que se autorizo el tratamiento se conserva: es la clausula, no la persona.
    expect(result.reservationConsentText).toBe('[v1] Acepto que se guarden mis datos para esta reserva');
  });

  /*
   * El evento del calendario del local se titula «<local>: <nombre>», de modo que anonimizar solo
   * la fila dejaria el nombre fuera de la base. Se renombra, no se borra: el trabajo que recupera
   * integraciones busca las reservas sin `calendar_event_id` y volveria a crearlo.
   */
  it('quita el nombre del evento del calendario sin borrar el evento', async () => {
    const calendario = { updateEvent: vi.fn().mockResolvedValue({ existe: true }) };
    const conCalendario = new DataProtectionService(
      {} as never, {} as never, auditRepo as never, {} as never, contactRepo as never,
      reservationRepo as never, {} as never, {} as never, calendario as never,
    );
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000',
      organizationId: 'org-1',
      guestName: 'Ana Perez',
      answers: {},
      referenceCode: 'ABC123',
      calendarEventId: 'evento-google-1',
      startsAt: new Date('2026-01-15T20:00:00.000Z'),
      endsAt: new Date('2026-01-15T21:30:00.000Z'),
    });

    await conCalendario.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1');

    expect(calendario.updateEvent).toHaveBeenCalledWith('org-1', 'evento-google-1', expect.objectContaining({
      summary: 'Reserva ABC123',
      durationMinutes: 90,
    }));
  });

  /* Que Google no responda no puede deshacer una anonimizacion que la ley ya exige cumplida. */
  it('la anonimizacion no falla si el calendario no responde', async () => {
    const calendario = { updateEvent: vi.fn().mockRejectedValue(new Error('Google no responde')) };
    const conCalendario = new DataProtectionService(
      {} as never, {} as never, auditRepo as never, {} as never, contactRepo as never,
      reservationRepo as never, {} as never, {} as never, calendario as never,
    );
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000',
      organizationId: 'org-1',
      guestName: 'Ana Perez',
      answers: {},
      referenceCode: 'ABC123',
      calendarEventId: 'evento-google-1',
      startsAt: new Date('2026-01-15T20:00:00.000Z'),
      endsAt: new Date('2026-01-15T21:30:00.000Z'),
    });

    const result = await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1');
    expect(result.guestEmail).toBeNull();

    await expect(conCalendario.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1')).resolves.toBeDefined();
    expect(auditRepo.save).toHaveBeenCalled();
  });

  it('deja rastro en la bitacora al anonimizar', async () => {
    reservationRepo.findOneBy.mockResolvedValue({
      id: 'abcdef12-0000-0000-0000-000000000000', organizationId: 'org-1',
      guestName: 'Ana', answers: {}, startsAt: new Date(),
    });

    await service.anonymizeReservation('abcdef12-0000-0000-0000-000000000000', 'org-1', 'Solicitud del titular');

    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      action: 'anonymize',
      entityType: 'Reservation',
      reason: 'Solicitud del titular',
    }));
  });

  it('anonimiza el contacto de campana conservando su identidad interna', async () => {
    contactRepo.findOneBy.mockResolvedValue({
      id: 'feedbeef-0000-0000-0000-000000000000', organizationId: 'org-1',
      name: 'Juan Soto', email: 'juan@example.com', phone: '+56922222222',
    });

    const result = await service.anonymizeContact('feedbeef-0000-0000-0000-000000000000', 'org-1');

    expect(result.name).toBe('Contacto anonimizado feedbeef');
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it('omite las reservas ya anonimizadas para poder reejecutar el barrido', async () => {
    reservationRepo.find.mockResolvedValue([
      { id: 'aaaaaaaa-0000-0000-0000-000000000000', organizationId: 'org-1', guestName: 'Visitante anonimizado aaaaaaaa', guestEmail: null, guestPhone: null },
    ]);

    const result = await service.anonymizeExpiredReservations(180);

    expect(result.reviewed).toBe(1);
    expect(result.anonymized).toBe(0);
    expect(reservationRepo.save).not.toHaveBeenCalled();
  });

  describe('la bitácora de lo anonimizado', () => {
    it('vacía el antes y el después de las filas de auditoría de la reserva, menos el rastro de anonimizar', async () => {
      reservationRepo.findOneBy.mockResolvedValue({ id: 'r-1', organizationId: 'org-1', guestName: 'Ana', startsAt: new Date(), endsAt: new Date() });

      await service.anonymizeReservation('r-1', 'org-1');

      const [donde, cambios] = auditRepo.update.mock.calls[0];
      expect(donde).toMatchObject({ organizationId: 'org-1', entityId: 'r-1' });
      expect(donde.action).toBeDefined();
      expect(Object.keys(cambios).sort()).toEqual(['after', 'before']);
    });

    it('al anonimizar a una persona, sus acciones pasan a un seudónimo y no a nulo', async () => {
      const usuarios = { findOneBy: vi.fn().mockResolvedValue({ id: 'u-1', organizationId: 'org-1' }), update: vi.fn() };
      const servicio = new DataProtectionService(usuarios as never, {} as never, auditRepo as never, {} as never, {} as never, {} as never);

      await servicio.anonymizeUser('u-1');

      const cambioDeActor = auditRepo.update.mock.calls.find(([donde]: [any]) => donde.actorId === 'u-1');
      expect(cambioDeActor[1].actorId).toMatch(/^[0-9a-f-]{36}$/);
      expect(cambioDeActor[1].actorId).not.toBe('u-1');
    });
  });
});
