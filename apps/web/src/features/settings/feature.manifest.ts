import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Mi configuración',
  navigation: [{ label: 'Mi configuración', path: '/settings', icon: '⚙️', roles: ['admin', 'operations_director', 'dev'] }],
  routes: [],
});
