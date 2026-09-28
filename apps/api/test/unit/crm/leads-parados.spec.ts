import { describe, expect, it, vi } from 'vitest';
import { LeadsParadosJob } from '../../../src/core/jobs/cron/leads-parados.job';

/**
 * Un prospecto parado avisa, tenga dueño o no.
 *
 * El aviso se saltaba los leads sin responsable porque no había a quién mandárselo, y eso
 * funcionaba mientras todo lead nacía asignado. Desde que entran sin dueño, saltárselos dejaría
 * sin vigilancia justo lo que nadie ha tomado.
 *
 * Importa además para Meta: la ventana de atribución son 28 días desde que el lead se generó, y
 * estas alertas son lo que evita que los cruce sin que nadie los trabaje.
 */
function montar(leads: Array<Record<string, unknown>>, hayDireccionComercial = true) {
  const notificaciones = {
    create: vi.fn((valor: unknown) => valor),
    save: vi.fn(async (valor: unknown) => valor),
  };
  const repoLeads = {
    find: vi.fn().mockResolvedValue(leads),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const usuarios = {
    findOne: vi.fn().mockResolvedValue(hayDireccionComercial ? { id: 'direccion-comercial' } : null),
  };
  // Los plazos de fábrica: 3, 5 y 7 días.
  const parametros = { getManyForOrganization: vi.fn().mockResolvedValue(new Map()) };

  const job = new LeadsParadosJob(
    repoLeads as never, notificaciones as never, usuarios as never, parametros as never,
  );
  return { job, notificaciones, repoLeads, usuarios };
}

/** Un lead cuya etapa no se mueve desde hace `dias`. */
function parado(dias: number, extra: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    organizationId: 'org-1',
    name: 'Ana Pérez',
    status: 'new',
    assignedTo: null,
    stageChangedAt: new Date(Date.now() - dias * 86_400_000),
    createdAt: new Date(Date.now() - dias * 86_400_000),
    idleAlertedLevel: null,
    ...extra,
  };
}

describe('alerta de prospectos parados', () => {
  it('la consulta no descarta los que no tienen responsable', async () => {
    /*
     * Se comprueba el filtro y no solo el resultado: el repositorio simulado devuelve lo que se
     * le pida, así que sin mirar la condición la prueba pasaría aunque la consulta volviera a
     * excluir a los huérfanos.
     */
    const { job, repoLeads } = montar([]);

    await job.handle();

    const consulta = repoLeads.find.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(consulta.where).not.toHaveProperty('assignedTo');
  });

  it('avisa a quien dirige el CRM cuando el lead no tiene responsable', async () => {
    const { job, notificaciones } = montar([parado(6)]);

    await job.handle();

    expect(notificaciones.save).toHaveBeenCalledTimes(1);
    const aviso = notificaciones.save.mock.calls[0][0] as Record<string, unknown>;
    expect(aviso.userId).toBe('direccion-comercial');
    expect(aviso.title).toBe('Prospecto sin responsable');
    expect((aviso.data as { sinResponsable: boolean }).sinResponsable).toBe(true);
  });

  it('avisa al responsable cuando lo tiene, con el mensaje de siempre', async () => {
    const { job, notificaciones } = montar([parado(6, { assignedTo: 'ejecutivo-1' })]);

    await job.handle();

    const aviso = notificaciones.save.mock.calls[0][0] as Record<string, unknown>;
    expect(aviso.userId).toBe('ejecutivo-1');
    expect(aviso.title).not.toBe('Prospecto sin responsable');
  });

  it('no marca como avisado lo que no pudo avisar', async () => {
    // Sin ningún cargo que reciba el aviso, el lead sigue esperándolo en la próxima pasada.
    const { job, notificaciones, repoLeads } = montar([parado(6)], false);

    await job.handle();

    expect(notificaciones.save).not.toHaveBeenCalled();
    expect(repoLeads.update).not.toHaveBeenCalled();
  });

  it('un lead recién movido no avisa', async () => {
    const { job, notificaciones } = montar([parado(1, { assignedTo: 'ejecutivo-1' })]);

    await job.handle();

    expect(notificaciones.save).not.toHaveBeenCalled();
  });
});

/*
 * El correo del lead parado.
 *
 * El interruptor existía en Correos pero ningún código lo leía: sólo salía la notificación. Ahora
 * el correo sale si está encendido, y la notificación dentro de la aplicación sale siempre.
 */
describe('alerta de lead parado · correo', () => {
  function conCorreo(encendido: boolean | null) {
    const notificaciones = { create: vi.fn((valor: unknown) => valor), save: vi.fn(async (valor: unknown) => valor) };
    const repoLeads = { find: vi.fn().mockResolvedValue([parado(10, { assignedTo: 'ejecutiva-1' })]), update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const usuarios = { findOne: vi.fn().mockResolvedValue({ id: 'ejecutiva-1', name: 'Camila Rojas', email: 'camila@agencia.cl' }) };
    const parametros = {
      getManyForOrganization: vi.fn().mockResolvedValue(new Map()),
      get: vi.fn(async (clave: string) => (clave === 'email.idle_lead_enabled' ? encendido : null)),
    };
    const correo = { send: vi.fn().mockResolvedValue(true) };
    const job = new LeadsParadosJob(repoLeads as never, notificaciones as never, usuarios as never, parametros as never, correo as never);
    return { job, notificaciones, correo };
  }

  it('encendido, manda el correo al responsable además de la notificación', async () => {
    const { job, notificaciones, correo } = conCorreo(true);
    await job.handle();

    expect(notificaciones.save).toHaveBeenCalled();
    expect(correo.send).toHaveBeenCalledWith('camila@agencia.cl', expect.stringContaining('Ana Pérez'), expect.any(String));
  });

  it('apagado, sale sólo la notificación dentro de la aplicación', async () => {
    const { job, notificaciones, correo } = conCorreo(false);
    await job.handle();

    expect(notificaciones.save).toHaveBeenCalled();
    expect(correo.send).not.toHaveBeenCalled();
  });

  it('sin valor guardado queda apagado, como vino de fábrica', async () => {
    const { job, correo } = conCorreo(null);
    await job.handle();

    expect(correo.send).not.toHaveBeenCalled();
  });
});
