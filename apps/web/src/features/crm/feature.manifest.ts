import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'crm',
  name: 'CRM',
  navigation: [
    // Son dos CRM distintos y no deben leerse como un mismo embudo:
    //
    // 1. Contactos de campañas — el CRM DE LOS CLIENTES. Personas que llegaron por las
    //    campañas de cada cliente, incluidas las que reservaron. Lo opera el equipo.
    // 2. Prospectos / Pipeline / Actividad — el CRM DE LA VITAMINA. Las empresas que la
    //    agencia quiere sumar como clientes. Es de dirección comercial.
    //
    // Los separa `leads.domain` en la base desde la migración 0069, y la barra del CRM los
    // muestra en dos grupos con ese mismo nombre.
    //
    // **Una sola entrada en la lateral.** Las nueve secciones viven en la barra propia del CRM
    // (`CrmLayout`), que es donde se navega una vez adentro. Publicarlas también acá ponía diez
    // entradas de un módulo en la lateral, empujaba fuera de vista a los demás y ofrecía dos
    // caminos al mismo sitio que se marcaban activos de forma distinta.
    //
    // Sin lista de cargos: quién ve el CRM lo decide la matriz de permisos, que se edita en
    // Configuración. Enumerarlos acá obligaba a tocar código y desplegar para un cambio que la
    // pantalla ya sabe hacer, y mantenía dos respuestas a la misma pregunta.
    //
    // Se conserva la segunda entrada para community managers porque no es una cuestión de
    // permiso sino de destino: el inicio del CRM lo sirve `crm-home.controller`, que no los
    // acepta, así que su puerta es la sección de contactos de campaña. Las dos se llaman «CRM»
    // y sus condiciones no se solapan, de modo que cada persona ve exactamente una.
    { label: 'CRM', path: '/crm', icon: '🏁', roles: ['admin', 'dev', 'commercial_director', 'operations_director'] },
    { label: 'CRM', path: '/crm/contacts', icon: '🏁', roles: ['community_manager'] },
  ],
  routes: [],
});
