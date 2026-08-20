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
    // El "pipeline" es el recorrido por etapas de las oportunidades (nuevo → calificado →
    // propuesta → negociación → ganado/perdido); los prospectos son quienes entran a él.
    // Va primero porque es la puerta: dice qué atender antes de mostrar cualquier lista.
    //
    // Sin `admin` a propósito: la matriz no le da el módulo `crm`, así que ofrecérselo en el menú
    // solo produciría una entrada que lleva a una pantalla cerrada. Las demás entradas de acá lo
    // listan por arrastre histórico y hay una prueba que impide que esa contradicción crezca.
    { label: 'Inicio del CRM', path: '/crm', icon: '🏁', roles: ['commercial_director', 'operations_director'] },
    // Solo dirección comercial: el tablero muestra el mismo embudo que «Posibles clientes», que
    // pertenece a `commercialPipeline`, y la matriz no le da ese módulo a operaciones. El inicio
    // del CRM sí lo ve, porque resume sin entrar al detalle de cada trato.
    { label: 'Tablero de leads', path: '/crm/tablero', icon: '🗂️', roles: ['commercial_director'] },
    { label: 'Contactos captados', path: '/crm/contacts', icon: '🙋', roles: ['admin', 'commercial_director', 'operations_director', 'community_manager'] },
    { label: 'Posibles clientes', path: '/crm/leads', icon: '🌱', roles: ['admin', 'commercial_director'] },
    { label: 'Oportunidades de venta', path: '/crm/opportunities', icon: '🧭', roles: ['admin', 'commercial_director'] },
    // El tablero muestra las mismas oportunidades por etapa. Convive con la tabla en vez de
    // reemplazarla: la tabla sigue siendo mejor para revisar muchas a la vez y para exportar.
    { label: 'Tablero de pipeline', path: '/crm/pipeline', icon: '🗂️', roles: ['admin', 'commercial_director'] },
    { label: 'Actividad comercial', path: '/crm/interactions', icon: '☎️', roles: ['admin', 'commercial_director'] },
  ],
  routes: [],
});
