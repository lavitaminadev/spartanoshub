/**
 * Nombre legible de cada cargo.
 *
 * Vive acá y no dentro de una pantalla porque lo usan varias: gobierno para asignar
 * responsables de una etapa y la barra lateral para el selector de previsualización. Dos
 * copias del mismo mapa acaban divergiendo en cuanto alguien renombra un cargo en una sola.
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administración',
  dev: 'Desarrollo',
  commercial_director: 'Dirección comercial',
  creative_director: 'Dirección creativa',
  operations_director: 'Dirección de operaciones',
  art_director: 'Dirección de arte',
  av_director: 'Dirección audiovisual',
  ai_lead: 'Automatización',
  community_manager: 'Community manager',
  designer: 'Diseño',
  audiovisual: 'Audiovisual',
  client: 'Cliente',
};

/** Etiqueta del cargo, o el valor crudo si no está en el mapa. */
export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}
