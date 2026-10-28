import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'users',
  name: 'Usuarios',
  /*
    Dos entradas, dos rutas, un solo cuerpo (`EquipoYAccesos`).

    El cargo cliente tiene la suya, `/mi-equipo`, en vez de compartir la de la agencia: ve su
    local y nada más, y «Usuarios · Gestión de cuentas y permisos» anunciaba un alcance que no
    tiene. Van en rutas separadas y no en dos etiquetas sobre la misma porque
    `getAllowedRolesForPath` se queda con la primera entrada que encuentra para un camino: la
    segunda no se miraría, y los cargos de la otra quedarían fuera.

    En las dos listas, el cargo abre la puerta y el permiso efectivo del módulo decide quién pasa:
    a una cuenta de empresa sin el permiso se le sigue negando. Sin el cargo aquí, en cambio, el
    permiso no alcanzaba, porque la ruta se rechazaba antes de mirarlo.
  */
  navigation: [
    { label: 'Usuarios', path: '/users', icon: '👤', roles: ['admin', 'dev', 'commercial_director', 'operations_director'] },
    { label: 'Mi equipo', path: '/mi-equipo', icon: '👤', roles: ['client'] },
  ],
  routes: [],
});
