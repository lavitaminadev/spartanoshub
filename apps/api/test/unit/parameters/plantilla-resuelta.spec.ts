import { describe, expect, it, vi } from 'vitest';
import { leerPlantilla } from '../../../src/core/parameters/plantilla-resuelta';

/*
 * Cómo se lee una plantilla, con su respaldo de fábrica.
 *
 * Lo importante es la última regla: un correo de acceso sin el enlace o sin la clave llega igual
 * y deja a la persona afuera. Si el texto guardado los perdió, se usa el de fábrica.
 */
const respaldo = { asunto: 'Tu acceso', cuerpo: 'Tu clave es {{clave}}. Entra en {{enlace}}.' };
const lector = (valores: Record<string, unknown>) => ({ get: vi.fn(async (clave: string) => valores[clave] ?? null) });

describe('leerPlantilla', () => {
  it('usa el texto guardado cuando lo hay', async () => {
    const resultado = await leerPlantilla(lector({ 'email.x_subject': 'Hola', 'email.x_body': 'Clave {{clave}} en {{enlace}}' }), 'email.x', {}, respaldo, { obligatorias: ['clave', 'enlace'] });
    expect(resultado).toMatchObject({ asunto: 'Hola', cuerpo: 'Clave {{clave}} en {{enlace}}' });
  });

  it('sin texto guardado usa el de fábrica', async () => {
    const resultado = await leerPlantilla(lector({}), 'email.x', {}, respaldo);
    expect(resultado).toMatchObject(respaldo);
  });

  it('si el texto guardado perdió una variable obligatoria, vuelve al de fábrica', async () => {
    const resultado = await leerPlantilla(lector({ 'email.x_subject': 'Hola', 'email.x_body': 'Bienvenido, entra cuando quieras' }), 'email.x', {}, respaldo, { obligatorias: ['clave', 'enlace'] });
    expect(resultado).toMatchObject(respaldo);
  });

  it('respeta el interruptor guardado', async () => {
    const resultado = await leerPlantilla(lector({ 'email.x_enabled': false }), 'email.x', {}, respaldo);
    expect(resultado.encendido).toBe(false);
  });

  it('sin interruptor guardado usa el valor por defecto que se le pide', async () => {
    expect((await leerPlantilla(lector({}), 'email.x', {}, respaldo, { encendidoPorDefecto: false })).encendido).toBe(false);
    expect((await leerPlantilla(lector({}), 'email.x', {}, respaldo)).encendido).toBe(true);
  });

  it('los que no tienen interruptor siempre están encendidos y no lo consultan', async () => {
    const parametros = lector({ 'email.x_enabled': false });
    const resultado = await leerPlantilla(parametros, 'email.x', {}, respaldo, { encendidoPorDefecto: null });
    expect(resultado.encendido).toBe(true);
    expect(parametros.get).not.toHaveBeenCalledWith('email.x_enabled', expect.anything(), expect.anything(), expect.anything());
  });
});
