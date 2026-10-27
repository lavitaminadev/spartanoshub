import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';
import { createDataSourceDouble } from '../../helpers/data-source.double';
import { createDestinatariosDeAvisosDouble } from '../../helpers/destinatarios-de-avisos.double';

/**
 * El aviso de solicitud de grupo al equipo avisa y enlaza; no transporta datos de terceros.
 *
 * La excepción —teléfono y correo— depende de la capacidad `detalleDeContactoEnAvisos` de la
 * empresa y de que el destinatario sea una cuenta con nivel `directo`. Las alergias y las
 * respuestas del formulario no salen en ningún caso.
 */
const emails = { send: vi.fn().mockResolvedValue(true) };
const parametros = { get: vi.fn() };
const notificaciones = { notifyMultiple: vi.fn() };

const local = { id: 'form-1', organizationId: 'org-1', clientId: 'client-1', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: {} };
const solicitud = {
  id: 'g-1', guestName: 'Ana Soto', guestEmail: 'ana.privada@example.cl', partySize: 12, cuando: '20 de septiembre',
  ocasion: 'Cumpleaños', telefono: '+56 9 8765 4321', notas: 'Una persona con alergia severa al maní',
};

function servicio(opciones: { capacidad: boolean; casillas: string[]; directos?: string[] }) {
  const vacio = {} as never;
  const dataSource = createDataSourceDouble({
    'FROM clients': [{ capabilities: JSON.stringify({ detalleDeContactoEnAvisos: opciones.capacidad }) }],
  });
  return new ReservationsService(
    vacio, vacio, vacio, vacio, vacio, vacio, dataSource, vacio, vacio, vacio,
    vacio, emails as never, notificaciones as never, vacio, vacio, vacio, parametros as never, vacio, vacio,
    vacio, createDestinatariosDeAvisosDouble(opciones.casillas, opciones.directos),
  );
}
const avisar = (s: ReservationsService) =>
  (s as unknown as { avisarSolicitudSinCupo: (f: unknown, t: 'grupo', d: unknown) => Promise<void> })
    .avisarSolicitudSinCupo(local, 'grupo', { ...solicitud });

/** Lo que recibió cada dirección del equipo (el acuse a la persona se excluye). */
function alEquipo(): Record<string, string> {
  return Object.fromEntries(
    emails.send.mock.calls.filter(([para]) => para !== solicitud.guestEmail).map(([para, , html]) => [para, String(html)]),
  );
}
const espera = () => new Promise((r) => setTimeout(r, 0));

describe('aviso de solicitud de grupo al equipo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parametros.get.mockImplementation(() => Promise.resolve(null));
  });

  it('con la capacidad apagada sale sin teléfono ni correo', async () => {
    await avisar(servicio({ capacidad: false, casillas: ['buzon@local.cl', 'ana.directa@agencia.cl'], directos: ['ana.directa@agencia.cl'] }));
    await espera();
    const recibidos = alEquipo();
    expect(Object.keys(recibidos)).toHaveLength(2);
    for (const html of Object.values(recibidos)) {
      expect(html).toContain('Ana Soto');
      expect(html).toContain('Reservas → Grupos y eventos');
      expect(html).not.toContain('8765');
      expect(html).not.toContain('ana.privada@example.cl');
    }
  });

  it('encendida, una dirección suelta igual lo recibe recortado', async () => {
    await avisar(servicio({ capacidad: true, casillas: ['buzon@local.cl'], directos: [] }));
    await espera();
    const html = alEquipo()['buzon@local.cl'];
    expect(html).toContain('Ana Soto');
    expect(html).not.toContain('8765');
    expect(html).not.toContain('ana.privada@example.cl');
  });

  it('encendida, sólo la cuenta con nivel directo recibe el contacto', async () => {
    await avisar(servicio({ capacidad: true, casillas: ['buzon@local.cl', 'ana.directa@agencia.cl'], directos: ['ana.directa@agencia.cl'] }));
    await espera();
    const recibidos = alEquipo();
    expect(recibidos['ana.directa@agencia.cl']).toContain('+56 9 8765 4321');
    expect(recibidos['ana.directa@agencia.cl']).toContain('ana.privada@example.cl');
    expect(recibidos['buzon@local.cl']).not.toContain('8765');
    expect(recibidos['buzon@local.cl']).not.toContain('ana.privada@example.cl');
  });

  it('las respuestas del formulario y lo que contó no salen, esté encendida o no', async () => {
    for (const capacidad of [false, true]) {
      emails.send.mockClear();
      await avisar(servicio({ capacidad, casillas: ['buzon@local.cl', 'ana.directa@agencia.cl'], directos: ['ana.directa@agencia.cl'] }));
      await espera();
      for (const html of Object.values(alEquipo())) {
        expect(html).not.toContain('alergia');
        expect(html).not.toContain('maní');
      }
    }
  });

  it('si no se puede leer la capacidad, recorta', async () => {
    const s = servicio({ capacidad: true, casillas: ['ana.directa@agencia.cl'], directos: ['ana.directa@agencia.cl'] });
    (s as unknown as { dataSource: { query: unknown } }).dataSource.query = vi.fn().mockRejectedValue(new Error('caída'));
    await avisar(s);
    await espera();
    expect(alEquipo()['ana.directa@agencia.cl'] ?? '').not.toContain('8765');
  });
});
