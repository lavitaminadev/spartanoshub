import { registerFeature } from '../../core/navigation.registry';

/**
 * Los correos automáticos tienen entrada propia, no una pestaña dentro de Accesos y seguridad.
 *
 * Esa pantalla es solo de administración y desarrollo, porque desde ahí se cambia la matriz de
 * permisos y el ciclo de vida de los módulos. Las plantillas de correo las escribe además
 * Dirección Comercial: el texto que recibe un prospecto o quien reserva es comunicación
 * comercial, y quien responde por ella tiene que poder corregirla.
 *
 * Meterla como pestaña obligaba a elegir entre dejar a Dirección Comercial sin acceso o darle
 * también la matriz de permisos. Con ruta propia cada pantalla tiene los cargos que le tocan.
 *
 * Cuelga del módulo `settings` porque es lo que gobierna el endpoint que usa.
 */
registerFeature({
  id: 'correos-automaticos',
  name: 'Correos',
  enabled: true,
  navigation: [{
    label: 'Correos',
    path: '/correos',
    icon: '✉️',
    /*
      El cargo cliente entra porque los correos que salen son los de su empresa.

      Qué plantillas ve lo deciden después sus servicios contratados y su permiso en cada módulo:
      una empresa solo con CRM no verá las de reservas. Entrar no es poder.
    */
    roles: ['admin', 'dev', 'commercial_director', 'client'],
  }],
  routes: [],
});
