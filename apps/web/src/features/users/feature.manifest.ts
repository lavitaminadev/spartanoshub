import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'users',
  name: 'Usuarios',
  navigation: [{ label: 'Usuarios', path: '/users', icon: '👤', roles: ['admin', 'dev', 'commercial_director'] }],
  routes: [],
});
