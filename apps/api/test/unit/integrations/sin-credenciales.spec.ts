import { describe, expect, it } from 'vitest';
import { sinCredenciales } from '../../../src/modules/integrations/meta/sin-credenciales';

/**
 * Ninguna credencial de Meta puede salir en un texto que va a registrarse.
 *
 * Ocurrió en producción: alguien pegó el token con unas palabras delante, Meta respondió
 * «Malformed access token» seguido del token entero, y ese mensaje quedó escrito en el registro
 * del servidor y devuelto a la pantalla. La credencial no la imprimió nadie; venía dentro de la
 * respuesta del tercero.
 */
describe('saneado de credenciales', () => {
  // Con la forma de un token real —empieza por EAA y pasa de los sesenta caracteres— pero
  // inventado: escribir uno de verdad en las pruebas repetiría el problema que arreglan.
  const TOKEN = `EAA${'Bc1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW'.repeat(4)}xyz`;

  it('quita el token del mensaje que devuelve Meta', () => {
    const limpio = sinCredenciales(`Malformed access token ACC TOKENS: ${TOKEN}`);

    expect(limpio).not.toContain(TOKEN);
    expect(limpio).toBe('Malformed access token ACC TOKENS: [token oculto]');
  });

  it('conserva el motivo, que es lo que dice qué hacer', () => {
    // Sustituir el mensaje entero por uno genérico dejaría sin distinguir «token caducado» de
    // «el Pixel no existe», que piden cosas distintas.
    expect(sinCredenciales('Error validating access token: Session has expired'))
      .toBe('Error validating access token: Session has expired');
  });

  it('quita todos los que haya, no solo el primero', () => {
    const limpio = sinCredenciales(`uno ${TOKEN} y otro ${TOKEN}`);

    expect(limpio).toBe('uno [token oculto] y otro [token oculto]');
  });

  it('no confunde una palabra que empiece igual con un token', () => {
    expect(sinCredenciales('EAA no es un token')).toBe('EAA no es un token');
    expect(sinCredenciales('EAAB123 tampoco')).toBe('EAAB123 tampoco');
  });

  it('tolera un mensaje ausente', () => {
    expect(sinCredenciales(null)).toBe('');
    expect(sinCredenciales(undefined)).toBe('');
  });
});
