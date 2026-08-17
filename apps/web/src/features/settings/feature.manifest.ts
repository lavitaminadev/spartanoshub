import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Configuración',
  navigation: [{ label: 'Configuración', path: '/settings', icon: '⚙️', roles: ['admin', 'dev', 'operations_director'] }],
  routes: [],
});
