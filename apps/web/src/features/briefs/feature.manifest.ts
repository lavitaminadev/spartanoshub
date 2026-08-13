import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'briefs',
  name: 'Briefs',
  enabled: true,
  navigation: [{ label: 'Encargos del cliente', path: '/briefs', icon: '📋', roles: ['admin', 'operations_director', 'creative_director'] }],
  routes: [],
});
