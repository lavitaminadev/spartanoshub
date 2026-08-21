import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Todo controlador declara su módulo, o declara por qué no tiene.
 *
 * `PermissionGuard` niega por omisión: un endpoint sin `@ModuleScope`, `@RequiresPermission`,
 * `@RequiresFeature` ni `@ModuleExempt` responde 403 a todo el mundo, siempre. Negar por omisión
 * es lo correcto —mientras lo no anotado pasaba libre, quitarle un módulo a alguien ocultaba su
 * menú y la API le seguía respondiendo—, pero convierte un olvido en una pantalla muerta.
 *
 * Fue exactamente lo que pasó con `TasksController`: el panel de tareas de la ficha del lead se
 * dibujaba y no cargaba ninguna, sin más pista que un 403 en la consola. Nada al compilar ni al
 * probar lo señalaba, porque el fallo está en lo que **no** se escribió.
 *
 * Esta prueba lee los archivos en vez de arrancar la aplicación: importar cada controlador
 * levantaría sus dependencias, y lo que se comprueba es una anotación, no un comportamiento.
 */
const API_SRC = resolve(__dirname, '../../../src');

const DECLARACIONES = [
  '@ModuleScope(',
  '@RequiresPermission(',
  '@RequiresFeature(',
  '@ModuleExempt(',
  // Un endpoint público no pasa por el guardia: su autorización es otra —una llave, una firma—
  // y exigirle módulo obligaría a inventarle uno a la puerta de entrada de las integraciones.
  '@Public(',
];

function controladores(dir: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      controladores(ruta, encontrados);
    } else if (entrada.endsWith('.controller.ts')) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

describe('contrato de permisos · todo controlador declara su módulo', () => {
  const archivos = controladores(API_SRC);

  it('encuentra los controladores de la API', () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  it('ninguno queda sin declarar, que equivale a 403 permanente', () => {
    const sinDeclarar = archivos
      .filter((ruta) => {
        const fuente = readFileSync(ruta, 'utf8');
        return !DECLARACIONES.some((decorador) => fuente.includes(decorador));
      })
      .map((ruta) => ruta.slice(API_SRC.length + 1).replace(/\\/g, '/'));

    expect(
      sinDeclarar,
      `Controladores sin módulo declarado —responden 403 a todo el mundo—:\n  ${sinDeclarar.join('\n  ')}`,
    ).toEqual([]);
  });
});
