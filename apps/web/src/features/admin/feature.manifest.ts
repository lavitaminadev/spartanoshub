import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'admin-panel',
  name: 'Panel de Administración',
  enabled: true,
  navigation: [{ label: 'Permisos del equipo', path: '/admin', icon: '🛡️', roles: ['admin', 'dev'] }],
  routes: [],
});
