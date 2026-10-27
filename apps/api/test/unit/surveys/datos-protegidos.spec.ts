import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { SurveysController } from '../../../src/modules/surveys/surveys.controller';

const RESPUESTA = {
  id: 'r1', surveyId: 'e1', respondentId: 'public:link:x', respondentName: 'Ana Pérez', respondentEmail: 'ana@correo.cl',
  answers: { tel: '+56911112222' }, submittedAt: new Date('2026-05-01'), rating: 5, teamMessage: 'Todo bien',
};

type Resultado = { respuestas: Array<Record<string, unknown>>; datosProtegidos: unknown };

function controlador(nivel: 'oculto' | 'bajo_registro' | 'directo', anonymous = false) {
  const encuesta = {
    id: 'e1', organizationId: 'org', clientId: 'empresa-1', title: 'Encuesta', type: 'internal', status: 'active',
    questions: [
      { id: 'nota', type: 'rating', question: '¿Cómo fue?', required: true },
      { id: 'tel', type: 'text', question: 'Tu teléfono', required: false, dato: 'telefono' },
    ],
    createdAt: new Date(), createdBy: 'u1', responseCount: 1, anonymous,
  };
  const surveys = { findOne: vi.fn().mockResolvedValue(encuesta) };
  const responses = { find: vi.fn().mockResolvedValue([{ ...RESPUESTA }]), findOne: vi.fn().mockResolvedValue({ ...RESPUESTA }) };
  const dataSource = { query: vi.fn().mockResolvedValue([]) };
  const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(undefined), assertClient: vi.fn() };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const niveles = { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos(nivel)) };
  const controller = new SurveysController(
    surveys as never, responses as never, dataSource as never, accountAccess as never, {} as never,
    audit as never, {} as never, {} as never, niveles as never,
  );
  const req = { organizationId: 'org', user: { id: 'u1', role: 'admin' }, ip: '10.0.0.1' } as never;
  return { controller, audit, req };
}

describe('Encuestas: quién respondió', () => {
  it('con nivel oculto los resultados no traen nombre ni correo, pero sí la nota y el mensaje', async () => {
    const { controller, req } = controlador('oculto');
    const resultado = await controller.results(req, 'e1') as never as Resultado;
    const texto = JSON.stringify(resultado);
    expect(texto).not.toContain('Ana Pérez');
    expect(texto).not.toContain(RESPUESTA.respondentEmail);
    // El teléfono lo dio en una pregunta de contacto: viaja dentro de las respuestas y también se recorta.
    expect(texto).not.toContain('+56911112222');
    expect(resultado.respuestas[0]).toMatchObject({ rating: 5, teamMessage: 'Todo bien' });
    expect(resultado.datosProtegidos).toMatchObject({ sePuedePedir: false });
  });

  it('con directo todo queda como siempre', async () => {
    const { controller, req } = controlador('directo');
    const resultado = await controller.results(req, 'e1') as never as Resultado;
    expect(resultado.respuestas[0].respondentEmail).toBe(RESPUESTA.respondentEmail);
    expect(resultado.datosProtegidos).toBeNull();
  });

  it('en una encuesta anónima no dice «protegido»: no hay nada que proteger', async () => {
    const { controller, req } = controlador('bajo_registro', true);
    const resultado = await controller.results(req, 'e1') as never as Resultado;
    expect(resultado.respuestas[0].respondentName).toBeNull();
    expect(resultado.datosProtegidos).toBeNull();
  });

  it('pedir ver quién respondió deja constancia antes de entregarlo', async () => {
    const { controller, audit, req } = controlador('bajo_registro');
    const respuesta = await controller.datosProtegidos(req, 'e1', 'r1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org', actorId: 'u1', entityType: 'survey_responses', entityId: 'r1', action: 'reveal_protected_data',
    }));
    expect(respuesta.datos).toMatchObject({ respondentName: 'Ana Pérez', respondentEmail: RESPUESTA.respondentEmail, respondentPhone: '+56911112222' });
  });

  it('con oculto no entrega nada ni anota nada', async () => {
    const { controller, audit, req } = controlador('oculto');
    await expect(controller.datosProtegidos(req, 'e1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
