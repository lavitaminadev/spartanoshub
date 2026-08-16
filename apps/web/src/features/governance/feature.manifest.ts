import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'governance',
  name: 'Operación y cuentas',
  enabled: true,
  navigation: [{ label: 'Gobierno del producto', path: '/governance', icon: '🏛️', roles: ['dev'] }],
  routes: [],
});
