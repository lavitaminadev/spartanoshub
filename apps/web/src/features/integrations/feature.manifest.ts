import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'integrations',
  name: 'Integraciones',
  navigation: [{ label: 'Conexiones', path: '/integrations', icon: '🔗', roles: ['admin', 'dev', 'commercial_director'] }],
  routes: [],
});
