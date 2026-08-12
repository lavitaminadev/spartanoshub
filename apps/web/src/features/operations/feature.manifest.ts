import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'operations',
  name: 'Operaciones',
  enabled: true,
  navigation: [{ label: 'Estado del sistema', path: '/operations', icon: '⚙️', roles: ['admin', 'operations_director'] }],
  routes: [],
});
