import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'dashboard',
  name: 'Dashboard',
  navigation: [{ label: 'Inicio', path: '/dashboard', icon: '📊' }],
  routes: [],
});
