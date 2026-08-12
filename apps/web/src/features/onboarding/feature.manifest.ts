import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'onboarding',
  name: 'Onboarding',
  enabled: true,
  navigation: [{ label: 'Alta de clientes', path: '/onboarding', icon: '🚀', roles: ['admin', 'operations_director'] }],
  routes: [],
});
