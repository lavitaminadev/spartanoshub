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
    // Sin `admin` a propósito: la matriz no le da el módulo `crm` ni `commercialPipeline`, así
    // que las cinco entradas que lo listaban llevaban a pantallas cerradas. Colapsar a una es
    // también lo que retira esa contradicción en vez de contenerla con una prueba.
    { label: 'CRM', path: '/crm', icon: '🏁', roles: ['commercial_director', 'operations_director'] },

    // Dos entradas, pero con roles disjuntos: cada persona sigue viendo exactamente una.
    //
    // El inicio del CRM lo sirve `crm-home.controller`, que no acepta community managers. Su
    // puerta es la sección de contactos de campaña, que es además la única del CRM que les
    // corresponde: el resto es el embudo de la agencia. Llevarlas a `/crm` habría sido ofrecer
    // una pantalla que el backend rechaza —o ampliarle el acceso al inicio para justificar el
    // menú, que es decidir un permiso desde la navegación.
    { label: 'CRM', path: '/crm/contacts', icon: '🏁', roles: ['community_manager'] },
  ],
  routes: [],
});
