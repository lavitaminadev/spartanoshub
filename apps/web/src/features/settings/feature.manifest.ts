import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Mi configuración',
  navigation: [{ label: 'Configuración técnica', path: '/settings', icon: '⚙️', roles: ['dev'] }],
  routes: [],
});
