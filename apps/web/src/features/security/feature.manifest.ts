import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'security',
  name: 'Seguridad y privacidad',
  enabled: true,
  navigation: [{ label: 'Seguridad y privacidad', path: '/security', icon: '🔒', roles: ['admin', 'dev'] }],
  routes: [],
});
