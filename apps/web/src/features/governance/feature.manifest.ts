import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'governance',
  name: 'Gobernanza',
  enabled: true,
  navigation: [{ label: 'Políticas internas', path: '/governance', icon: '🏛️', roles: ['admin', 'operations_director'] }],
  routes: [],
});
