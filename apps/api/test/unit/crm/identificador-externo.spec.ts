import { describe, expect, it } from 'vitest';
import { identificadorExterno } from '../../../src/modules/crm/leads/identificador-externo';

/**
 * Es lo que decide si dos caminos hacia el CRM reconocen el mismo lead o lo duplican.
 *
 * Mientras el acceso directo de Meta espera la verificación del negocio, se opera con un puente
 * por automatización. Los dos pueden estar encendidos a la vez, y esta regla es la única razón
 * por la que eso no produce dos leads por persona.
 */
describe('identificadorExterno', () => {
  it('no antepone nada a los orígenes cuyo identificador ya es único en el mundo', () => {
    // Es el mismo valor que guarda el webhook firmado de Meta al recibir ese lead.
    expect(identificadorExterno('meta_lead_ads', '123456789012345')).toBe('123456789012345');
  });

  it('antepone el origen a los demás, para que dos portales no se pisen', () => {
    expect(identificadorExterno('sitio web', '42')).toBe('sitio web:42');
    expect(identificadorExterno('whatsapp', '42')).toBe('whatsapp:42');
  });

  it('un puente mal nombrado produce un identificador distinto, y por eso duplicaría', () => {
    // Queda fijado a propósito: el documento pide que el origen del puente se llame
    // `meta_lead_ads`, y esta prueba muestra qué ocurre cuando no se cumple.
    expect(identificadorExterno('Meta Ads', '123456789012345')).toBe('Meta Ads:123456789012345');
  });

  it('sin identificador de origen no compone ninguno', () => {
    // Sin él la deduplicación cae al correo y al teléfono, que es el camino previsto.
    expect(identificadorExterno('meta_lead_ads', undefined)).toBeUndefined();
    expect(identificadorExterno('sitio web', '')).toBeUndefined();
  });
});
