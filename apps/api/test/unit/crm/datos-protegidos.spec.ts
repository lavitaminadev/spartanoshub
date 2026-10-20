import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { ContactsController } from '../../../src/modules/crm/contacts/contacts.controller';
import { LeadController } from '../../../src/modules/crm/leads/lead.controller';

const LEAD = { id: 'lead-1', clientId: 'empresa-1', name: 'Ana', phone: '+56911112222', email: 'ana@correo.cl', status: 'new', createdAt: new Date() };

function controladorDeLeads(nivel: 'oculto' | 'bajo_registro' | 'directo') {
  const getLead = { execute: vi.fn().mockResolvedValue({ ...LEAD }) };
  const listLeads = { execute: vi.fn().mockResolvedValue({ data: [{ ...LEAD }], total: 1 }) };
  const accountAccess = {
    allowedClientIds: vi.fn().mockResolvedValue(undefined),
    empresaDeTrabajo: vi.fn().mockResolvedValue(undefined),
    assertClient: vi.fn(),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const niveles = { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos(nivel)) };
  const controller = new LeadController(
    {} as never, listLeads as never, getLead as never, {} as never, {} as never, {} as never,
    {} as never, accountAccess as never, {} as never,
    { porLead: vi.fn().mockResolvedValue(new Map()) } as never,
    { getManyForOrganization: vi.fn().mockResolvedValue(new Map()) } as never,
    { assert: vi.fn(), filtrar: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never, niveles as never, audit as never,
  );
  const req = { organizationId: 'org-1', user: { id: 'user-1', role: 'admin' }, ip: '10.0.0.1', query: {} } as never;
  return { controller, audit, req };
}

describe('CRM: datos protegidos del prospecto en lo que sale del servidor', () => {
  it('con nivel oculto el listado no trae el teléfono ni el correo, y dice que no se puede pedir', async () => {
    const { controller, req } = controladorDeLeads('oculto');
    const respuesta = await controller.list({} as never, req);
    const texto = JSON.stringify(respuesta);
    expect(texto).not.toContain(LEAD.phone);
    expect(texto).not.toContain(LEAD.email);
    expect(respuesta.data[0]).toMatchObject({ name: 'Ana', datosProtegidos: { sePuedePedir: false } });
  });

  it('con nivel oculto la ficha tampoco trae el teléfono', async () => {
    const { controller, req } = controladorDeLeads('oculto');
    const ficha = await controller.getById('lead-1', req);
    expect(JSON.stringify(ficha)).not.toContain(LEAD.phone);
  });

  it('con bajo_registro va recortado pero se puede pedir', async () => {
    const { controller, req } = controladorDeLeads('bajo_registro');
    const recortado = await controller.getById('lead-1', req);
    expect(JSON.stringify(recortado)).not.toContain(LEAD.phone);
    expect(recortado.datosProtegidos).toMatchObject({ sePuedePedir: true });
  });

  it('con directo la respuesta queda como siempre', async () => {
    const { controller, req } = controladorDeLeads('directo');
    const completo = await controller.getById('lead-1', req);
    expect(completo.phone).toBe(LEAD.phone);
    expect(completo).not.toHaveProperty('datosProtegidos');
  });

  it('pedir la revelación con bajo_registro deja constancia de quién y de qué lead antes de entregar', async () => {
    const { controller, audit, req } = controladorDeLeads('bajo_registro');
    const respuesta = await controller.datosProtegidos('lead-1', req);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', actorId: 'user-1', entityType: 'leads', entityId: 'lead-1', action: 'reveal_protected_data',
    }));
    expect(respuesta.datos).toMatchObject({ phone: LEAD.phone, email: LEAD.email });
  });

  it('si la constancia no se puede escribir, el dato no sale', async () => {
    const { controller, audit, req } = controladorDeLeads('bajo_registro');
    audit.log.mockRejectedValue(new Error('base caída'));
    await expect(controller.datosProtegidos('lead-1', req)).rejects.toThrow('base caída');
  });

  it('con oculto no entrega nada ni anota nada', async () => {
    const { controller, audit, req } = controladorDeLeads('oculto');
    await expect(controller.datosProtegidos('lead-1', req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('CRM: contactos', () => {
  it('con nivel oculto el listado no trae correo ni teléfono', async () => {
    const service = { findAll: vi.fn().mockResolvedValue({ data: [{ id: 'c1', clientId: 'empresa-1', name: 'Ana', phone: LEAD.phone, email: LEAD.email }], total: 1, limit: 50, offset: 0 }) };
    const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(undefined), assertClient: vi.fn() };
    const controller = new ContactsController(
      service as never, accountAccess as never, {} as never,
      { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos('oculto')) } as never, { log: vi.fn() } as never,
    );
    const respuesta = await controller.findAll({} as never, { organizationId: 'org-1', user: { id: 'u', role: 'admin' }, query: {} } as never);
    expect(JSON.stringify(respuesta)).not.toContain(LEAD.phone);
    expect(JSON.stringify(respuesta)).not.toContain(LEAD.email);
  });
});
