import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'admin-panel',
  name: 'Accesos y seguridad',
  enabled: true,
  navigation: [{ label: 'Accesos y seguridad', path: '/admin', icon: '🛡️', roles: ['admin', 'dev'] }],
  routes: [],
});
