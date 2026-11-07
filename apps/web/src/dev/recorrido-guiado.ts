/**
 * El manual de funcionamiento del sistema, vista por vista.
 *
 * El menú agrupa por área y eso sirve para trabajar, no para entender: quien abre el sistema por
 * primera vez no sabe que una reserva deja un contacto en el CRM, ni que la encuesta sale de esa
 * visita, ni que el cupón vuelve a traer a la misma persona. Acá cada pantalla se cuenta entera y
 * los pasos se agrupan en flujos que se eligen: nadie tiene que recorrer el sistema completo para
 * entender los cupones.
 *
 * Lo que hace y cómo se lee van en campos distintos, y así se dibujan.
 *
 * `queHace` sólo admite lo que se puede señalar en el código; `comoSeLee` es criterio —qué
 * significa una cifra, para qué sirve una pantalla— y va bajo su propio encabezado. Mezclarlos fue
 * el defecto de la primera versión de este archivo: una opinión escrita con el mismo tono que una
 * función se lee como una función, y el lector no tiene cómo distinguirlas. Una frase con
 * «siempre», «sólo», «nunca» o «al instante» no entra en `queHace` sin haber abierto antes el
 * archivo que lo hace.
 *
 * `rol` va declarado en todos los pasos, sin heredarse del anterior. Un paso se puede alcanzar
 * desde su flujo, desde el recorrido completo o desde un salto de perspectiva, de modo que no
 * existe «el paso anterior»: heredar mostraría la pantalla desde el cargo de quien pasara por ahí.
 *
 * ## Cada cosa, con un nombre
 *
 * El manual explica un producto que ya tiene palabras para lo suyo. Usar dos para lo mismo
 * —«prospecto» y «trato», pongamos— obliga al lector a decidir en cada frase si está leyendo de
 * una cosa o de dos, y borra las distinciones donde el producto sí las sostiene.
 *
 * - **El comensal** es quien come. Nunca «el cliente»: ése es otro.
 * - **El cliente** es la empresa que contrata a la agencia, y el nombre del cargo que entra a su
 *   portal. Cuando hablo del sitio donde se come digo **el local**; cuando hablo de la cuenta, el
 *   contrato o los datos legales, **la empresa**.
 * - **El prospecto** es el restaurante que todavía no firma. Cuando ese prospecto tiene propuesta
 *   y fecha de cierre, lo que se abre es **una oportunidad**. Son dos registros, no dos palabras.
 * - **El servicio** es lo que una empresa contrató. **El módulo** es la pieza del producto que lo
 *   sostiene. Un servicio se vende; un módulo se enciende.
 * - **La agencia** es La Vitamina. «Espartanos» es el sistema, no quien atiende.
 */

/** Un flujo: un trozo del sistema que se entiende por sí solo, de principio a fin. */
export interface FlujoDelRecorrido {
  id: string;
  /** Cómo se llama en la portada. */
  nombre: string;
  /** Para quién es útil, en una línea. */
  para: string;
}

/**
 * Los flujos, en el orden en que pasan las cosas.
 *
 * El recorrido completo es la concatenación de todos sin repetir pasos, así que este orden es
 * también el del sistema contado de corrido.
 */
export const FLUJOS: FlujoDelRecorrido[] = [
  { id: 'comercial', nombre: 'Conseguir un cliente', para: 'Cómo entra un restaurante, se le hace seguimiento y termina firmando.' },
  { id: 'publicar', nombre: 'Publicar su página de reserva', para: 'Cómo se arma lo que verá el comensal y qué exige el sistema antes de dejarlo salir.' },
  { id: 'comensal', nombre: 'Reservar, desde el comensal', para: 'Todo lo que ve alguien de la calle, sin cuenta y desde el teléfono.' },
  { id: 'servicio', nombre: 'Atender el servicio', para: 'El día del local: quién viene, quién llegó, qué mesa, qué hacer si no hay cupo.' },
  { id: 'medir', nombre: 'Medir la experiencia', para: 'La encuesta que sale sola después de la visita y lo que se hace con la respuesta.' },
  { id: 'volver', nombre: 'Traerla de vuelta', para: 'Cupones y campañas: el negocio de que la misma persona vuelva.' },
  { id: 'producir', nombre: 'Producir el contenido', para: 'Lo que pide el cliente, quién lo hace, cuándo se publica y quién lo aprueba.' },
  { id: 'automatizar', nombre: 'Automatizar lo repetitivo', para: 'Lo que el sistema hace solo y cómo se comprueba que lo hizo.' },
  { id: 'resultados', nombre: 'Entregar resultados', para: 'Los números, qué representan y qué se le entrega al cliente cada mes.' },
  { id: 'portal', nombre: 'Lo que ve el cliente', para: 'Las cuatro empresas, cada una con lo que contrató y nada más.' },
  { id: 'gobierno', nombre: 'Quién puede qué', para: 'Permisos, datos protegidos, consentimiento y los derechos del comensal.' },
  { id: 'enObra', nombre: 'Construido y sin datos', para: 'Módulos que existen y están vacíos: se mira la estructura, no el contenido.' },
  { id: 'decidir', nombre: 'Lo que falta decidir', para: 'Cinco cosas que el sistema hace de una forma y nadie eligió que fueran así.' },
];

/** La misma cosa vista por otro cargo o desde otra empresa. */
export interface SaltoDePerspectiva {
  /** Cómo se ofrece el salto, en el panel. */
  etiqueta: string;
  ruta: string;
  rol: string;
  empresa?: string;
  /** Qué cambia al mirarlo desde ahí: es la razón de ofrecer el salto. */
  queCambia: string;
}

export interface PasoDelRecorrido {
  /** Ruta de la aplicación, tal como la escribe el router. */
  ruta: string;
  /** Qué es esta pantalla, en tres o cuatro palabras. */
  titulo: string;
  /** Los flujos en los que aparece. El primero es su casa. */
  flujos: string[];
  /** Desde qué cargo se ve. Obligatorio: no se hereda. */
  rol: string;
  /** Desde qué empresa se ve. Sólo cambia algo con el cargo cliente. */
  empresa?: string;
  /** Qué hay en pantalla, en dos líneas. */
  queVes: string;
  /** Qué se hacía a mano antes, o qué se rompe si esto no está. */
  porQueExiste: string;
  /** Lo que la pantalla hace, comprobado en el código. Nada que no se pueda señalar. */
  queHace: string[];
  /** Criterio: qué significa una cifra, para qué sirve la pantalla. No es comportamiento. */
  comoSeLee?: string[];
  /**
   * Lo que la auditoría encontró en esta pantalla, con su evidencia.
   *
   * Sale de `auditoria-main/`, que cuenta por archivo y línea lo que cada vista hace mal o a
   * medias. El manual explica qué hace una pantalla; sin esto no dice de qué no fiarse, y un
   * recorrido que sólo enseña lo que funciona no sirve para decidir nada.
   */
  queLeFalta?: string[];
  /** La misma cosa vista por otro cargo o otra empresa. */
  tambienDesde?: SaltoDePerspectiva[];
  /** Cuántos datos de muestra tiene la maqueta en esta vista. Por omisión, completos. */
  muestra?: 'parcial' | 'vacia';
}

export const RECORRIDO: PasoDelRecorrido[] = [
  // ------------------------------------------------------------- Conseguir un cliente
  {
    ruta: '/crm',
    titulo: 'La entrada al CRM',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'El punto de partida del CRM, con los dos embudos que conviven dentro: el comercial de la agencia y la audiencia de cada local.',
    porQueExiste: 'Son dos negocios distintos en la misma herramienta. Sin separarlos, un comensal que reservó aparecería como una oportunidad por cerrar.',
    queHace: [
      'Un registro lleva su dominio: comercial si es un restaurante que quiere contratar, audiencia si es un comensal de un local atendido.',
      'En el comercial, el nombre de la empresa es un campo del propio registro. En audiencia ese campo no significa nada y lo que manda es de qué local es la audiencia.',
    ],
    comoSeLee: [
      'Si una pantalla del CRM habla de cotizaciones, montos o redes sociales, es del embudo comercial. La audiencia del local no tiene nada de eso.',
    ],
  },
  {
    ruta: '/crm/tablero',
    titulo: 'El embudo comercial',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Siete restaurantes que quieren contratar a la agencia, cada uno en la etapa en que va su conversación. Esto pasa antes de que exista cliente alguno.',
    porQueExiste: 'El seguimiento comercial vivía en la cabeza de quien atendía y en mensajes sueltos. Cuando esa persona no estaba, nadie sabía por dónde iba un prospecto.',
    queHace: [
      'Las columnas son las etapas de la conversación, y una tarjeta se arrastra de una a otra.',
      'Las etapas se llaman como las llama la agencia: el vocabulario se edita en Administración del CRM, no en el código.',
      'El color del borde de una tarjeta es el de la persona que la atiende, no una alerta: sirve para reconocer de quién es sin leer el nombre.',
    ],
    comoSeLee: [
      'La suma de cada columna no es dinero ganado: es lo que habría si todo lo que está ahí cerrara. Sirve para comparar columnas entre sí, no para contarlo como ingreso.',
    ],
    queLeFalta: [
      'El puntaje de calidad se calcula y se guarda en cada prospecto (lead-intake.service.ts:552-649), pero ninguna pantalla lo muestra: sólo está declarado en los tipos (LeadDetailDrawer.tsx).',
      'Los intentos de contacto se piden y se guardan al descartar (LeadsBoardPage.tsx:406-416) y después no los lee nadie: no entran en el panel del embudo.',
      'Al descartar en lote, la pantalla afirma que se enviará a Meta como «Calificado» o «Descartado» (LeadsBoardPage.tsx:1525, 1542-1543); el envío se descarta si el prospecto no cumple condiciones, y el aviso no cambia.',
    ],
    tambienDesde: [
      { etiqueta: 'El otro embudo: la audiencia del local', ruta: '/crm/leads', rol: 'admin', queCambia: 'El mismo CRM con comensales en vez de restaurantes. Dos embudos distintos que comparten pantalla.' },
    ],
  },
  {
    ruta: '/crm/pipeline',
    titulo: 'El avance del embudo',
    flujos: ['comercial'],
    rol: 'dev',
    queVes: 'Las mismas etapas, pero mirando el movimiento: qué entró, qué avanzó y qué sigue donde estaba.',
    porQueExiste: 'El tablero dice dónde está cada prospecto hoy. Esta vista dice si se están moviendo, que es otra pregunta y la que importa a fin de mes.',
    queHace: [
      'Las etapas y su orden salen de la misma configuración que el tablero: cambiarlas en un sitio las cambia en los dos.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección comercial, que es quien la usará, le responde «no tienes acceso».',
      'Un embudo con mucho en las primeras etapas y poco al final puede ser un mes bueno que empieza o uno malo que ya se decidió. La diferencia la da compararlo con el mes anterior, no la foto.',
    ],
  },
  {
    ruta: '/crm/leads',
    titulo: 'Un prospecto en detalle',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'La lista plana de prospectos: de dónde llegó cada uno, cuánto se estima y quién lo atiende.',
    porQueExiste: 'El tablero sirve para ver el estado de todo. Esta lista sirve para encontrar a uno, y para trabajar de a muchos: filtrar, asignar, importar.',
    queHace: [
      'El origen dice por qué camino llegó: formulario, campaña, recomendación.',
      'Conviven las dos clases de registro: los contratos de la agencia, con monto, y los comensales de un local, sin monto.',
      'Se importan prospectos desde una planilla, y los que fallan quedan seleccionados para corregirlos sin volver a subir el archivo entero.',
    ],
    comoSeLee: [
      'El origen es lo que después permite saber qué camino trae clientes y cuál sólo trae ruido. Un prospecto sin origen no se puede atribuir a nada.',
    ],
    queLeFalta: [
      'La lista se pide sin límite y el servidor responde veinte por omisión (CrmRecordsPage.tsx:306, list-leads.use-case.ts). El selector de prospecto se alimenta de esos veinte.',
      'El servidor acepta filtrar por origen, campaña, anuncio, plataforma, campo propio y fechas (list-leads.dto.ts); la pantalla no ofrece esos controles.',
    ],
    tambienDesde: [
      { etiqueta: 'La ficha de un comensal', ruta: '/crm/contacts', rol: 'admin', queCambia: 'Una persona que reservó: sin monto, sin etapa comercial.' },
    ],
  },
  {
    ruta: '/crm/opportunities',
    titulo: 'Las oportunidades',
    flujos: ['comercial'],
    rol: 'dev',
    queVes: 'Los prospectos que ya tomaron forma de negocio: qué servicio, por cuánto, con qué fecha de cierre esperada.',
    porQueExiste: 'Un prospecto interesado y una oportunidad con propuesta sobre la mesa no se trabajan igual. Separarlos evita que lo serio se pierda entre lo que todavía es una conversación.',
    queHace: [
      'Cada oportunidad cuelga de un prospecto: se abre desde su ficha y vuelve a ella.',
      'Lleva fecha de cierre esperada y etapa propias, aparte de las del prospecto.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección comercial, que es quien la usará, le responde «no tienes acceso».',
      'El cierre esperado ponderado no es una previsión de caja: es la misma lista castigada según cuánta confianza da cada etapa. Sirve para comparar un mes con otro, no para prometerle un número a nadie.',
    ],
    queLeFalta: [
      'El pipeline abierto dice ahora sobre cuántas oportunidades está sumado cuando hay más de las que trae la consulta. Actividades y contactos siguen contándose sobre las cien que bajan.',
    ],
  },
  {
    ruta: '/crm/contacts',
    titulo: 'Los contactos',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Las personas, aparte de las empresas y de las oportunidades: quién es quién y dónde está.',
    porQueExiste: 'La persona sobrevive a la oportunidad. Si un contacto cambia de restaurante, lo que se sabe de él no se va con la oportunidad que se cayó.',
    queHace: [
      'Un contacto puede estar atado a una empresa cliente o a ninguna.',
      'Los campos que se guardan de una persona los define la agencia: hay campos propios configurables, no una tabla fija.',
    ],
    comoSeLee: [
      'Un contacto sin empresa no es un error: es una persona que todavía no se sabe dónde encaja, y se queda hasta que encaje.',
    ],
    queLeFalta: [
      'La pantalla pide cien contactos y filtra sobre esos cien (CrmRecordsPage.tsx:382). Con más, los que faltan no aparecen ni se avisa.',
    ],
  },
  {
    ruta: '/crm/interactions',
    titulo: 'La bitácora',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Todo lo que se habló con cada prospecto, en orden, con fecha y autor.',
    porQueExiste: 'Es la respuesta a «qué le dijimos la última vez» sin preguntarle a un compañero, y lo que permite que otra persona tome un prospecto sin empezar de cero.',
    queHace: [
      'Cada anotación guarda quién la creó y cuándo.',
      'El resultado de la gestión es una columna propia y no una frase dentro del texto, para poder filtrar por él.',
    ],
    comoSeLee: [
      'Los seguimientos vencidos son los únicos renglones de esta pantalla que piden algo hoy. El resto es historia.',
    ],
    queLeFalta: [
      'Las reservas de un prospecto se traen de cincuenta en cincuenta, sin total ni aviso, y se pintan como si fueran el historial completo (lead.controller.ts:397, CrmRecordsPage.tsx:127-129).',
    ],
  },
  {
    ruta: '/crm/calendario',
    titulo: 'Los seguimientos en el calendario',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Los compromisos del equipo comercial puestos en días: a quién hay que llamar y cuándo.',
    porQueExiste: 'Un seguimiento acordado y no agendado se olvida. Visto en calendario también se ve cuándo se prometió más de lo que cabe en un día.',
    queHace: [
      'Cada compromiso cuelga de un prospecto y se abre desde el calendario.',
    ],
    comoSeLee: [
      'Un día con cinco seguimientos y otro vacío no es organización, es que se agendó según quién insistió más. El calendario es donde eso se ve antes de que pase.',
    ],
  },
  {
    ruta: '/crm/administracion',
    titulo: 'Cómo se califica un prospecto',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Las conexiones que traen prospectos, el vocabulario de las etapas y las reglas que puntúan a cada uno.',
    porQueExiste: 'Antes había que salir del módulo para revisar por qué no entraban prospectos. Y sin reglas, «este prospecto es bueno» era la opinión de quien lo mirara.',
    queHace: [
      'Cada conexión de entrada muestra cuántos prospectos trajo y cuándo fue el último.',
      'El vocabulario de etapas se edita acá y lo toman el tablero y el avance del embudo.',
      'Las reglas suman o restan puntos según lo que el prospecto respondió, y se prueban contra un caso antes de dejarlas activas.',
    ],
    comoSeLee: [
      'El puntaje no dice si alguien va a firmar: dice a quién conviene llamar primero cuando hay treinta y una tarde.',
      'Con todas las reglas en cero el puntaje no significa nada, y la lista queda ordenada como si no existiera.',
    ],
    queLeFalta: [
      'Al aplicar reglas en lote, el resumen dice cuántas fallaron y no cuáles: el motivo se va al registro del servidor (reglas.service.ts:512).',
      'Las campañas aceptan fecha de inicio y de fin, se guardan y se devuelven (campaign.entity.ts:42-43), pero no hay dónde verlas ni ponerlas.',
      'Cinco enlaces de esta pantalla llevan a módulos cerrados: a un cargo sin acceso lo rebotan sin decir por qué (CrmAdminPage.tsx:507, 514, 520, 766, 788).',
    ],
  },
  {
    ruta: '/crm/dashboard',
    titulo: 'Cómo va el embudo',
    flujos: ['comercial', 'resultados'],
    rol: 'commercial_director',
    queVes: 'El estado del trabajo comercial en cifras: cuántos entraron, cuántos avanzaron, cuántos se cayeron y por qué.',
    porQueExiste: 'Sin esto, «el mes viene flojo» es una sensación. Acá se ve si entró menos gente o si entró la misma y se cayó más adelante, que se arreglan de maneras distintas.',
    queHace: [
      'Cada cifra lleva un subtítulo que la pone en contexto: el total y el promedio por día van juntos.',
      'Los motivos de pérdida se cuentan aparte del resto.',
    ],
    comoSeLee: [
      'Las entradas miden el trabajo de arriba del embudo: campañas, recomendaciones, formulario. Si bajan, el problema está antes del vendedor.',
      'La proporción de los que avanzan mide la conversación. Si baja con las entradas iguales, el problema está en cómo se vende, no en cuánta gente llega.',
    ],
    queLeFalta: [
      'Si la conciliación con la pauta publicitaria falla, el servidor devuelve nulo y la pantalla esconde el bloque entero (crm-dashboard.service.ts:103-104, CrmDashboardPage.tsx:558): un error se ve igual que no tener pauta.',
    ],
  },
  {
    ruta: '/clients',
    titulo: 'Las cinco empresas',
    flujos: ['comercial', 'portal'],
    rol: 'admin',
    queVes: 'Las empresas atendidas. El prospecto que firmó aparece acá y deja de ser una conversación para ser una cuenta con servicios.',
    porQueExiste: 'Es el único lugar donde se decide qué contrató cada empresa, y esa decisión manda sobre todo lo que sigue: menús, pantallas, correos y permisos.',
    queHace: [
      'La columna de servicios dice qué contrató cada empresa. Casa Costanera tiene Reservas y Encuestas, Hotel Mirador tiene Audiencia y no tiene Reservas, Café Plaza no tiene nada.',
      'Los módulos cuyo sujeto es una empresa atendida nacen apagados: encender uno es una decisión que se toma acá.',
      'Lo que no está contratado no aparece en el menú de esa empresa.',
    ],
    comoSeLee: [
      'Esta pantalla explica casi todo lo que el recorrido muestra después: si una empresa no tiene un servicio, las pantallas de ese servicio no existen para ella. No están atenuadas ni dicen «contrátalo».',
    ],
    tambienDesde: [
      { etiqueta: 'El portal de Café Plaza', ruta: '/portal', rol: 'client', empresa: 'visual-client-5', queCambia: 'Una empresa recién firmada, sin nada encendido: el estado real del primer día.' },
    ],
  },
  {
    ruta: '/clients/visual-client',
    titulo: 'La ficha de una empresa',
    flujos: ['comercial'],
    rol: 'admin',
    queVes: 'Casa Costanera por dentro: sus datos, sus servicios contratados y sus datos legales.',
    porQueExiste: 'Los datos legales de la empresa son requisito para publicar una página de reserva. Tenerlos acá y no en un correo es lo que permite que el sistema compruebe que están.',
    queHace: [
      'Los datos legales —razón social, identificación, domicilio— se guardan en la ficha y los exige el publicador de páginas de reserva.',
      'Los servicios contratados se encienden y apagan desde acá.',
    ],
    comoSeLee: [
      'Si los datos legales están incompletos, el problema no se ve acá: aparece después, cuando la página de reserva se niega a publicarse. Por eso la puesta en marcha los pide primero.',
    ],
  },
  {
    ruta: '/onboarding',
    titulo: 'La puesta en marcha',
    flujos: ['comercial'],
    rol: 'admin',
    queVes: 'La lista de pasos para dejar operando a un cliente nuevo, con lo hecho y lo que falta.',
    porQueExiste: 'La puesta en marcha se hacía de memoria y cada vez se olvidaba algo distinto. Lo que se olvida acá reaparece semanas después como «esto no funciona».',
    queHace: [
      'Los pasos están en el orden en que dependen unos de otros: los datos legales van antes que la página de reserva, porque publicar sin ellos lo rechaza el sistema.',
    ],
    comoSeLee: [
      'Es la misma lista que mira el cliente para saber en qué va lo suyo, así que cada paso está escrito para que lo entienda él y no el equipo.',
    ],
    tambienDesde: [
      { etiqueta: 'Lo que el cliente ve mientras tanto', ruta: '/portal', rol: 'client', empresa: 'visual-client-5', queCambia: 'Su portal sin nada encendido: es lo que tiene delante durante los días que dura esta lista.' },
    ],
  },

  // --------------------------------------------------- Publicar su página de reserva
  {
    ruta: '/reservations?tab=forms',
    titulo: 'Las páginas de reserva',
    flujos: ['publicar'],
    rol: 'operations_director',
    queVes: 'Las páginas de reserva del local, publicadas o en pausa, con su dirección pública.',
    porQueExiste: 'Un local puede tener más de una página —el restaurante, un evento, una sucursal— y hace falta poder pausar una sin borrarla ni perder su enlace.',
    queHace: [
      'Publicar exige el consentimiento declarado y los datos legales de la empresa; si faltan, la pantalla nombra lo que falta y no publica.',
      'Una página en pausa conserva su dirección y deja de aceptar reservas.',
      'La dirección pública se copia desde acá.',
    ],
    comoSeLee: [
      'Una página en pausa y una borrada se parecen en la lista y no en sus consecuencias: la pausada conserva el enlace que el local ya repartió por Instagram.',
    ],
  },
  {
    ruta: '/reservations/forms/visual-form',
    titulo: 'Una página por dentro',
    flujos: ['publicar'],
    rol: 'operations_director',
    queVes: 'El detalle de una página de reserva: su estado, su dirección, sus últimos cambios y su salud de medición.',
    porQueExiste: 'Entre armarla y publicarla hay decisiones que no son de diseño —si está viva, quién la tocó, si el pixel responde— y no caben en el constructor.',
    queHace: [
      'Guarda los últimos cambios de la página, de modo que se puede ver quién movió qué.',
      'Muestra el estado de la medición de esa página en concreto, no el de la cuenta entera.',
    ],
    comoSeLee: [
      'Los últimos cambios son lo que se mira cuando el local dice «ayer funcionaba». Casi siempre funcionaba, y alguien tocó algo.',
    ],
  },
  {
    ruta: '/reservations/forms/visual-form/design',
    titulo: 'El constructor',
    flujos: ['publicar'],
    rol: 'operations_director',
    queVes: 'La página pública armándose: horarios, zonas, qué se le pregunta al comensal y el texto legal que tiene que aceptar.',
    porQueExiste: 'Cada restaurante pregunta cosas distintas y atiende a horas distintas. Sin esto habría que programar una página por cliente, y cambiar un horario sería un despliegue.',
    queHace: [
      'Los bloques se arrastran al formulario: cada uno es una pregunta que verá el comensal.',
      'Las zonas —terraza, salón, barra— llevan cada una su propio cupo.',
      'El texto legal se guarda con versión, y lo que acepta un comensal queda atado a la versión que leyó.',
    ],
    comoSeLee: [
      'Cada pregunta que se añade acá baja la proporción de gente que termina de reservar. Preguntar algo tiene un precio, y se paga en la pantalla de números.',
    ],
    queLeFalta: [
      'La pantalla muestra «Retener cupo» con cinco minutos por omisión y el servidor usa diez si el local no lo fija (ReservationBuilderPage.tsx:607, reservations.service.ts:2304).',
      '«Tolerancia antes de no-show» se guarda y no lo lee nadie: ninguna regla la usa (ReservationBuilderPage.tsx:645).',
      'La misma idea de tolerancia se guarda con dos claves distintas según dónde se edite (AjustesDelDia.tsx:329-331, ReservationBuilderPage.tsx:645).',
      '«Nombre de esta campaña» se guarda en la página y lo lee un solo sitio: no llega a las métricas de campaña (reservation-form.entity.ts:26).',
    ],
    tambienDesde: [
      { etiqueta: 'Verlo publicado, como el comensal', ruta: '/book/casa-costanera', rol: 'client', empresa: 'visual-client', queCambia: 'Lo mismo sin sesión y desde el teléfono: la prueba de que lo que se armó acá es lo que sale a la calle.' },
    ],
  },
  {
    ruta: '/reservations/locals/visual-local',
    titulo: 'El local y su operación',
    flujos: ['publicar'],
    rol: 'operations_director',
    queVes: 'El local como unidad: sus páginas, sus zonas y los ajustes de su operación diaria.',
    porQueExiste: 'Una empresa puede tener varios locales y cada uno abre a horas distintas. Los ajustes que son del local no pueden vivir dentro de una página de reserva.',
    queHace: [
      'Reúne en una pantalla las páginas de reserva de ese local y sus ajustes de operación.',
    ],
    comoSeLee: [
      'Un local con varias páginas de reserva no es un desorden: suele ser un restaurante con un evento, o una terraza que se gestiona aparte.',
    ],
  },
  {
    ruta: '/correos',
    titulo: 'Los correos del local',
    flujos: ['publicar'],
    rol: 'dev',
    queVes: 'Veinte plantillas de correo editables, cada una para un momento: confirmación, recordatorio, cambio, cancelación, invitación a la encuesta, cupón.',
    porQueExiste: 'El correo es casi todo el contacto del local con el comensal después de reservar. Si lo escribe el sistema con palabras genéricas, el local suena como un software.',
    queHace: [
      'El asunto y el cuerpo se editan con variables entre llaves: nombre, local, hora, código de la reserva.',
      'Cada plantilla tiene su propio interruptor: un aviso se puede apagar sin borrar su texto.',
      'Las plantillas son por empresa: dos restaurantes no comparten el texto.',
      'Si un ajuste no responde, el correo sale con el texto de fábrica del mismo catálogo, no vacío.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección de operaciones, que es quien la usará, le responde «no tienes acceso».',
      'La vista previa de la maqueta genera el HTML con el mismo código que arma el correo real, así que lo que se ve acá es lo que llegaría.',
    ],
  },
  {
    ruta: '/integrations',
    titulo: 'La medición de la publicidad',
    flujos: ['publicar', 'resultados'],
    rol: 'dev',
    queVes: 'El centro de medición: la conexión con Meta, el pixel que atribuye reservas a la publicidad y la biblioteca de imágenes.',
    porQueExiste: 'Sin esto, el local paga publicidad y no sabe cuántas reservas trajo.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección de operaciones, que es quien la usará, le responde «no tienes acceso».',
      'Sin datos de muestra: se mira la estructura.',
    ],
    queLeFalta: [
      'La pantalla anuncia que Google llegará «en futuras fases» y el servidor ya tiene nueve rutas de Google construidas y sin pantalla que las llame (google.controller.ts, IntegrationsPage.tsx:58-60).',
      'Crear y editar integraciones existe en el servidor y ninguna pantalla lo usa (integrations.controller.ts:29-55).',
    ],
    queHace: [
      'El pixel se asigna por empresa, y la pantalla lista cuáles son elegibles.',
      'Hay un estado de salud de la conexión, aparte de la conexión misma.',
      'La biblioteca de imágenes guarda logos y fotos con las credenciales de la propia agencia.',
    ],
  },

  // ------------------------------------------------------- Reservar, desde el comensal
  {
    ruta: '/book/casa-costanera',
    titulo: 'La página pública',
    flujos: ['comensal'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'Lo que ve alguien que llega desde Instagram. Sin cuenta, sin sesión, desde el teléfono.',
    porQueExiste: 'Es el único lugar donde el sistema habla con un desconocido. Todo lo demás del recorrido —la reserva, la encuesta, el cupón, la audiencia— nace acá.',
    queHace: [
      'Las horas que se ofrecen son las que tienen cupo en ese momento; una zona cerrada no aparece.',
      'El aviso de medición se puede rechazar y la reserva se completa igual.',
      'Lo que el comensal acepta se guarda con la versión del texto que leyó.',
      'Las notas de dieta y alergia quedan marcadas como dato protegido desde que se escriben acá.',
    ],
    comoSeLee: [
      'Que la reserva funcione sin aceptar la medición es deliberado: condicionarla no sería un consentimiento libre.',
    ],
    queLeFalta: [
      '«Te esperamos N minutos; después la mesa queda disponible» (PublicReservationPage.tsx:1065): ninguna regla libera esa mesa. La reserva sigue ocupando cupo hasta su hora de fin.',
      '«Enviaremos los detalles a tu correo» (PublicReservationPage.tsx:948) sale sólo si la plantilla de confirmación está encendida en esa empresa. Si está apagada, la frase se muestra igual.',
      'Al fallar la validación el foco no va al primer error, y los mensajes no dicen qué corregir (PublicReservationPage.tsx:555-565, 569).',
      'Los campos de nombre, teléfono y correo no declaran autocompletado ni tipo de teclado (PublicReservationPage.tsx:1200-1202): en un teléfono se escriben a mano enteros.',
    ],
    tambienDesde: [
      { etiqueta: 'Cómo entra al local', ruta: '/reservations', rol: 'operations_director', queCambia: 'Esta misma reserva en la pantalla del local.' },
    ],
  },
  {
    ruta: '/book/casa-costanera',
    titulo: 'El cupón, antes de reservar',
    flujos: ['comensal', 'volver'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'La misma página, en el bloque «Cupón de descuento»: el comensal escribe el código que le llegó por correo.',
    porQueExiste: 'Si el cupón se valida al reservar, el comensal sabe el descuento antes de comprometerse. Validarlo recién en la caja es donde se producen las discusiones.',
    queHace: [
      'El código se valida contra el local antes de confirmar la reserva.',
      'El rechazo nombra el motivo —vencido, agotado, ya usado— en vez de decir sólo que no sirve.',
      'El cupón queda guardado en la reserva, y si la reserva se cancela el uso se devuelve al cupón.',
    ],
    comoSeLee: [
      'En la maqueta funcionan VUELVE20 y VERANO20; CADUCADO muestra el rechazo. Son datos de muestra, no códigos del producto.',
    ],
  },
  {
    ruta: '/book/manage/token-visual-de-prueba-123',
    titulo: 'Cambiar o cancelar',
    flujos: ['comensal'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'La pantalla a la que llega el comensal con el enlace de su correo: su reserva, con cambiar la hora o cancelar.',
    porQueExiste: 'Una cancelación que el local sabe a tiempo es una mesa que se vuelve a vender. Una que llega por teléfono a las ocho de la noche, no.',
    queHace: [
      'El enlace es la credencial: no hay cuenta ni contraseña, y cada enlace sirve para una sola reserva.',
      'Cambiar la hora o el número de personas se valida contra el cupo, excluyendo la propia reserva del conteo.',
      'Si la página ya no está publicada, el cambio se rechaza.',
      'Al cancelar, si eso libera cupo, se dispara el aviso a quienes están en lista de espera de esa hora.',
    ],
    comoSeLee: [
      'Cuantas más cancelaciones lleguen por acá y menos por teléfono, mejor funciona: una cancelación con horas de aviso es una mesa que se vuelve a vender.',
    ],
    queLeFalta: [
      'Al pedir el enlace de gestión, el servidor devuelve como mucho cinco reservas futuras (reservations.service.ts:1710) y la página dice «te enviamos un enlace para gestionarlas». Con seis, llegan cinco.',
    ],
    tambienDesde: [
      { etiqueta: 'Lo mismo, desde el anfitrión', ruta: '/reservations/agenda', rol: 'operations_director', queCambia: 'El cambio aparece en el turno sin que nadie lo transcriba.' },
    ],
  },
  {
    ruta: '/survey/visual-survey',
    titulo: 'La encuesta en el teléfono',
    flujos: ['comensal', 'medir'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'La encuesta como la ve el comensal: sin sesión, desde el teléfono, en menos de un minuto.',
    porQueExiste: 'Es la parte que decide si hay datos o no hay nada. Una encuesta que se ve mal en un teléfono no se responde.',
    queHace: [
      'No pide cuenta ni registro.',
      'Con nota baja la respuesta queda marcada como que pide atención, y el cierre cambia: en vez de la reseña pública, abre un canal con el local.',
    ],
    comoSeLee: [
      'Separar el camino de la nota baja es lo que hace la diferencia entre enterarse el local y enterarse internet.',
    ],
    tambienDesde: [
      { etiqueta: 'Dónde cae esta respuesta', ruta: '/surveys', rol: 'operations_director', queCambia: 'La respuesta de Camila dentro de los resultados del local.' },
    ],
  },
  {
    ruta: '/solicitudes',
    titulo: 'Los derechos del comensal',
    flujos: ['comensal', 'gobierno'],
    rol: 'client',
    empresa: 'visual-client',
    muestra: 'vacia',
    queVes: 'La página pública donde cualquier persona pide acceso a sus datos, su corrección o su eliminación, y consulta el estado con un código.',
    porQueExiste: 'La ley le da ese derecho a la persona y obliga a atenderlo en plazo. Sin una puerta propia, la petición llega por mensaje directo y se pierde.',
    queHace: [
      'Es pública y sin cuenta: pedir que se borren los datos no exige registrarse.',
      'Devuelve un código de seguimiento con el que se consulta el estado sin dar más datos.',
      'Antes de enviar hay que abrir y aceptar el aviso de privacidad.',
      'La resolución cuenta qué se buscó y qué se hizo, no sólo que se cerró.',
    ],
    comoSeLee: [
      'Esta vista va sin datos de muestra: es un formulario, así que se ve entera, pero no hay solicitudes cargadas que consultar.',
    ],
    queLeFalta: [
      'La solicitud ofrece «anonimización o supresión de mis datos» y el borrado alcanza usuarios, prospectos, contactos y reservas: no toca suscriptores de marketing ni respuestas de encuesta (service-requests.service.ts:350-408).',
      'El estado vacío dice «no encontramos solicitudes para ese correo y RUT» cuando la consulta ya se hizo sólo con uno de los dos (SolicitudesPage.tsx:202).',
    ],
  },

  // --------------------------------------------------------------- Atender el servicio
  {
    ruta: '/reservations',
    titulo: 'El día de hoy',
    flujos: ['servicio'],
    rol: 'operations_director',
    queVes: 'La pantalla con la que abre el local: quién viene hoy, a qué hora, cuántas personas y en qué mesa.',
    porQueExiste: 'Es la hoja impresa que el anfitrión llevaba en la mano, con la diferencia de que ésta se actualiza cuando el comensal cambia la hora.',
    queHace: [
      'Las pestañas separan reservas, grupos, páginas, métricas y cupones.',
      'Los comensales con nota de dieta o alergia van marcados sin mostrar la nota.',
    ],
    comoSeLee: [
      'La reserva de Camila Rojas, hoy a las 20:00, mesa 12 en terraza, es la misma persona que sigue el recorrido entero: reserva, responde la encuesta y vuelve con un cupón.',
      'Los números de arriba son la carga del día, no un resultado: son con qué hay que contar esta noche.',
    ],
    queLeFalta: [
      'Los filtros de campaña, origen, medio y cupón se arman con los veinte registros que están a la vista, no con los valores que existen (ReservationsPage.tsx:341-351): filtrar por algo que está en la página 3 no se puede.',
      'Los botones «Asistió» y «No» de cada fila escriben un estado final: desde ahí no se vuelve (reservations.service.ts:188-194). Un clic equivocado no se deshace en la pantalla.',
      '«Exportar datos» es por local y no tiene selector: si antes no se eligió un formulario en el filtro, no sirve (ReservationsPage.tsx:679).',
    ],
    tambienDesde: [
      { etiqueta: 'El mismo día, en el portal del local', ruta: '/portal', rol: 'client', empresa: 'visual-client', queCambia: 'El dueño ve su día sin las herramientas del servicio: cuánta gente viene, no a quién sentar dónde.' },
    ],
  },
  {
    ruta: '/reservations?tab=bookings',
    titulo: 'La ficha de la reserva',
    flujos: ['servicio', 'gobierno'],
    rol: 'operations_director',
    queVes: 'Todo lo de una reserva: lo que respondió en el formulario, la nota de dieta, qué aceptó y el texto exacto que aceptó.',
    porQueExiste: 'Es la prueba. Si un comensal reclama que nunca autorizó que le escribieran, acá está qué versión del texto leyó y cuándo.',
    queHace: [
      'Guarda el historial del comensal: si es la primera vez o la quinta.',
      'La nota de dieta es dato protegido; en el nivel «bajo registro» se anota quién la pidió antes de entregarla, y si esa anotación falla el dato no sale.',
      'El cambio de estado —llegó, no llegó— es lo que alimenta después las métricas de ocupación.',
    ],
    comoSeLee: [
      'La constancia sólo se deja en el nivel «bajo registro». A quien tenga el nivel «directo» el dato le sale sin anotar nada: la trazabilidad depende de cómo esté configurado cada cargo.',
    ],
    queLeFalta: [
      'El historial se pide por dos rutas distintas que devuelven formas distintas de lo mismo: la lista usa /history y la ficha usa /historial (ReservationsPage.tsx:372, FichaDeReserva.tsx:55).',
      'El texto del consentimiento sensible se guarda en cada reserva, pero la pantalla manda null como texto al escribirlo (ReservationsPage.tsx:1060): la prueba que esta vista promete depende de que lo haya escrito otro camino.',
      '«Cancelar y avisar al cliente» avisa sólo si la reserva tiene correo y la plantilla está encendida (reservations.service.ts:2086, 2092). Una reserva tomada por teléfono se cancela en silencio y el botón no lo dice.',
    ],
    tambienDesde: [
      { etiqueta: 'Quién miró la alergia', ruta: '/security', rol: 'admin', queCambia: 'El registro de accesos a datos protegidos: la otra mitad de este mismo asunto.' },
    ],
  },
  {
    ruta: '/reservations/agenda',
    titulo: 'El turno',
    flujos: ['servicio'],
    rol: 'operations_director',
    queVes: 'La vista del anfitrión mientras hay gente en la puerta: quién llegó, quién falta, qué mesa.',
    porQueExiste: 'Durante el servicio no hay tiempo de buscar: la pantalla tiene que responder «quién es y dónde lo siento» de una mirada.',
    queHace: [
      'Marcar llegada es una acción de un toque.',
      'Los ajustes del día —cerrar, abrir, mover cupo— están en la misma pantalla del turno.',
    ],
    comoSeLee: [
      'Es la única pantalla del sistema que se usa de pie y con gente esperando. Todo lo que no se pueda hacer de un toque, acá no se hace.',
    ],
    queLeFalta: [
      'El total del día, los no-shows y la ocupación los cuenta ahora el servidor: la página sigue trayendo cien filas para dibujar, y las cifras ya no dependen de eso.',
      'La lista de grupos y eventos corta en cincuenta sin decirlo (reservations.service.ts:2425).',
      'Los errores al cerrar el turno se muestran genéricos y ocultan el motivo que el servidor sí devuelve (AgendaPage.tsx:259, 339, 352).',
    ],
  },
  {
    ruta: '/reservations/calendar',
    titulo: 'La disponibilidad',
    flujos: ['servicio'],
    rol: 'operations_director',
    queVes: 'El cupo por zona y por hora, de aquí a las próximas semanas.',
    porQueExiste: 'Es donde el local decide cuánta gente puede atender bien. Un cupo mal puesto se paga con cocina colapsada o con mesas vacías.',
    queHace: [
      'Cerrar un día o una zona se hace con un bloqueo, y la página pública ofrece sólo lo que tiene cupo, de modo que no hay un segundo sitio que actualizar.',
      'Los bloqueos sirven para eventos privados: el día existe pero no se ofrece.',
    ],
    comoSeLee: [
      'El cupo no es la capacidad física del local: es cuánta gente se puede atender bien. Ponerlo al máximo llena las mesas y vacía las reseñas.',
    ],
    queLeFalta: [
      'El tope del día se define en personas, pero la pantalla lo presenta junto a cuentas de reservas (reservations.service.ts:1064, AvailabilityCalendarPage.tsx:185): dos unidades distintas, una al lado de la otra.',
      'Cerrar un día manda la fecha sin zona horaria y el servidor la interpreta como UTC (AjustesDelDia.tsx:155-159, reservations.service.ts:692): en Chile eso corre el corte unas horas.',
    ],
    tambienDesde: [
      { etiqueta: 'Qué ve el comensal cuando no hay cupo', ruta: '/book/casa-costanera', rol: 'client', empresa: 'visual-client', queCambia: 'Una zona cerrada acá no aparece allá como cerrada: directamente no se ofrece.' },
    ],
  },
  {
    ruta: '/reservations?tab=groups',
    titulo: 'Las solicitudes de grupo',
    flujos: ['servicio'],
    rol: 'operations_director',
    queVes: 'Las peticiones de mesas grandes, que no se confirman solas: las acepta o las rechaza una persona.',
    porQueExiste: 'Una mesa de dieciocho no cabe en el cupo normal y casi siempre necesita una conversación. Dejarla entrar como reserva automática desordena el servicio.',
    queHace: [
      'Al entrar una solicitud, el sistema avisa al equipo del local y le manda un acuse a quien la pidió.',
      'Al aceptarla se convierte en una reserva normal.',
    ],
    comoSeLee: [
      'Que no se confirmen solas es la decisión importante: una mesa de dieciocho que entra sin que nadie la mire desarma el servicio de esa noche.',
    ],
    queLeFalta: [
      'El contador ya dice cuántas hay y cuántas se muestran, y los motivos de pérdida los cuenta el servidor sobre todas las solicitudes, no sobre la página.',
      'Al convertir una solicitud en reserva no se puede elegir servicio: la pantalla no manda ese campo (ReservationsPage.tsx:515).',
    ],
  },
  {
    ruta: '/reservations/waitlist',
    titulo: 'La lista de espera',
    flujos: ['servicio'],
    rol: 'operations_director',
    queVes: 'Quién quiso reservar cuando ya no quedaba cupo.',
    porQueExiste: 'Esa gente antes se perdía. Acá queda, y si se libera una mesa el sistema escribe sin que nadie tenga que acordarse.',
    queHace: [
      'Al entrar alguien, el equipo recibe un aviso y la persona un acuse.',
      'Cuando se libera cupo a esa hora, el aviso sale a los primeros veinte de la lista de esa hora, a todos a la vez.',
      'El aviso sólo sale si la página está publicada, la hora aún no pasó y la plantilla de ese correo está encendida.',
    ],
    comoSeLee: [
      'Avisar a veinte a la vez hace que gane quien reserve primero, no quien lleve más tiempo esperando: hoy es una carrera, no una cola. Está en el flujo «Lo que falta decidir», con quién decide.',
      'El largo de la lista es demanda que el local no está atendiendo. Sostenida, es el argumento para abrir otro turno.',
    ],
    queLeFalta: [
      'La página pública promete que el local revisará las solicitudes «en orden de llegada» (PublicReservationPage.tsx:908) y el aviso de cupo sale a los primeros veinte a la vez, sin orden (reservations.service.ts:1914-1934). La promesa está escrita; el orden, no.',
    ],
    tambienDesde: [
      { etiqueta: 'Cómo se anota el comensal', ruta: '/book/casa-costanera', rol: 'client', empresa: 'visual-client', queCambia: 'Desde fuera no se ve ninguna lista: se ve una hora sin cupo y la opción de dejar el contacto.' },
    ],
  },

  // ----------------------------------------------------------- Medir la experiencia
  {
    ruta: '/surveys',
    titulo: 'Las encuestas del local',
    flujos: ['medir'],
    rol: 'operations_director',
    queVes: 'Las encuestas activas del local y cuántas respuestas lleva cada una.',
    porQueExiste: 'Preguntar después de la visita es lo único que convierte una mala noche en información. Sin esto, la mala noche se va caminando y no vuelve.',
    queHace: [
      'La invitación la manda una tarea programada unas horas después de la visita, una sola vez por visita.',
      'No se le escribe a quien canceló.',
      'Hay un margen desde que se enciende el aviso, para no encuestar de golpe a todas las visitas anteriores.',
    ],
    comoSeLee: [
      'La encuesta mide lo que pregunta. Si sólo pregunta por la comida, el problema de la espera en la puerta no aparecerá nunca en los resultados.',
    ],
    tambienDesde: [
      { etiqueta: 'La misma encuesta, en el teléfono', ruta: '/survey/visual-survey', rol: 'client', empresa: 'visual-client', queCambia: 'Lo que acá es configuración, allá es un minuto de la noche de alguien.' },
    ],
  },
  {
    ruta: '/surveys/create',
    titulo: 'Armar una encuesta',
    flujos: ['medir'],
    rol: 'operations_director',
    queVes: 'El asistente que crea una encuesta: las preguntas, el momento del envío y qué pasa con una nota baja.',
    porQueExiste: 'Las encuestas largas no se responden. El asistente empuja a lo corto y a preguntar sólo lo que el local va a usar.',
    queHace: [
      'Cada pregunta elige su forma: estrellas, escala, texto libre.',
      'Se define el umbral bajo el cual una respuesta pide atención.',
    ],
    comoSeLee: [
      'El momento del envío decide la tasa de respuesta: demasiado pronto la persona sigue en la mesa, demasiado tarde ya no se acuerda.',
    ],
  },
  {
    ruta: '/surveys/visual-survey/results',
    titulo: 'Los resultados',
    flujos: ['medir', 'resultados'],
    rol: 'operations_director',
    queVes: 'Las respuestas una por una y el resumen de todas.',
    porQueExiste: 'El promedio sirve para saber si algo cambió; las respuestas sueltas sirven para saber qué cambiar. Hacen falta las dos cosas.',
    queHace: [
      'Cada respuesta queda atada a la visita de la que salió.',
      'Las respuestas marcadas como que piden atención se pueden separar del resto.',
    ],
    comoSeLee: [
      'La respuesta de Camila —cinco estrellas, pidiendo más opciones sin gluten— es lo mismo que anotó al reservar: el círculo se cierra sin que nadie una los datos a mano.',
      'El promedio no dice si el local es bueno: dice si cambió respecto de antes. Un cuatro coma dos estable y uno que viene cayendo son situaciones opuestas.',
      'Si responden muy pocos, el promedio es la opinión de cuatro personas y no sirve para decidir nada.',
    ],
    queLeFalta: [
      '«Respuestas» cuenta también las respuestas a medias, y la tasa se calcula sobre todos los destinatarios (survey-metrics.ts:129-131, SurveyResultsPage.tsx:471-476): dos cifras que no se refieren a lo mismo, una al lado de la otra.',
      'El botón de CSV dice cuántas respuestas lleva el archivo cuando el servidor recortó: antes se descargaba incompleto con nombre de completo.',
      'Las respuestas de texto libre se muestran hasta veinte y no se dice cuántas hay (SurveyResultsPage.tsx:348).',
    ],
    tambienDesde: [
      { etiqueta: 'De dónde salió esta respuesta', ruta: '/reservations?tab=bookings', rol: 'operations_director', queCambia: 'La visita que originó la encuesta, con lo que esa persona pidió al reservar.' },
    ],
  },

  // ------------------------------------------------------------- Traerla de vuelta
  {
    ruta: '/reservations?tab=coupons',
    titulo: 'Los cupones del local',
    flujos: ['volver'],
    rol: 'operations_director',
    queVes: 'Los cupones vivos del local y, arriba, qué pasó con todos: cuántos se usaron, cuáles se agotan o vencen.',
    porQueExiste: 'Un cupón es la herramienta del local para decidir cuándo vuelve la gente. Sin seguimiento es un descuento regalado a quien ya iba a venir.',
    queHace: [
      'Un cupón es porcentaje o monto fijo, con tope de usos, vigencia y límite por persona.',
      'Crear un cupón y cobrarlo son permisos distintos.',
      'Si una reserva con cupón se cancela, el uso vuelve al cupón.',
    ],
    comoSeLee: [
      'Los usos no son ventas: son personas que volvieron por este motivo y no por otro.',
      'Muchos enviados y pocos usados es un problema de a quién se le mandó, no del descuento.',
    ],
    queLeFalta: [
      'La pantalla no envía al guardar varios campos que el servidor acepta —vigencia por días de la semana, franja horaria, límite por persona— (dto/reservation.dto.ts:448-462, ReservationsPage.tsx:553): existen en el modelo y no se pueden poner desde acá.',
    ],
  },
  {
    ruta: '/reservations?tab=coupons',
    titulo: 'Quién cobra un cupón',
    flujos: ['volver'],
    rol: 'operations_director',
    queVes: 'Pulsa «Anotar cupón usado» y escribe un código: esto es lo que ve el cajero con el comensal delante.',
    porQueExiste: 'Quien cobra no debería poder crear cupones ni ver la audiencia del local. Son dos permisos distintos a propósito.',
    queHace: [
      'Responde si el código sirve, y si no sirve, por qué.',
      'Se anota con qué mesa y cómo pagó.',
    ],
    comoSeLee: [
      'Que responda una sola cosa es el punto: con gente esperando no se puede interpretar nada.',
      'En la maqueta, un código que empiece por NO devuelve el caso contrario. Es un atajo de la maqueta para ver los dos lados, no una regla del producto.',
    ],
    queLeFalta: [
      'El aviso «el cupón guardado ya no está activo» se decide con la lista de cupones que está cargada en pantalla (CuponAutomatico.tsx:76-81): si el cupón no venía en esa página, el aviso aparece sin que haya pasado nada.',
    ],
    tambienDesde: [
      { etiqueta: 'Lo mismo, visto por el dueño', ruta: '/reservations?tab=coupons', rol: 'admin', queCambia: 'El dueño ve el costo del descuento y el detalle de todos los canjes; el cajero no.' },
    ],
  },
  {
    ruta: '/reservations?tab=coupons',
    titulo: 'Qué pasó con un cupón',
    flujos: ['volver'],
    rol: 'admin',
    queVes: 'En «Ver usos»: cada canje con su camino, su consumo y su descuento.',
    porQueExiste: 'Es la rendición de cuentas del descuento. Sin esto, «la promoción funcionó» no se puede sostener ni desmentir.',
    queHace: [
      'Cada canje guarda por qué camino se usó: en el local o al reservar.',
      'Guarda el consumo asociado y el descuento aplicado.',
    ],
    comoSeLee: [
      'El consumo medio con cupón es la pregunta real: si quien usa el descuento gasta más que quien no lo usa, el cupón se paga solo. Si gasta lo mismo, el local está regalando margen.',
    ],
  },
  {
    ruta: '/campanas',
    titulo: 'El envío masivo',
    flujos: ['volver'],
    rol: 'dev',
    queVes: 'Las campañas de correo a la audiencia del local, con su avance y su resultado.',
    porQueExiste: 'Es lo que convierte una lista de comensales en gente que vuelve. Y es donde más fácil se infringe la ley, así que el sistema lo acota.',
    queHace: [
      'Cada destinatario lleva su propio enlace de baja, y ese pie no tiene interruptor que lo apague.',
      'Hay vista previa del correo tal como lo recibirá cada persona.',
      'Los fallidos se listan aparte de los enviados.',
      'Se puede medir el retorno de una campaña.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección de operaciones, que es quien la usará, le responde «no tienes acceso».',
      'El retorno se cuenta en reservas, no en aperturas: una campaña muy abierta que no llenó una mesa no sirvió de nada.',
    ],
    queLeFalta: [
      '«Llegó a X de Y» cuenta los mensajes que el servidor de correo aceptó, no los que llegaron (email.service.ts:132-135, CampanasPage.tsx:192).',
      'El pie de baja desaparece si falta la dirección pública de la aplicación o si se apaga el parámetro correspondiente (enlace-de-baja.ts:60-75). La pantalla afirma que cada envío lleva el suyo.',
      'Con destino «Quienes administran», el aviso de alcance sigue hablando del servicio contratado, que no aplica a ese destino (CampanasPage.tsx:323-326, 428-431).',
      'El editor arranca con «Espartanos (agencia)» como empresa por omisión (CampanasPage.tsx:53-55): un descuido manda la campaña desde la agencia y no desde el local.',
    ],
  },
  {
    ruta: '/suscriptores',
    titulo: 'Quién dio permiso',
    flujos: ['volver', 'gobierno'],
    rol: 'operations_director',
    queVes: 'La audiencia del local persona por persona: si dijo que sí, cuándo, desde qué dirección y el texto que aceptó.',
    porQueExiste: 'El permiso de marketing hay que poder demostrarlo, no afirmarlo. Esta pantalla es la prueba.',
    queHace: [
      'Guarda de dónde salió cada contacto, la dirección desde la que aceptó y el texto que aceptó.',
      'La baja es por empresa: la misma persona puede estar suscrita en un local y de baja en otro.',
      'Una baja no se revierte sola: una reserva nueva no vuelve a suscribir a quien se dio de baja.',
      'Declarar ser mayor de edad se guarda como un dato propio.',
      'Los suscritos se pueden descargar.',
    ],
    comoSeLee: [
      'Esta pantalla no sirve para conseguir audiencia: sirve para poder demostrar, el día que alguien reclame, que cada contacto dijo que sí y cuándo.',
    ],
    queLeFalta: [
      'Ya se pagina: las filas más allá de las doscientas se pueden mirar, y el filtro vuelve a la primera página al cambiar.',
      '«Último correo enviado» sólo lo escribe el saludo de cumpleaños (saludo-de-cumpleanos.job.ts:90). Para quien recibió campañas, la fecha es falsa (SuscriptoresPage.tsx:324).',
      'La descarga corta en cinco mil y luego dice «N direcciones descargadas» con el número de lo que bajó (suscriptores.service.ts:559). Con más de cinco mil, el aviso confirma una descarga incompleta.',
      'Con «Todas las empresas» elegido, el botón descarga la lista de la agencia, no la unión de las empresas (suscriptores.controller.ts:168).',
      'La pantalla dice que queda anotado quién descargó; el registro de auditoría sólo guarda escrituras, y esto es una lectura (audit.interceptor.ts).',
    ],
    tambienDesde: [
      { etiqueta: 'Dónde dijo que sí', ruta: '/book/casa-costanera', rol: 'client', empresa: 'visual-client', queCambia: 'El permiso que esta lista guarda se da en una casilla de la página pública, no en una conversación.' },
    ],
  },

  // --------------------------------------------------------- Producir el contenido
  {
    ruta: '/intake',
    titulo: 'Lo que pide el cliente',
    flujos: ['producir'],
    rol: 'creative_director',
    queVes: 'Las peticiones que entran desde los clientes, antes de ser trabajo: qué quieren, para cuándo y de qué tipo.',
    porQueExiste: 'Las peticiones llegaban por mensaje directo a quien el cliente tuviera a mano. Lo que no pasa por una sola puerta no se puede priorizar ni cobrar.',
    queHace: [
      'Una petición se convierte en trabajo al aceptarla, y ahí se eligen las piezas que saldrán de ella.',
      'El motivo es obligatorio al rechazar: una solicitud rechazada sin motivo se vuelve a pedir igual.',
    ],
    comoSeLee: [
      'Lo que entra por acá se puede priorizar y cobrar. Lo que entra por mensaje directo a alguien del equipo, no: por eso la puerta única importa más que el formulario.',
    ],
    queLeFalta: [
      'La bandeja baja las doscientas más recientes y el servidor devuelve el total; la pantalla lo ignora (intake.service.ts:183-188, IntakePage.tsx:132-134).',
      'El servidor deja filtrar por estado y la pantalla no lo usa: se filtra sobre lo que bajó (intake.controller.ts:70).',
      'Hay un recuento por estado en el servidor que ninguna pantalla pide (intake.controller.ts:84).',
    ],
  },
  {
    ruta: '/production',
    titulo: 'La cadena de producción',
    flujos: ['producir'],
    rol: 'dev',
    queVes: 'Todo el trabajo en curso: quién lo hace, de qué depende, para cuándo y en qué va.',
    porQueExiste: 'La capacidad del equipo es el límite real de la agencia. Sin verla, se promete lo que no se puede entregar y se descubre el día del vencimiento.',
    queHace: [
      'Una pieza puede depender de otras, y esas dependencias se guardan en la propia pieza.',
      'La pantalla muestra la capacidad configurada junto a la carga activa por persona.',
      'Las correcciones son una etapa de la cadena, no un estado aparte.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección creativa, que es quien la usará, le responde «no tienes acceso».',
      'Capacidad contra carga no mide productividad: mide cuánto más se puede aceptar sin incumplir lo ya prometido.',
    ],
    queLeFalta: [
      'Crear una pieza desde un brief está roto en la pantalla: el servidor acepta el brief y copia título y descripción, y la pantalla no lo manda (production.controller.ts:86, ProductionPage.tsx:306).',
      'Cancelar una pieza existe en el servidor y no tiene botón en ninguna pantalla (ProductionPage.tsx:316, WorkDetailPage.tsx:86).',
      'El servidor deja filtrar por persona asignada; la pantalla sólo manda estado y empresa (production.controller.ts:109, ProductionPage.tsx:150-151).',
    ],
    tambienDesde: [
      { etiqueta: 'De dónde vino este trabajo', ruta: '/intake', rol: 'creative_director', queCambia: 'La petición del cliente antes de ser trabajo, con lo que pidió en sus palabras.' },
    ],
  },
  {
    ruta: '/production/visual-pieza',
    titulo: 'Una pieza por dentro',
    flujos: ['producir'],
    rol: 'dev',
    muestra: 'parcial',
    queVes: 'El detalle de un trabajo: su estado, sus fechas, de qué depende y lo que se ha comentado sobre él.',
    porQueExiste: 'La discusión sobre una pieza acababa en un chat aparte del trabajo. Lo que se decidió sobre ella tiene que vivir con ella.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección creativa, que es quien la usará, le responde «no tienes acceso».',
    ],
    queHace: [
      'Lleva un hilo de comentarios atado a la pieza.',
      'Muestra sus dependencias y sus fechas en la misma pantalla que su avance.',
    ],
  },
  {
    ruta: '/content',
    titulo: 'La parrilla de publicaciones',
    flujos: ['producir'],
    rol: 'creative_director',
    queVes: 'El calendario de contenido por cliente: qué se publica, qué día y en qué formato.',
    porQueExiste: 'Lo que se produce hay que publicarlo en un orden que tenga sentido para el cliente. La parrilla es ese orden, y es lo que el cliente quiere ver antes de aprobar.',
    queHace: [
      'Las parrillas son por cliente y la planificación es semanal.',
      'Una publicación lleva su formato, su fecha y sus notas internas.',
    ],
    comoSeLee: [
      'La parrilla es lo que el cliente quiere ver antes de aprobar nada: no la pieza suelta, sino en qué orden van a aparecer sus semanas.',
    ],
  },
  {
    ruta: '/meetings',
    titulo: 'Las reuniones y sus acuerdos',
    flujos: ['producir'],
    rol: 'dev',
    queVes: 'Las reuniones con el cliente, con su acta: decisiones y acuerdos, no un relato de lo que se habló.',
    porQueExiste: 'Lo acordado en una reunión y no escrito se vuelve a discutir en la siguiente.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección creativa, que es quien la usará, le responde «no tienes acceso».',
    ],
    queHace: [
      'Las decisiones y acuerdos van en su propio campo, aparte de las notas.',
      'El estado distingue programada, completada y cancelada.',
      'Una reunión se puede publicar en el calendario.',
    ],
  },
  {
    ruta: '/audiovisual',
    titulo: 'Rodajes y referencias',
    flujos: ['producir'],
    rol: 'av_director',
    muestra: 'parcial',
    queVes: 'La planificación audiovisual: las sesiones de rodaje y los tableros de referencias que las guían.',
    porQueExiste: 'Un rodaje tiene restricciones que una pieza gráfica no tiene —fecha, lugar y gente— y mezclarlo en la misma cola las oculta.',
    queHace: [
      'Las referencias visuales se agrupan en tableros por cliente.',
      'Las sesiones se asignan a personas del equipo de producción.',
    ],
    comoSeLee: [
      'En la maqueta hay tableros de referencia, pero no sesiones cargadas: esa mitad de la pantalla sale vacía.',
    ],
  },

  // --------------------------------------------------- Automatizar lo repetitivo
  {
    ruta: '/automations',
    titulo: 'Las automatizaciones',
    flujos: ['automatizar'],
    rol: 'dev',
    queVes: 'Lo que el sistema hace solo: avisos, correos y tareas que se disparan cuando pasa algo.',
    porQueExiste: 'Las tareas repetitivas que dependen de que alguien se acuerde no se hacen los días de mucho trabajo, que son los días en que importan.',
    queHace: [
      'El interruptor está en el listado y no dentro del editor, para poder apagar una automatización problemática de un clic sin abrir su flujo.',
      'Hay un catálogo de automatizaciones ya resueltas, para no empezar en blanco.',
    ],
    comoSeLee: [
      'Cada automatización encendida es algo que el sistema hace en nombre de la agencia sin que nadie lo mire ese día. Conviene que la lista sea corta y se entienda entera.',
    ],
    queLeFalta: [
      'El selector de empresas de esta pantalla se alimenta de una lista que devuelve veinte por omisión y como mucho cien (list-clients.use-case.ts:16-17): con más empresas, las que faltan no se pueden elegir.',
    ],
  },
  {
    ruta: '/automations/auto-1',
    titulo: 'Cómo se arma una',
    flujos: ['automatizar'],
    rol: 'dev',
    queVes: 'El editor de una automatización: qué la dispara, qué condiciones pone y qué hace.',
    porQueExiste: 'Para que una automatización se pueda revisar hay que poder leerla. Escondida en el código, nadie fuera de desarrollo sabe qué hace el sistema en su nombre.',
    queHace: [
      'El disparador es un hecho del sistema; las condiciones acotan a qué casos se aplica; la acción es lo que ocurre.',
    ],
    comoSeLee: [
      'Leer una automatización tiene que ser posible para quien no la programó. Si para saber qué hace hay que preguntarle a desarrollo, está mal puesta.',
    ],
  },
  {
    ruta: '/automations/auto-1/runs',
    titulo: 'Si de verdad se ejecutó',
    flujos: ['automatizar'],
    rol: 'dev',
    queVes: 'El historial de ejecuciones de esa automatización, con lo que hizo o el error con que falló.',
    porQueExiste: 'Una automatización silenciosa que se cayó es peor que no tenerla: todos creen que el aviso salió.',
    queHace: [
      'Cada ejecución guarda su resultado y, si falló, el texto del error.',
    ],
    comoSeLee: [
      'Una automatización silenciosa que se cayó es peor que no tenerla: todos siguen creyendo que el aviso salió. Esta pantalla es la que convierte esa creencia en un dato.',
    ],
  },
  {
    ruta: '/registro-de-correos',
    titulo: 'Qué correos salieron',
    flujos: ['automatizar', 'gobierno'],
    rol: 'dev',
    queVes: 'Los correos enviados por el sistema, con destinatario, asunto y resultado.',
    porQueExiste: 'Es la respuesta a «no me llegó nada». Sin esto, la conversación es la palabra del cliente contra la del equipo.',
    queHace: [
      'Se busca por destinatario o por asunto.',
    ],
    comoSeLee: [
      'Es la pantalla que termina las discusiones. Un rechazo del servidor se ve acá antes de que el cliente lo note, y «no me llegó nada» deja de ser la palabra de uno contra la del otro.',
    ],
  },

  // ------------------------------------------------------------ Entregar resultados
  {
    ruta: '/reservations/analytics',
    titulo: 'Los números de reservas',
    flujos: ['resultados'],
    rol: 'operations_director',
    queVes: 'El camino completo de un comensal contado en cuatro números: abrió la página, empezó a reservar, confirmó, apareció.',
    porQueExiste: 'Sin esto «nos va bien» es una opinión. Acá se ve en qué escalón se cae la gente, y cada escalón se arregla distinto.',
    queHace: [
      'Cuenta las visitas y los inicios de reserva a partir de los eventos de la propia página, no de las reservas.',
      'Desglosa por zona y por origen de la visita —campaña, medio, contenido—.',
      'Separa las que aparecieron de las que no.',
    ],
    comoSeLee: [
      'La caída entre confirmó y apareció son las mesas que el local guardó y nadie usó: se paga en comida preparada y en gente a la que se dijo que no había sitio.',
      'La caída entre abrió y empezó no es del local, es de la página: algo en el formulario estorba.',
      'La ocupación por hora no mide éxito: dice a qué hora sobra sitio, que es la única hora que sirve promocionar.',
    ],
    tambienDesde: [
      { etiqueta: 'Lo mismo, en el portal del cliente', ruta: '/portal', rol: 'client', empresa: 'visual-client', queCambia: 'El cliente ve sus números sin el desglose interno.' },
    ],
  },
  {
    ruta: '/dashboard',
    titulo: 'El pulso de la operación',
    flujos: ['resultados'],
    rol: 'admin',
    queVes: 'Un puntaje de la operación con las dimensiones que lo componen y la próxima mejor acción.',
    porQueExiste: 'Cada módulo tiene sus números, pero nadie los mira todos. Esto responde «qué hago hoy» con una sola pantalla.',
    queHace: [
      'Cada dimensión declara la evidencia con la que se calculó.',
      'Una dimensión sin datos lo dice, en vez de puntuar cero.',
    ],
    comoSeLee: [
      'El puntaje no es una nota: es un orden de prioridades. Sirve para saber qué dimensión está peor que las otras, no para compararse con otra agencia.',
      'Que la próxima acción sea una sola es deliberado: una lista de diez urgencias no se hace.',
    ],
    queLeFalta: [
      'La tarjeta «Ingresos pagados» vive bajo «Últimos 12 meses» y ahora suma esa ventana, no toda la historia: es la suma de las barras de abajo (reports.controller.ts:211).',
      'El gráfico titulado «Rendimiento por tipo» agrupa por estado, no por tipo (DashboardPage.tsx:292-293).',
      'El bloque «Ciclo Maestro» son siete pasos escritos a mano: no sale de ningún dato de la cuenta (DashboardPage.tsx:270).',
    ],
  },
  {
    ruta: '/reports',
    titulo: 'El informe mensual',
    flujos: ['resultados'],
    rol: 'dev',
    queVes: 'Lo que se le entrega al cliente cada mes, armado con los datos del mes.',
    porQueExiste: 'El informe se hacía a mano copiando cifras de varias pantallas a una presentación. Ahí es donde se cometen los errores que el cliente sí nota.',
    comoSeLee: [
      'Ya está liberado: ocho cargos lo alcanzan por matriz y el restaurante ve el informe publicado en su portal. Antes lo abría sólo Desarrollo.',
      'Es el documento que se cierra, se redacta y se firma. Para preguntar por un rango cualquiera está el explorador, que no guarda nada.',
    ],
    queLeFalta: [
      '«Clientes por ingresos» muestra cinco y no dice que son los cinco primeros (reports.controller.ts:239, ReportsPage.tsx:360).',
      'Las unidades de dedicación se suman por el mes en que se creó la pieza, no por el de entrega, y se comparan con ingresos del mes (reports.controller.ts:213-231).',
      'El subtítulo promete «ingresos, carga y distribución real» y en la pantalla no hay carga por persona (ReportsPage.tsx:344).',
    ],
    queHace: [
      'Los informes se guardan por empresa y por periodo: se puede volver a abrir el de un mes anterior.',
      'Las cifras se toman de los módulos, no se escriben a mano.',
      'Cada indicador trae su variación contra el período anterior, calculada al generarlo y guardada con el informe.',
    ],
  },
  {
    ruta: '/reports',
    titulo: 'Explorar un período',
    flujos: ['resultados'],
    rol: 'commercial_director',
    queVes: 'Dos fechas, contra qué comparar, y la misma tabla de métricas del informe para el rango que se pida.',
    porQueExiste: 'El informe está atado al mes porque es un documento que se firma. La pregunta «cómo nos fue esta quincena» o «el fin de semana largo contra el del año pasado» no tenía dónde hacerse, y se respondía a mano.',
    queHace: [
      'Lee los mismos agregados del servidor que el informe mensual, así que preguntar por un mes completo da las cifras de ese informe.',
      'Comparar «el período anterior» toma los mismos días inmediatamente antes; un mes calendario se compara con el mes calendario anterior, no restando días.',
      'No guarda nada: es una consulta.',
    ],
    comoSeLee: [
      'La comparación de un mes de 31 días restando su duración se llevaba tres días del mes anterior al anterior. Por eso el mes completo se detecta y se corre por calendario: una prueba lo fija para los siete meses de 31 días.',
      '«Hasta» no se incluye, y las fechas se leen sobre el día de la actividad: la reserva por su visita, la pieza por su entrega, la oportunidad por su cierre.',
    ],
  },
  {
    ruta: '/clients',
    titulo: 'En qué se fueron las UD del mes',
    flujos: ['resultados'],
    rol: 'operations_director',
    queVes: 'La ficha de una empresa, con su presupuesto del mes y el libro de movimientos plegado debajo.',
    porQueExiste: 'Los tres totales dicen cuánto queda; esto dice en qué se gastó, que es la pregunta que llega cuando el número no cuadra con lo que la empresa esperaba.',
    queHace: [
      'Cada movimiento trae su efecto con signo, la pieza si la hubo, el motivo y **quién** lo hizo.',
      'Se une al presupuesto del mes y no a la fecha del movimiento: un ajuste escrito el día 1 pertenece al mes del presupuesto que toca.',
    ],
    comoSeLee: [
      'El restaurante no ve esto, y es deliberado: las UD son cómo la agencia mide su propia capacidad. En su portal ve el saldo del mes, porque decide si puede pedir otra pieza, y nada más.',
      'Quién movió qué sí viaja acá y no al portal: para el equipo es la pregunta que sigue, para la empresa es reparto interno.',
    ],
  },
  {
    ruta: '/reservations/analytics',
    titulo: 'A quién captaron las reservas',
    flujos: ['volver'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'Cuántas personas aceptaron recibir comunicaciones, cuántas sin confirmar, cuántas de baja y desde cuándo.',
    porQueExiste: 'Cada reserva cuyo formulario pide el consentimiento deja a esa persona en la lista de la empresa, con el texto que aceptó y su IP. Eso ocurre tenga o no Marketing contratado, así que la empresa captaba una lista que no podía ni mirar.',
    queHace: [
      'Pide Reservas y **no** Marketing: es el dato que la empresa captó por sus propias reservas.',
      'Las bajas se muestran: son la constancia de que cuando alguien se va, se respeta.',
      'Con la lista en cero el panel no aparece, en vez de decir «0 personas» e invitar a buscar una avería.',
    ],
    comoSeLee: [
      'Escribirles —segmentos, campañas, plantillas— sigue siendo Marketing y se sigue vendiendo. Acá no hay ningún botón de enviar: la cifra responde «qué tengo», no «qué puedo hacer con esto».',
      'Las que aceptaron sin confirmar el correo van aparte: contarlas como alcanzables sería prometer un alcance que no existe.',
    ],
  },
  {
    ruta: '/direction',
    titulo: 'Lo que todavía no se mide',
    flujos: ['resultados'],
    rol: 'dev',
    queVes: 'La pantalla de dirección, declarando qué métricas aún no tienen fuente de datos.',
    porQueExiste: 'Es una decisión del producto: una métrica sin instrumentación se marca como pendiente en vez de estimarse. Un número inventado contamina todas las decisiones que se toman con él.',
    queHace: [
      'Un indicador sin fuente aparece como «instrumentación pendiente» y no muestra cifra.',
      'Una métrica corregida se señala como tal.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección, que es quien la usará, le responde «no tienes acceso».',
      'Es la pantalla que mejor explica el criterio de la casa: no inventamos lo que aún no se mide.',
    ],
  },

  // --------------------------------------------------------- Lo que ve el cliente
  {
    ruta: '/portal',
    titulo: 'Portal: todo contratado',
    flujos: ['portal'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'El portal de Casa Costanera, que tiene Reservas y Encuestas. Es otra aplicación: otro menú, sólo sus datos.',
    porQueExiste: 'El cliente no necesita el sistema de la agencia, necesita lo suyo. Y nunca debe poder ver a otro restaurante, ni por accidente.',
    queHace: [
      'El menú muestra lo contratado y nada más.',
      'Pedir una empresa fuera de alcance responde «no existe», el mismo 404 que si no existiera.',
    ],
    comoSeLee: [
      'El 404 es a propósito: decir «existe pero no es tuyo» ya revelaría a quién atiende la agencia.',
    ],
  },
  {
    ruta: '/portal',
    titulo: 'Portal: sólo Reservas',
    flujos: ['portal'],
    rol: 'client',
    empresa: 'visual-client-3',
    queVes: 'Pastelería Alameda. El mismo portal con otra cosa contratada.',
    porQueExiste: 'Es la prueba de que lo contratado manda sobre lo que se ve. Compara el menú con el paso anterior.',
    queHace: [
      'Sin Encuestas ni Audiencia, esas secciones no se dibujan: no están atenuadas.',
      'El panel de inicio tampoco arma los bloques de lo no contratado.',
    ],
    comoSeLee: [
      'Compara el menú con el paso anterior: esa diferencia es toda la decisión comercial, hecha visible.',
    ],
  },
  {
    ruta: '/portal',
    titulo: 'Portal: sólo audiencia',
    flujos: ['portal'],
    rol: 'client',
    empresa: 'visual-client-4',
    queVes: 'Hotel Mirador del Valle, al revés que el anterior: tiene audiencia y no tiene reservas.',
    porQueExiste: 'No hay un orden obligatorio de contratación, y el sistema no debe asumir que Reservas es el primer paso.',
    queHace: [
      'Sin Reservas no hay página pública, ni agenda, ni cupones.',
      'La audiencia funciona igual, porque sus contactos pueden venir de una importación y no de una reserva.',
    ],
    comoSeLee: [
      'Sirve para ver que el orden de contratación no está impuesto: nadie tiene que empezar por Reservas.',
    ],
  },
  {
    ruta: '/portal',
    titulo: 'Portal: nada contratado',
    flujos: ['portal'],
    rol: 'client',
    empresa: 'visual-client-5',
    queVes: 'Café Plaza. Lo que ve un cliente recién firmado, antes de que comercial le encienda algo.',
    porQueExiste: 'Este estado existe de verdad y dura días. Si se viera como un error, el cliente nuevo pensaría que el sistema está roto el primer día.',
    queHace: [
      'El portal explica qué falta en vez de mostrar un menú vacío.',
    ],
    comoSeLee: [
      'Es el estado que hay que mirar al revisar la puesta en marcha: es lo que el cliente tiene delante mientras se le configura lo suyo, y dura días.',
    ],
  },

  // ---------------------------------------------------------------- Quién puede qué
  {
    ruta: '/users',
    titulo: 'El equipo de la agencia',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'Las personas de la agencia, su cargo y a qué empresas alcanzan.',
    porQueExiste: 'Doce cargos con permisos distintos. Sin un lugar donde verlo, los permisos se amplían de a uno y nadie sabe quién puede qué.',
    queHace: [
      'El cargo da el permiso base por módulo, y hay excepciones por persona y por empresa que se guardan aparte del cargo.',
      'El alcance por empresa acota qué datos ve cada cuenta.',
    ],
    comoSeLee: [
      'Una cuenta sin alcance declarado no es neutra: sin límite, alcanza todo. Un alcance vacío y un alcance sin límite son cosas opuestas.',
    ],
    queLeFalta: [
      '«Se cerrarán las sesiones activas y se generará una contraseña temporal» (UsersPage.tsx:604): la contraseña se genera, las sesiones de refresco no se revocan. Quien tuviera la sesión abierta sigue dentro.',
      'La clave temporal que se entrega no caduca (UsersPage.tsx:577).',
    ],
    tambienDesde: [
      { etiqueta: 'El mismo reparto, dentro de un local', ruta: '/mi-equipo', rol: 'client', empresa: 'visual-client', queCambia: 'La empresa reparte accesos a su gente con las mismas reglas, sobre un alcance mucho más pequeño.' },
    ],
  },
  {
    ruta: '/mi-equipo',
    titulo: 'El equipo del local',
    flujos: ['gobierno'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'Los perfiles que concede el administrador de la empresa: anfitrión, garzón, cajero.',
    porQueExiste: 'El local tiene que poder dar acceso a su propia gente sin pedírselo a la agencia.',
    queHace: [
      'Cada perfil se arma con áreas en nivel ver u operar.',
      'Conceder un nivel mayor al propio se rechaza con ese motivo: nadie da lo que no tiene.',
    ],
    comoSeLee: [
      'Que el local reparta sus propios accesos es lo que evita que cada alta de un garzón pase por la agencia. El límite es que nadie da lo que no tiene.',
    ],
    tambienDesde: [
      { etiqueta: 'Lo que ve el cajero', ruta: '/reservations?tab=coupons', rol: 'operations_director', queCambia: 'La pantalla de cobro con lo justo: un código, y sirve o no sirve.' },
    ],
  },
  {
    ruta: '/admin',
    titulo: 'La matriz de permisos',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'Quién puede qué, módulo por módulo y cargo por cargo, con las excepciones concedidas a personas concretas.',
    porQueExiste: 'El permiso de un cargo se decide una vez y afecta a todos los que lo tienen. Verlo en matriz es lo que permite notar que un cargo tiene de más.',
    queHace: [
      'Muestra la matriz de cargos y módulos, y por separado las excepciones por persona.',
      'Acá están los interruptores de módulo de la organización, y el servidor los reserva a Desarrollo: encender uno va después de desplegar y comprobar que funciona.',
      'Reúne también las versiones de consentimiento y quién aceptó cada una.',
    ],
    comoSeLee: [
      'Es la pantalla donde se nota lo que a nadie se le ocurre revisar: por ejemplo, qué cargos pueden tocar los interruptores de módulo.',
    ],
    tambienDesde: [
      { etiqueta: 'La reja que está por encima de la matriz', ruta: '/governance', rol: 'dev', queCambia: 'Un módulo cerrado ahí no se abre por mucho que la matriz lo conceda.' },
    ],
  },
  {
    ruta: '/governance',
    titulo: 'Gobierno del producto',
    flujos: ['gobierno'],
    rol: 'dev',
    queVes: 'Las plantillas de proceso con que trabaja la agencia y los pods: qué equipo atiende a qué empresas.',
    porQueExiste: 'La agencia reparte su trabajo por pods: un equipo atiende a unas empresas y no a otras. Sin esto, el alcance de cada persona se decide cuenta por cuenta.',
    queHace: [
      'Las plantillas de proceso se editan y se devuelven a su valor de origen.',
      'Un pod agrupa personas y empresas: es lo que después acota lo que ve cada quien.',
      'Lo administran dirección comercial y dirección de operaciones; administración lo ve.',
    ],
    comoSeLee: [
      'Esta pantalla no enciende ni apaga módulos, aunque se llame gobierno: los interruptores del producto están en la matriz de permisos y los mueve sólo Desarrollo.',
    ],
  },
  {
    ruta: '/security',
    titulo: 'Privacidad y datos protegidos',
    flujos: ['gobierno'],
    rol: 'dev',
    queVes: 'El nivel de datos protegidos por módulo y por persona, y el registro de quién pidió ver una alergia.',
    porQueExiste: 'Una alergia o una dieta es un dato de salud. Que lo vea cualquiera es un problema legal, y que no lo vea nadie impide atender la mesa.',
    queHace: [
      'Hay tres niveles: oculto, bajo registro y directo.',
      'Oculto responde 403 y no anota nada; bajo registro anota quién, qué registro y qué campos antes de entregar el dato, y si esa anotación falla el dato no sale; directo entrega sin anotar.',
      'El nivel más restrictivo gana cuando una petición alcanza a varias empresas.',
    ],
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Administración, que es quien la usará, le responde «no tienes acceso».',
      'Bajo registro recorta lo mismo que oculto: la diferencia no es cuánto se ve, es que quede constancia de haberlo pedido.',
    ],
    queLeFalta: [
      'El nivel «directo» entrega el dato sin dejar constancia: sólo «bajo registro» anota quién lo pidió (revelar-protegidos.ts). La trazabilidad que esta pantalla ofrece depende de cómo esté configurado cada cargo.',
      'El registro de accesos recoge escrituras; una descarga de datos es una lectura y no deja fila (audit.interceptor.ts).',
    ],
  },
  {
    ruta: '/legal',
    titulo: 'Los documentos legales',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'Lo que la ley obliga a publicar, cada documento con su versión y su fecha.',
    porQueExiste: 'Un consentimiento vale si se puede decir qué texto leyó la persona. Si el documento se edita sin versionar, todos los consentimientos anteriores quedan sin respaldo.',
    queHace: [
      'Cada documento se guarda con versión, y lo aceptado queda atado a una versión concreta.',
      'Publicar una versión nueva no cambia a qué versión quedaron atados los anteriores.',
      'Estos textos son los que muestra la página pública.',
    ],
    comoSeLee: [
      'La versión es lo que da valor a todo lo demás: sin ella, un consentimiento es la palabra de la agencia sobre qué decía el texto aquel día.',
    ],
  },
  {
    ruta: '/legal/terminos',
    titulo: 'Un documento publicado',
    flujos: ['gobierno'],
    rol: 'client',
    empresa: 'visual-client',
    queVes: 'Un documento legal como lo ve quien pulsa el enlace desde la página de reserva.',
    porQueExiste: 'El comensal tiene que poder leer lo que acepta sin salir del sitio ni buscarlo en otra parte.',
    queHace: [
      'Se abre sin sesión, con la versión vigente del documento.',
    ],
    comoSeLee: [
      'Que se abra sin sesión no es un detalle: un texto legal que exige entrar a algo para leerse no se ha publicado de verdad.',
    ],
  },
  {
    ruta: '/sesiones',
    titulo: 'Las sesiones abiertas',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'Desde qué aparatos está abierta la cuenta, con la opción de cerrar las demás.',
    porQueExiste: 'El teléfono del local se pierde o cambia de manos. Sin esto, la única forma de cortar el acceso es cambiar la contraseña y avisar a todo el equipo.',
    queHace: [
      'Describe el aparato lo justo para distinguir un computador de un teléfono.',
      'Cerrar las otras sesiones no cambia la contraseña.',
    ],
    comoSeLee: [
      'La descripción se queda corta a propósito: afinarla daría una falsa sensación de precisión sobre un dato que el navegador declara y no se puede comprobar.',
    ],
  },
  {
    ruta: '/settings',
    titulo: 'La configuración',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'El índice de lo configurable: accesos y seguridad, correos, biblioteca de imágenes, datos de la agencia.',
    porQueExiste: 'Separar el ajuste del trabajo diario. Lo que se toca una vez al año no debe estar donde lo que se usa cada noche.',
    queHace: [
      'Cada tarjeta lleva a su propia pantalla.',
      'Administración y Desarrollo entran a la misma pantalla y no ven lo mismo: la identidad de la agencia se edita con cualquiera de los dos, y el panel técnico sólo lo ve Desarrollo.',
      'Los ajustes de la agencia y los de una empresa atendida son juegos distintos.',
    ],
  },

  // -------------------------------------------------------- Construido y sin datos
  {
    ruta: '/contracts',
    titulo: 'Contratos',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'El lugar de los contratos firmados con cada empresa, y los paquetes de servicio con que se arman.',
    porQueExiste: 'Lo que se contrató manda sobre lo que se enciende. Tener el contrato al lado de los servicios evita discutir de memoria qué incluía.',
    queHace: [
      'Un contrato se asocia a una empresa y a paquetes del catálogo de servicios.',
    ],
    comoSeLee: [
      'Sin datos de muestra: se mira la estructura. Conectarla o dejarla fuera está en el flujo «Lo que falta decidir».',
    ],
  },
  {
    ruta: '/catalog',
    titulo: 'El catálogo de servicios',
    flujos: ['enObra'],
    rol: 'dev',
    muestra: 'vacia',
    queVes: 'Los servicios que vende la agencia y los paquetes que los agrupan.',
    porQueExiste: 'Es de donde salen los contratos y las oportunidades. Sin un catálogo, cada propuesta inventa su propio nombre para lo mismo.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Administración, que es quien la usará, le responde «no tienes acceso».',
    ],
    queHace: [
      'Separa servicios sueltos de paquetes.',
    ],
  },
  {
    ruta: '/billing',
    titulo: 'Facturación',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'Las facturas por empresa y periodo, y las notas de cobro.',
    porQueExiste: 'Lo contratado vive en el sistema; lo cobrado, todavía fuera. Esta pantalla es donde se juntarían.',
    queHace: ['Lista facturas y notas de cobro por empresa.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
  },
  {
    ruta: '/briefs',
    titulo: 'Briefs',
    flujos: ['enObra'],
    rol: 'creative_director',
    muestra: 'vacia',
    queVes: 'La estructura de los briefs de campaña, por cliente.',
    porQueExiste: 'Un brief incompleto se descubre cuando la pieza ya está hecha. Pedirlo con forma es más barato que corregir.',
    queHace: ['Un brief se asocia a un cliente.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
  },
  {
    ruta: '/documents',
    titulo: 'Documentos',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'El repositorio de documentos por cliente, con búsqueda.',
    porQueExiste: 'Las marcas, los logos y los manuales del cliente andan por correo. Acá tendrían un solo sitio.',
    queHace: ['Los documentos se filtran por cliente y por texto.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
  },
  {
    ruta: '/approvals',
    titulo: 'Aprobaciones',
    flujos: ['enObra'],
    rol: 'creative_director',
    muestra: 'vacia',
    queVes: 'La pantalla donde el cliente aprueba o pide cambios sobre una pieza.',
    porQueExiste: 'La aprobación por mensaje se pierde y no queda claro quién dijo que sí.',
    queHace: ['Lista lo que está esperando respuesta del cliente.'],
    comoSeLee: ['Sin datos de muestra. El estado vacío también es una vista real: es lo que ve un cliente que no tiene nada por aprobar.'],
  },
  {
    ruta: '/operations',
    titulo: 'Estructura operativa',
    flujos: ['enObra'],
    rol: 'dev',
    muestra: 'vacia',
    queVes: 'La capacidad asignada y la carga por persona, con los ciclos mensuales y los objetivos.',
    porQueExiste: 'Es la vista con la que se decide si se puede tomar un cliente más, antes de prometerlo.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Dirección de operaciones, que es quien la usará, le responde «no tienes acceso».',
      'Sin datos de muestra: se mira la estructura.',
    ],
    queLeFalta: [
      'La cabecera suma la capacidad semanal como si fuera la del periodo mostrado (get-operations-overview.use-case.ts:265-269, OperationsPage.tsx:192).',
      'El porcentaje de carga por persona divide piezas entre unidades de capacidad: dos unidades distintas en la misma fracción (OperationsPage.tsx:226, 235).',
      'El estado de un objetivo —activo, en pausa, terminado— existe en el servidor y la pantalla nunca lo manda ni lo muestra (dto/objective.dto.ts:110).',
    ],
    queHace: ['Cruza el equipo con su carga activa y con los objetivos del ciclo.'],
  },
  {
    ruta: '/knowledge',
    titulo: 'Base de conocimiento',
    flujos: ['enObra'],
    rol: 'dev',
    muestra: 'vacia',
    queVes: 'Lo que la agencia sabe y quiere no volver a explicar.',
    porQueExiste: 'El conocimiento de cómo se hacen las cosas vive en las personas que llevan más tiempo, y se va con ellas.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a el equipo, que es quien la usará, le responde «no tienes acceso».',
      'Sin datos de muestra: se mira la estructura.',
    ],
    queHace: ['Guarda artículos consultables por el equipo.'],
  },
  {
    ruta: '/gamification',
    titulo: 'Ranking del equipo',
    flujos: ['enObra'],
    rol: 'dev',
    muestra: 'vacia',
    queVes: 'El ranking interno y las disputas sobre su puntuación.',
    porQueExiste: 'Medir el trabajo del equipo con un puntaje sólo funciona si se puede reclamar. Las disputas son parte del diseño, no un añadido.',
    comoSeLee: [
      'Hoy sólo la abre Desarrollo: el módulo no está liberado en la reja de operación inicial, así que a Administración, que es quien la usará, le responde «no tienes acceso».',
      'Sin datos de muestra: se mira la estructura.',
    ],
    queHace: ['Lleva un ranking y un registro de disputas sobre él.'],
  },

  // ------------------------------------------------------------ Lo que falta decidir
  /*
   * Las decisiones salieron de contrastar el manual con el código, y por eso están acá.
   *
   * Tres pasos del recorrido decían «está anotado como decisión pendiente» y no había ninguna
   * lista: el manual mandaba a un sitio que no existía. Éste es ese sitio, y por eso cada paso
   * dice qué hace hoy el sistema, qué se decidiría y a quién le toca decidirlo.
   */
  {
    ruta: '/reservations/waitlist',
    titulo: 'Decidir: la lista de espera no es una cola',
    flujos: ['decidir'],
    rol: 'operations_director',
    queVes: 'La lista de espera, que parece una cola por orden de llegada y no se comporta como una.',
    porQueExiste: 'Al liberarse un cupo, el sistema escribe a los primeros veinte de esa hora, a todos a la vez. Gana quien reserve primero, no quien lleve más tiempo esperando.',
    queHace: [
      'El aviso sale sin orden declarado y sin plazo: no hay turnos ni se pasa al siguiente si uno no responde.',
      'Se envía sólo si la página está publicada, la hora no ha pasado y la plantilla está encendida.',
    ],
    comoSeLee: [
      'Decidir: si se queda como está —rápido, y el local llena la mesa— o pasa a ser una cola por orden, que es lo que la gente entiende por lista de espera y lo único defendible ante un reclamo.',
      'Decide: dirección de operaciones, porque es quien responde ante el local. Cambiarlo es trabajo de desarrollo en el aviso de cupo liberado.',
    ],
  },
  {
    ruta: '/governance',
    titulo: 'Decidir: catorce pantallas cerradas',
    flujos: ['decidir'],
    rol: 'dev',
    queVes: 'La lista de módulos del producto, con los que la reja de operación inicial mantiene cerrados.',
    porQueExiste: 'Quedan catorce pantallas del recorrido —informes, campañas, producción, reuniones, seguridad, entre otras— que sólo abre Desarrollo. A los cargos que van a usarlas les responde «no tienes acceso». Ajustes, correos y puesta en marcha ya se liberaron.',
    queHace: [
      'La reja se evalúa antes que el permiso y antes que el servicio contratado, así que no hay permiso que la salte.',
      'El cargo de desarrollo es el único que la atraviesa.',
    ],
    comoSeLee: [
      'Decidir: cuáles de las catorce se liberan y cuándo. No es una sola decisión: cada módulo se libera cuando está listo para que lo use alguien que no sea quien lo programó.',
      'Decide: el dueño del producto, módulo por módulo. Mientras tanto el manual lo dice en cada paso afectado, para que nadie crea que la maqueta está rota.',
    ],
  },
  {
    ruta: '/security',
    titulo: 'Decidir: la alergia que se ve sin dejar rastro',
    flujos: ['decidir'],
    rol: 'dev',
    queVes: 'Los niveles de datos protegidos, con el nivel «directo» entre ellos.',
    porQueExiste: 'En «bajo registro» se anota quién pidió ver una alergia antes de entregarla. En «directo» el dato sale sin anotar nada, y la trazabilidad depende de cómo esté configurado cada cargo.',
    queHace: [
      'Oculto responde 403 y no anota; bajo registro anota antes de entregar y falla cerrado si la anotación falla; directo entrega sin dejar constancia.',
    ],
    comoSeLee: [
      'Decidir: si una nota de salud puede estar alguna vez en «directo», o si el mínimo para ese campo es «bajo registro» para todos los cargos, sin excepción.',
      'Decide: quien responda por los datos personales ante la ley, no el equipo que atiende las mesas.',
    ],
  },
  {
    ruta: '/billing',
    titulo: 'Decidir: facturación y contratos, dentro o fuera',
    flujos: ['decidir'],
    rol: 'dev',
    queVes: 'Facturación, construida y vacía. Al lado, contratos y catálogo, en el mismo estado.',
    porQueExiste: 'Lo que cada empresa contrató ya vive en el sistema y manda sobre lo que se enciende. Lo que se le cobra, no: vive fuera.',
    queHace: [
      'Las pantallas existen y sus rutas responden; no hay nada detrás que las alimente.',
    ],
    comoSeLee: [
      'Decidir: conectarlas —y entonces el sistema sabe qué se cobró y puede cruzarlo con lo que se entregó— o retirarlas del menú, para que nadie entre y crea que se rompió.',
      'Decide: administración, porque es quien hoy factura por fuera y sabe qué costaría traerlo.',
    ],
  },
  {
    ruta: '/approvals',
    titulo: 'Decidir: lo construido que nadie usa',
    flujos: ['decidir'],
    rol: 'dev',
    queVes: 'Aprobaciones, briefs, documentos, conocimiento, ranking: siete pantallas sin datos de muestra en este recorrido.',
    porQueExiste: 'Están construidas y vacías. Una pantalla vacía no dice si está esperando datos, esperando una decisión o esperando que alguien la borre.',
    queHace: [
      'Cada una responde en su ruta y muestra su estado vacío.',
    ],
    comoSeLee: [
      'Decidir, para cada una: se termina y se usa, se deja visible como está, o se retira hasta que haya alguien que la necesite.',
      'Decide: dirección creativa y administración, según de quién sea la pantalla. Lo que no se decide se queda en el menú ocupando sitio y restando confianza al resto.',
    ],
  },
];

/**
 * Los pasos de un flujo: primero los suyos, después los prestados.
 *
 * El primer flujo que declara un paso es su casa, y ahí va en el orden del guion. En los demás va
 * al final, como añadido: una vista que vive en otro relato cae en medio de éste sin venir a
 * cuento, y lo que se lee no es la historia que el flujo prometió contar.
 */
export function pasosDelFlujo(flujo: string): number[] {
  const propios: number[] = [];
  const prestados: number[] = [];
  RECORRIDO.forEach((paso, i) => {
    if (paso.flujos[0] === flujo) propios.push(i);
    else if (paso.flujos.includes(flujo)) prestados.push(i);
  });
  return [...propios, ...prestados];
}

/**
 * El recorrido completo: todos los flujos en fila, sin repetir un paso.
 *
 * Un paso que está en dos flujos se cuenta en el primero que lo nombra, de modo que el recorrido
 * completo no obliga a ver dos veces la misma pantalla.
 */
export const ORDEN_COMPLETO: number[] = FLUJOS.reduce<number[]>((orden, flujo) => {
  for (const i of pasosDelFlujo(flujo.id)) if (!orden.includes(i)) orden.push(i);
  return orden;
}, []);
