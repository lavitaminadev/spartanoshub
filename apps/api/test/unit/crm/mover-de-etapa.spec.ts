import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { createLeadCierreDouble } from '../../helpers/lead-cierre.double';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * Arrastrar una tarjeta: qué lo acepta y qué lo rechaza.
 *
 * Cuando el servidor rechaza el movimiento, la tarjeta vuelve a su columna y en pantalla se lee
 * como que «no guarda». Son tres motivos distintos con tres remedios distintos, y confundirlos
 * lleva a repetir el gesto en vez de corregir la causa. Esta prueba fija los tres y su mensaje,
 * para que el texto que aparece en pantalla identifique cuál es sin tener que abrir la consola.
 */
function caso(lead: Record<string, unknown>) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(lead),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  return { uso: new UpdateLeadUseCase(repo as never, createProcessHistoryDouble(), createLeadCierreDouble(), { emit: () => true } as never), repo };
}

describe('mover un lead de etapa', () => {
  it('un prospecto de la agencia recorre el embudo comercial', async () => {
    const { uso, repo } = caso({ id: 'l1', domain: 'commercial', status: LeadStatus.MEETING_SCHEDULED });
    const resultado = await uso.execute('l1', { status: LeadStatus.NEGOTIATION }, 'org-1');
    expect(resultado.status).toBe(LeadStatus.NEGOTIATION);
    expect(repo.save).toHaveBeenCalled();
  });

  it('un contacto de campaña recorre el ciclo de la visita', async () => {
    const { uso } = caso({ id: 'l1', domain: 'audience', status: LeadStatus.NEW });
    const resultado = await uso.execute('l1', { status: LeadStatus.RESERVED }, 'org-1');
    expect(resultado.status).toBe(LeadStatus.RESERVED);
  });

  /*
   * Motivo 1: el estado no pertenece al embudo del lead.
   *
   * Es lo que ocurría cuando el tablero de una empresa cliente dibujaba las columnas del embudo
   * comercial. Si el aviso de pantalla dice esto, lo que hay delante es una versión anterior de
   * la interfaz contra un servidor ya actualizado.
   */
  it('rechaza un estado comercial sobre un contacto de campaña, y dice por qué', async () => {
    const { uso, repo } = caso({ id: 'l1', domain: 'audience', status: LeadStatus.NEW });
    await expect(uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1'))
      .rejects.toThrow(/no corresponde a un lead de/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza un estado del ciclo de reserva sobre un prospecto de la agencia', async () => {
    const { uso } = caso({ id: 'l1', domain: 'commercial', status: LeadStatus.NEW });
    await expect(uso.execute('l1', { status: LeadStatus.ATTENDED }, 'org-1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca «Venta» como éxito sin convertir a la persona en empresa cliente', async () => {
    const { uso, repo } = caso({ id: 'l1', domain: 'commercial', status: LeadStatus.NEGOTIATION });
    const resultado = await uso.execute('l1', { status: LeadStatus.WON }, 'org-1');
    expect(resultado.status).toBe(LeadStatus.WON);
    expect(resultado.convertedToClientId).toBeUndefined();
    expect(repo.save).toHaveBeenCalled();
  });

  /*
   * Motivo 3: el estado no existe en el servidor.
   *
   * Lo detiene el validador del DTO antes de llegar acá, y su mensaje habla de «valores
   * permitidos» sin nombrar el embudo. Si el aviso dice eso, la interfaz está más adelantada que
   * la API: se desplegó la web y no el servidor.
   */
  it('un estado que el servidor no conoce no llega a guardarse', async () => {
    const { uso, repo } = caso({ id: 'l1', domain: 'commercial', status: LeadStatus.NEW });
    await uso.execute('l1', { status: 'etapa_inventada' }, 'org-1');
    // El use-case lo ignora en vez de escribirlo: quien valida el catálogo es el DTO.
    expect(repo.save.mock.calls[0][0].status).toBe(LeadStatus.NEW);
  });
});
