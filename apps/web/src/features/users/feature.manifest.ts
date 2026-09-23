import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'users',
  name: 'Usuarios',
  /*
    El cargo cliente entra en la lista, pero no entra solo.

    La lista de cargos abre la puerta; el permiso efectivo del módulo decide quién pasa, y a una
    cuenta de empresa sin el permiso se le sigue negando como a cualquier otra. Sin el cargo
    aquí, en cambio, el permiso no alcanzaba: la ruta se rechazaba antes de mirarlo.
  */
  navigation: [{ label: 'Usuarios', path: '/users', icon: '👤', roles: ['admin', 'dev', 'commercial_director', 'operations_director', 'client'] }],
  routes: [],
});
