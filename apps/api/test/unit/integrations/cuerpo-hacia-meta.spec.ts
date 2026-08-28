import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { MetaConversionsService } from '../../../src/modules/integrations/meta/meta-conversions.service';

/**
 * Qué sale exactamente por el cable hacia Meta.
 *
 * Estas pruebas miran el cuerpo del POST y no el modelo interno: entre uno y otro hay una
 * traducción de nombres y un hasheo, y comprobar solo el modelo dejaría sin vigilar justo el
 * tramo donde una fuga sería irreversible.
 *
 * Fallan si alguien vuelve a enviar correo o teléfono sin hashear, que es su razón de existir.
 */
const SHA256 = /^[a-f0-9]{64}$/;

function servicio() {
  const enviados: Record<string, any>[] = [];
  const http = {
    post: vi.fn((_url: string, cuerpo: Record<string, any>) => {
      enviados.push(cuerpo);
      return of({ data: { events_received: 1 } });
    }),
  };
  return { servicio: new MetaConversionsService(http as never), enviados, http };
}

const evento = {
  eventName: 'Contactado',
  eventTime: 1787864382,
  actionSource: 'system_generated',
  eventId: 'lead-stage:11111111-2222-3333-4444-555555555555:contacted',
  userData: {
    lead_id: '1514141180734116',
    em: ['Persona@Ejemplo.CL'],
    ph: ['+56 9 1234 5678'],
  },
  customData: { leadEventSource: 'Espartanos', eventSource: 'crm' },
} as never;

describe('el cuerpo que llega a Graph API', () => {
  it('manda el correo hasheado, nunca reconocible', async () => {
    const { servicio: svc, enviados } = servicio();

    await svc.sendServerEvent('123', 'token', evento);

    const userData = enviados[0].data[0].user_data;
    expect(userData.em[0]).toMatch(SHA256);
    expect(JSON.stringify(enviados[0])).not.toContain('@');
  });

  it('manda el teléfono hasheado, sin rastro del número', async () => {
    const { servicio: svc, enviados } = servicio();

    await svc.sendServerEvent('123', 'token', evento);

    expect(enviados[0].data[0].user_data.ph[0]).toMatch(SHA256);
    expect(JSON.stringify(enviados[0])).not.toContain('56912345678');
    expect(JSON.stringify(enviados[0])).not.toContain('1234 5678');
  });

  it('el identificador de Meta viaja tal cual', async () => {
    // Es un número que generó Meta, no un dato personal: hasheado se vuelve irreconocible para
    // ellos y el evento deja de emparejarse con su lead.
    const { servicio: svc, enviados } = servicio();

    await svc.sendServerEvent('123', 'token', evento);

    expect(enviados[0].data[0].user_data.lead_id).toBe('1514141180734116');
  });

  it('no cambia el identificador del evento', async () => {
    // De él depende la deduplicación: cambiarlo haría que Meta contara dos veces lo mismo.
    const { servicio: svc, enviados } = servicio();

    await svc.sendServerEvent('123', 'token', evento);

    expect(enviados[0].data[0].event_id).toBe('lead-stage:11111111-2222-3333-4444-555555555555:contacted');
  });

  it('traduce los nombres al formato de Graph API', async () => {
    const { servicio: svc, enviados } = servicio();

    await svc.sendServerEvent('123', 'token', evento);

    const salida = enviados[0].data[0];
    expect(salida.event_name).toBe('Contactado');
    expect(salida.action_source).toBe('system_generated');
    expect(salida.custom_data.lead_event_source).toBe('Espartanos');
    expect(salida.custom_data.event_source).toBe('crm');
  });

  it('un dato ya hasheado no se vuelve a hashear', async () => {
    const { servicio: svc, enviados } = servicio();
    const primero = servicio();
    await primero.servicio.sendServerEvent('123', 'token', evento);
    const digest = primero.enviados[0].data[0].user_data.em[0];

    await svc.sendServerEvent('123', 'token', {
      ...(evento as any), userData: { ...(evento as any).userData, em: [digest] },
    } as never);

    expect(enviados[0].data[0].user_data.em[0]).toBe(digest);
  });

  it('salga lo que salga de la entrada, el cuerpo va hasheado', () => {
    // La reja previa al POST es inalcanzable desde acá **a propósito**: la preparación siempre
    // produce un digest válido. Lo que se comprueba es esa propiedad —ninguna entrada consigue
    // que un identificador salga en claro—, que es la garantía de verdad. La reja se prueba
    // aparte, y existe para un camino futuro que se saltara la preparación.
    const entradas = ['Persona@Ejemplo.CL', '  MAYUS@X.CL  ', '+56 9 1234 5678', 'sin arroba'];

    return Promise.all(entradas.map(async (valor) => {
      const { servicio: svc, enviados } = servicio();

      await svc.sendServerEvent('123', 'token', {
        ...(evento as any), userData: { lead_id: '1514141180734116', em: [valor], ph: [valor] },
      } as never);

      const userData = enviados[0].data[0].user_data;
      expect(userData.em?.[0] ?? '').toMatch(SHA256);
      expect(JSON.stringify(enviados[0])).not.toContain(valor.trim());
    }));
  });
});
