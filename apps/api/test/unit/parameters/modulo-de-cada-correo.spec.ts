import { describe, expect, it } from 'vitest';
import { MODULO_DE_CORREO, modulosDeCorreo } from '../../../src/core/parameters/organization-settings.controller';
import { ORGANIZATION_SETTINGS } from '../../../src/core/parameters/organization-settings.catalog';

/**
 * Los prefijos que reparten las plantillas tienen que existir de verdad.
 *
 * El mapeo decía `email.lead` y `email.crm`, y ninguna clave del catálogo empieza así: se llaman
 * `email.new_lead_*`. La categoría del CRM quedó vacía sin que nada se quejara, y una empresa que
 * sólo tiene CRM abría Correos y no encontraba ni una plantilla que editar.
 *
 * La prueba que cubría esto usaba una clave inventada —`email.lead_assigned_subject`— que sí
 * casaba con el prefijo roto, así que pasaba en verde mientras el producto fallaba. De ahí que
 * esta compare contra el catálogo real y no contra ejemplos escritos a mano.
 */
describe('a qué módulo va cada plantilla de correo', () => {
  const clavesDeCorreo = ORGANIZATION_SETTINGS
    .map((ajuste) => ajuste.key)
    .filter((clave) => clave.startsWith('email.'));

  it('el catálogo trae plantillas de correo', () => {
    expect(clavesDeCorreo.length).toBeGreaterThan(20);
  });

  it('cada prefijo declarado alcanza al menos una plantilla real', () => {
    const huerfanos = MODULO_DE_CORREO
      .map(([prefijo]) => prefijo)
      .filter((prefijo) => !clavesDeCorreo.some((clave) => clave.startsWith(prefijo)));
    expect(huerfanos).toEqual([]);
  });

  it('los tres módulos de cliente tienen plantillas, y el CRM no se queda vacío', () => {
    const porModulo = { reservations: 0, surveys: 0, crm: 0, agencia: 0 };
    for (const clave of clavesDeCorreo) {
      for (const modulo of modulosDeCorreo(clave)) porModulo[modulo] += 1;
    }
    expect(porModulo.crm).toBeGreaterThan(0);
    expect(porModulo.surveys).toBeGreaterThan(0);
    expect(porModulo.reservations).toBeGreaterThan(0);
    expect(porModulo.agencia).toBeGreaterThan(0);
  });

  it('el aviso de lead nuevo es del CRM, no de Reservas', () => {
    expect(modulosDeCorreo('email.new_lead_subject')).toEqual(['crm']);
    expect(modulosDeCorreo('email.idle_lead_enabled')).toEqual(['crm']);
    expect(modulosDeCorreo('email.daily_digest_body')).toEqual(['crm']);
  });

  it('el cumpleaños lo pueden escribir los dos módulos que lo usan', () => {
    expect(modulosDeCorreo('email.birthday_subject')).toEqual(['crm', 'reservations']);
  });

  it('lo de la agencia no depende de lo que contrate una empresa', () => {
    expect(modulosDeCorreo('email.task_reminder_body')).toEqual(['agencia']);
    expect(modulosDeCorreo('email.collection_overdue_enabled')).toEqual(['agencia']);
  });

  it('una plantilla sin prefijo declarado sigue siendo de Reservas', () => {
    expect(modulosDeCorreo('email.reservation_confirmation_subject')).toEqual(['reservations']);
    expect(modulosDeCorreo('email.waitlist_spot_body')).toEqual(['reservations']);
  });
});
