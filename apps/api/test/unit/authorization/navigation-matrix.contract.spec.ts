import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../../src/core/authorization/role-permissions';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/**
 * Contrato entre los roles que promete el menú y los que la matriz concede.
 *
 * Son dos fuentes que responden la misma pregunta —quién ve esta pantalla— y viven en paquetes
 * distintos: la matriz en la API, la lista de roles en el manifiesto de cada feature del
 * frontend. Nada las obliga a coincidir.
 *
 * Cuando divergen no falla nada al compilar y el resultado es peor que un error: el menú
 * promete una pantalla que el guardia de ruta bloquea. Fue exactamente lo que pasó con
 * `admin`, que aparecía declarado en cuatro manifiestos sin tener ninguno de esos módulos en
 * su mapa. El menú no lo mostraba —el guardia gana— y la contradicción quedó invisible.
 *
 * La prueba que ya existía (`navigation-roles.contract.spec.ts`) compara el manifiesto con los
 * `@Roles` del **controlador**, que es otra cosa: un rol puede estar aceptado por el
 * controlador y no tener el módulo en la matriz. Esta cubre ese hueco.
 */

const REPO_ROOT = resolve(__dirname, '../../../../..');
const WEB_FEATURES = join(REPO_ROOT, 'apps/web/src/features');
const NAVIGATION_REGISTRY = join(REPO_ROOT, 'apps/web/src/core/navigation.registry.ts');

/**
 * Módulo de organización al que pertenece cada ruta, leído del registro del frontend.
 *
 * Se lee del archivo en vez de duplicar la tabla: si alguien agrega una ruta allá, esta prueba
 * la considera sin tener que acordarse de este archivo.
 */
function moduleByPath(): Map<string, string> {
  const source = readFileSync(NAVIGATION_REGISTRY, 'utf8');
  const result = new Map<string, string>();
  for (const entry of source.matchAll(/^\s*'(\/[^']*)':\s*'([a-zA-Z]+)',/gm)) {
    result.set(entry[1], entry[2]);
  }
  return result;
}

/** Roles declarados en la navegación de cada manifiesto, por ruta. */
function navigationRoles(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const feature of readdirSync(WEB_FEATURES, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const manifest = join(WEB_FEATURES, feature.name, 'feature.manifest.ts');
    if (!existsSync(manifest)) continue;
    const source = readFileSync(manifest, 'utf8');
    for (const entry of source.matchAll(/path:\s*'([^']+)'[^}]*?roles:\s*\[([^\]]*)\]/g)) {
      const roles = [...entry[2].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
      if (roles.length > 0) result.set(entry[1], roles);
    }
  }
  return result;
}

/** Nivel efectivo que la matriz concede a un rol sobre un módulo. Ausente equivale a `none`. */
function grantedLevel(role: string, moduleKey: string): string {
  const map = ROLE_PERMISSIONS[role as UserRole] as Record<string, string> | undefined;
  return map?.[moduleKey] ?? 'none';
}

describe('contrato entre el menú y la matriz de permisos', () => {
  const navigation = navigationRoles();
  const modules = moduleByPath();

  it('encuentra la tabla de módulos por ruta', () => {
    expect(modules.size).toBeGreaterThan(10);
  });

  /**
   * El menú no puede ofrecer una pantalla a un rol que la matriz no le concede.
   *
   * Ya no hay excepciones. `admin` estaba exceptuado mientras se decidía si administración
   * opera el día a día o solo administra el sistema: la contradicción abarcaba 22 rutas y una
   * prueba aparte impedía que creciera. Se resolvió abriendo el catálogo a todo el equipo y
   * dejando el recorte en la pantalla de permisos, así que ese hueco desapareció y con él la
   * prueba que lo contenía.
   *
   * El cargo de cliente sí puede quedarse corto a propósito —es el único de fuera de la
   * agencia—, pero no aparece en los manifiestos de la aplicación interna, así que tampoco
   * necesita excepción.
   */
  it('ningún rol del menú carece del permiso que la ruta exige', () => {
    const contradicciones: string[] = [];

    for (const [path, roles] of navigation) {
      const moduleKey = modules.get(path);
      // Una ruta sin módulo declarado no pasa por la matriz: la gobiernan solo los roles.
      if (!moduleKey) continue;

      for (const role of roles) {
        if (grantedLevel(role, moduleKey) === 'none') {
          contradicciones.push(`${path} ofrece "${role}" pero la matriz no le da "${moduleKey}"`);
        }
      }
    }

    expect(contradicciones, contradicciones.join('\n')).toEqual([]);
  });

});
