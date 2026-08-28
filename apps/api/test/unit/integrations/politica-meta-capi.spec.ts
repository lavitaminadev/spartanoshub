import { describe, expect, it } from 'vitest';
import {
  construirEventoPermitido,
  resumenAuditable,
  revisarEvento,
} from '../../../src/modules/integrations/meta/politica-meta-capi';

/**
 * La frontera entre la ficha comercial y lo que ve Meta.
 *
 * Cada caso describe una forma real de que un dato prohibido llegue a Meta: alguien añade el
 * campo al evento, alguien lo esconde en el nombre, alguien lo pone como importe. Si alguno de
 * estos deja de fallar, el CRM volvió a poder filtrar información financiera del lead.
 */
describe('política de Meta CAPI', () => {
  const eventoValido = {
    eventName: 'QualifiedLead',
    eventTime: 1700000000,
    eventId: 'lead-stage:abc:won',
    actionSource: 'system_generated',
    userData: { lead_id: '123456789012345', em: ['a'.repeat(64)], ph: ['b'.repeat(64)] },
    customData: { currency: 'CLP', value: 1000, eventSource: 'crm', leadEventSource: 'Espartanos' },
  };

  it('acepta el evento que el CRM emite hoy', () => {
    expect(revisarEvento({ ...eventoValido })).toEqual([]);
  });

  // La política cubre los dos emisores. Si solo pasara el del CRM, el primer despliegue dejaría
  // la cola de reservas bloqueada entera.
  it('acepta el evento que emiten las reservas', () => {
    expect(revisarEvento({
      eventName: 'Schedule',
      eventTime: 1700000000,
      eventId: 'reserva:abc',
      actionSource: 'website',
      eventSourceUrl: 'https://cuartel.espartanos.cl/book/demo',
      userData: {
        em: ['a'.repeat(64)], ph: ['b'.repeat(64)], fn: ['c'.repeat(64)], ln: ['d'.repeat(64)],
        ct: ['e'.repeat(64)], st: ['f'.repeat(64)], country: ['0'.repeat(64)],
        externalId: ['1'.repeat(64)], fbp: 'fb.1.1.1', fbc: 'fb.1.1.x',
        client_ip_address: '1.2.3.4', client_user_agent: 'Mozilla/5.0',
      },
      customData: { contentIds: ['form-1'], contentType: 'reservation' },
    })).toEqual([]);
  });

  it('bloquea la capacidad de inversión aunque venga dentro de custom_data', () => {
    const infracciones = revisarEvento({
      ...eventoValido,
      customData: { ...eventoValido.customData, capacidad_inversion: 100000000 },
    });
    expect(infracciones).toHaveLength(1);
    expect(infracciones[0].campo).toBe('capacidad_inversion');
    expect(infracciones[0].seccion).toBe('custom_data');
  });

  it.each([
    ['presupuesto', 500000],
    ['investment_range', 'alto'],
    ['patrimonio', 1],
    ['renta_mensual', 1],
    ['rut', '11111111-1'],
    ['notas_vendedor', 'texto'],
    ['respuestas_formulario', ['a']],
    ['diagnostico', 'x'],
  ])('bloquea «%s» en custom_data', (campo, valor) => {
    const infracciones = revisarEvento({
      ...eventoValido,
      customData: { ...eventoValido.customData, [campo]: valor },
    });
    expect(infracciones.map((i) => i.campo)).toContain(campo);
  });

  it('bloquea cualquier identificador que Meta no admita, aunque suene inocente', () => {
    const infracciones = revisarEvento({
      ...eventoValido,
      userData: { ...eventoValido.userData, segmento: 'premium' },
    });
    expect(infracciones.map((i) => i.campo)).toContain('segmento');
  });

  it('bloquea un nombre de evento que revela la categoría prohibida', () => {
    const infracciones = revisarEvento({ ...eventoValido, eventName: 'LeadRentaAlta' });
    expect(infracciones.map((i) => i.campo)).toContain('eventName');
  });

  it('no basta con hashear el dato prohibido para que salga', () => {
    const infracciones = revisarEvento({
      ...eventoValido,
      customData: { ...eventoValido.customData, capacidad_inversion: 'c'.repeat(64) },
    });
    expect(infracciones).toHaveLength(1);
  });

  it('rechaza un value sin moneda y uno que no es un importe', () => {
    expect(revisarEvento({ ...eventoValido, customData: { value: 1000 } })).toHaveLength(1);
    expect(revisarEvento({ ...eventoValido, customData: { currency: 'CLP', value: -5 } })).toHaveLength(1);
  });

  it('construye un objeto nuevo y deja fuera todo lo que no está autorizado', () => {
    const construido = construirEventoPermitido({
      ...eventoValido,
      notasInternas: 'no debe salir',
      userData: { ...eventoValido.userData, capacidadInversion: 100 },
      customData: { ...eventoValido.customData, presupuesto: 5 },
    } as Record<string, unknown>);

    const claves = JSON.stringify(construido);
    expect(claves).not.toContain('notasInternas');
    expect(claves).not.toContain('capacidadInversion');
    expect(claves).not.toContain('presupuesto');
    expect((construido as any).userData.lead_id).toBe('123456789012345');
    expect((construido as any).customData.value).toBe(1000);
  });

  it('el resumen de auditoría dice qué viajó, no su contenido', () => {
    const resumen = resumenAuditable({
      ...eventoValido,
      userData: { em: ['d'.repeat(64)], ph: ['e'.repeat(64)], lead_id: '123456789012345' },
    });
    expect(resumen).toContain('email_present=true');
    expect(resumen).toContain('phone_present=true');
    expect(resumen).not.toContain('d'.repeat(64));
    expect(resumen).not.toContain('123456789012345');
  });
});
