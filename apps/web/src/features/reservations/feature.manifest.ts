import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y captacion',
  navigation: [
    // **Una sola entrada, sin cascada.** Reservas se recorre entero desde su propia barra
    // (`ReservationsLayout`), igual que el CRM: la lateral solo necesita la puerta. Publicar sus
    // cinco secciones acá metía un módulo entero en el menú general y obligaba a volver a la
    // lateral para pasar de la bandeja a la agenda.
    {
      label: 'Reservas',
      path: '/reservations',
      icon: '🗓️',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
  ],
  routes: [],
});
