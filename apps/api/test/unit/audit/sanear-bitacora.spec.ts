import { describe, expect, it, vi } from 'vitest';
import { sanearParaBitacora, sanearTexto } from '../../../src/core/audit/sanear-bitacora';
import { AuditService } from '../../../src/core/audit/audit.service';

/*
 * La bitácora no guarda secretos. Se limpia por el nombre del campo y también por el valor: un
 * token pegado en un comentario o en una URL no tiene un nombre que lo delate.
 */
describe('saneo de la bitácora', () => {
  it('recorta un token dentro de un texto libre', () => {
    const texto = 'Le pasé el acceso: sk_live_abcdef1234567890XYZ para que entre, y también eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.firmaDelToken123';

    const limpio = sanearTexto(texto);

    expect(limpio).not.toContain('sk_live_abcdef1234567890XYZ');
    expect(limpio).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(limpio).toContain('Le pasé el acceso');
  });

  it('recorta el valor de ?token= en una URL y la credencial incrustada', () => {
    const limpio = sanearTexto('ver https://app.cl/reset?token=abc123def456&usuario=ana y postgres://admin:s3cr3t@db.cl/x');

    expect(limpio).not.toContain('abc123def456');
    expect(limpio).not.toContain('s3cr3t');
    expect(limpio).toContain('usuario=ana');
  });

  it('recorta un secreto nombrado en el texto y un RUT', () => {
    const limpio = sanearTexto('la clave: hunter22 y el RUT 12.345.678-5');

    expect(limpio).not.toContain('hunter22');
    expect(limpio).not.toContain('12.345.678-5');
  });

  it('respeta los UUID: son lo que la bitácora existe para cruzar', () => {
    const id = '3f2b8c1e-9a4d-4e0b-8c1a-0a1b2c3d4e5f';
    expect(sanearTexto(`reserva ${id}`)).toBe(`reserva ${id}`);
  });

  it('redacta por nombre: clave, rut, pin y compuestos, anidados y en listas', () => {
    const limpio = sanearParaBitacora({
      clave: 'a', userRut: '1-9', pin: '1234', contrasena: 'x', apiKey: 'k',
      anidado: { password_hash: 'h', lista: [{ token: 't' }], nombre: 'Ana' },
    }) as Record<string, any>;

    expect(limpio.clave).toBe('[REDACTED]');
    expect(limpio.userRut).toBe('[REDACTED]');
    expect(limpio.pin).toBe('[REDACTED]');
    expect(limpio.contrasena).toBe('[REDACTED]');
    expect(limpio.apiKey).toBe('[REDACTED]');
    expect(limpio.anidado.password_hash).toBe('[REDACTED]');
    expect(limpio.anidado.lista[0].token).toBe('[REDACTED]');
    expect(limpio.anidado.nombre).toBe('Ana');
  });

  it('no confunde palabras parecidas: pinned y shipping no son pin', () => {
    expect(sanearParaBitacora({ pinned: true, shipping: 'x', running: 1 })).toEqual({ pinned: true, shipping: 'x', running: 1 });
  });

  it('lo que queda más hondo del límite no se conserva crudo', () => {
    let hondo: Record<string, unknown> = { nota: 'sk_live_abcdef1234567890XYZ' };
    for (let i = 0; i < 10; i += 1) hondo = { siguiente: hondo };

    expect(JSON.stringify(sanearParaBitacora(hondo))).not.toContain('sk_live_');
  });

  it('AuditService.log sanea antes de guardar', async () => {
    const repo = { create: vi.fn((v) => v), save: vi.fn(async (v) => v) };
    const servicio = new AuditService(repo as never);

    await servicio.log({
      organizationId: 'org-1', entityType: 'x', action: 'update',
      before: { clave: 'vieja' }, after: { nota: 'token es abcd1234efgh' }, reason: 'ver /r?token=zzz999',
    });

    const guardado = repo.save.mock.calls[0][0];
    expect(JSON.stringify(guardado)).not.toMatch(/vieja|abcd1234efgh|zzz999/);
  });
});
