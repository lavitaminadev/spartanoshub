import { describe, expect, it, vi } from 'vitest';
import { LeadTaskSummaryService } from '../../../src/modules/crm/leads/lead-task-summary.service';

function servicio(tareas: Array<Record<string, unknown>>) {
  const repo = { find: vi.fn().mockResolvedValue(tareas) };
  return { service: new LeadTaskSummaryService(repo as never), repo };
}

const ayer = new Date(Date.now() - 86_400_000);
const manana = new Date(Date.now() + 86_400_000);

describe('LeadTaskSummaryService', () => {
  it('sin leads no consulta nada', async () => {
    const { service, repo } = servicio([]);
    await expect(service.porLead('org-1', [])).resolves.toEqual(new Map());
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('el próximo paso es la tarea que vence antes, no la primera creada', async () => {
    const { service } = servicio([
      { entityId: 'lead-1', title: 'Llamar la próxima semana', dueAt: manana },
      { entityId: 'lead-1', title: 'Confirmar hoy', dueAt: ayer },
    ]);
    const resumen = await service.porLead('org-1', ['lead-1']);
    expect(resumen.get('lead-1')?.nextStep?.title).toBe('Confirmar hoy');
    expect(resumen.get('lead-1')?.openTasks).toBe(2);
  });

  it('una tarea con plazo desplaza a una sin plazo', async () => {
    const { service } = servicio([
      { entityId: 'lead-1', title: 'Revisar cuando se pueda', dueAt: null },
      { entityId: 'lead-1', title: 'Enviar propuesta', dueAt: manana },
    ]);
    const resumen = await service.porLead('org-1', ['lead-1']);
    expect(resumen.get('lead-1')?.nextStep?.title).toBe('Enviar propuesta');
  });

  it('marca vencido lo que ya pasó de fecha', async () => {
    const { service } = servicio([{ entityId: 'lead-1', title: 'Llamar', dueAt: ayer }]);
    const resumen = await service.porLead('org-1', ['lead-1']);
    expect(resumen.get('lead-1')?.nextStep?.overdue).toBe(true);
  });

  it('no mezcla las tareas de un lead con las de otro', async () => {
    const { service } = servicio([
      { entityId: 'lead-1', title: 'Uno', dueAt: manana },
      { entityId: 'lead-2', title: 'Dos', dueAt: manana },
    ]);
    const resumen = await service.porLead('org-1', ['lead-1', 'lead-2']);
    expect(resumen.get('lead-1')?.openTasks).toBe(1);
    expect(resumen.get('lead-2')?.nextStep?.title).toBe('Dos');
  });
});
