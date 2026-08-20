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
   * `dev` se exceptúa porque `isRoleAllowedForPath` lo deja pasar siempre y la matriz le da
   * `manage` sobre todo el catálogo: no hay contradicción posible.
   *
   * `admin` también, y esa exclusión **no** es una conveniencia de la prueba: es una
   * contradicción real y sistémica que hay que decidir, no silenciar. Está declarado en 25
   * manifiestos y la matriz solo le da `dashboard`, `users`, `settings`, `integrations` y
   * `governance`. Resolverlo es elegir entre dos productos distintos —una administración que
   * opera el día a día o una que solo administra el sistema— y esa decisión no se toma desde
   * una prueba. Ver `docs/PERMISOS-ADMIN.md`.
   *
   * Mientras se decide, la prueba cubre a los demás cargos, que es donde una discrepancia
   * nueva sí sería un descuido y no una decisión pendiente.
   */
  const DECISION_PENDIENTE = new Set(['dev', 'admin']);

  it('ningún rol del menú carece del permiso que la ruta exige', () => {
    const contradicciones: string[] = [];

    for (const [path, roles] of navigation) {
      const moduleKey = modules.get(path);
      // Una ruta sin módulo declarado no pasa por la matriz: la gobiernan solo los roles.
      if (!moduleKey) continue;

      for (const role of roles) {
        if (DECISION_PENDIENTE.has(role)) continue;
        if (grantedLevel(role, moduleKey) === 'none') {
          contradicciones.push(`${path} ofrece "${role}" pero la matriz no le da "${moduleKey}"`);
        }
      }
    }

    expect(contradicciones, contradicciones.join('\n')).toEqual([]);
  });

  /**
   * Fija el alcance de la contradicción de `admin` para que no crezca sin que nadie lo note.
   *
   * Si alguien agrega `admin` a un manifiesto nuevo, este número sube y la prueba falla: la
   * decisión pendiente sigue pendiente, pero no se amplía en silencio. Y cuando se resuelva
   * —en cualquiera de las dos direcciones— el número baja y también falla, que es justo el
   * momento de borrar esta prueba.
   */
  it('la contradicción de admin no se amplía mientras no se decida', () => {
    const rutas = [...navigation]
      .filter(([path, roles]) => {
        const moduleKey = modules.get(path);
        return moduleKey && roles.includes('admin') && grantedLevel('admin', moduleKey) === 'none';
      })
      .map(([path]) => path);

    // Bajó de 27 a 22 al colapsar el menú del CRM a una sola entrada: las cinco rutas de CRM
    // que ofrecían `admin` sin darle el módulo (`/crm/leads`, `/crm/opportunities`,
    // `/crm/pipeline`, `/crm/interactions`, `/crm/contacts`) salieron de la lateral y ahora se
    // navegan desde la barra del propio CRM. La contradicción de fondo sigue sin decidirse en
    // las 22 restantes; lo que se retiró fue el tramo que dejó de tener entrada de menú.
    expect(rutas.length, `rutas donde el menú ofrece admin sin permiso:\n${rutas.join('\n')}`).toBe(22);
  });
});
