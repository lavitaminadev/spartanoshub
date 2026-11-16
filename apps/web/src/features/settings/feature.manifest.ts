import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Mi configuración',
  // Dirección Comercial es la propietaria; Desarrollo conserva el acceso técnico.
  navigation: [{ label: 'Configuración', path: '/settings', icon: '⚙️', roles: ['dev', 'commercial_director'] }],
  routes: [],
});
