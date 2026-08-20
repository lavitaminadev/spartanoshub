import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

describe('UpdateLeadUseCase', () => {
  it('requires client conversion before marking a lead as won', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue({ id: 'lead-1', status: LeadStatus.NEGOTIATION }),
      save: vi.fn(),
    };
    const useCase = new UpdateLeadUseCase(repo as never, createProcessHistoryDouble());

    await expect(useCase.execute('lead-1', { status: LeadStatus.WON }, 'org-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows a converted lead to remain in the won stage', async () => {
    const lead = { id: 'lead-1', domain: 'commercial', status: LeadStatus.NEGOTIATION, convertedToClientId: 'client-1' };
    const repo = {
      findOne: vi.fn().mockResolvedValue(lead),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const useCase = new UpdateLeadUseCase(repo as never, createProcessHistoryDouble());

    const result = await useCase.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(result.status).toBe(LeadStatus.WON);
    expect(repo.save).toHaveBeenCalledWith(lead);
  });
describe('CRM-09 · el estado corresponde al dominio del lead', () => {
    function useCaseFor(lead: Record<string, unknown>) {
      const repo = {
        findOne: vi.fn().mockResolvedValue(lead),
        save: vi.fn().mockImplementation(async (value) => value),
      };
      return { useCase: new UpdateLeadUseCase(repo as never, createProcessHistoryDouble()), repo };
    }

    it('rechaza marcar a un comensal con un estado del embudo comercial', async () => {
      // El caso concreto que estaba abierto: por API se podia poner "negotiation" a quien solo
      // reservo una mesa, y aparecia en el pronostico comercial.
      const { useCase, repo } = useCaseFor({ id: 'lead-1', domain: 'audience', status: LeadStatus.RESERVED });

      await expect(useCase.execute('lead-1', { status: LeadStatus.NEGOTIATION }, 'org-1'))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza marcar a un prospecto comercial con un estado de reserva', async () => {
      const { useCase, repo } = useCaseFor({ id: 'lead-1', domain: 'commercial', status: LeadStatus.CONTACTED });

      await expect(useCase.execute('lead-1', { status: LeadStatus.ATTENDED }, 'org-1'))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('acepta el ciclo propio de cada dominio', async () => {
      const audience = useCaseFor({ id: 'lead-1', domain: 'audience', status: LeadStatus.RESERVED });
      const attended = await audience.useCase.execute('lead-1', { status: LeadStatus.ATTENDED }, 'org-1');
      expect(attended.status).toBe(LeadStatus.ATTENDED);

      const commercial = useCaseFor({ id: 'lead-2', domain: 'commercial', status: LeadStatus.CONTACTED });
      const quoted = await commercial.useCase.execute('lead-2', { status: LeadStatus.QUOTE_SENT }, 'org-1');
      expect(quoted.status).toBe(LeadStatus.QUOTE_SENT);
    });

    it('un lead sin dominio no acepta ningun estado', async () => {
      // Preferible rechazar un lead con el dominio mal escrito a dejar pasar cualquier cosa.
      const { useCase } = useCaseFor({ id: 'lead-1', status: LeadStatus.NEW });

      await expect(useCase.execute('lead-1', { status: LeadStatus.CONTACTED }, 'org-1'))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('UpdateLeadUseCase · responsable del lead', () => {
  function useCaseFor(lead: Record<string, unknown>) {
    const repo = {
      findOne: vi.fn().mockResolvedValue(lead),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    return { useCase: new UpdateLeadUseCase(repo as never, createProcessHistoryDouble()), repo };
  }

  it('asigna el responsable que llega en la petición', async () => {
    const { useCase } = useCaseFor({ id: 'lead-1', domain: 'commercial', status: LeadStatus.NEW });

    // La columna existía desde el principio y no había forma de escribirla: todos los leads
    // quedaban «Sin asignar» para siempre.
    const guardado = await useCase.execute('lead-1', { assignedTo: 'user-1' }, 'org-1');

    expect(guardado.assignedTo).toBe('user-1');
  });

  it('devuelve el lead a la bandeja común cuando el responsable llega en null', async () => {
    const { useCase } = useCaseFor({ id: 'lead-1', domain: 'commercial', status: LeadStatus.NEW, assignedTo: 'user-1' });

    const guardado = await useCase.execute('lead-1', { assignedTo: null }, 'org-1');

    expect(guardado.assignedTo).toBeUndefined();
  });

  it('no toca el responsable cuando el campo no viene', async () => {
    const { useCase } = useCaseFor({ id: 'lead-1', domain: 'commercial', status: LeadStatus.NEW, assignedTo: 'user-1' });

    // `null` y ausente son dos intenciones distintas: si se colapsaran, guardar una nota
    // desasignaría el lead sin que nadie lo pidiera.
    const guardado = await useCase.execute('lead-1', { notes: 'Llamado el martes' }, 'org-1');

    expect(guardado.assignedTo).toBe('user-1');
  });
});
