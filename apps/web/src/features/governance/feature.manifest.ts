import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'governance',
  name: 'Operación y cuentas',
  enabled: true,
  navigation: [{ label: 'Operación y cuentas', path: '/governance', icon: '🏛️', roles: ['admin', 'operations_director', 'dev'] }],
  routes: [],
});
