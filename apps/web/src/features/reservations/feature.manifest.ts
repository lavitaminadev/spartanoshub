import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'reservations',
  name: 'Reservas y captacion',
  navigation: [
    // **Una sola entrada, sin cascada.** Reservas se recorre entero desde su propia barra
    // (`ReservationsLayout`), igual que el CRM: la lateral solo necesita la puerta. Publicar sus
    // cinco secciones acá metía un módulo entero en el menú general y obligaba a volver a la
    // lateral para pasar de la bandeja a la agenda.
    // Sin lista de cargos, igual que el CRM. La enumeración dejaba fuera al cargo cliente, así
    // que una empresa con Reservas contratado entraba a su portal y no encontraba la entrada:
    // el permiso estaba (`reservations: 'edit'` en la matriz) y la capacidad también, pero el
    // menú la descartaba antes de mirar ninguna de las dos. Quién ve Reservas lo deciden ahora
    // el permiso efectivo y, en un portal, el servicio contratado por su empresa.
    {
      label: 'Reservas',
      path: '/reservations',
      icon: '🗓️',
    },
  ],
  routes: [],
});
