import { describe, expect, it, vi } from 'vitest';
import { LeadCierreService } from '../../../src/modules/crm/leads/lead-cierre.service';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

function servicio() {
  const notificaciones = { notifyUser: vi.fn().mockResolvedValue(undefined) };
  return { service: new LeadCierreService(notificaciones as never), notificaciones };
}

const lead = (extra: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  organizationId: 'org-1',
  name: 'Ana Pérez',
  assignedTo: 'user-duenio',
  status: LeadStatus.WON,
  ...extra,
} as never);

describe('LeadCierreService · avisar cuando un lead termina', () => {
  it('avisa a quien lo tenía asignado', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(lead(), LeadStatus.NEGOTIATION, 'otra-persona');

    expect(notificaciones.notifyUser).toHaveBeenCalledOnce();
    const [orgId, userId, tipo, titulo] = notificaciones.notifyUser.mock.calls[0];
    expect(orgId).toBe('org-1');
    expect(userId).toBe('user-duenio');
    expect(tipo).toBe('crm.lead.cerrado');
    expect(titulo).toContain('Ana Pérez');
  });

  it('no avisa a quien acaba de hacerlo: ya lo sabe', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(lead(), LeadStatus.NEGOTIATION, 'user-duenio');
    expect(notificaciones.notifyUser).not.toHaveBeenCalled();
  });

  it('no avisa si el lead no tiene dueño: no hay a quién', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(lead({ assignedTo: null }), LeadStatus.NEGOTIATION, 'otra');
    expect(notificaciones.notifyUser).not.toHaveBeenCalled();
  });

  it('no avisa cuando la etapa no cambió, o avisaría en cada guardado', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(lead(), LeadStatus.WON, 'otra');
    expect(notificaciones.notifyUser).not.toHaveBeenCalled();
  });

  it('no avisa por una etapa que no es un cierre', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(lead({ status: LeadStatus.CONTACTED }), LeadStatus.NEW, 'otra');
    expect(notificaciones.notifyUser).not.toHaveBeenCalled();
  });

  it('avisa también de los cierres del ciclo de reserva', async () => {
    for (const estado of [LeadStatus.ATTENDED, LeadStatus.NO_SHOW, LeadStatus.LOST]) {
      const { service, notificaciones } = servicio();
      await service.avisar(lead({ status: estado }), LeadStatus.NEW, 'otra');
      expect(notificaciones.notifyUser, estado).toHaveBeenCalledOnce();
    }
  });

  it('el motivo de descarte viaja en el mensaje: sin él el aviso no explica nada', async () => {
    const { service, notificaciones } = servicio();
    await service.avisar(
      lead({ status: LeadStatus.LOST, discardReason: 'Precio fuera de presupuesto' }),
      LeadStatus.NEGOTIATION, 'otra',
    );
    expect(notificaciones.notifyUser.mock.calls[0][4]).toContain('Precio fuera de presupuesto');
  });

  it('un aviso que falla no tumba el guardado, que ya está escrito', async () => {
    const notificaciones = { notifyUser: vi.fn().mockRejectedValue(new Error('sin correo')) };
    const service = new LeadCierreService(notificaciones as never);
    await expect(service.avisar(lead(), LeadStatus.NEGOTIATION, 'otra')).resolves.toBeUndefined();
  });
});
