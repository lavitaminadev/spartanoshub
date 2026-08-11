import { registerFeature } from '../../core/navigation.registry';

/**
 * Solicitudes: la puerta de entrada a producción.
 *
 * Los cargos declarados incluyen a quien ejecuta —diseño, audiovisual, community— porque abrir
 * una solicitud es justamente lo que reemplaza al mensaje suelto. El permiso de asignar y
 * convertir se resuelve dentro de la página y en el backend, no escondiendo el menú.
 */
registerFeature({
  id: 'intake',
  name: 'Solicitudes',
  enabled: true,
  navigation: [{
    label: 'Solicitudes',
    path: '/intake',
    icon: '📝',
    roles: [
      'admin', 'operations_director', 'commercial_director', 'creative_director',
      'art_director', 'av_director', 'community_manager', 'designer', 'audiovisual', 'ai_lead',
    ],
  }],
  routes: [],
});
