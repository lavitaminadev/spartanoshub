/**
 * @fileoverview Manifiesto de la feature de Encuestas.
 *
 * Registra la entrada de navegación de `/surveys`. Las rutas en sí (incluida `/surveys/create`
 * y `/surveys/:id/results`) se declaran en `core/router.tsx`, igual que el resto de las
 * features: el manifiesto solo aporta el ítem de menú y, con eso, la sección a la que
 * pertenece en `NAVIGATION_SECTIONS`.
 */

import type { UserRole } from '@espartanos/shared';
import { registerFeature } from '../../core/navigation.registry';

/**
 * Roles que pueden crear, editar y cerrar encuestas.
 *
 * Mismo criterio que Reservas (`admin`, dirección de operaciones y comercial, y quien opera
 * el día a día con el cliente): las encuestas —internas o a clientes— son una herramienta de
 * medición operativa, no de dirección creativa o de producción.
 */
export const SURVEY_MANAGE_ROLES: UserRole[] = [
  'admin',
  'operations_director',
  'commercial_director',
  'community_manager',
];

/**
 * Roles que pueden abrir el dashboard de resultados sin poder editar la encuesta.
 *
 * Hoy es el mismo conjunto que puede gestionar: separarlo queda listo para el día en que
 * alguien deba ver resultados sin permiso de crear o cerrar encuestas.
 */
export const SURVEY_RESULTS_ROLES: UserRole[] = SURVEY_MANAGE_ROLES;

registerFeature({
  id: 'surveys',
  name: 'Encuestas',
  navigation: [
    { label: 'Encuestas', path: '/surveys', icon: '📋', roles: SURVEY_MANAGE_ROLES },
  ],
  routes: [],
});
