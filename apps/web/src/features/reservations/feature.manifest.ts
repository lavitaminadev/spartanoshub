import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y captacion',
  navigation: [
    {
      label: 'Reservas',
      path: '/reservations',
      icon: '🗓️',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Agenda del día',
      path: '/reservations/agenda',
      icon: '📆',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Disponibilidad',
      path: '/reservations/calendar',
      icon: '🗓️',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Lista de espera',
      path: '/reservations/waitlist',
      icon: '⏳',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
    {
      label: 'Resultados de reservas',
      path: '/reservations/analytics',
      icon: '📊',
      roles: ['admin', 'operations_director', 'commercial_director', 'community_manager'],
    },
  ],
  routes: [],
});
