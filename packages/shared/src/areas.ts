/**
 * @fileoverview Las áreas de cada módulo: en qué partes se puede separar lo que alguien hace.
 *
 * Un módulo entero es demasiado grueso para repartir trabajo. Reservas son trece cosas bajo un
 * mismo interruptor: quien anota que un comensal llegó y quien cambia los horarios del local
 * reciben hoy el mismo acceso. Lo mismo en CRM, donde «aplicar reglas» reescribe el semáforo, la
 * etapa y el responsable de los prospectos que recibe, y vive junto a «ver la lista».
 *
 * Un **área** es un grupo de acciones con nombre dentro de un módulo. Un **perfil** es un juego
 * de áreas con nombre que la empresa compone y reparte entre su gente. Las excepciones por
 * persona se siguen guardando donde ya se guardan, en `user_action_override`, que admite conceder
 * y quitar con su motivo y quién lo hizo.
 *
 * ESTE ARCHIVO ES LA ÚNICA FUENTE. De aquí salen tres cosas: la pantalla donde se componen los
 * perfiles, la comprobación del servidor y la pantalla que explica qué ve una persona. Es el
 * mismo patrón que ya funcionó dos veces: `status-labels.ts` es la única tabla de estados y por
 * eso no hay ni un estado crudo en pantalla, y `documentos-legales.ts` hace que el plazo que se
 * publica y el que borra no puedan contradecirse.
 *
 * **El catálogo es código, no datos.** Las empresas componen perfiles a partir de esta lista;
 * no pueden inventar áreas. Es la diferencia entre un modelo que se lee en un archivo y un motor
 * de permisos donde nadie puede contestar «¿quién ve esto?» sin ejecutarlo.
 *
 * No sustituye a las otras dos rejas, se suma: la empresa tiene que haber contratado el módulo, y
 * quien concede nunca puede dar lo que él mismo no alcanza.
 */

import type { OrganizationModuleKey } from './constants/modules';

/**
 * Hasta dónde llega alguien en un área.
 *
 * Tres y no más: cada nivel extra multiplica las combinaciones que hay que entender para
 * responder «¿qué ve esta persona?», que es la pregunta que todo esto existe para contestar.
 */
export type NivelDeArea = 'ninguno' | 'ver' | 'hacer';

export const NIVELES_DE_AREA: readonly NivelDeArea[] = ['ninguno', 'ver', 'hacer'] as const;

/**
 * Qué se ve de los datos personales de un tercero: el comensal, el prospecto, quien respondió.
 *
 * Son tres y no dos por el caso difícil. La alergia de un comensal es dato de salud, y a la vez
 * es lo que la cocina necesita para no enfermar a nadie: esconderla sería peor que mostrarla. Con
 * `bajo_registro` no hay que elegir entre proteger y operar —se opera, y queda constancia de
 * quién la vio y cuándo—, que es además lo que permite contestarle a un titular quién trató sus
 * datos.
 */
export type NivelDeDatosProtegidos = 'oculto' | 'bajo_registro' | 'directo';

export const NIVELES_DE_DATOS: readonly NivelDeDatosProtegidos[] = ['oculto', 'bajo_registro', 'directo'] as const;

export interface DefinicionDeArea {
  /** `modulo.area`, con la misma forma que las claves de `acciones.ts`. */
  clave: string;
  modulo: OrganizationModuleKey;
  nombre: string;
  /** Qué incluye, dicho para quien reparte el trabajo y no para quien programa. */
  ayuda: string;
  /**
   * Los niveles que esta área admite. Dos valores cuando es de sí o no —`ninguno` y `hacer`—,
   * porque una acción irreversible no tiene un punto medio que signifique algo.
   */
  niveles: readonly NivelDeArea[];
  /** Si toca datos personales de un tercero, y entonces el nivel de protección también aplica. */
  tocaDatosDeTerceros?: true;
}

const VER_O_HACER: readonly NivelDeArea[] = ['ninguno', 'ver', 'hacer'] as const;
const SI_O_NO: readonly NivelDeArea[] = ['ninguno', 'hacer'] as const;
const SOLO_VER: readonly NivelDeArea[] = ['ninguno', 'ver'] as const;

/**
 * Dos áreas se repiten en todos los módulos y son, justamente, las dos que le importan a la ley:
 * **exportar** y **ver datos protegidos**. Se llaman igual en todas partes para que la pantalla
 * las agrupe y alguien pueda preguntar una sola vez «¿quién saca datos personales de aquí?».
 */
function transversales(modulo: OrganizationModuleKey): DefinicionDeArea[] {
  return [
    {
      clave: `${modulo}.exportar`,
      modulo,
      nombre: 'Exportación',
      ayuda: 'Descargar la información en un archivo. Lo exportado respeta el nivel de datos protegidos de quien lo pide.',
      niveles: SI_O_NO,
      tocaDatosDeTerceros: true,
    },
  ];
}

/**
 * Qué son los datos protegidos en cada módulo, y por qué el nivel va **por módulo**.
 *
 * No es lo mismo el teléfono de un prospecto, que alguien de comercial necesita para llamarlo,
 * que el documento de un comensal, que casi nadie necesita para atender. Un solo nivel por
 * persona obligaría a conceder el más alto que necesite en cualquier módulo, y se llevaría por
 * delante todo lo demás.
 *
 * No va aquí como área porque su escala es otra —tres valores, no «ver» y «hacer»— y mezclarlas
 * en un mismo registro acaba en un campo que significa dos cosas según dónde se lea.
 */
export interface DatosProtegidosDeModulo {
  modulo: OrganizationModuleKey;
  nombre: string;
  ayuda: string;
  /**
   * Si entre estos datos hay alguno de categoría especial —salud, en la práctica las alergias y
   * restricciones alimentarias del comensal—.
   *
   * Cuando lo hay, conceder el acceso exige que quien lo concede acepte un texto con versión, y
   * queda guardado con `ConsentVersion` y `DataConsent`, que es el mecanismo que la plataforma ya
   * usa para los consentimientos. No lo pide la ley con esas palabras: lo pide la obligación de
   * **poder demostrar** que el acceso se limitó y que quien lo recibió conocía su deber de
   * confidencialidad.
   */
  incluyeSensibles?: true;
}

export const DATOS_PROTEGIDOS: readonly DatosProtegidosDeModulo[] = [
  {
    modulo: 'reservations',
    nombre: 'Datos del comensal',
    ayuda: 'Documento, fecha de nacimiento, teléfono, correo y las respuestas de alergias o restricciones.',
    incluyeSensibles: true,
  },
  { modulo: 'crm', nombre: 'Datos del prospecto', ayuda: 'Teléfono, correo y documento.' },
  {
    modulo: 'surveys',
    nombre: 'Identidad de quien responde',
    ayuda: 'Sin este nivel los resultados se leen agregados y anónimos, que es como deberían leerse casi siempre.',
    incluyeSensibles: true,
  },
  { modulo: 'marketing', nombre: 'Direcciones de la lista', ayuda: 'El correo de cada suscriptor.' },
] as const;

/**
 * Si conceder este módulo exige que quien concede acepte el texto de confidencialidad.
 *
 * Sólo donde hay datos de categoría especial. Pedirlo en todos convertiría la aceptación en un
 * clic automático, y una evidencia que nadie leyó no prueba nada.
 */
export function concederExigeAceptacion(modulo: OrganizationModuleKey, nivel: NivelDeDatosProtegidos): boolean {
  if (nivel === 'oculto') return false;
  return DATOS_PROTEGIDOS.some((entrada) => entrada.modulo === modulo && entrada.incluyeSensibles === true);
}

const MODULOS_CON_DATOS = new Set(DATOS_PROTEGIDOS.map((entrada) => entrada.modulo));

export function tieneDatosProtegidos(modulo: OrganizationModuleKey): boolean {
  return MODULOS_CON_DATOS.has(modulo);
}

export const AREAS: readonly DefinicionDeArea[] = [
  // ─── Reservas ───────────────────────────────────────────────────────────────
  { clave: 'reservations.turno', modulo: 'reservations', nombre: 'Turno', ayuda: 'La agenda del día: anotar que alguien llegó, marcar que no vino y liberar la mesa.', niveles: VER_O_HACER },
  { clave: 'reservations.reservas', modulo: 'reservations', nombre: 'Reservas', ayuda: 'Abrir la ficha de una reserva, editarla, moverla de hora y cancelarla.', niveles: VER_O_HACER, tocaDatosDeTerceros: true },
  { clave: 'reservations.tomar', modulo: 'reservations', nombre: 'Tomar reservas', ayuda: 'Anotar una reserva en el mostrador o por teléfono, y retener un cupo.', niveles: SI_O_NO },
  { clave: 'reservations.espera_y_grupos', modulo: 'reservations', nombre: 'Espera y grupos', ayuda: 'Avisar cupos liberados, y responder y cotizar solicitudes de evento.', niveles: VER_O_HACER, tocaDatosDeTerceros: true },
  { clave: 'reservations.canjear_cupon', modulo: 'reservations', nombre: 'Canjear cupón', ayuda: 'Anotar en el mostrador que alguien usó un cupón.', niveles: SI_O_NO },
  { clave: 'reservations.cupones', modulo: 'reservations', nombre: 'Gestionar cupones', ayuda: 'Crear cupones, editarlos y ver sus canjes.', niveles: VER_O_HACER },
  { clave: 'reservations.configurar', modulo: 'reservations', nombre: 'Configurar el local', ayuda: 'Horarios, zonas, mesas, capacidad, tolerancia y cierres del día.', niveles: VER_O_HACER },
  { clave: 'reservations.publicar', modulo: 'reservations', nombre: 'Página pública y textos', ayuda: 'Publicar o despublicar la página de reserva y escribir los correos que recibe el comensal.', niveles: VER_O_HACER },
  { clave: 'reservations.medicion', modulo: 'reservations', nombre: 'Medición', ayuda: 'Las analíticas del local y lo que se le informa a la pauta.', niveles: SOLO_VER },
  { clave: 'reservations.historial', modulo: 'reservations', nombre: 'Historial de asistencia', ayuda: 'Ver cuántas veces cada comensal llegó o no llegó, y en qué días del local falla más gente.', niveles: SOLO_VER },
  ...transversales('reservations'),

  // ─── CRM ────────────────────────────────────────────────────────────────────
  { clave: 'crm.prospectos', modulo: 'crm', nombre: 'Prospectos', ayuda: 'Abrir la ficha de un prospecto, editarla y cambiarle la etapa.', niveles: VER_O_HACER, tocaDatosDeTerceros: true },
  { clave: 'crm.descartar', modulo: 'crm', nombre: 'Descartar', ayuda: 'Cerrar un prospecto dejando dicho por qué.', niveles: SI_O_NO },
  { clave: 'crm.convertir', modulo: 'crm', nombre: 'Convertir en cliente', ayuda: 'Crear una empresa cliente a partir de un prospecto. Es un acto de la agencia.', niveles: SI_O_NO },
  { clave: 'crm.importar', modulo: 'crm', nombre: 'Importar', ayuda: 'Alta masiva de prospectos desde un archivo.', niveles: SI_O_NO },
  { clave: 'crm.contactos', modulo: 'crm', nombre: 'Contactos y actividades', ayuda: 'Registrar llamadas, correos y reuniones con un prospecto.', niveles: VER_O_HACER, tocaDatosDeTerceros: true },
  { clave: 'crm.embudo', modulo: 'crm', nombre: 'Embudo', ayuda: 'Mover tratos de etapa y cerrarlos como ganados o perdidos.', niveles: VER_O_HACER },
  { clave: 'crm.reglas', modulo: 'crm', nombre: 'Reglas de calificación', ayuda: 'Crear y ordenar las reglas, y aplicarlas: aplicar reescribe el semáforo, la etapa y el responsable de los prospectos elegidos.', niveles: VER_O_HACER },
  { clave: 'crm.campos', modulo: 'crm', nombre: 'Campos propios', ayuda: 'La estructura de la ficha: qué se le pregunta a cada prospecto.', niveles: VER_O_HACER },
  { clave: 'crm.origenes', modulo: 'crm', nombre: 'Orígenes de entrada', ayuda: 'Los formularios externos que dejan prospectos, y sus llaves.', niveles: VER_O_HACER },
  { clave: 'crm.medicion', modulo: 'crm', nombre: 'Medición', ayuda: 'Qué se le informa a la pauta y cómo va la conciliación.', niveles: SOLO_VER },
  ...transversales('crm'),

  // ─── Encuestas ──────────────────────────────────────────────────────────────
  { clave: 'surveys.resultados', modulo: 'surveys', nombre: 'Resultados', ayuda: 'Ver las respuestas y sus indicadores.', niveles: SOLO_VER, tocaDatosDeTerceros: true },
  { clave: 'surveys.editar', modulo: 'surveys', nombre: 'Crear y editar', ayuda: 'Armar la encuesta y cambiar sus preguntas.', niveles: VER_O_HACER },
  { clave: 'surveys.publicar', modulo: 'surveys', nombre: 'Publicar y archivar', ayuda: 'Dejar la encuesta disponible o retirarla.', niveles: SI_O_NO },
  { clave: 'surveys.enviar', modulo: 'surveys', nombre: 'Enviar y compartir', ayuda: 'Mandarla por correo o entregar su enlace.', niveles: SI_O_NO },
  ...transversales('surveys'),

  // ─── Marketing ──────────────────────────────────────────────────────────────
  { clave: 'marketing.suscriptores', modulo: 'marketing', nombre: 'Suscriptores', ayuda: 'La lista de quienes aceptaron recibir correo.', niveles: VER_O_HACER, tocaDatosDeTerceros: true },
  { clave: 'marketing.importar', modulo: 'marketing', nombre: 'Importar', ayuda: 'Cargar suscriptores desde un archivo, con su respaldo de permiso.', niveles: SI_O_NO },
  { clave: 'marketing.campanas', modulo: 'marketing', nombre: 'Campañas', ayuda: 'Redactar y preparar una campaña.', niveles: VER_O_HACER },
  { clave: 'marketing.enviar', modulo: 'marketing', nombre: 'Enviar campaña', ayuda: 'Ponerla en cola. Va aparte de redactarla porque sale hacia fuera y no se puede deshacer.', niveles: SI_O_NO },
  { clave: 'marketing.bajas', modulo: 'marketing', nombre: 'Bajas y constancia', ayuda: 'Quién pidió no recibir más correo y cuándo lo pidió.', niveles: SOLO_VER, tocaDatosDeTerceros: true },
  ...transversales('marketing'),

  // ─── Producción ─────────────────────────────────────────────────────────────
  { clave: 'production.piezas', modulo: 'production', nombre: 'Piezas', ayuda: 'Ver el trabajo en curso y moverlo de estado.', niveles: VER_O_HACER },
  { clave: 'production.asignar', modulo: 'production', nombre: 'Asignar', ayuda: 'Poner una pieza a nombre de alguien. Reserva UD del mes.', niveles: SI_O_NO },
  { clave: 'production.entregar', modulo: 'production', nombre: 'Entregar', ayuda: 'Dar una pieza por terminada. Consume las UD reservadas.', niveles: SI_O_NO },
  { clave: 'production.cancelar', modulo: 'production', nombre: 'Cancelar una pieza', ayuda: 'Devuelve al presupuesto las UD que tenía reservadas.', niveles: SI_O_NO },
  { clave: 'production.briefs', modulo: 'production', nombre: 'Briefs', ayuda: 'El pedido del cliente y las piezas que salieron de él.', niveles: VER_O_HACER },
  { clave: 'production.aprobaciones', modulo: 'production', nombre: 'Aprobaciones', ayuda: 'Revisar y aprobar lo producido.', niveles: VER_O_HACER },
  { clave: 'production.presupuesto', modulo: 'production', nombre: 'Presupuesto UD', ayuda: 'Cuánto se contrató este mes, cuánto se lleva y cuánto queda.', niveles: SOLO_VER },
  { clave: 'production.ajustar_presupuesto', modulo: 'production', nombre: 'Ajustar lo contratado', ayuda: 'Cambiar las UD del mes. Cambia cuánto se le debe a la agencia.', niveles: SI_O_NO },

  // ─── Equipo ─────────────────────────────────────────────────────────────────
  { clave: 'users.equipo', modulo: 'users', nombre: 'Ver el equipo', ayuda: 'Quiénes tienen cuenta en esta empresa y con qué perfil.', niveles: SOLO_VER },
  { clave: 'users.invitar', modulo: 'users', nombre: 'Invitar y retirar', ayuda: 'Sumar personas al equipo de esta empresa y quitarles el acceso.', niveles: SI_O_NO },
  { clave: 'users.perfiles', modulo: 'users', nombre: 'Conceder perfiles', ayuda: 'Componer perfiles y repartirlos. Nadie puede conceder lo que él mismo no alcanza.', niveles: SI_O_NO },
  { clave: 'users.clave', modulo: 'users', nombre: 'Restablecer clave', ayuda: 'Mandar a alguien de su equipo un acceso nuevo.', niveles: SI_O_NO },
] as const;

const AREA_POR_CLAVE = new Map(AREAS.map((area) => [area.clave, area]));

export function definicionDeArea(clave: string): DefinicionDeArea | undefined {
  return AREA_POR_CLAVE.get(clave);
}

export function areasDelModulo(modulo: OrganizationModuleKey): DefinicionDeArea[] {
  return AREAS.filter((area) => area.modulo === modulo);
}

/** Las áreas que tocan datos de un tercero, que son las que la protección de datos alcanza. */
export function areasConDatosDeTerceros(): DefinicionDeArea[] {
  return AREAS.filter((area) => area.tocaDatosDeTerceros === true);
}

/**
 * Qué áreas y con qué nivel. Es lo que guarda un perfil y lo que resuelve una persona.
 *
 * Un área ausente significa `ninguno`: lo que no se concedió, no se tiene. Nunca al revés.
 */
export type JuegoDeAreas = Readonly<Record<string, NivelDeArea>>;

/**
 * El nivel de datos protegidos, módulo por módulo.
 *
 * Un módulo ausente significa `oculto`, con la misma regla que las áreas: lo que no se concedió,
 * no se tiene. La migración escribe `directo` de forma explícita para quienes hoy ya los ven, de
 * modo que nadie pierda nada el día del despliegue.
 */
export type JuegoDeDatos = Readonly<Partial<Record<OrganizationModuleKey, NivelDeDatosProtegidos>>>;

export interface Perfil {
  id: string;
  /** De la empresa, no del producto: un local dice «anfitrión» y otro «recepción». */
  clientId: string;
  nombre: string;
  descripcion?: string;
  areas: JuegoDeAreas;
  datosProtegidos: JuegoDeDatos;
}

export function nivelEnJuego(areas: JuegoDeAreas, clave: string): NivelDeArea {
  return areas[clave] ?? 'ninguno';
}

/** `hacer` incluye `ver`: quien edita, mira. */
export function alcanza(actual: NivelDeArea, exigido: NivelDeArea): boolean {
  if (exigido === 'ninguno') return true;
  if (exigido === 'ver') return actual === 'ver' || actual === 'hacer';
  return actual === 'hacer';
}

/**
 * El nivel que resulta de un perfil más las excepciones escritas para una persona.
 *
 * Las excepciones pueden **conceder y también quitar**. Sin lo segundo habría que inventar un
 * perfil nuevo cada vez que alguien concreto necesita una cosa menos, y los perfiles dejarían de
 * significar algo en una semana.
 *
 * @param extras - Lo escrito para esa persona en esa empresa. Gana sobre el perfil, que es lo que
 *   significa ser una excepción.
 */
export function nivelEfectivo(perfil: JuegoDeAreas, extras: JuegoDeAreas, clave: string): NivelDeArea {
  return extras[clave] ?? nivelEnJuego(perfil, clave);
}

/**
 * El nivel de datos protegidos que resulta, para un módulo, del perfil más sus excepciones.
 *
 * Misma regla que las áreas: la excepción gana, y lo ausente es lo más restrictivo. Va por
 * módulo porque alguien puede necesitar el teléfono del prospecto y no el del comensal.
 */
export function datosEfectivos(
  perfil: JuegoDeDatos,
  extras: JuegoDeDatos,
  modulo: OrganizationModuleKey,
): NivelDeDatosProtegidos {
  return extras[modulo] ?? perfil[modulo] ?? 'oculto';
}

/** Si hay que anotar quién lo vio. Es lo que `bajo_registro` significa. */
export function exigeDejarConstancia(nivel: NivelDeDatosProtegidos): boolean {
  return nivel === 'bajo_registro';
}

/**
 * Los tres perfiles que se entregan sugeridos para Reservas, y los tres de CRM.
 *
 * Se copian a la empresa al encender el módulo y desde ahí son suyos: puede renombrarlos,
 * cambiarlos o borrarlos. No son roles del producto, y por eso no se consultan en tiempo de
 * ejecución: sólo sirven para no empezar con una pantalla en blanco.
 */
export const PERFILES_SUGERIDOS: readonly { modulo: OrganizationModuleKey; nombre: string; descripcion: string; areas: JuegoDeAreas; datosProtegidos: JuegoDeDatos }[] = [
  {
    modulo: 'reservations',
    nombre: 'Garzón',
    descripcion: 'Atiende el turno: ve a quién le toca, anota que llegó y libera la mesa.',
    areas: { 'reservations.turno': 'hacer', 'reservations.reservas': 'ver', 'reservations.canjear_cupon': 'hacer' },
    datosProtegidos: { reservations: 'bajo_registro' },
  },
  {
    modulo: 'reservations',
    nombre: 'Anfitrión',
    descripcion: 'Recibe, toma reservas por teléfono y resuelve la lista de espera.',
    areas: {
      'reservations.turno': 'hacer', 'reservations.reservas': 'hacer', 'reservations.tomar': 'hacer',
      'reservations.espera_y_grupos': 'hacer', 'reservations.canjear_cupon': 'hacer', 'reservations.historial': 'ver',
    },
    datosProtegidos: { reservations: 'bajo_registro' },
  },
  {
    modulo: 'reservations',
    nombre: 'Jefe de local',
    descripcion: 'Todo lo del turno, más la configuración del local y sus números.',
    areas: {
      'reservations.turno': 'hacer', 'reservations.reservas': 'hacer', 'reservations.tomar': 'hacer',
      'reservations.espera_y_grupos': 'hacer', 'reservations.canjear_cupon': 'hacer', 'reservations.cupones': 'hacer',
      'reservations.configurar': 'hacer', 'reservations.publicar': 'hacer', 'reservations.medicion': 'ver',
      'reservations.historial': 'ver', 'reservations.exportar': 'hacer',
    },
    datosProtegidos: { reservations: 'directo' },
  },
  {
    modulo: 'crm',
    nombre: 'Asistente comercial',
    descripcion: 'Registra el contacto del día a día sin mover el embudo.',
    areas: { 'crm.prospectos': 'ver', 'crm.contactos': 'hacer', 'crm.embudo': 'ver' },
    datosProtegidos: { crm: 'bajo_registro' },
  },
  {
    modulo: 'crm',
    nombre: 'Ejecutivo',
    descripcion: 'Trabaja sus prospectos de punta a punta.',
    areas: {
      'crm.prospectos': 'hacer', 'crm.descartar': 'hacer', 'crm.contactos': 'hacer',
      'crm.embudo': 'hacer', 'crm.reglas': 'ver', 'crm.medicion': 'ver',
    },
    datosProtegidos: { crm: 'directo' },
  },
  {
    modulo: 'crm',
    nombre: 'Jefe comercial',
    descripcion: 'Además configura las reglas, los campos y los orígenes.',
    areas: {
      'crm.prospectos': 'hacer', 'crm.descartar': 'hacer', 'crm.convertir': 'hacer', 'crm.importar': 'hacer',
      'crm.contactos': 'hacer', 'crm.embudo': 'hacer', 'crm.reglas': 'hacer', 'crm.campos': 'hacer',
      'crm.origenes': 'hacer', 'crm.medicion': 'ver', 'crm.exportar': 'hacer',
    },
    datosProtegidos: { crm: 'directo' },
  },
] as const;
