import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { In } from 'typeorm';
import { ContactsService } from '../../../src/modules/crm/contacts/contacts.service';

function serviceWith(repo: Partial<Record<string, unknown>>, dataSource: Partial<Record<string, unknown>> = {}) {
  return new ContactsService(repo as never, dataSource as never);
}

describe('ContactsService — alcance por cuenta', () => {
  it('acota el listado a las cuentas permitidas cuando no se pide una en concreto', async () => {
    const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };

    await serviceWith(repo).findAll('org-1', 50, 0, undefined, ['client-1', 'client-2']);

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', clientId: In(['client-1', 'client-2']) } }),
    );
  });

  it('no consulta la base cuando la persona no alcanza ninguna cuenta', async () => {
    const repo = { findAndCount: vi.fn() };

    const result = await serviceWith(repo).findAll('org-1', 50, 0, undefined, []);

    // Sin esta rama, un alcance vacío caeria al `where` sin clientId y devolveria la
    // organizacion entera, que es justo lo contrario de lo que pide un alcance vacio.
    expect(repo.findAndCount).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it('deja pasar la consulta sin filtro de cuenta solo cuando el alcance es ilimitado', async () => {
    const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };

    await serviceWith(repo).findAll('org-1', 50, 0, undefined, undefined);

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('vacia el resultado cuando se pide una cuenta fuera del alcance', async () => {
    const repo = { findAndCount: vi.fn() };

    const result = await serviceWith(repo).findAll('org-1', 50, 0, 'client-9', ['client-1']);

    expect(repo.findAndCount).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('oculta un contacto de otra cuenta tras un 404, sin confirmar que existe', async () => {
    const repo = { findOne: vi.fn().mockResolvedValue({ id: 'contact-1', clientId: 'client-9' }) };

    await expect(serviceWith(repo).findOne('contact-1', 'org-1', ['client-1']))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('oculta un contacto sin cuenta asignada a quien esta acotado', async () => {
    const repo = { findOne: vi.fn().mockResolvedValue({ id: 'contact-1', clientId: null }) };

    await expect(serviceWith(repo).findOne('contact-1', 'org-1', ['client-1']))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve el contacto cuando su cuenta esta dentro del alcance', async () => {
    const contact = { id: 'contact-1', clientId: 'client-1' };
    const repo = { findOne: vi.fn().mockResolvedValue(contact) };

    await expect(serviceWith(repo).findOne('contact-1', 'org-1', ['client-1'])).resolves.toBe(contact);
  });

  it('acota los segmentos a las cuentas permitidas y pasa los ids como parametros', async () => {
    const query = vi.fn().mockResolvedValue([{ total: 0 }]);
    const service = serviceWith({}, { query });

    await service.segments('org-1', undefined, ['client-1', 'client-2']);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('l.client_id IN (?,?)');
    expect(params).toEqual(['org-1', 'client-1', 'client-2']);
  });

  it('CRM-01 · los segmentos cuentan la misma poblacion que lista la pantalla', async () => {
    // La lista y los contadores salen de `leads`; los segmentos salian de `crm_contacts`. Los
    // dos numeros del mismo encabezado no cuadraban en cuanto un lead de audiencia no tenia
    // contacto derivado, o al reves, y nada lo explicaba en pantalla.
    const query = vi.fn().mockResolvedValue([{ total: 0 }]);

    await serviceWith({}, { query }).segments('org-1');

    const [sql] = query.mock.calls[0];
    expect(sql).toContain('FROM leads l');
    expect(sql).toContain("l.domain = 'audience'");
    // El vinculo con las reservas sigue pasando por el contacto, que es donde vive contact_id.
    expect(sql).toContain('LEFT JOIN crm_contacts c ON c.lead_id = l.id');
  });

  it('devuelve los cuatro segmentos en cero cuando no hay cuentas alcanzables', async () => {
    const query = vi.fn();
    const service = serviceWith({}, { query });

    const segments = await service.segments('org-1', undefined, []);

    expect(query).not.toHaveBeenCalled();
    expect(segments).toHaveLength(4);
    expect(segments.every((segment) => segment.count === 0)).toBe(true);
  });
});
