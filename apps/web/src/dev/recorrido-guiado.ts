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
    porQueExiste: 'Son dos negocios distintos en la misma herramienta. Sin separarlos, un comensal que reservó aparecería como un trato por cerrar.',
    queHace: [
      'Un registro lleva su dominio: comercial si es un restaurante que quiere contratar, audiencia si es un comensal de un local cliente.',
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
    porQueExiste: 'El seguimiento comercial vivía en la cabeza de quien atendía y en mensajes sueltos. Cuando esa persona no estaba, nadie sabía por dónde iba un trato.',
    queHace: [
      'Las columnas son las etapas de la conversación, y una tarjeta se arrastra de una a otra.',
      'Las etapas se llaman como las llama la agencia: el vocabulario se edita en Administración del CRM, no en el código.',
      'El color del borde de una tarjeta es el de la persona que la atiende, no una alerta: sirve para reconocer de quién es sin leer el nombre.',
    ],
    comoSeLee: [
      'La suma de cada columna no es dinero ganado: es lo que habría si todo lo que está ahí cerrara. Sirve para comparar columnas entre sí, no para contarlo como ingreso.',
    ],
    tambienDesde: [
      { etiqueta: 'El otro embudo: la audiencia del local', ruta: '/crm/leads', rol: 'admin', queCambia: 'El mismo CRM con comensales en vez de restaurantes. Dos embudos distintos que comparten pantalla.' },
    ],
  },
  {
    ruta: '/crm/pipeline',
    titulo: 'El avance del embudo',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Las mismas etapas, pero mirando el movimiento: qué entró, qué avanzó y qué sigue donde estaba.',
    porQueExiste: 'El tablero dice dónde está cada trato hoy. Esta vista dice si se están moviendo, que es otra pregunta y la que importa a fin de mes.',
    queHace: [
      'Las etapas y su orden salen de la misma configuración que el tablero: cambiarlas en un sitio las cambia en los dos.',
    ],
    comoSeLee: [
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
    tambienDesde: [
      { etiqueta: 'La ficha de un comensal', ruta: '/crm/contacts', rol: 'admin', queCambia: 'Una persona que reservó: sin monto, sin etapa comercial.' },
    ],
  },
  {
    ruta: '/crm/opportunities',
    titulo: 'Las oportunidades',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Los tratos que ya tienen forma: qué servicio, por cuánto, con qué fecha de cierre esperada.',
    porQueExiste: 'Un prospecto interesado y un trato con propuesta sobre la mesa no se trabajan igual. Separarlos evita que lo serio se pierda entre lo que todavía es una conversación.',
    queHace: [
      'Cada oportunidad cuelga de un prospecto: se abre desde su ficha y vuelve a ella.',
      'Lleva fecha de cierre esperada y etapa propias, aparte de las del prospecto.',
    ],
    comoSeLee: [
      'El cierre esperado ponderado no es una previsión de caja: es la misma lista castigada según cuánta confianza da cada etapa. Sirve para comparar un mes con otro, no para prometerle un número a nadie.',
    ],
  },
  {
    ruta: '/crm/contacts',
    titulo: 'Los contactos',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Las personas, aparte de las empresas y de los tratos: quién es quién y dónde está.',
    porQueExiste: 'La persona sobrevive al trato. Si un contacto cambia de restaurante, lo que se sabe de él no se va con el trato que se cayó.',
    queHace: [
      'Un contacto puede estar atado a una empresa cliente o a ninguna.',
      'Los campos que se guardan de una persona los define la agencia: hay campos propios configurables, no una tabla fija.',
    ],
  },
  {
    ruta: '/crm/interactions',
    titulo: 'La bitácora',
    flujos: ['comercial'],
    rol: 'commercial_director',
    queVes: 'Todo lo que se habló con cada prospecto, en orden, con fecha y autor.',
    porQueExiste: 'Es la respuesta a «qué le dijimos la última vez» sin preguntarle a un compañero, y lo que permite que otra persona tome un trato sin empezar de cero.',
    queHace: [
      'Cada anotación guarda quién la creó y cuándo.',
      'El resultado de la gestión es una columna propia y no una frase dentro del texto, para poder filtrar por él.',
    ],
    comoSeLee: [
      'Los seguimientos vencidos son los únicos renglones de esta pantalla que piden algo hoy. El resto es historia.',
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
  },
  {
    ruta: '/correos',
    titulo: 'Los correos del local',
    flujos: ['publicar'],
    rol: 'operations_director',
    queVes: 'Veinte plantillas de correo editables, cada una para un momento: confirmación, recordatorio, cambio, cancelación, invitación a la encuesta, cupón.',
    porQueExiste: 'El correo es casi todo el contacto del local con el comensal después de reservar. Si lo escribe el sistema con palabras genéricas, el local suena como un software.',
    queHace: [
      'El asunto y el cuerpo se editan con variables entre llaves: nombre, local, hora, código de la reserva.',
      'Cada plantilla tiene su propio interruptor: un aviso se puede apagar sin borrar su texto.',
      'Las plantillas son por empresa: dos restaurantes no comparten el texto.',
      'Si un ajuste no responde, el correo sale con el texto de fábrica del mismo catálogo, no vacío.',
    ],
    comoSeLee: [
      'La vista previa de la maqueta genera el HTML con el mismo código que arma el correo real, así que lo que se ve acá es lo que llegaría.',
    ],
  },
  {
    ruta: '/integrations',
    titulo: 'La medición de la publicidad',
    flujos: ['publicar', 'resultados'],
    rol: 'operations_director',
    queVes: 'El centro de medición: la conexión con Meta, el pixel que atribuye reservas a la publicidad y la biblioteca de imágenes.',
    porQueExiste: 'Sin esto, el local paga publicidad y no sabe cuántas reservas trajo.',
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
      'Avisar a veinte a la vez hace que gane quien reserve primero, no quien lleve más tiempo esperando: hoy es una carrera, no una cola. Está anotado como decisión pendiente.',
      'El largo de la lista es demanda que el local no está atendiendo. Sostenida, es el argumento para abrir otro turno.',
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
  },
  {
    ruta: '/reservations?tab=coupons',
    titulo: 'Quién cobra un cupón',
    flujos: ['volver'],
    rol: 'operations_director',
    queVes: 'Pulsa «Anotar cupón usado» y escribe un código: esto es lo que ve el cajero con el cliente delante.',
    porQueExiste: 'Quien cobra no debería poder crear cupones ni ver la audiencia del local. Son dos permisos distintos a propósito.',
    queHace: [
      'Responde si el código sirve, y si no sirve, por qué.',
      'Se anota con qué mesa y cómo pagó.',
    ],
    comoSeLee: [
      'Que responda una sola cosa es el punto: con gente esperando no se puede interpretar nada.',
      'En la maqueta, un código que empiece por NO devuelve el caso contrario. Es un atajo de la maqueta para ver los dos lados, no una regla del producto.',
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
    rol: 'operations_director',
    queVes: 'Las campañas de correo a la audiencia del local, con su avance y su resultado.',
    porQueExiste: 'Es lo que convierte una lista de comensales en gente que vuelve. Y es donde más fácil se infringe la ley, así que el sistema lo acota.',
    queHace: [
      'Cada destinatario lleva su propio enlace de baja, y ese pie no tiene interruptor que lo apague.',
      'Hay vista previa del correo tal como lo recibirá cada persona.',
      'Los fallidos se listan aparte de los enviados.',
      'Se puede medir el retorno de una campaña.',
    ],
    comoSeLee: [
      'El retorno se cuenta en reservas, no en aperturas: una campaña muy abierta que no llenó una mesa no sirvió de nada.',
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
  },
  {
    ruta: '/production',
    titulo: 'La cadena de producción',
    flujos: ['producir'],
    rol: 'creative_director',
    queVes: 'Todo el trabajo en curso: quién lo hace, de qué depende, para cuándo y en qué va.',
    porQueExiste: 'La capacidad del equipo es el límite real de la agencia. Sin verla, se promete lo que no se puede entregar y se descubre el día del vencimiento.',
    queHace: [
      'Una pieza puede depender de otras, y esas dependencias se guardan en la propia pieza.',
      'La pantalla muestra la capacidad configurada junto a la carga activa por persona.',
      'Las correcciones son una etapa de la cadena, no un estado aparte.',
    ],
    comoSeLee: [
      'Capacidad contra carga no mide productividad: mide cuánto más se puede aceptar sin incumplir lo ya prometido.',
    ],
  },
  {
    ruta: '/production/visual-pieza',
    titulo: 'Una pieza por dentro',
    flujos: ['producir'],
    rol: 'creative_director',
    muestra: 'parcial',
    queVes: 'El detalle de un trabajo: su estado, sus fechas, de qué depende y lo que se ha comentado sobre él.',
    porQueExiste: 'La discusión sobre una pieza acababa en un chat aparte del trabajo. Lo que se decidió sobre ella tiene que vivir con ella.',
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
  },
  {
    ruta: '/meetings',
    titulo: 'Las reuniones y sus acuerdos',
    flujos: ['producir'],
    rol: 'creative_director',
    queVes: 'Las reuniones con el cliente, con su acta: decisiones y acuerdos, no un relato de lo que se habló.',
    porQueExiste: 'Lo acordado en una reunión y no escrito se vuelve a discutir en la siguiente.',
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
  },
  {
    ruta: '/reports',
    titulo: 'El informe mensual',
    flujos: ['resultados'],
    rol: 'admin',
    queVes: 'Lo que se le entrega al cliente cada mes, armado con los datos del mes.',
    porQueExiste: 'El informe se hacía a mano copiando cifras de varias pantallas a una presentación. Ahí es donde se cometen los errores que el cliente sí nota.',
    queHace: [
      'Los informes se guardan por empresa y por periodo: se puede volver a abrir el de un mes anterior.',
      'Las cifras se toman de los módulos, no se escriben a mano.',
    ],
  },
  {
    ruta: '/direction',
    titulo: 'Lo que todavía no se mide',
    flujos: ['resultados'],
    rol: 'admin',
    queVes: 'La pantalla de dirección, declarando qué métricas aún no tienen fuente de datos.',
    porQueExiste: 'Es una decisión del producto: una métrica sin instrumentación se marca como pendiente en vez de estimarse. Un número inventado contamina todas las decisiones que se toman con él.',
    queHace: [
      'Un indicador sin fuente aparece como «instrumentación pendiente» y no muestra cifra.',
      'Una métrica corregida se señala como tal.',
    ],
    comoSeLee: [
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
      'Reúne también las versiones de consentimiento y quién aceptó cada una.',
    ],
    comoSeLee: [
      'Es la pantalla donde se nota lo que a nadie se le ocurre revisar: por ejemplo, qué cargos pueden tocar los interruptores de módulo.',
    ],
  },
  {
    ruta: '/governance',
    titulo: 'Gobierno del producto',
    flujos: ['gobierno'],
    rol: 'dev',
    queVes: 'Los interruptores de los módulos del producto y la fase en la que está cada uno.',
    porQueExiste: 'Es la reja de más arriba: lo que acá está cerrado no se abre con un permiso ni contratándolo. Cierra lo que todavía no está listo para un cliente.',
    queHace: [
      'Distingue la fase de cada módulo, que es lo que permite trabajar en uno sin que aparezca en el menú de nadie.',
      'En la matriz de permisos este módulo no está reservado a desarrollo: administración lo ve, y dirección comercial y dirección de operaciones lo gestionan.',
    ],
    comoSeLee: [
      'Que dos direcciones puedan mover los interruptores contradice la idea de que ésta es la reja de más arriba. Está anotado como decisión pendiente.',
    ],
  },
  {
    ruta: '/security',
    titulo: 'Privacidad y datos protegidos',
    flujos: ['gobierno'],
    rol: 'admin',
    queVes: 'El nivel de datos protegidos por módulo y por persona, y el registro de quién pidió ver una alergia.',
    porQueExiste: 'Una alergia o una dieta es un dato de salud. Que lo vea cualquiera es un problema legal, y que no lo vea nadie impide atender la mesa.',
    queHace: [
      'Hay tres niveles: oculto, bajo registro y directo.',
      'Oculto responde 403 y no anota nada; bajo registro anota quién, qué registro y qué campos antes de entregar el dato, y si esa anotación falla el dato no sale; directo entrega sin anotar.',
      'El nivel más restrictivo gana cuando una petición alcanza a varias empresas.',
    ],
    comoSeLee: [
      'Bajo registro recorta lo mismo que oculto: la diferencia no es cuánto se ve, es que quede constancia de haberlo pedido.',
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
      'Sin datos de muestra: se mira la estructura. Es una de las decisiones pendientes —conectarla o dejarla fuera del sistema—.',
    ],
  },
  {
    ruta: '/catalog',
    titulo: 'El catálogo de servicios',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'Los servicios que vende la agencia y los paquetes que los agrupan.',
    porQueExiste: 'Es de donde salen los contratos y las oportunidades. Sin un catálogo, cada propuesta inventa su propio nombre para lo mismo.',
    queHace: [
      'Separa servicios sueltos de paquetes.',
    ],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
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
    rol: 'operations_director',
    muestra: 'vacia',
    queVes: 'La capacidad asignada y la carga por persona, con los ciclos mensuales y los objetivos.',
    porQueExiste: 'Es la vista con la que se decide si se puede tomar un cliente más, antes de prometerlo.',
    queHace: ['Cruza el equipo con su carga activa y con los objetivos del ciclo.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
  },
  {
    ruta: '/knowledge',
    titulo: 'Base de conocimiento',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'Lo que la agencia sabe y quiere no volver a explicar.',
    porQueExiste: 'El conocimiento de cómo se hacen las cosas vive en las personas que llevan más tiempo, y se va con ellas.',
    queHace: ['Guarda artículos consultables por el equipo.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
  },
  {
    ruta: '/gamification',
    titulo: 'Ranking del equipo',
    flujos: ['enObra'],
    rol: 'admin',
    muestra: 'vacia',
    queVes: 'El ranking interno y las disputas sobre su puntuación.',
    porQueExiste: 'Medir el trabajo del equipo con un puntaje sólo funciona si se puede reclamar. Las disputas son parte del diseño, no un añadido.',
    queHace: ['Lleva un ranking y un registro de disputas sobre él.'],
    comoSeLee: ['Sin datos de muestra: se mira la estructura.'],
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
