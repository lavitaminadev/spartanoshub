import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../../src/core/authorization/role-permissions';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/**
 * Quién puede entrar a algo se decide hoy en varios sitios a la vez.
 *
 * Cada endpoint tiene dos rejas que se suman: `@Roles(...)` enumera cargos a mano, y
 * `@ModuleScope(...)` delega en la matriz de permisos, que es la que se edita desde la pantalla
 * de Accesos. Cuando las dos hablan del mismo endpoint y no dicen lo mismo, gana la más
 * restrictiva —el decorador— y la pantalla de permisos deja de gobernar: alguien concede un
 * módulo, la persona lo ve en el menú, entra, y recibe 403.
 *
 * Esto no cambia comportamiento. Convierte una deuda invisible en una lista concreta: cuántos
 * endpoints tienen las dos rejas, y en cuáles el decorador niega lo que la matriz concede. Es el
 * inventario que hace falta antes de unificarlas, y la red que avisa si la brecha crece.
 */
const API_SRC = resolve(__dirname, '../../../src');

/** Cargos que atraviesan la organización entera: su presencia no revela una discrepancia. */
const SIN_RESTRICCION = new Set<string>([UserRole.DEV, UserRole.ADMIN]);

interface Endpoint {
  archivo: string;
  modulo: string;
  rolesDeclarados: string[];
}

function controladores(dir: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) controladores(ruta, encontrados);
    else if (entrada.endsWith('.controller.ts')) encontrados.push(ruta);
  }
  return encontrados;
}

/**
 * Lee las dos rejas de cada controlador.
 *
 * Se hace sobre el texto y no arrancando la aplicación: importar cada controlador levantaría sus
 * dependencias, y lo que se compara son anotaciones, no comportamiento.
 */
function leerEndpoints(): Endpoint[] {
  const salida: Endpoint[] = [];
  for (const ruta of controladores(API_SRC)) {
    const fuente = readFileSync(ruta, 'utf8');
    const modulo = fuente.match(/@ModuleScope\('([^']+)'\)/)?.[1];
    if (!modulo) continue;

    const roles = [...fuente.matchAll(/@Roles\(([^)]*)\)/gs)]
      .flatMap((coincidencia) => [...coincidencia[1].matchAll(/UserRole\.(\w+)/g)].map((m) => m[1]));
    if (roles.length === 0) continue;

    salida.push({
      archivo: ruta.slice(API_SRC.length + 1).replace(/\\/g, '/'),
      modulo,
      rolesDeclarados: [...new Set(roles)],
    });
  }
  return salida;
}

/** Cargos a los que la matriz concede al menos lectura sobre un módulo. */
function cargosSegunLaMatriz(modulo: string): string[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, permisos]) => (permisos as Record<string, string>)[modulo] !== undefined
      && (permisos as Record<string, string>)[modulo] !== 'none')
    .map(([rol]) => rol);
}

/** `COMMUNITY_MANAGER` en el decorador es `community_manager` en la matriz. */
function aValorDeRol(nombre: string): string {
  return (UserRole as unknown as Record<string, string>)[nombre] ?? nombre.toLowerCase();
}

describe('fuentes de autorización', () => {
  const endpoints = leerEndpoints();

  it('encuentra controladores con las dos rejas a la vez', () => {
    expect(endpoints.length).toBeGreaterThan(5);
  });

  /**
   * El inventario: dónde el decorador niega lo que la matriz concede.
   *
   * No falla. Deja la lista escrita en la salida de la prueba para poder recorrerla, porque
   * arreglarla exige decidir caso por caso si manda el cargo o el permiso, y eso no lo puede
   * decidir una prueba.
   */
  it('deja escrito dónde el decorador niega lo que la pantalla de permisos concede', () => {
    const divergencias: string[] = [];

    for (const endpoint of endpoints) {
      const declarados = new Set(endpoint.rolesDeclarados.map(aValorDeRol));
      const concedidos = cargosSegunLaMatriz(endpoint.modulo);

      const negados = concedidos.filter((rol) => !declarados.has(rol) && !SIN_RESTRICCION.has(rol));
      if (negados.length) {
        divergencias.push(`${endpoint.archivo} (${endpoint.modulo}): la matriz concede a ${negados.join(', ')} y el decorador no los nombra`);
      }
    }

    // Se imprime en vez de fallar: es un inventario, no una regla. Falla la de más abajo, que sí
    // es una regla —que no crezca—.
    if (divergencias.length) {
      console.log(`\nDivergencias entre @Roles y la matriz de permisos (${divergencias.length}):\n  ${divergencias.join('\n  ')}\n`);
    }
    /*
     * La cota es la que había al medirlo: veintiséis.
     *
     * **Bajarla es progreso.** Cada una que se resuelve —decidiendo si manda el cargo o el
     * permiso— quita un sitio donde el menú ofrece algo que luego se niega. Subirla significa que
     * se añadió otro endpoint donde la pantalla de permisos promete lo que el decorador no
     * cumple, y eso se vive como que el sistema miente.
     *
     * No se arregla desde acá: resolverlas amplía o recorta el acceso de gente concreta, y esa es
     * una decisión del dueño del producto, no de una prueba.
     */
    expect(divergencias.length).toBeLessThanOrEqual(26);
  });

  /**
   * Los que la pantalla de permisos no gobierna.
   *
   * Un controlador con `@Roles` y sin `@ModuleScope` decide por su cuenta: conceder ese módulo
   * desde Accesos y seguridad no cambia nada, y quitarlo tampoco. Es el caso que se vive como
   * «lo encendí y no pasó nada», y no hay forma de notarlo desde la pantalla.
   *
   * La cota es la que había al medirlo. **Bajarla es progreso**: cada controlador que pasa a
   * declarar su módulo entra bajo el gobierno de la matriz, y hay que bajar también este número.
   * Subirla significa que se añadió otro fuera de control.
   */
  it('no crece el número de controladores que la matriz no gobierna', () => {
    const fueraDeLaMatriz: string[] = [];

    for (const ruta of controladores(API_SRC)) {
      const fuente = readFileSync(ruta, 'utf8');
      const tieneRoles = fuente.includes('@Roles(');
      const tieneModulo = ['@ModuleScope(', '@RequiresPermission(', '@RequiresFeature(']
        .some((decorador) => fuente.includes(decorador));
      if (tieneRoles && !tieneModulo) {
        fueraDeLaMatriz.push(ruta.slice(API_SRC.length + 1).replace(/\\/g, '/'));
      }
    }

    if (fueraDeLaMatriz.length) {
      console.log(
        `\nControladores que la pantalla de permisos no gobierna (${fueraDeLaMatriz.length}):\n`
        + fueraDeLaMatriz.map((archivo) => `  ${archivo}`).join('\n')
        + '\n',
      );
    }
    /*
     * Seis, y los seis son de infraestructura: el acceso, la salud del servicio, las métricas, las
     * subidas, las imágenes y los avisos. Ninguno pertenece a un módulo del producto, así que
     * gobernarlos desde la pantalla de permisos no tendría sentido.
     *
     * Lo que vigila esta cota es que no aparezca un séptimo **del producto**: ese sí sería un
     * módulo que se enciende en Accesos y no pasa nada.
     */
    expect(fueraDeLaMatriz.length).toBeLessThanOrEqual(6);
  });
});
