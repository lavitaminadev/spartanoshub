import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'marketing',
  name: 'Suscriptores',
  navigation: [
    // Una cuenta de empresa la ve para descargar la suya; enviar campañas es de la agencia.
    {
      label: 'Suscriptores',
      path: '/suscriptores',
      icon: '✉',
    },
    /*
     * Escribir a la lista, sólo para el equipo.
     *
     * No basta con que el controlador rechace al cargo cliente: un menú que lleva a un 403 se lee
     * como sistema roto. El `roles` explícito es lo que hace que ni siquiera aparezca.
     */
    {
      label: 'Campañas',
      path: '/campanas',
      icon: '✉',
      roles: ['admin', 'commercial_director', 'dev'],
    },
  ],
  routes: [],
});
