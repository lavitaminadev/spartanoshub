import { EquipoYAccesos } from './EquipoYAccesos';

/**
 * «Mi equipo»: las personas de un local, su perfil y qué datos ve cada una.
 *
 * La pantalla de quien administra una empresa atendida. Antes compartía ruta y nombre con la de la
 * agencia —«Usuarios y accesos · Gestión de cuentas y permisos»—, que anuncia un alcance que esa
 * cuenta no tiene: ve su local, no el equipo de La Vitamina. Tener ruta propia es lo que permite
 * nombrarla por lo que hace y sacarla del menú de la agencia.
 *
 * El cuerpo es el mismo y recorta por cargo, no por ruta: ver `EquipoYAccesos`.
 */
export function MiEquipoPage() {
  return <EquipoYAccesos />;
}
