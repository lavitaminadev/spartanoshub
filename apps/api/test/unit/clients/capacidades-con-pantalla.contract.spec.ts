import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENT_CAPABILITY_KEYS } from '../../../src/modules/clients/client-capabilities';

/**
 * Cada servicio contratable tiene su casilla en la pantalla de empresas.
 *
 * El portal declara su propia lista de capacidades a mano, porque no comparte tipos con la API.
 * El día que se agrega una allá y se olvida acá no falla nada: compila, se despliega, y el
 * servicio simplemente no se puede encender —no hay casilla— con lo que la reja que gobierna
 * queda cerrada para siempre y sin forma de abrirla desde la aplicación.
 *
 * Pasó con `marketing`: la capacidad existía en el servidor, el DTO la aceptaba, y la pantalla
 * no la ofrecía. Esta prueba convierte ese fallo silencioso en uno ruidoso.
 *
 * Se lee el archivo como texto a propósito. Importar un `.tsx` del portal desde las pruebas de la
 * API arrastraría React y el resto del árbol; lo que hace falta comprobar es sólo que la clave
 * esté declarada como opción.
 */
const PANTALLA = join(__dirname, '../../../../web/src/features/clients/ClientsPage.tsx');

describe('contrato entre las capacidades y su pantalla', () => {
  const fuente = readFileSync(PANTALLA, 'utf8');

  it('toda capacidad del catálogo se puede encender desde la pantalla de empresas', () => {
    const sinCasilla = CLIENT_CAPABILITY_KEYS.filter((clave) => !fuente.includes(`key: '${clave}'`));

    expect(
      sinCasilla,
      `Capacidades sin casilla en ClientsPage: ${sinCasilla.join(', ')}. `
      + 'Sin ella nadie puede contratar ese servicio para una empresa.',
    ).toEqual([]);
  });

  it('toda capacidad del catálogo está en el tipo que usa la pantalla', () => {
    const tipo = fuente.split('interface ClientCapabilities')[1]?.split('}')[0] ?? '';
    const faltantes = CLIENT_CAPABILITY_KEYS.filter((clave) => !tipo.includes(`${clave}:`));

    expect(faltantes, `Capacidades fuera del tipo del portal: ${faltantes.join(', ')}`).toEqual([]);
  });
});
