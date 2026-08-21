import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    // **Una sola entrada, sin cascada.** El CRM se recorre entero desde su propia barra
    // (`CrmLayout`), así que la lateral solo necesita la puerta. Publicar sus secciones acá
    // ponía diez entradas de un módulo en el menú general y ofrecía dos caminos al mismo sitio.
    //
    // Estuvo duplicada: eran dos entradas llamadas «CRM» con roles que se creían disjuntos
    // —una al inicio y otra a los contactos, porque el inicio no aceptaba community managers—.
    // `isRoleAllowedForPath` deja pasar siempre al cargo de desarrollo, así que él veía las dos.
    // Se resolvió abriendo el inicio a todos los cargos del CRM en vez de rodearlo con una
    // entrada extra.
    //
    // Sin lista de roles: quién ve el CRM lo decide la matriz de permisos, que se edita en
    // Configuración. Enumerarlos acá obligaba a desplegar para un cambio que la pantalla ya
    // sabe hacer, y mantenía dos respuestas a la misma pregunta.
    { label: 'CRM', path: '/crm', icon: '🏁' },
  ],
  routes: [],
});
