import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'admin-panel',
  name: 'Panel de Administración',
  enabled: true,
  navigation: [{ label: 'Control de acceso', path: '/admin', icon: '🛡️', roles: ['admin'] }],
  routes: [],
});
