import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MetaPixelService } from '../../../src/modules/integrations/meta/meta-pixel.service';

/**
 * Qué se puede concluir de no poder leer la ficha de un Pixel.
 *
 * Poco: leer exige permiso sobre la cuenta publicitaria, y escribir eventos no. Un token de la
 * API de Conversiones suele poder `POST /events` y no ese `GET`. Tratar cualquier fallo como
 * credencial inválida impedía guardar credenciales que funcionan.
 */
function conRespuesta(respuesta: unknown) {
  return new MetaPixelService({ get: vi.fn(() => of({ data: respuesta })) } as never);
}

function conError(error: unknown) {
  return new MetaPixelService({ get: vi.fn(() => throwError(() => error)) } as never);
}

describe('verificación de un par Pixel + token', () => {
  it('leer la ficha confirma el par', async () => {
    const servicio = conRespuesta({ id: '123', name: 'Principal' });

    await expect(servicio.verificarPixel('123', 'token')).resolves.toEqual({ verificado: true, bloquea: false });
  });

  it('un token que Meta declara inválido sí bloquea', async () => {
    const servicio = conError({ response: { data: { error: { code: 190, message: 'Invalid OAuth access token' } } } });

    const resultado = await servicio.verificarPixel('123', 'token');
    expect(resultado.bloquea).toBe(true);
    expect(resultado.motivo).toBe('Invalid OAuth access token');
  });

  it('la falta de permiso de lectura no bloquea', async () => {
    // Es el caso que dejaba a un token bueno sin poder guardarse: puede escribir eventos aunque
    // no pueda leer la ficha del Pixel.
    const servicio = conError({ response: { data: { error: { code: 200, message: 'Permissions error' } } } });

    const resultado = await servicio.verificarPixel('123', 'token');
    expect(resultado.verificado).toBe(false);
    expect(resultado.bloquea).toBe(false);
  });

  it('una caída de Meta no se presenta como error de configuración', async () => {
    const servicio = conError(new Error('timeout of 15000ms exceeded'));

    const resultado = await servicio.verificarPixel('123', 'token');
    expect(resultado.bloquea).toBe(false);
    expect(resultado.motivo).toMatch(/timeout/);
  });
});
