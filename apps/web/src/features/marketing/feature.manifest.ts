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
  ],
  routes: [],
});
