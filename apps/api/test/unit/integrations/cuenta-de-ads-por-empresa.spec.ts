import { describe, expect, it, vi } from 'vitest';
import { GoogleConversionOutboxService } from '../../../src/modules/integrations/google/google-conversion-outbox.service';

/**
 * A qué cuenta de Google Ads se manda la conversión de una empresa.
 *
 * Existía un `?? accounts[0]`: una empresa sin cuenta propia caía en la primera que hubiera, que
 * es de otra. Sus conversiones se enviaban a la cuenta publicitaria de un cliente distinto y
 * alimentaban la optimización de campañas ajenas.
 *
 * No fallaba nada —el envío tenía éxito— y por eso podía durar meses sin que nadie lo notara. Es
 * peor que el caso equivalente de Meta, donde al menos ambos tokens apuntaban al mismo destino.
 */
function servicio(cuentas: Array<Record<string, unknown>>) {
  const integrations = { findOne: vi.fn().mockResolvedValue({ id: 'int-1' }) };
  const accounts = { find: vi.fn().mockResolvedValue(cuentas) };
  return new GoogleConversionOutboxService(
    {} as never, integrations as never, accounts as never, {} as never, {} as never,
  );
}

const cuenta = (clientId: string, externalId: string) => ({
  externalId,
  metadata: { clientId, conversionActions: { reserva: 'accion-1' } },
});

describe('cuenta de Google Ads por empresa', () => {
  it('usa la cuenta de la empresa que pide', async () => {
    const config = await servicio([
      cuenta('empresa-a', '111-111-1111'),
      cuenta('empresa-b', '222-222-2222'),
    ]).resolveConfig('org-1', 'empresa-b', 'reserva');

    expect(config?.customerId).toBe('2222222222');
  });

  /*
   * La regla que faltaba. No mandar una conversión es recuperable; mandarla al anunciante
   * equivocado no, y además le enseña a Meta —o a Google— un perfil que no es suyo.
   */
  it('una empresa sin cuenta propia no hereda la de otra', async () => {
    const config = await servicio([
      cuenta('empresa-a', '111-111-1111'),
    ]).resolveConfig('org-1', 'empresa-sin-ads', 'reserva');

    expect(config).toBeNull();
  });

  it('sin ninguna cuenta configurada tampoco inventa una', async () => {
    const config = await servicio([]).resolveConfig('org-1', 'empresa-a', 'reserva');

    expect(config).toBeNull();
  });

  it('con cuenta pero sin la acción de ese evento, no se envía', async () => {
    const config = await servicio([
      { externalId: '111-111-1111', metadata: { clientId: 'empresa-a', conversionActions: {} } },
    ]).resolveConfig('org-1', 'empresa-a', 'reserva');

    expect(config).toBeNull();
  });
});
