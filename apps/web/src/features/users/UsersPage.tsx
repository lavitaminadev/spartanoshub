import { EquipoYAccesos } from './EquipoYAccesos';

/**
 * «Usuarios y accesos»: el equipo de la agencia, con el alcance de cada persona.
 *
 * La pantalla de la agencia. Quien administra una empresa atendida tiene la suya, `MiEquipoPage`,
 * y no entra aquí: el manifiesto ya no ofrece esta ruta al cargo cliente. Si llegara igual —un
 * enlace viejo, una dirección escrita a mano—, el cuerpo recorta por cargo y vería su empresa y
 * nada más, así que la separación es de nombre y de menú, no de seguridad.
 */
export function UsersPage() {
  return <EquipoYAccesos />;
}
