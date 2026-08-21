import { UserRole } from '../../organizations/user-role.enum';

/**
 * Cargos que ven el embudo completo de las cuentas que alcanzan.
 *
 * Son la administración, las cinco direcciones y el cliente. Los tres primeros porque dirigir es
 * repartir trabajo: quien no ve lo de todos no puede notar que alguien está saturado ni que un
 * lead lleva tres semanas quieto. El cliente porque los leads de su empresa son suyos, y quién
 * de la agencia los trabaja es un detalle interno que no debería recortarle su propia lista.
 */
const VEN_TODO = new Set<UserRole>([
  UserRole.DEV,
  UserRole.ADMIN,
  UserRole.COMMERCIAL_DIRECTOR,
  UserRole.OPERATIONS_DIRECTOR,
  UserRole.CREATIVE_DIRECTOR,
  UserRole.ART_DIRECTOR,
  UserRole.AV_DIRECTOR,
  UserRole.CLIENT,
]);

/**
 * Si a esta persona el CRM debe mostrarle solo su propio trabajo.
 *
 * Es una segunda reja, distinta de la de cuentas. `AccountAccessService` decide **qué empresas**
 * alcanza alguien; ésta decide **cuánto ve dentro** de cada una. Sin ella, entrar a una cuenta
 * mostraba el embudo entero: el de uno y el de sus compañeros, con sus montos y sus notas.
 *
 * Quien queda acotado ve lo suyo **y lo que no tiene dueño**. Ocultar lo libre dejaría los leads
 * nuevos sin nadie que pudiera tomarlos: los vería solo quien ya ve todo, que es justo el que no
 * los va a trabajar.
 */
export function veSoloLoSuyo(role: string | undefined): boolean {
  return !VEN_TODO.has(role as UserRole);
}
