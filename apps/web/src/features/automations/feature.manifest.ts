import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'automations',
  name: 'Automatizaciones',
  navigation: [
    // Configurar una automatización es decidir que el sistema actúe solo sobre datos reales
    // en nombre de una persona, así que queda en dirección y no en el uso cotidiano. Es el
    // mismo criterio que aplica el controlador en el servidor.
    {
      label: 'Automatizaciones',
      path: '/automations',
      icon: '⚡',
      roles: ['admin', 'dev', 'commercial_director', 'operations_director'],
    },
  ],
  routes: [],
});
