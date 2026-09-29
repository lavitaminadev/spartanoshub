import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'registro-de-correos',
  name: 'Correos enviados',
  navigation: [
    // Herramienta de diagnóstico, no una pantalla de la operación: sólo desarrollo la ve. Los
    // asuntos nombran clientes y leads de todas las empresas.
    {
      label: 'Correos enviados',
      path: '/registro-de-correos',
      icon: '✉',
      roles: ['dev'],
    },
  ],
  routes: [],
});
