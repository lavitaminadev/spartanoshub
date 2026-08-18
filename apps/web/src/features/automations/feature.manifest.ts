import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'automations',
  name: 'Automatizaciones',
  navigation: [
    // Configurar una automatización es decidir que el sistema actúe solo sobre datos reales
    // en nombre de una persona, así que queda en dirección y no en el uso cotidiano. Es el
    // mismo criterio que aplica el controlador en el servidor.
    {
      // Los roles deben tener `crm` en la matriz de permisos, que es lo que el guardia de ruta
      // comprueba de verdad. `admin` no lo tiene: declararlo acá prometía una pantalla que el
      // guardia bloqueaba, y el menú nunca la mostraba.
      label: 'Automatizaciones',
      path: '/automations',
      icon: '⚡',
      roles: ['dev', 'commercial_director', 'operations_director'],
    },
  ],
  routes: [],
});
