import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'automations',
  name: 'Automatizaciones',
  navigation: [
    // Automatizaciones todavía no forma parte de la operación liberada. Desarrollo la conserva
    // para validar el producto sin exponerla a administración ni a las direcciones.
    {
      label: 'Automatizaciones',
      path: '/automations',
      icon: '⚡',
      roles: ['dev'],
    },
  ],
  routes: [],
});
