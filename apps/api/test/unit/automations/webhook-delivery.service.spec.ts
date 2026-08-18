import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryService } from '../../../src/modules/automations/webhook-delivery.service';

describe('WebhookDeliveryService', () => {
  const deliveries = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: 'delivery-1', ...value })),
    manager: { transaction: vi.fn() },
    delete: vi.fn(),
  };
  const http = { post: vi.fn() };
  let service: WebhookDeliveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookDeliveryService(deliveries as never, http as never);
  });

  it('encola un webhook hacia una dirección pública', async () => {
    const result = await service.enqueue('org-1', 'https://hooks.ejemplo.cl/espartanos', { hola: 'mundo' });
    expect(result.id).toBe('delivery-1');
    expect(deliveries.save).toHaveBeenCalled();
  });

  /**
   * La dirección la escribe una persona desde una pantalla. Sin esta comprobación, el servidor
   * podría usarse para alcanzar servicios de la propia red que no están expuestos a internet
   * —incluido el punto de metadatos de la nube, que entrega credenciales de la instancia—.
   */
  it('rechaza direcciones internas', async () => {
    const internas = [
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.0.0.5/hook',
      'https://192.168.1.10/hook',
      'https://172.16.4.4/hook',
      'https://169.254.169.254/latest/meta-data',
    ];
    for (const url of internas) {
      await expect(service.enqueue('org-1', url, {})).rejects.toThrow(/interna/i);
    }
    expect(deliveries.save).not.toHaveBeenCalled();
  });

  it('exige HTTPS', async () => {
    await expect(service.enqueue('org-1', 'http://hooks.ejemplo.cl/hook', {})).rejects.toThrow(/HTTPS/);
  });

  it('rechaza una dirección que no se puede interpretar', async () => {
    await expect(service.enqueue('org-1', 'no-es-una-direccion', {})).rejects.toThrow(/no es válida/i);
  });

  it('acepta un subdominio que empieza con un número sin confundirlo con una IP privada', async () => {
    await expect(service.enqueue('org-1', 'https://10cliente.ejemplo.cl/hook', {})).resolves.toBeTruthy();
  });
});
