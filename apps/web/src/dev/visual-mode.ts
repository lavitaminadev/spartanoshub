/**
 * @fileoverview Modo visual: levanta la interfaz sin backend y con todos los modulos abiertos.
 *
 * Se activa solo con `npm run dev:visual`, que define `VITE_VISUAL=1` desde `.env.visual`.
 * En cualquier otro arranque este modulo no hace nada y la aplicacion habla con la API real.
 *
 * Garantiza tres cosas mientras esta activo:
 * - ninguna peticion sale a la red: axios responde desde este archivo;
 * - la sesion arranca iniciada como `admin`, con todos los modulos en `active` y permiso
 *   `manage`, de modo que las vistas son navegables tanto por menu como por URL directa;
 * - un endpoint sin respuesta declarada devuelve un vacio, nunca un error.
 *
 * No toca `src/core/`: la sesion se abre respondiendo el mismo `/auth/session` que consulta
 * `checkAuth()`, y los modulos se abren por `user.moduleLifecycle`, que es la via que
 * `isModuleInPhaseScope` ya consulta antes que el catalogo. El codigo de produccion corre
 * exactamente igual que antes.
 */

import axios, { type AxiosAdapter } from 'axios';
import { VERSION_DOCUMENTOS_LEGALES } from '@espartanos/shared';
import { ORGANIZATION_MODULE_CATALOG, WEB_ONLY_MODULE_CATALOG } from '@espartanos/shared';

/** Verdadero solo bajo `npm run dev:visual`. */
export const VISUAL_MODE = import.meta.env.VITE_VISUAL === '1';

/**
 * Claves de modulo derivadas del catalogo compartido, no escritas a mano.
 *
 * Asi, un modulo nuevo queda visible en modo visual el mismo dia que se agrega al catalogo,
 * sin tener que acordarse de este archivo.
 */
const MODULE_KEYS: string[] = [...ORGANIZATION_MODULE_CATALOG, ...WEB_ONLY_MODULE_CATALOG]
  .map((item) => item.key);

/** Asigna el mismo valor a todos los modulos del catalogo. */
function forEveryModule<T>(value: T): Record<string, T> {
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, value]));
}

/**
 * JWT sintetico con `exp` a ocho horas.
 *
 * `api.ts` lee ese claim para programar la renovacion proactiva. Sin un `exp` legible, el
 * temporizador no se programa; con uno vencido, la sesion se reiniciaria sola a media revision.
 */
function syntheticJwt(): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'visual', exp: expiresAt })}.visual`;
}

/**
 * Cargo con el que se revisa, tomado de `?rol=` en la dirección.
 *
 * El menú y varias pantallas cambian con el cargo, así que revisar siempre como `admin` deja sin
 * ver justo lo que está asignado a otros: el inicio del CRM, por ejemplo, es de dirección
 * comercial y de operaciones. Con esto se revisa cada vista desde el cargo que la va a usar,
 * cambiando la dirección y sin volver a entrar.
 *
 *   http://localhost:5176/crm?rol=commercial_director
 */
function rolDeRevision(): string {
  const solicitado = new URLSearchParams(window.location.search).get('rol');
  return solicitado?.trim() || 'admin';
}

/** Perfil con acceso total, usado para responder `/auth/me`. */
const VISUAL_USER = {
  id: 'visual-user',
  name: 'Modo Visual',
  email: 'visual@espartanos.local',
  role: rolDeRevision(),
  organizationId: 'visual-org',
  mustChangePassword: false,
  mustCompleteProfile: false,
  mustAcceptTerms: false,
  features: forEveryModule(true),
  moduleLifecycle: forEveryModule('active'),
  permissions: forEveryModule('manage'),
  // Con `?rol=client` el portal muestra los servicios de una empresa con todo contratado.
  clientId: 'visual-client',
  capabilities: { reservations: true, crm: true, surveys: true },
};

/**
 * Contenedores anidados que las vistas leen sin proteger el segundo nivel.
 *
 * `ReservationResults` escribe `data?.funnel.views`: cuida `data` pero no `funnel`, asi que un
 * `funnel` ausente revienta el componente. El patron se repite en diecisiete contenedores
 * distintos, contados sobre el codigo. Se rellenan todos de entrada en vez de ir agregandolos
 * de a uno cada vez que una vista falla.
 */
const NESTED_CONTAINERS = [
  'funnel', 'ud', 'bindings', 'pieces', 'memory', 'disk', 'database', 'team', 'redis',
  'pods', 'pixels', 'impact', 'commitments', 'errors', 'dimensions', 'apiKey', 'actions',
] as const;

/**
 * Vacio que satisface las tres formas de respuesta que consumen las vistas.
 *
 * Es un Array real —46 `useQuery` esperan `T[]` y llaman `.map()` directo— que ademas expone
 * `data`, `items` y `results`, porque otros 36 esperan `{ data: [...] }`. Un objeto plano
 * romperia a los primeros y un array pelado a los segundos; esto sirve a ambos sin que la
 * vista sepa que esta en modo visual.
 *
 * Los contenedores anidados reciben el mismo vacio, de modo que sobre ellos funcionen tanto
 * `.length` y `.map()` como el acceso a una propiedad suelta, que devuelve `undefined` y cae
 * en el `?? 0` que las vistas ya escriben.
 *
 * Se construye uno nuevo por peticion: compartir la instancia dejaria que una vista que
 * ordena o inserta en su copia altere lo que ve otra.
 */
function emptyPayload(depth = 0): unknown {
  const nested = depth === 0
    ? Object.fromEntries(NESTED_CONTAINERS.map((key) => [key, emptyPayload(depth + 1)]))
    : {};
  return Object.assign([], {
    data: [],
    items: [],
    results: [],
    rows: [],
    slots: [],
    fullDays: [],
    sources: [],
    permissions: {},
    total: 0,
    page: 1,
    limit: 20,
    unread: 0,
    ...nested,
  });
}

/**
 * Respuestas explicitas para los endpoints que deciden si la aplicacion arranca.
 *
 * Todo lo demas cae en `emptyPayload()`. Cuando una vista necesite datos con forma propia,
 * se agrega su patron aca y no hay que tocar nada mas.
 */
/** Bandeja de solicitudes en memoria para el modo visual. */
const visualRequests: any[] = [];

/** Un local realista permite revisar Reservas sin confundir una pantalla vacía con un flujo listo. */
const VISUAL_RESERVATION_LOCAL = {
  id: 'visual-form', clientId: 'visual-client', name: 'Casa Costanera - Providencia', publicSlug: 'casa-costanera',
  status: 'published', mode: 'appointment', timezone: 'America/Santiago', durationMinutes: 90, bufferMinutes: 15,
  capacityPerSlot: 24, dailyCapacity: 120, minimumNoticeHours: 2, maximumAdvanceDays: 45, confirmationMode: 'automatic',
  fieldSchema: [
    { id: 'name', type: 'text', label: 'Nombre y apellido', required: true, system: true },
    { id: 'phone', type: 'phone', label: 'Teléfono celular', required: true, system: true },
    { id: 'email', type: 'email', label: 'Correo electrónico', required: true, system: true },
    // Ejemplo de pregunta condicional, para ver la regla funcionando en el modo visual.
    { id: 'ocasion', type: 'select', label: '¿Celebras algo?', required: false, options: ['No', 'Cumpleaños', 'Aniversario', 'Empresa', 'Con niños'] },
    { id: 'detalleOcasion', type: 'text', label: '¿Qué preparamos?', required: true, mostrarSi: { campo: 'ocasion', operador: 'distinto', valor: 'No' } },
  ],
  designConfig: {
    title: 'Reserva tu mesa', welcome: 'Elige personas, fecha y horario.', primaryColor: '#0f766e', accentColor: '#e11d48', backgroundColor: '#f8fafc', fontFamily: 'system-ui',
    legalCompanyName: 'Casa Costanera SpA', legalCompanyId: '76.123.456-7', supportEmail: 'reservas@casacostanera.cl', privacyUrl: 'https://casacostanera.cl/privacidad', termsUrl: 'https://casacostanera.cl/condiciones',
    reservationConsentText: 'Acepto que Casa Costanera use mis datos para coordinar esta reserva, enviarme su confirmación y ayudarme si necesito cambiarla.',
    networkConsentEnabled: 'true', networkBrandName: 'Espartanos',
    marketingConsentText: 'Quiero recibir novedades, experiencias y beneficios de Casa Costanera.', marketingConsentVersion: 'cc-2026-01',
    welcomePopupTitle: 'Bienvenido a Casa Costanera', welcomePopupText: 'Reserva en pocos pasos. Si organizas una celebración o grupo, también puedes enviar una solicitud sin tomar un horario.',
    ocasionesEnabled: 'true', ocasionesPopup: 'true', ocasionesVeces: 'siempre', ocasionesTitulo: 'Para cada ocasión', ocasionesTexto: 'Cuéntanos qué celebras y lo preparamos contigo.', ocasionesBoton: 'Ver horarios', ocasionesPreguntaId: 'ocasion',
    ocasiones: JSON.stringify([{ titulo: 'Cumpleaños', texto: 'Torta, decoración y un rincón para la foto.', imagen: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22600%22%3E%3Crect%20width%3D%22800%22%20height%3D%22600%22%20fill%3D%22%23f7c9d9%22%2F%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22300%22%20r%3D%22160%22%20fill%3D%22%23ea0f63%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22320%22%20font-size%3D%2260%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%3ECumple%3C%2Ftext%3E%3C%2Fsvg%3E' }, { titulo: 'Aniversario', texto: 'Mesa tranquila, luz baja y brindis de cortesía.' }, { titulo: 'Empresa', texto: 'Salón privado, menú acordado y boleta a nombre de la empresa.' }, { titulo: 'Con niños', texto: 'Sillas altas, menú infantil y espacio para el coche.' }]),
    toleranciaMinutos: '15', notasDelLocal: 'Estacionamiento con convenio en Calle 123. Los sabados pedimos vestimenta formal.', askSmoking: 'true', askChildren: 'true', askAccessibility: 'true', askAllergies: 'true', whatsappBusinessNumber: '+56 9 1234 5678', whatsappGroupMessage: 'Hola, envié una solicitud de grupo desde Casa Costanera y me gustaría coordinar los detalles.',
  },
  scheduleConfig: { windows: [{ day: 1, start: '13:00', end: '23:00' }, { day: 2, start: '13:00', end: '23:00' }, { day: 3, start: '13:00', end: '23:00' }, { day: 4, start: '13:00', end: '23:00' }, { day: 5, start: '13:00', end: '23:30' }, { day: 6, start: '13:00', end: '23:30' }] },
  resourcesConfig: [{ id: 'terrace', name: 'Terraza', capacity: 40, description: 'Exterior techado', smokingAllowed: false }, { id: 'salon', name: 'Salón', capacity: 80, description: 'Interior climatizado', smokingAllowed: false }],
  campaignId: 'verano-2026', crmEnabled: false, calendarEnabled: true, metaCapiEnabled: true, teamNotifications: ['reservas@casacostanera.cl'], pixelId: '123456789012345', pixelName: 'Casa Costanera · Reservas', metaReady: true, companyDailyCap: 200, ga4MeasurementId: 'G-CC2026TEST', capabilities: { reservations: true, crm: false, metaConversions: true }, updatedAt: new Date().toISOString(),
};

/**
 * El modo visual es una maqueta navegable, pero crear un local debe comportarse como crear un
 * local: el listado y su hub lo tienen que volver a mostrar. Mantener este arreglo en memoria
 * evita el falso "Formulario creado" que antes desaparecía al invalidar la consulta.
 */
const visualReservationForms: any[] = [VISUAL_RESERVATION_LOCAL];

/*
 * Los formularios del modo visual se guardan en este navegador.
 *
 * Sólo en memoria, cualquier recarga —abrir la página pública, la vista previa en otra pestaña—
 * volvía al ejemplo original y parecía que el editor no guardaba. Borrar el sitio en el
 * navegador restablece el ejemplo.
 */
const CLAVE_FORMULARIOS_VISUALES = 'vh.visual.reservationForms';
try {
  const guardados = JSON.parse(localStorage.getItem(CLAVE_FORMULARIOS_VISUALES) || '[]');
  if (Array.isArray(guardados)) {
    for (const guardado of guardados) {
      if (!guardado?.id) continue;
      if (guardado.id === VISUAL_RESERVATION_LOCAL.id) Object.assign(VISUAL_RESERVATION_LOCAL, guardado);
      else visualReservationForms.push(guardado);
    }
  }
} catch { /* sin almacenamiento: queda el ejemplo en memoria */ }
function guardarFormulariosVisuales() {
  try { localStorage.setItem(CLAVE_FORMULARIOS_VISUALES, JSON.stringify(visualReservationForms)); } catch { /* sin almacenamiento */ }
}

function visualRequestBody(config?: any): Record<string, any> {
  if (!config?.data) return {};
  if (typeof config.data === 'string') {
    try { return JSON.parse(config.data); } catch { return {}; }
  }
  return config.data as Record<string, any>;
}

function visualSlug(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'nuevo-local';
}

/*
 * Dos reservas con lo que de verdad llega: respuestas del formulario, zona, cupón y mesa.
 *
 * Con reservas sin respuestas no se puede revisar la parte del detalle que más se mira al recibir
 * a alguien, que es justamente lo que esa persona pidió al reservar.
 */
const VISUAL_RESERVATIONS = [
  {
    id: 'visual-booking-1', formId: 'visual-form', referenceCode: 'CC-1042', status: 'confirmed',
    startsAt: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(), partySize: 2,
    guestName: 'Camila Rojas', guestPhone: '+56 9 8123 4567', guestEmail: 'camila@example.test',
    resourceId: 'terrace', couponCode: 'VERANO20', tableLabel: '12',
    answers: { ocasion: 'Cumpleaños', childrenCount: 1, dietaryNotes: 'Sin gluten', notes: 'Llegamos 10 minutos tarde.' },
  },
  {
    id: 'visual-booking-2', formId: 'visual-form', referenceCode: 'CC-1043', status: 'attended',
    startsAt: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(), partySize: 4,
    guestName: 'Sebastián Vera', guestPhone: '+56 9 7456 1234', guestEmail: 'sebastian@example.test',
    resourceId: 'salon',
    answers: { ocasion: 'Empresa', accessibilityNeed: 'Acceso sin escalón', birthDate: '1990-05-14' },
  },
];

/** Reserva pública demostrativa: permite revisar el resultado, el enlace de gestión y cancelar sin API. */
const visualManagedReservation = {
  token: 'visual-management-token', referenceCode: 'CC-1044', guestName: 'Alexis Muñoz',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), partySize: 2,
  status: 'confirmed', guestConfirmedAt: null as string | null, canCancel: true, canReschedule: true,
  timezone: 'America/Santiago',
};

/*
 * Encuesta de ejemplo, para recorrer el flujo simple sin backend.
 *
 * Tiene la pregunta de estrellas —que activa el flujo por pasos—, dos preguntas más, reseña de
 * Google y los tres canales, así cada botón de la lista y cada paso de la página pública se pueden
 * probar.
 */
const VISUAL_SURVEY = {
  id: 'visual-survey', clientId: 'visual-client', title: 'Tu visita a Casa Costanera', type: 'customer', status: 'active',
  createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), createdBy: 'visual-user', responses: 3,
  distribution: ['email', 'qr', 'link'], recipients: ['camila@example.test', 'sebastian@example.test', 'no-es-correo'],
  publicUrl: 'http://localhost:5176/survey/visual-survey',
  questions: [
    { id: 'nota', type: 'rating', question: '¿Cómo fue tu visita?', required: true },
    { id: 'volveria', type: 'multiple-choice', question: '¿Volverías?', required: true, options: ['Sí', 'Tal vez', 'No'] },
    { id: 'fallo', type: 'multiple-choice', question: '¿Qué falló?', required: true, options: ['La atención', 'El tiempo de espera', 'La comida'], mostrarSi: { preguntaId: 'nota', valores: ['1', '2', '3'] } },
    { id: 'mejorar', type: 'text', question: '¿Qué podríamos hacer mejor?', required: false },
    { id: 'dato-nombre', type: 'text', question: 'Tu nombre', required: false, dato: 'nombre' },
    { id: 'dato-correo', type: 'text', question: 'Tu correo', required: false, dato: 'correo' },
    { id: 'dato-telefono', type: 'text', question: 'Tu teléfono', required: false, dato: 'telefono' },
  ],
  consentimiento: { version: 'survey-v1', responsable: 'Casa Costanera SpA', texto: 'Acepto que Casa Costanera SpA use los datos que dejo en esta encuesta para conocer mi opinión y, si corresponde, contactarme sobre ella. Se conservan mientras sirvan a ese fin. Puedo pedir acceso, corrección o eliminación escribiendo a privacidad@casacostanera.cl. La plataforma Espartanos los trata por encargo de Casa Costanera SpA.', privacyUrl: 'https://casacostanera.cl/privacidad', privacyText: null },
  designConfig: { welcome: 'Nos ayuda mucho saber cómo te fue.', primaryColor: '#07706b', backgroundMode: 'gradient', gradientFrom: '#fff4ea', gradientTo: '#e7f8f6', gradientAngle: '135' },
  googleReview: { url: 'https://g.page/r/ejemplo/review', minRating: 4 },
};

/*
 * Vistas guardadas en memoria, con una compartida por otra persona del equipo: así se ve la
 * diferencia entre las propias —se comparten y se borran— y las ajenas, que sólo se aplican.
 */
const visualSavedViews: Array<{ id: string; scope: string; name: string; filters: Record<string, string>; shared: boolean; propia: boolean }> = [
  { id: 'vista-equipo-1', scope: 'reservas.lista', name: 'Pendientes (del equipo)', filters: { status: 'pending' }, shared: true, propia: false },
];

/*
 * Campos propios del CRM en memoria: uno de cada tipo común y uno archivado con valor guardado,
 * para revisar el panel de administración y cómo se ven en la ficha.
 */
const VISUAL_NIVELES_CM: Record<string, string> = { dashboard: 'view', crm: 'manage', reservations: 'edit', surveys: 'edit', clients: 'view', users: 'none', integrations: 'none', reports: 'view' };
const visualAjustesDePermiso: Record<string, Record<string, string>> = {};
const visualAjustesDeAccion: Record<string, Record<string, boolean>> = {};
const visualEmpresasDeUsuario: Record<string, Array<{ clientId: string; source: string }>> = {};
const visualLeadConCampos: Record<string, any> = {
  id: 'l1', name: 'Ricardo Galvez Lopez', phone: '+56983000089', email: 'galvezr941@gmail.com', status: 'new', source: 'Meta Ads', campaignName: 'Primavera', assignedTo: null, clientId: null, estimatedAmount: 4500000, createdAt: '2026-08-20T02:15:20.676Z', updatedAt: '2026-08-20T02:15:20.676Z',
  customFields: { canal: 'WhatsApp', presupuesto_mensual: 800000, rubro_antiguo: 'Gastronomía' },
};
const visualCrmFields: Array<Record<string, any>> = [
  { id: 'f1', entity: 'lead', key: 'canal', label: 'Canal preferido', type: 'select', options: ['WhatsApp', 'Correo', 'Llamada'], required: true, position: 0, archivedAt: null },
  { id: 'f2', entity: 'lead', key: 'presupuesto_mensual', label: 'Presupuesto mensual', type: 'number', options: null, required: false, position: 1, archivedAt: null },
  { id: 'f3', entity: 'lead', key: 'servicios_interes', label: 'Servicios de interés', type: 'multi_select', options: ['Meta Ads', 'Sitio web', 'Branding'], required: false, position: 2, archivedAt: null },
  { id: 'f4', entity: 'lead', key: 'rubro_antiguo', label: 'Rubro', type: 'text', options: null, required: false, position: 3, archivedAt: '2026-08-01T00:00:00.000Z' },
];

/**
 * Las plantillas de correo tal como las devuelve el servidor.
 *
 * Son las mismas claves del catálogo real —interruptor, asunto y cuerpo por aviso—, porque el
 * panel dibuja un aviso sólo si existe su clave `_enabled`. Con una lista corta la pantalla se
 * veía casi vacía y parecía que faltaban correos que en el servidor sí están.
 */
/**
 * Las plantillas con su asunto, su cuerpo y las variables que admite cada una.
 *
 * Con un texto genérico repetido diecisiete veces no se puede revisar nada: ni si el cuerpo cabe,
 * ni si las fichas de variables corresponden al aviso, ni cómo queda en la vista previa. Son los
 * mismos textos y las mismas variables que el catálogo del servidor.
 */
const PLANTILLAS_DE_CORREO: Array<{ prefijo: string; titulo: string; variables: string[]; asunto: string; cuerpo: string }> = [
  { prefijo: 'email.reservation_confirmation', titulo: 'Confirmación de reserva', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo', 'gestion'], asunto: 'Tu reserva en {{local}} está confirmada', cuerpo: 'Hola {{nombre}}:\n\nTu mesa en {{local}} quedó confirmada para el {{fecha}}, para {{personas}} personas.\n\nTu código es {{codigo}}.' },
  { prefijo: 'email.reservation_reminder', titulo: 'Recordatorio de reserva', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo'], asunto: 'Mañana te esperamos en {{local}}', cuerpo: 'Hola {{nombre}}:\n\nTe recordamos tu reserva del {{fecha}} en {{local}}, para {{personas}} personas.' },
  { prefijo: 'email.reservation_change', titulo: 'Cambio de hora', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo'], asunto: 'Tu reserva en {{local}} cambió', cuerpo: 'Hola {{nombre}}:\n\nTu reserva {{codigo}} quedó para el {{fecha}}.' },
  { prefijo: 'email.post_visit_survey', titulo: 'Encuesta después de la visita', variables: ['nombre', 'local', 'fecha'], asunto: '¿Cómo te fue en {{local}}?', cuerpo: 'Hola {{nombre}}:\n\nGracias por venir a {{local}}. ¿Nos cuentas cómo te fue? Es un minuto.' },
  { prefijo: 'email.reservation_cancellation', titulo: 'Cancelación', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo', 'motivo'], asunto: 'Tu reserva en {{local}} quedó cancelada', cuerpo: 'Hola {{nombre}}:\n\nTu reserva del {{fecha}} quedó cancelada. {{motivo}}' },
  { prefijo: 'email.group_request_ack', titulo: 'Acuse de solicitud de grupo', variables: ['nombre', 'local', 'fecha', 'personas'], asunto: 'Recibimos tu solicitud para {{local}}', cuerpo: 'Hola {{nombre}}:\n\nRecibimos tu solicitud para {{personas}} personas. Todavía no hay nada reservado: te contactamos para coordinar.' },
  { prefijo: 'email.waitlist_ack', titulo: 'Acuse de lista de espera', variables: ['nombre', 'local', 'fecha', 'personas'], asunto: 'Quedaste en la lista de espera de {{local}}', cuerpo: 'Hola {{nombre}}:\n\nTe anotamos para el {{fecha}}. No es una reserva: te avisamos si se libera un cupo.' },
  { prefijo: 'email.waitlist_spot', titulo: 'Cupo liberado', variables: ['nombre', 'local', 'fecha'], asunto: 'Se liberó un cupo en {{local}}', cuerpo: 'Hola {{nombre}}:\n\nSe liberó un cupo para el {{fecha}}. Queda para quien confirme primero.' },
  { prefijo: 'email.reservation_recovery', titulo: 'Enlace para recuperar la reserva', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo'], asunto: 'Tu reserva en {{local}}', cuerpo: 'Hola {{nombre}}:\n\nAcá está tu reserva {{codigo}} del {{fecha}}.' },
  { prefijo: 'email.collection_overdue', titulo: 'Aviso de pago vencido', variables: ['empresa', 'factura', 'monto', 'vencimiento'], asunto: 'Factura {{factura}} vencida', cuerpo: 'Hola:\n\nLa factura {{factura}} de {{empresa}}, por {{monto}}, venció el {{vencimiento}}.' },
  { prefijo: 'email.birthday', titulo: 'Saludo de cumpleaños', variables: ['nombre'], asunto: '¡Feliz cumpleaños, {{nombre}}!', cuerpo: 'Hola {{nombre}}:\n\nQue lo pases muy bien. Te esperamos cuando quieras celebrarlo.' },
  { prefijo: 'email.daily_digest', titulo: 'Resumen diario del CRM', variables: ['fecha', 'pendientes', 'parados'], asunto: 'Tu resumen del {{fecha}}', cuerpo: 'Tienes {{pendientes}} pendientes y {{parados}} sin movimiento.' },
  { prefijo: 'email.task_reminder', titulo: 'Recordatorio de tareas', variables: ['tarea', 'horas', 'lead'], asunto: '{{tarea}} vence en {{horas}} horas', cuerpo: 'La tarea «{{tarea}}» de {{lead}} vence en {{horas}} horas.' },
  { prefijo: 'email.new_lead', titulo: 'Aviso de lead nuevo', variables: ['lead', 'origen', 'campana'], asunto: 'Lead nuevo: {{lead}}', cuerpo: '{{lead}} llegó por {{origen}} ({{campana}}).' },
  { prefijo: 'email.team_new_reservation', titulo: 'Aviso al equipo: reserva nueva', variables: ['nombre', 'local', 'fecha', 'personas', 'codigo'], asunto: 'Reserva nueva en {{local}}', cuerpo: '{{nombre}} reservó para el {{fecha}}, {{personas}} personas. Código {{codigo}}.' },
  { prefijo: 'email.team_group_request', titulo: 'Aviso al equipo: solicitud de grupo', variables: ['nombre', 'local', 'fecha', 'personas'], asunto: 'Solicitud de evento en {{local}}', cuerpo: '{{nombre}} pidió un evento para {{personas}} personas.' },
  { prefijo: 'email.team_waitlist', titulo: 'Aviso al equipo: lista de espera', variables: ['nombre', 'local', 'fecha', 'personas'], asunto: 'Alguien se anotó en la lista de espera', cuerpo: '{{nombre}} se anotó para el {{fecha}}, {{personas}} personas.' },
];

function ajustesDeCorreo(source: 'client' | 'master_default') {
  return PLANTILLAS_DE_CORREO.flatMap(({ prefijo, titulo, variables, asunto, cuerpo }) => {
    const declaradas = `Variables: ${variables.map((variable) => `{{${variable}}}`).join(', ')}.`;
    return [
      { key: `${prefijo}_enabled`, label: titulo, description: 'Enciende o apaga este aviso.', valueType: 'boolean' as const, value: true, source },
      { key: `${prefijo}_subject`, label: `${titulo} · asunto`, description: declaradas, valueType: 'text' as const, value: asunto, source: 'master_default' as const },
      { key: `${prefijo}_body`, label: `${titulo} · cuerpo`, description: declaradas, valueType: 'text' as const, value: cuerpo, source: 'master_default' as const },
    ];
  });
}

const ROUTES: Array<[RegExp, (config?: any) => unknown]> = [
  [/\/users(?:\?|$)/, () => ([
    { id: 'u-cm', name: 'Valentina Soto', email: 'valentina@espartanos.cl', role: 'community_manager', isActive: true, clientId: null, phone: '', createdAt: '2026-06-01T12:00:00.000Z' },
    { id: 'u-ops', name: 'Rodrigo Pérez', email: 'rodrigo@espartanos.cl', role: 'operations_director', isActive: true, clientId: null, phone: '', createdAt: '2026-05-10T12:00:00.000Z' },
    { id: 'u-cli', name: 'Casa Costanera (portal)', email: 'reservas@casacostanera.cl', role: 'client', isActive: true, clientId: 'visual-client', phone: '', createdAt: '2026-07-02T12:00:00.000Z' },
  ])],
  // Permisos por persona: ajustes y empresas en memoria para revisar el panel de Usuarios.
  [/\/users\/[^/]+\/permissions\/[^/]+$/, (config) => {
    const [, usuario, modulo] = config?.url?.match(/\/users\/([^/]+)\/permissions\/([^/?]+)/) ?? [];
    const ajustes = visualAjustesDePermiso[usuario] ??= {};
    if ((config?.method ?? '').toLowerCase() === 'delete') delete ajustes[modulo];
    else ajustes[modulo] = visualRequestBody(config).level;
    return { module: modulo };
  }],
  [/\/users\/[^/]+\/permissions$/, (config) => {
    const usuario = (config?.url?.match(/\/users\/([^/]+)\/permissions/) ?? [])[1];
    const ajustes = visualAjustesDePermiso[usuario] ?? {};
    return { userId: usuario, role: 'community_manager', modules: Object.entries(VISUAL_NIVELES_CM).map(([module, level]) => ({ module, level: ajustes[module] ?? level, source: ajustes[module] ? 'override' : 'role', moduleDisabled: false, productHidden: false })) };
  }],
  [/\/roles\/[^/]+\/permissions$/, () => ({ role: 'community_manager', permissions: VISUAL_NIVELES_CM })],
  [/\/users\/[^/]+\/actions\/[^/]+$/, (config) => {
    const [, usuario, accion] = config?.url?.match(/\/users\/([^/]+)\/actions\/([^/?]+)/) ?? [];
    const ajustes = visualAjustesDeAccion[usuario] ??= {};
    if ((config?.method ?? '').toLowerCase() === 'delete') delete ajustes[accion];
    else ajustes[accion] = Boolean(visualRequestBody(config).allowed);
    return { accion };
  }],
  [/\/users\/[^/]+\/actions$/, (config) => {
    const usuario = (config?.url?.match(/\/users\/([^/]+)\/actions/) ?? [])[1];
    const ajustes = visualAjustesDeAccion[usuario] ?? {};
    const base = [
      { clave: 'crm.importar', modulo: 'crm', nombre: 'Importar leads', ayuda: 'Subir contactos desde un archivo.', porNivel: true },
      { clave: 'crm.borrar', modulo: 'crm', nombre: 'Borrar oportunidades', ayuda: 'Eliminar una oportunidad del embudo.', porNivel: true },
      { clave: 'reservations.exportar', modulo: 'reservations', nombre: 'Exportar reservas', ayuda: 'Descargar reservas con datos de contacto.', porNivel: true },
      { clave: 'reservations.importar', modulo: 'reservations', nombre: 'Importar reservas', ayuda: 'Cargar reservas desde un archivo.', porNivel: true },
      { clave: 'surveys.enviar', modulo: 'surveys', nombre: 'Enviar encuestas por correo', ayuda: 'Mandar la encuesta a sus destinatarios.', porNivel: true },
      { clave: 'surveys.borrar', modulo: 'surveys', nombre: 'Eliminar encuestas', ayuda: 'Borrar una encuesta con todas sus respuestas.', porNivel: false },
    ];
    return { userId: usuario, acciones: base.map((accion) => ({ ...accion, permitida: ajustes[accion.clave] ?? accion.porNivel, origen: accion.clave in ajustes ? 'ajuste' : 'nivel' })) };
  }],
  [/\/users\/[^/]+\/client-access\/[^/]+$/, (config) => {
    const [, usuario, empresa] = config?.url?.match(/\/users\/([^/]+)\/client-access\/([^/?]+)/) ?? [];
    const lista = visualEmpresasDeUsuario[usuario] ??= [];
    if ((config?.method ?? '').toLowerCase() === 'delete') visualEmpresasDeUsuario[usuario] = lista.filter((item) => item.clientId !== empresa);
    else if (!lista.some((item) => item.clientId === empresa)) lista.push({ clientId: empresa, source: 'assignment' });
    return { ok: true };
  }],
  [/\/users\/[^/]+\/client-access$/, (config) => {
    const usuario = (config?.url?.match(/\/users\/([^/]+)\/client-access/) ?? [])[1];
    return { userId: usuario, role: 'community_manager', access: visualEmpresasDeUsuario[usuario] ??= [{ clientId: 'visual-client', source: 'pod' }] };
  }],
  [/\/crm\/leads\/l1$/, (config) => {
    const cambios = (config?.method ?? 'get').toLowerCase() === 'get' ? {} : visualRequestBody(config);
    if (cambios.customFields) Object.assign(visualLeadConCampos.customFields, cambios.customFields);
    return { ...visualLeadConCampos, ...cambios, customFields: { ...visualLeadConCampos.customFields } };
  }],
  [/\/crm\/fields\/[^/]+\/archivo$/, (config) => {
    const id = (config?.url?.match(/\/crm\/fields\/([^/]+)\/archivo/) ?? [])[1];
    const campo = visualCrmFields.find((item) => item.id === id);
    if (!campo) return {};
    campo.archivedAt = visualRequestBody(config).archivado ? new Date().toISOString() : null;
    return campo;
  }],
  [/\/crm\/fields\/[^/?]+$/, (config) => {
    const id = (config?.url?.match(/\/crm\/fields\/([^/?]+)/) ?? [])[1];
    const campo = visualCrmFields.find((item) => item.id === id);
    if (!campo) return {};
    Object.assign(campo, visualRequestBody(config));
    return campo;
  }],
  [/\/crm\/fields(?:\?|$)/, (config) => {
    if ((config?.method ?? 'get').toLowerCase() === 'post') {
      const body = visualRequestBody(config);
      const nuevo = { id: `f${Date.now()}`, entity: body.entity, key: body.key, label: body.label, type: body.type, options: body.options ?? null, required: Boolean(body.required), position: visualCrmFields.length, archivedAt: null };
      visualCrmFields.push(nuevo);
      return nuevo;
    }
    const url = new URL(`http://x${config?.url ?? ''}`);
    const entidad = url.searchParams.get('entity');
    const archivados = url.searchParams.get('archivados') === 'true';
    return visualCrmFields.filter((campo) => campo.entity === entidad && (archivados || !campo.archivedAt)).sort((a, b) => a.position - b.position);
  }],
  [/\/saved-views\/[^/?]+$/, (config) => {
    const id = decodeURIComponent((config?.url?.match(/\/saved-views\/([^/?]+)/) ?? [])[1] ?? '');
    const indice = visualSavedViews.findIndex((vista) => vista.id === id);
    if (indice < 0) return {};
    if ((config?.method ?? '').toLowerCase() === 'delete') { visualSavedViews.splice(indice, 1); return { deleted: true }; }
    visualSavedViews[indice].shared = Boolean(visualRequestBody(config).shared);
    return visualSavedViews[indice];
  }],
  [/\/saved-views(?:\?|$)/, (config) => {
    if ((config?.method ?? 'get').toLowerCase() === 'post') {
      const body = visualRequestBody(config);
      const existente = visualSavedViews.find((vista) => vista.propia && vista.scope === body.scope && vista.name === body.name);
      if (existente) { Object.assign(existente, { filters: body.filters, shared: Boolean(body.shared) }); return existente; }
      const nueva = { id: `vista-${Date.now()}`, scope: String(body.scope), name: String(body.name), filters: body.filters ?? {}, shared: Boolean(body.shared), propia: true };
      visualSavedViews.push(nueva);
      return nueva;
    }
    const scope = new URL(`http://x${config?.url ?? ''}`).searchParams.get('scope');
    return visualSavedViews.filter((vista) => vista.scope === scope);
  }],
  [/\/public\/surveys\/visual-survey\/start$/, (config) => {
    const body = visualRequestBody(config);
    const rating = Number(body.rating);
    return { responseId: 'visual-response-nueva', token: 'token-visual-de-prueba-123', rating, siguiente: rating < 4 ? 'mensaje-al-equipo' : 'ofrecer-encuesta', reviewUrl: 'https://g.page/r/ejemplo/review', nombre: body.invitacion ? 'Camila' : null };
  }],
  [/\/public\/surveys\/visual-survey\/responses\/[^/]+\/complete$/, (config) => ({ completed: Boolean(visualRequestBody(config).terminar) })],
  [/\/public\/surveys\/visual-survey\/visit$/, () => ({ registrada: true })],
  [/\/surveys\/visual-survey\/responses\/[^/]+\/attention$/, (config) => ({ attendedAt: visualRequestBody(config).atendida ? new Date().toISOString() : null })],
  [/\/public\/surveys\/visual-survey$/, () => VISUAL_SURVEY],
  [/\/surveys\/visual-survey\/send-email$/, () => ({ enviados: 2, fallidos: 0, invalidos: 1 })],
  [/\/surveys\/visual-survey\/results$/, () => ({
    surveyId: 'visual-survey', totalResponses: 6, completionRate: null,
    visitasPorDia: [
      { origen: 'qr-mesa', dia: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), total: 42 },
      { origen: 'whatsapp', dia: new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10), total: 35 },
      { origen: 'instagram', dia: new Date(Date.now() - 33 * 86400000).toISOString().slice(0, 10), total: 60 },
      { origen: 'link', dia: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), total: 12 },
    ], generatedAt: new Date().toISOString(),
    questions: [
      { questionId: 'nota', question: '¿Cómo fue tu visita?', required: true, totalAnswers: 3, type: 'rating', average: 3.7, distribution: { '2': 1, '4': 1, '5': 1 } },
      { questionId: 'volveria', question: '¿Volverías?', required: true, totalAnswers: 1, type: 'multiple-choice', counts: { 'Sí': 1 } },
      { questionId: 'mejorar', question: '¿Qué podríamos hacer mejor?', required: false, totalAnswers: 1, type: 'text', answers: ['Más opciones sin gluten'] },
    ],
    respuestas: [
      { id: 'r1', submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(), rating: 2, respondentName: 'Sebastián Vera', respondentEmail: 'sebastian@example.test', origen: 'reserva', reservationId: 'visual-booking-2', teamMessage: 'La comida llegó fría y tuvimos que pedir la cuenta tres veces.', completedAt: new Date(Date.now() - 2 * 3600000).toISOString(), answers: { nota: 2 } },
      { id: 'r2', submittedAt: new Date(Date.now() - 26 * 3600000).toISOString(), rating: 5, respondentName: 'Camila Rojas', respondentEmail: 'camila@example.test', origen: 'reserva', reservationId: 'visual-booking-1', teamMessage: null, completedAt: new Date(Date.now() - 26 * 3600000).toISOString(), answers: { nota: 5, volveria: 'Sí', mejorar: 'Más opciones sin gluten' } },
      { id: 'r3', origen: 'qr', submittedAt: new Date(Date.now() - 50 * 3600000).toISOString(), rating: 4, respondentName: null, respondentEmail: null, reservationId: null, teamMessage: null, completedAt: null, answers: { nota: 4 } },
      { id: 'r4', origen: 'whatsapp', attendedAt: new Date(Date.now() - 8 * 86400000).toISOString(), attendedByName: 'Valentina Soto', submittedAt: new Date(Date.now() - 9 * 86400000).toISOString(), rating: 3, respondentName: 'Ignacia Muñoz', respondentEmail: 'ignacia@example.test', reservationId: null, teamMessage: null, completedAt: new Date(Date.now() - 9 * 86400000).toISOString(), privacyConsentAt: new Date(Date.now() - 9 * 86400000).toISOString(), answers: { nota: 3, volveria: 'Tal vez', fallo: 'El tiempo de espera', 'dato-nombre': 'Ignacia Muñoz', 'dato-correo': 'ignacia@example.test', 'dato-telefono': '+56 9 8765 4321' } },
      { id: 'r5', origen: 'qr', submittedAt: new Date(Date.now() - 20 * 86400000).toISOString(), rating: 5, respondentName: null, respondentEmail: null, reservationId: null, teamMessage: null, completedAt: new Date(Date.now() - 20 * 86400000).toISOString(), answers: { nota: 5, volveria: 'Sí' } },
      { id: 'r6', origen: 'instagram', submittedAt: new Date(Date.now() - 33 * 86400000).toISOString(), rating: 4, respondentName: null, respondentEmail: null, reservationId: null, teamMessage: null, completedAt: new Date(Date.now() - 33 * 86400000).toISOString(), answers: { nota: 4, volveria: 'Sí', mejorar: 'Música un poco más baja' } },
    ],
  })],
  [/\/surveys\/visual-survey$/, () => VISUAL_SURVEY],
  [/\/surveys(?:\?|$)/, () => [VISUAL_SURVEY]],
  [/\/auth\/session$/, () => ({ authenticated: true, accessToken: syntheticJwt() })],
  [/\/auth\/refresh$/, () => ({ accessToken: syntheticJwt() })],
  [/\/auth\/login$/, () => ({ accessToken: syntheticJwt(), user: VISUAL_USER })],
  [/\/auth\/me$/, () => VISUAL_USER],
  [/\/me\/permissions$/, () => ({ permissions: forEveryModule('manage') })],
  [/\/auth\/logout$/, () => ({})],
  [/\/notifications\/unread/, () => ({ unread: 0 })],
  // Casa Costanera tiene Reservas y Encuestas, no CRM: así se comprueba que Correos oculta los
  // avisos de un servicio que esa empresa no contrató.
  [/\/clients(?:\?|$)/, () => ({ data: [{ id: 'visual-client', name: 'Casa Costanera', capabilities: { reservations: true, crm: false, surveys: true } }] })],
  /*
   * Datos de ejemplo del CRM.
   *
   * El vacio generico deja las seis vistas en blanco, y una pantalla vacia no permite revisar si
   * una tarjeta cabe, si una columna se corta o si un porcentaje se lee. Estos datos no tocan
   * ninguna base: viven aca y solo existen bajo \`npm run dev:visual\`.
   *
   * Se eligieron para que cada vista muestre sus casos limite: un lead sin asignar, uno recien
   * ingresado, uno enfriandose y un descarte con motivo.
   */
  [/\/crm\/home\/dashboard/, () => ({
    days: 30,
    totals: {
      leads: 42, calificados: 18, conVisita: 11, ventas: 4,
      montoVendido: 32400000, pipelineAbierto: 96500000, ticketPromedio: 8100000, estancados: 6,
    },
    porEtapa: [
      { key: 'contacted', total: 14 }, { key: 'new', total: 9 }, { key: 'quote_sent', total: 7 },
      { key: 'meeting_scheduled', total: 5 }, { key: 'negotiation', total: 3 },
      { key: 'won', total: 4 }, { key: 'lost', total: 6 },
    ],
    porFuente: [
      { key: 'Meta Ads', total: 24 }, { key: 'Formulario web', total: 11 },
      { key: 'Referido', total: 5 }, { key: 'Portal', total: 2 },
    ],
    porDia: [1, 4, 2, 0, 3, 5, 1, 2, 6, 3, 0, 4, 7, 4].map((total, i) => ({
      key: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
      total,
    })),
    motivosDeCierre: [
      { key: 'Precio', total: 3 }, { key: 'Sin respuesta', total: 2 }, { key: 'Otro', total: 1 },
    ],
  })],
  [/\/crm\/home$/, () => ({
    month: { leads: 42, ventas: 4, monto: 32400000 },
    urgentCount: 3,
    coolingDays: 7,
    alerts: [
      { key: 'sin_contactar', count: 9, sample: { id: 'l1', name: 'Ricardo Galvez Lopez', source: 'Meta Ads', campaignName: 'Primavera', createdAt: '2026-08-20T02:15:20.674Z' } },
      { key: 'sin_asignar', count: 3, sample: { id: 'l2', name: 'Fabiana Ibanez Escalona', source: 'Meta Ads', campaignName: 'Primavera', createdAt: '2026-08-19T02:15:20.676Z' } },
      { key: 'calificados_sin_visita', count: 7, sample: { id: 'l3', name: 'Matias Cancino Caceres', source: 'Formulario web', campaignName: null, createdAt: '2026-08-15T02:15:20.676Z' } },
    ],
    team: [
      { userId: 'u1', name: 'Mathias Quintana', open: 14, uncontacted: 3, cooling: 2 },
      { userId: 'u2', name: 'German Larre', open: 9, uncontacted: 1, cooling: 4 },
      { userId: 'u3', name: 'Maria Veronica Vera', open: 5, uncontacted: 0, cooling: 0 },
    ],
  })],
  [/\/crm\/leads\/[^/]+\/historial$/, () => ([
    { id: 'p1', fromStage: null, toStage: 'new', durationHours: null, changedBy: null, reason: null, createdAt: '2026-08-08T02:15:20.676Z' },
    { id: 'p2', fromStage: 'new', toStage: 'contacted', durationHours: 26.5, changedBy: 'u1', reason: null, createdAt: '2026-08-09T02:15:20.676Z' },
    { id: 'p3', fromStage: 'contacted', toStage: 'quote_sent', durationHours: 72, changedBy: 'u1', reason: null, createdAt: '2026-08-12T02:15:20.676Z' },
  ])],
  [/\/crm\/leads(\?|$)/, () => ({
    data: [
      { id: 'l1', customFields: { canal: 'WhatsApp', presupuesto_mensual: 800000, rubro_antiguo: 'Gastronomía' }, name: 'Ricardo Galvez Lopez', phone: '+56983000089', email: 'galvezr941@gmail.com', status: 'new', source: 'Meta Ads', campaignName: 'Primavera', assignedTo: null, clientId: null, estimatedAmount: 4500000, createdAt: '2026-08-20T02:15:20.676Z', updatedAt: '2026-08-20T02:15:20.676Z' },
      { id: 'l2', name: 'Fabiana Ibanez Escalona', phone: '+56948532342', email: 'fabiana@gmail.com', status: 'contacted', source: 'Meta Ads', campaignName: 'Primavera', assignedTo: 'u1', clientId: null, estimatedAmount: 7800000, createdAt: '2026-08-17T02:15:20.676Z', updatedAt: '2026-08-19T02:15:20.676Z' },
      { id: 'l3', name: 'Matias Cancino Caceres', phone: '+56967338235', email: 'matias09@hotmail.com', status: 'quote_sent', source: 'Formulario web', campaignName: null, assignedTo: 'u1', clientId: null, estimatedAmount: 12000000, createdAt: '2026-08-14T02:15:20.676Z', updatedAt: '2026-08-10T02:15:20.676Z' },
      { id: 'l4', name: 'Yohana Valenzuela', phone: '+56996118555', email: 'yohana@gmail.com', status: 'meeting_scheduled', source: 'Referido', campaignName: null, assignedTo: 'u2', clientId: null, estimatedAmount: 9200000, createdAt: '2026-08-11T02:15:20.676Z', updatedAt: '2026-08-18T02:15:20.676Z' },
      { id: 'l5', name: 'Oriana Astete', phone: '+56987392203', email: 'oriana@gmail.com', status: 'negotiation', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u2', clientId: null, estimatedAmount: 15600000, createdAt: '2026-07-31T02:15:20.676Z', updatedAt: '2026-08-19T02:15:20.676Z' },
      { id: 'l6', name: 'Merida Colores', phone: '+56958036024', email: 'merida@gmail.com', status: 'won', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u1', clientId: null, estimatedAmount: 8100000, createdAt: '2026-07-21T02:15:20.676Z', updatedAt: '2026-08-16T02:15:20.676Z' },
      { id: 'l7', name: 'Maria Elena Donoso', phone: '+56966459555', email: 'elenadg30@hotmail.com', status: 'lost', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u1', clientId: null, discardReason: 'Precio', estimatedAmount: 0, createdAt: '2026-07-26T02:15:20.676Z', updatedAt: '2026-08-13T02:15:20.676Z' },
    ],
    total: 7,
  })],
  [/\/crm\/ingest-sources/, () => ([
    { id: 's1', name: 'Meta Ads', source: 'meta_ads', isActive: true, tokenHint: '...4a2f91', receivedCount: 24, lastReceivedAt: '2026-08-20T02:15:20.676Z', lastError: null, url: '' },
    { id: 's2', name: 'Portal inmobiliario', source: 'portal', isActive: true, tokenHint: '...b7c033', receivedCount: 0, lastReceivedAt: null, lastError: null, url: '' },
    { id: 's3', name: 'Formulario web', source: 'formulario_web', isActive: false, tokenHint: '...19ee42', receivedCount: 6, lastReceivedAt: '2026-08-15T02:15:20.676Z', lastError: 'El lead necesita telefono o correo', url: '' },
  ])],
  [/\/meetings/, () => ([
    { id: 'm1', title: 'Visita Fundo La Esperanza', scheduledAt: '2026-08-20T02:15:20.676Z', clientId: null },
    { id: 'm2', title: 'Llamada Oriana Astete', scheduledAt: '2026-08-22T02:15:20.676Z', clientId: null },
    { id: 'm3', title: 'Cierre Merida Colores', scheduledAt: '2026-08-25T02:15:20.676Z', clientId: null },
  ])],

  /*
   * El dashboard es la unica vista de las 33 que no se sostiene con el vacio generico:
   * `OperationalHome` desestructura `const { today, upcoming } = data` y lee `today.total`
   * derecho. Un `today` ausente la tumba, y uno vacio le hace imprimir «undefined» en pantalla.
   * Se responde con la forma declarada en `OperationalHomeData`, en cero.
   */
  // Resultados con canales: uno que convierte bien, uno flojo, uno detectado y mucho directo.
  [/\/reservations\/forms\/[^/]+\/meta-health/, () => ({ enviados: 184, pendientes: 2, fallidos: 3, ultimoEnvio: new Date(Date.now() - 40 * 60000).toISOString(), ultimoError: { mensaje: 'Invalid parameter: event_time is too far in the past', cuando: new Date(Date.now() - 3 * 86400000).toISOString() } })],
  [/\/reservations\/analytics\/metrics/, () => ({
    days: 30,
    totals: { total: 96, attended: 61, no_show: 7, pending: 9, confirmed: 19, cancelled: 4 },
    daily: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10), total: 4 + (i % 5), attended: 3 + (i % 3), no_show: i % 4 === 0 ? 1 : 0 })),
    sources: [
      { source: 'instagram', medium: 'social', campaign: '', content: '', total: 31, attended: 22 },
      { source: 'qr-mesa', medium: 'qr', campaign: '', content: '', total: 18, attended: 14 },
      { source: 'google', medium: 'maps', campaign: '', content: 'deteccion-automatica', total: 22, attended: 15 },
      { source: 'whatsapp', medium: 'social', campaign: 'dia-de-la-madre', content: '', total: 6, attended: 3 },
      { source: 'directo', medium: 'Sin medio', campaign: 'Sin campaña', content: '', total: 19, attended: 7 },
    ],
    canales: [
      { source: 'instagram', visitas: 240, reservas: 31, asistieron: 22, conversion: 12.9, detectado: false },
      { source: 'google', visitas: 110, reservas: 22, asistieron: 15, conversion: 20, detectado: true },
      { source: 'directo', visitas: 380, reservas: 19, asistieron: 7, conversion: 5, detectado: false },
      { source: 'qr-mesa', visitas: 64, reservas: 18, asistieron: 14, conversion: 28.1, detectado: false },
      { source: 'whatsapp', visitas: 150, reservas: 6, asistieron: 3, conversion: 4, detectado: false },
      { source: 'facebook', visitas: 9, reservas: 0, asistieron: 0, conversion: 0, detectado: true },
    ],
    areas: [{ area: 'Terraza', total: 52 }, { area: 'Salón', total: 44 }],
    porHora: [{ hora: 13, total: 30, attended: 22 }, { hora: 20, total: 41, attended: 27 }, { hora: 21, total: 25, attended: 12 }],
    anticipacionHoras: 30, recurrencia: { personas: 80, repiten: 14, porcentaje: 18 },
    funnel: { views: 953, starts: 240, completed: 96, conversionRate: 10.1 },
  })],
  [/\/reservations\/analytics\/operational-home/, () => ({
    date: new Date().toISOString().slice(0, 10),
    timezone: 'America/Santiago',
    today: { total: 0, attended: 0, pending: 0, noShow: 0, dailyCap: 0, occupancyPct: null },
    upcoming: [],
  })],
  // Datos demostrativos únicamente: permiten revisar el estado de integración sin exponer
  // credenciales ni intentar enviar eventos a Meta desde el modo visual.
  [/\/integrations\/meta\/client-pixels\/catalog/, () => ({
    bindings: [{ clientId: 'visual-client', pixelId: '123456789012345', pixelName: 'Casa Costanera · Reservas', tokenConfigured: true }],
    pixels: [{ pixelId: '123456789012345', pixelNames: ['Casa Costanera · Reservas'], usageCount: 1, tokenConfigured: true }],
  })],
  // El listado se pide tanto con filtros (`?clientId=`) como sin query. Si sólo se
  // simulaba la primera variante, Administración aparecía vacía y no se podía revisar
  // el flujo completo aunque el local de ejemplo sí estaba definido arriba.
  [/\/uploads\/images$/, (config) => {
    const file = config?.data instanceof FormData ? config.data.get('file') : null;
    const url = file instanceof Blob ? URL.createObjectURL(file) : '';
    return url ? { url, publicId: `visual/${Date.now()}` } : { url: '', publicId: '' };
  }],
  [/\/uploads\/images\/cloudinary\//, () => ({ deleted: true })],
  [/\/uploads\/images\/status/, () => ({ configured: true })],
  [/\/public\/reservations\/manage\/[^/]+\/beneficios$/, () => ({ aceptado: true })],
  [/\/settings\/estado-del-correo$/, () => ({ habilitado: true, remitente: 'reservas@espartanos.cl', servidor: 'mail.espartanos.cl', puerto: 465, respuestasA: null, faltan: [] })],
  [/\/(reservations|surveys)\/company-legal/, (config) => {
    const clave = 'vh.visual.companyLegal';
    let actual: Record<string, unknown> = { legalName: 'Casa Costanera SpA', taxId: '', privacyEmail: '', privacyUrl: '', termsUrl: '', legalMode: 'enlace', privacyText: '', termsText: '' };
    try { actual = { ...actual, ...JSON.parse(localStorage.getItem(clave) || '{}') }; } catch { /* sin almacenamiento */ }
    if (config?.method?.toLowerCase() === 'put') {
      const cuerpo = visualRequestBody(config);
      actual = { ...actual, ...cuerpo };
      if (cuerpo.aceptaEncargo === true) actual.encargo = { version: VERSION_DOCUMENTOS_LEGALES, aceptadoEn: new Date().toISOString(), aceptadoPor: 'Usuario visual', vigente: true, versionVigente: VERSION_DOCUMENTOS_LEGALES };
      delete actual.aceptaEncargo;
      try { localStorage.setItem(clave, JSON.stringify(actual)); } catch { /* sin almacenamiento */ }
    }
    return actual;
  }],
  // Pixels entre los que puede elegir el local: uno de la empresa y uno de otra cuenta sin token,
  // para poder ver en pantalla el aviso de credencial faltante.
  [/\/reservations\/forms\/meta-pixels/, () => ({
    porDefecto: { pixelId: '123456789012345', pixelName: 'Casa Costanera · Reservas', tieneToken: true },
    pixels: [
      { pixelId: '123456789012345', nombre: 'Casa Costanera · Reservas', tieneToken: true, esDeLaEmpresa: true },
      { pixelId: '998877665544332', nombre: 'Terraza · agencia', tieneToken: true, esDeLaEmpresa: false },
      { pixelId: '555000111222333', nombre: null, tieneToken: false, esDeLaEmpresa: false },
    ],
  })],
  [/\/reservations\/forms(?:\?|$)/, (config) => {
    const method = config?.method?.toLowerCase();
    if (method === 'post') {
      const body = visualRequestBody(config);
      const baseSlug = visualSlug(String(body.name || 'nuevo-local'));
      const publicSlug = visualReservationForms.some((form) => form.publicSlug === baseSlug)
        ? `${baseSlug}-${visualReservationForms.length + 1}` : baseSlug;
      const created = {
        ...structuredClone(VISUAL_RESERVATION_LOCAL),
        id: `visual-form-${Date.now()}`,
        clientId: body.clientId || 'visual-client',
        name: String(body.name || 'Nuevo local'),
        mode: body.mode || 'appointment',
        publicSlug,
        status: 'draft',
        metaCapiEnabled: false,
        pixelId: null,
        pixelName: null,
        metaReady: false,
        ga4MeasurementId: null,
        designConfig: { ...structuredClone(VISUAL_RESERVATION_LOCAL.designConfig), title: String(body.name || 'Nuevo local'), logoUrl: '', backgroundImage: '', backgroundMode: 'color' },
        updatedAt: new Date().toISOString(),
      };
      visualReservationForms.push(created);
      guardarFormulariosVisuales();
      return created;
    }
    const clientId = new URL(config?.url || '/', window.location.origin).searchParams.get('clientId');
    return visualReservationForms.filter((form) => !clientId || form.clientId === clientId);
  }],
  [/\/reservations\?(?!.*analytics)/, () => ({ data: VISUAL_RESERVATIONS, total: VISUAL_RESERVATIONS.length, page: 1, pageSize: 100, pages: 1 })],
  /*
   * Horarios calculados con la configuración del local, como el servidor: semana habitual,
   * duración, una llegada cada N minutos, anticipación mínima y ventana máxima. Usa la hora del
   * navegador como si fuera la del local; alcanza para revisar la pantalla.
   */
  [/\/public\/reservations\/[^/?]+\/slots/, (config) => {
    const slugPedido = (config?.url?.match(/\/public\/reservations\/([^/?]+)\/slots/) ?? [])[1];
    const local = visualReservationForms.find((item) => item.publicSlug === slugPedido) ?? VISUAL_RESERVATION_LOCAL;
    const url = new URL(`http://x${config?.url ?? ''}`);
    const desde = url.searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const dias = Math.min(62, Number(url.searchParams.get('days') || '14') || 14);
    const personas = Number(url.searchParams.get('partySize') || '2') || 2;
    const ritmo = Number(local.designConfig?.slotCadenceMinutes || '15') || 15;
    const primero = Date.now() + local.minimumNoticeHours * 3_600_000;
    const ultimo = Date.now() + local.maximumAdvanceDays * 86_400_000;
    const [anio, mes, dia] = desde.split('-').map(Number);
    const slots: Array<{ startsAt: string; available: number }> = [];
    for (let indice = 0; indice < dias; indice += 1) {
      const fecha = new Date(anio, mes - 1, dia + indice);
      for (const ventana of (local.scheduleConfig?.windows ?? []).filter((item: { day: number }) => item.day === fecha.getDay())) {
        const [hi, mi] = ventana.start.split(':').map(Number); const [hf, mf] = ventana.end.split(':').map(Number);
        for (let minuto = hi * 60 + mi; minuto + local.durationMinutes <= hf * 60 + mf; minuto += ritmo) {
          const inicio = new Date(fecha); inicio.setHours(Math.floor(minuto / 60), minuto % 60, 0, 0);
          if (inicio.getTime() < primero || inicio.getTime() > ultimo) continue;
          // `?cupoPrueba=N` en la página simula un cupo bajo, para revisar el aviso de «sin horarios para N personas».
          const cupoPrueba = Number(new URLSearchParams(window.location.search).get('cupoPrueba'));
          const available = cupoPrueba > 0 ? cupoPrueba : Math.max(0, local.capacityPerSlot - ((inicio.getDate() * 7 + minuto) % 9));
          if (available >= personas) slots.push({ startsAt: inicio.toISOString(), available });
        }
      }
    }
    return { slots, fullDays: [] };
  }],
  [/\/public\/reservations\/manage\/[^/?]+\/cancel$/, () => {
    visualManagedReservation.status = 'cancelled_client';
    visualManagedReservation.canCancel = false;
    visualManagedReservation.canReschedule = false;
    return { cancelled: true, referenceCode: visualManagedReservation.referenceCode, status: visualManagedReservation.status };
  }],
  [/\/public\/reservations\/manage\/[^/?]+\/confirm$/, () => {
    visualManagedReservation.guestConfirmedAt = new Date().toISOString();
    return { confirmed: true, referenceCode: visualManagedReservation.referenceCode };
  }],
  [/\/public\/reservations\/manage\/[^/?]+\/reschedule$/, (config) => {
    const body = visualRequestBody(config);
    if (body.startsAt) visualManagedReservation.startsAt = body.startsAt;
    visualManagedReservation.status = 'rescheduled';
    return { referenceCode: visualManagedReservation.referenceCode, startsAt: visualManagedReservation.startsAt, status: visualManagedReservation.status };
  }],
  [/\/public\/reservations\/manage\/[^/?]+$/, () => ({ ...visualManagedReservation })],
  /*
   * Solicitud de grupo: no toma horario, así que su respuesta no trae fecha.
   *
   * Faltaba la regla, y al no coincidir con ninguna el flujo terminaba en una respuesta sin
   * `kind` ni `startsAt` —justo la forma que hacía caer la pantalla de confirmación—.
   */
  /*
   * Historial de quien reserva, para poder revisar el bloque que lo muestra.
   *
   * Sin datos previos la ficha decía siempre «primera vez» y no había forma de ver en pantalla
   * lo que se deduce de visitas anteriores.
   */
  [/\/reservations\/[^/?]+\/guest-history$/, () => ({
    total: 4,
    attended: 3,
    noShow: 1,
    anteriores: [
      { id: 'h1', referenceCode: 'CC-0931', startsAt: new Date(Date.now() - 21 * 86400000).toISOString(), status: 'attended', partySize: 2 },
      { id: 'h2', referenceCode: 'CC-0844', startsAt: new Date(Date.now() - 58 * 86400000).toISOString(), status: 'attended', partySize: 2 },
      { id: 'h3', referenceCode: 'CC-0777', startsAt: new Date(Date.now() - 96 * 86400000).toISOString(), status: 'no_show', partySize: 4 },
      { id: 'h4', referenceCode: 'CC-0612', startsAt: new Date(Date.now() - 150 * 86400000).toISOString(), status: 'attended', partySize: 2 },
    ],
    preferencias: {
      zonaHabitual: 'terrace',
      personasHabitual: 2,
      alergias: ['Sin gluten'],
      accesibilidad: ['Acceso sin escalón'],
      ultimaVisita: new Date(Date.now() - 21 * 86400000).toISOString(),
      diasDesdeLaUltima: 21,
      vinoConNinos: true,
      usoCupon: true,
    },
  })],
  [/\/public\/reservations\/[^/?]+\/group-request$/, () => ({ id: 'visual-group-1', status: 'pending', kind: 'group_request' })],
  [/\/public\/reservations\/[^/?]+$/, (config) => {
    const slug = (config?.url?.match(/\/public\/reservations\/([^/?]+)/) ?? [])[1];
    if (config?.method?.toLowerCase() !== 'post') return visualReservationForms.find((form) => form.publicSlug === slug) || VISUAL_RESERVATION_LOCAL;
    const body = visualRequestBody(config);
    visualManagedReservation.guestName = String(body.guestName || visualManagedReservation.guestName);
    visualManagedReservation.partySize = Number(body.partySize || visualManagedReservation.partySize);
    visualManagedReservation.status = 'confirmed';
    visualManagedReservation.canCancel = true;
    visualManagedReservation.canReschedule = true;
    visualManagedReservation.guestConfirmedAt = null;
    return { id: 'visual-booking-3', referenceCode: visualManagedReservation.referenceCode, status: 'confirmed', startsAt: visualManagedReservation.startsAt, managementToken: visualManagedReservation.token };
  }],
  [/\/public\/reservations\/[^/?]+(?:\?|$)/, (config) => {
    const slug = (config?.url?.match(/\/public\/reservations\/([^/?]+)/) ?? [])[1];
    return visualReservationForms.find((form) => form.publicSlug === slug) || VISUAL_RESERVATION_LOCAL;
  }],
  [/\/integrations\/meta\/conversions\/outbox/, () => ({
    stats: { pending: 0, retry: 0, processing: 0, failed: 0, expired: 0, processed: 0, total: 0 },
    problems: [],
  })],
  /*
   * Analiticas con volumen real: el vacio generico dejaba la vista en su estado "sin reservas"
   * y no habia forma de revisar KPIs, evolucion, areas ni fuentes. `areas` es ademas la clave
   * que solo consume esta pantalla, asi que sin ella el grafico quedaba mudo aun con datos.
   */
  [/\/reservations\/analytics\/metrics/, (config) => {
    const dias = Number((config?.url?.match(/days=(\d+)/) ?? [])[1] || 30);
    const daily = Array.from({ length: Math.min(dias, 30) }, (_, index) => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - (Math.min(dias, 30) - 1 - index));
      const total = 6 + ((index * 7) % 11);
      const no_show = index % 6 === 0 ? 1 : 0;
      return { day: fecha.toISOString().slice(0, 10), total, attended: total - no_show - (index % 4 === 0 ? 1 : 0), no_show };
    });
    const total = daily.reduce((suma, fila) => suma + fila.total, 0);
    const attended = daily.reduce((suma, fila) => suma + fila.attended, 0);
    const no_show = daily.reduce((suma, fila) => suma + fila.no_show, 0);
    const views = Math.round(total * 6.4);
    return {
      totals: { total, attended, no_show, pending: 9, confirmed: total - attended - no_show - 9, waitlist: 4, cancelled: 7 },
      daily,
      areas: [{ area: 'Terraza', total: Math.round(total * 0.46) }, { area: 'Salón', total: Math.round(total * 0.39) }, { area: 'Sin área', total: Math.round(total * 0.15) }],
      sources: [{ source: 'meta', total: Math.round(total * 0.41) }, { source: 'google', total: Math.round(total * 0.24) }, { source: 'instagram', total: Math.round(total * 0.18) }, { source: 'directo', total: Math.round(total * 0.17) }],
      funnel: { views, starts: Math.round(total * 1.7), completed: total, conversionRate: Math.round(total * 1000 / views) / 10 },
      days: dias,
    };
  }],
  /*
   * El constructor del flujo (`ReservationBuilderPage`) es la otra vista que el vacio generico
   * no sostiene: lee `draft.designConfig.title` y `draft.timezone.split()` sin proteger el
   * segundo nivel, de modo que un formulario sin esos objetos la tumba. Se responde con un
   * formulario completo para poder revisar los cuatro pasos, incluido el entorno visual.
   */
  [/\/reservations\/forms\/[^/?]+\/pause$/, (config) => {
    const id = (config?.url?.match(/\/reservations\/forms\/([^/?]+)\/pause$/) ?? [])[1];
    const form = visualReservationForms.find((item) => item.id === id) || VISUAL_RESERVATION_LOCAL;
    const until = String(visualRequestBody(config).until || '');
    form.designConfig = { ...form.designConfig, bookingPausedUntil: until || undefined };
    guardarFormulariosVisuales();
    return form;
  }],
  [/\/reservations\/forms\/[^/?]+$/, (config) => {
    const id = (config?.url?.match(/\/reservations\/forms\/([^/?]+)$/) ?? [])[1];
    const form = visualReservationForms.find((item) => item.id === id) || VISUAL_RESERVATION_LOCAL;
    if (config?.method?.toLowerCase() !== 'patch') return form;
    const body = visualRequestBody(config);
    // Como el servidor: la pausa sólo cambia por su propia ruta.
    Object.assign(form, body, { designConfig: { ...form.designConfig, ...body.designConfig, bookingPausedUntil: form.designConfig?.bookingPausedUntil }, updatedAt: new Date().toISOString() });
    guardarFormulariosVisuales();
    return form;
  }],
  [/\/roles\/permissions$/, () => {
    const VISUAL_ROLES = ['admin','commercial_director','creative_director','operations_director','art_director','av_director','ai_lead','community_manager','designer','audiovisual','client'] as const;
    const ROLE_BASE: Record<string, 'manage'|'edit'|'view'|'none'> = { admin:'manage', operations_director:'edit', commercial_director:'edit', creative_director:'edit', art_director:'edit', av_director:'edit', ai_lead:'edit', community_manager:'view', designer:'view', audiovisual:'view', client:'none' };
    const matrix: Record<string, Record<string, string>> = {};
    for (const mod of MODULE_KEYS) {
      matrix[mod] = {};
      for (const role of VISUAL_ROLES) { matrix[mod][role] = ROLE_BASE[role] ?? 'view'; }
    }
    return { matrix };
  }],
  // Detalle de permisos de una persona, con la procedencia de cada nivel. Trae un caso de cada
  // motivo posible para poder revisar la pantalla completa.
  [/\/users\/[^/?]+\/permissions$/, () => ({
    userId: 'visual-user',
    role: 'commercial_director',
    modules: [
      { module: 'reservations', level: 'edit', source: 'role', roleAdjusted: false, moduleDisabled: false, productHidden: false },
      { module: 'surveys', level: 'none', source: 'override', roleAdjusted: false, moduleDisabled: false, productHidden: false },
      { module: 'crm', level: 'manage', source: 'role', roleAdjusted: true, moduleDisabled: false, productHidden: false },
      { module: 'clients', level: 'manage', source: 'role', roleAdjusted: false, moduleDisabled: false, productHidden: false },
      { module: 'reports', level: 'none', source: 'role', roleAdjusted: false, moduleDisabled: false, productHidden: true },
      { module: 'billing', level: 'none', source: 'role', roleAdjusted: false, moduleDisabled: true, productHidden: false },
    ],
  })],
  [/\/permission-overrides$/, () => ({
    items: [
      { id:'exc-001', userId:'user-cm', userName:'Valentina Rojas', userRole:'community_manager', module:'production', level:'edit', reason:'Campaña Q1 — necesita ver el tablero de producción por dos semanas', expiresAt: new Date(Date.now() + 14*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 2*864e5).toISOString() },
      { id:'exc-002', userId:'user-designer', userName:'Joaquín Muñoz', userRole:'designer', module:'crm', level:'view', reason:'Cobertura de vacaciones — puede ver contactos pero no editar', expiresAt: new Date(Date.now() + 3*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 864e5).toISOString() },
      { id:'exc-003', userId:'user-av', userName:'Diego Venegas', userRole:'audiovisual', module:'reports', level:'edit', reason:'Reporte trimestral del equipo AV', expiresAt: null, status:'active', createdAt: new Date(Date.now() - 5*864e5).toISOString() },
    ],
  })],
  /*
   * Pipeline comercial y automatizaciones.
   *
   * Van antes que la regla general de `/users` porque las pantallas nuevas piden `/users` sin
   * el filtro `isActive`, y sin una respuesta propia caerían en el vacío: los selectores de
   * responsable quedarían sin opciones y el tablero sin nombres.
   */
  [/\/crm\/opportunities/, () => ({
    total: 6,
    data: [
      { id: 'opp-1', name: 'Restaurante Ánimo — retainer mensual', amount: 1850000, stage: 'negotiation', probability: 70, assignedTo: 'user-admin', nextAction: 'Enviar propuesta ajustada', createdAt: '2026-07-28T12:00:00Z' },
      { id: 'opp-2', name: 'Café del Puerto — parrilla + audiovisual', amount: 920000, stage: 'proposal', probability: 45, assignedTo: 'user-ops', nextAction: 'Reunión de encuadre', createdAt: '2026-08-02T15:30:00Z' },
      { id: 'opp-3', name: 'Panadería Trigo — campaña de apertura', amount: 480000, stage: 'qualified', probability: 30, assignedTo: 'user-admin', createdAt: '2026-08-08T09:15:00Z' },
      { id: 'opp-4', name: 'Bar Sur — pauta trimestral', amount: 2400000, stage: 'new', probability: 15, createdAt: '2026-08-14T18:00:00Z' },
      { id: 'opp-5', name: 'Cocina Norte — retainer anual', amount: 3600000, stage: 'won', probability: 100, assignedTo: 'user-ops', createdAt: '2026-06-20T11:00:00Z' },
      { id: 'opp-6', name: 'Food truck Delta — piloto', amount: 320000, stage: 'lost', probability: 0, lossReason: 'sin_presupuesto', createdAt: '2026-07-05T14:20:00Z' },
    ],
  })],
  [/\/automations\/catalog$/, () => ({
    triggers: [
      { key: 'deal.created', label: 'Trato creado', entityType: 'opportunity', event: 'deal.created' },
      { key: 'deal.stage_changed', label: 'Cambio de etapa', entityType: 'opportunity', event: 'deal.stage_changed' },
      { key: 'deal.won', label: 'Trato ganado', entityType: 'opportunity', event: 'deal.won' },
      { key: 'deal.lost', label: 'Trato perdido', entityType: 'opportunity', event: 'deal.lost' },
      { key: 'lead.converted', label: 'Prospecto convertido', entityType: 'lead', event: 'lead.converted' },
      { key: 'task.overdue', label: 'Tarea vencida', entityType: 'approval', event: 'task.overdue' },
      { key: 'deal.stale', label: 'Trato sin seguimiento', entityType: 'opportunity', event: 'deal.stale' },
    ],
    actions: [
      { key: 'notify_user', label: 'Enviar notificación', requiredConfig: ['userId', 'title', 'message'] },
      { key: 'notify_assignee', label: 'Notificar al responsable', requiredConfig: ['title', 'message'] },
      { key: 'send_email', label: 'Enviar correo', requiredConfig: ['to', 'subject', 'body'] },
      { key: 'assign_user', label: 'Asignar responsable', requiredConfig: ['userId'] },
      { key: 'add_comment', label: 'Agregar nota al hilo', requiredConfig: ['body'] },
      { key: 'send_webhook', label: 'Enviar webhook', requiredConfig: ['url'] },
      { key: 'create_contract', label: 'Abrir contrato del trato ganado', requiredConfig: [] },
    ],
  })],
  [/\/automations\/runs\/[^/?]+$/, () => ({
    run: { id: 'run-1', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-5::2', entityType: 'opportunity', entityId: 'opp-5', status: 'completed', attempts: 0, createdAt: '2026-08-16T10:00:00Z', finishedAt: '2026-08-16T12:00:04Z' },
    steps: [
      { id: 'step-1', nodeId: 'cond-1', nodeType: 'condition', nodeKey: 'field', status: 'completed', output: { result: true }, durationMs: 3, createdAt: '2026-08-16T10:00:00Z' },
      { id: 'step-2', nodeId: 'delay-1', nodeType: 'delay', nodeKey: 'wait', status: 'skipped', durationMs: 1, createdAt: '2026-08-16T10:00:00Z' },
      { id: 'step-3', nodeId: 'act-1', nodeType: 'action', nodeKey: 'notify_assignee', status: 'completed', output: { notifiedUserId: 'user-ops' }, durationMs: 42, createdAt: '2026-08-16T12:00:04Z' },
    ],
  })],
  [/\/automations\/[^/?]+\/runs$/, () => ([
    { id: 'run-1', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-5::2', entityType: 'opportunity', entityId: 'opp-5abc1234', status: 'completed', attempts: 0, createdAt: '2026-08-16T10:00:00Z', finishedAt: '2026-08-16T12:00:04Z' },
    { id: 'run-2', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-9::2', entityType: 'opportunity', entityId: 'opp-9def5678', status: 'waiting', attempts: 0, resumeAt: '2026-08-18T14:00:00Z', createdAt: '2026-08-18T12:00:00Z' },
    { id: 'run-3', automationId: 'auto-1', automationVersion: 1, triggerKey: 'deal.won:opp-3::1', entityType: 'opportunity', entityId: 'opp-3ghi9012', status: 'failed', attempts: 5, lastError: 'La persona indicada no está activa en la organización', createdAt: '2026-08-10T08:00:00Z', finishedAt: '2026-08-10T09:04:00Z' },
  ])],
  [/\/automations\/[^/?]+$/, () => ({
    id: 'auto-1',
    name: 'Avisar al ganar un trato grande',
    description: 'Cuando se gana un trato sobre el millón, avisa al responsable pasadas dos horas.',
    triggerType: 'deal.won',
    isActive: true,
    version: 2,
    runAsUserId: 'user-admin',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-16T09:00:00Z',
    graph: {
      nodes: [
        { id: 'trigger', type: 'trigger', key: 'deal.won', config: {}, position: { x: 140, y: 20 } },
        { id: 'cond-1', type: 'condition', key: 'field', config: { field: 'amount', operator: 'greater_than', value: '1000000' }, position: { x: 140, y: 150 } },
        { id: 'delay-1', type: 'delay', key: 'wait', config: { amount: 2, unit: 'hours' }, position: { x: 40, y: 290 } },
        { id: 'act-1', type: 'action', key: 'notify_assignee', config: { title: 'Trato ganado', message: 'El trato cerró en {{amount}}.' }, position: { x: 40, y: 420 } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'delay-1', branch: 'true' },
        { id: 'e3', source: 'delay-1', target: 'act-1' },
      ],
    },
  })],
  [/\/automations$/, () => ([
    { id: 'auto-1', name: 'Avisar al ganar un trato grande', description: 'Sobre el millón, avisa al responsable pasadas dos horas.', triggerType: 'deal.won', isActive: true, version: 2, runAsUserId: 'user-admin', graph: { nodes: [], edges: [] }, createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-16T09:00:00Z' },
    { id: 'auto-2', name: 'Nota al perder un trato', description: 'Deja constancia del motivo en el hilo.', triggerType: 'deal.lost', isActive: false, version: 1, runAsUserId: 'user-ops', graph: { nodes: [], edges: [] }, createdAt: '2026-08-05T16:00:00Z', updatedAt: '2026-08-05T16:00:00Z' },
  ])],
  /*
   * `/users` sin filtros, que es como lo piden el tablero de pipeline y el editor de
   * automatizaciones. Devuelve el sobre `{ data }` porque es la forma que esas vistas leen;
   * la regla de abajo, con `isActive=true`, responde un arreglo pelado a quienes ya la usaban.
   */
  /*
   * Una pieza de producción, para poder abrir su detalle y su bitácora.
   *
   * Devuelve un arreglo pelado porque es lo que responde `ListPiecesUseCase`; envolverlo en
   * `{ data }` rompía el detalle con `pieces.find is not a function`.
   */
  [/\/production\/pieces$/, () => ([{
    id: 'piece-1', title: 'Parrilla agosto — pieza 3', type: 'post', status: 'internal_review',
    udAmount: 4, correctionCount: 1, difficultyLevel: 2, clientName: 'Cocina Norte',
    assignedTo: 'user-cm', assignedName: 'Valentina Rojas',
    createdAt: '2026-08-10T12:00:00Z', assignedAt: '2026-08-11T09:00:00Z',
  }])],
  /*
    Campañas con su costo por lead, y el alta que devuelve la llave recién emitida.

    El alta va **antes** del listado en esta tabla porque las dos coinciden con la misma ruta y
    gana la primera: sin este orden, crear una campaña devolvía la lista y la pantalla se
    quedaba sin llave que mostrar. Fue justo lo que impidió comprobar ese aviso.
  */
  [/\/crm\/campaigns$/, (config) => {
    if (config?.method?.toLowerCase() !== 'post') {
      return [
        { id: 'cmp1', name: 'Primavera', source: 'meta_lead_ads', clientId: null, investment: 450000, status: 'active', leads: 9, costPerLead: 50000 },
        { id: 'cmp2', name: 'Verano', source: 'meta_lead_ads', clientId: null, investment: 300000, status: 'active', leads: 0, costPerLead: null },
      ];
    }
    const body = typeof config?.data === 'string' ? JSON.parse(config.data) : config?.data;
    return {
      campaign: { id: 'cmp-nueva', name: body?.name ?? 'Campaña', source: body?.source ?? 'meta_lead_ads' },
      integracion: {
        url: '/api/public/ingest/leads',
        method: 'POST',
        header: 'Authorization: Bearer esp_in_ejemplo0000000000000000000000000000',
        token: 'esp_in_ejemplo0000000000000000000000000000',
      },
    };
  }],
  /* Resultado de una importación, con filas buenas y una rechazada. */
  [/\/crm\/leads\/import$/, (config) => {
    const body = typeof config?.data === 'string' ? JSON.parse(config.data) : config?.data;
    const total = Array.isArray(body?.rows) ? body.rows.length : 0;
    return {
      imported: Math.max(0, total - 1),
      duplicates: total > 1 ? 1 : 0,
      failed: total > 2
        ? [{ row: 4, name: 'Fila de ejemplo', reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' }]
        : [],
    };
  }],
  /*
   * Moodboards del cliente, con uno aprobado y uno en borrador.
   *
   * Los dos hacen falta para poder revisar la barrera: el selector de conversión solo debe
   * ofrecer el aprobado.
   */
  [/\/moodboards/, () => ({
    data: [
      { id: 'mb-1', clientId: 'visual-client', title: 'Verano 2026 — aprobado', status: 'approved', images: [], createdAt: '2026-08-01T10:00:00Z' },
      { id: 'mb-2', clientId: 'visual-client', title: 'Otoño — en borrador', status: 'draft', images: [], createdAt: '2026-08-10T10:00:00Z' },
    ],
    total: 2,
  })],
  /* Una solicitud audiovisual aceptada, para poder abrir el modal de conversión. */
  [/\/intake\/requests(\?|$)/, () => ({
    data: [{
      id: 'req-1', code: 'SOL-00001', clientId: 'visual-client', area: 'audiovisual',
      title: 'Reel de la carta nueva', description: 'Grabar los cuatro platos de la carta de primavera.',
      priority: 'high', status: 'accepted', assignedTo: 'user-av',
      creativeFields: { tipoAudiovisual: 'reel', locacion: '__no_aplica__', duracion: '30 s' },
      createdAt: '2026-08-14T10:00:00Z',
      client: { id: 'visual-client', name: 'Cocina Norte' },
      requester: { id: 'user-cm', name: 'Valentina Rojas' },
    }],
    total: 1,
  })],
  /* Hilo de trabajo. Sirve a las cinco áreas, así que la regla mira el sufijo. */
  [/\/comments$/, () => ({
    proceso: [
      { id: 'c1', body: 'Se ajustó el encuadre según el moodboard aprobado.', authorName: 'Joaquín Muñoz', authorRole: 'designer', visibility: 'internal', createdAt: '2026-08-14T15:20:00Z' },
      { id: 'c2', body: 'Falta el logo en vector; se pidió al cliente.', authorName: 'Valentina Rojas', authorRole: 'community_manager', visibility: 'internal', editedAt: '2026-08-15T10:05:00Z', createdAt: '2026-08-15T09:40:00Z' },
    ],
    revision: [
      { id: 'c3', body: 'Nos gusta la propuesta, solo cambiar el color del texto.', authorName: 'Cliente', authorRole: 'client', visibility: 'client', createdAt: '2026-08-16T11:00:00Z' },
    ],
  })],
  [/\/users$/, () => ({
    data: [
      { id: 'user-admin', name: 'Camila Riquelme', role: 'admin', isActive: true },
      { id: 'user-ops', name: 'María Paredes', role: 'operations_director', isActive: true },
      { id: 'user-cm', name: 'Valentina Rojas', role: 'community_manager', isActive: true },
    ],
    total: 3,
  })],
  [/\/users\?isActive=true$/, () => {
    const sampleUsers = [
      { id:'user-admin', name:'Camila Riquelme', role:'admin', isActive:true },
      { id:'user-cm', name:'Valentina Rojas', role:'community_manager', isActive:true },
      { id:'user-designer', name:'Joaquín Muñoz', role:'designer', isActive:true },
      { id:'user-av', name:'Diego Venegas', role:'audiovisual', isActive:true },
      { id:'user-ops', name:'María Paredes', role:'operations_director', isActive:true },
    ];
    return sampleUsers;
  }],
  [/\/health\/details$/, () => ({
    status: 'ok', uptime: 86400, timestamp: new Date().toISOString(), version: '1.0.0',
    database: { status: 'ok', connected: true, writable: true, message: 'Conexión activa' },
    memory: { status: 'ok', usagePercent: '34%', freeMb: 340, totalMb: 512 },
    disk: { status: 'ok', writable: true, message: 'Escritura verificada' },
    redis: { status: 'not_configured', message: 'Modo visual: sin Redis' },
  })],
  [/\/consent\/active$/, () => null], // null → muestra EmptyState "Sin consentimiento publicado"
  [/\/consent\/pending-count$/, () => ({ pending: 0, total: 0 })],
  /*
   * Panel de correos: el aviso de encuesta después de la visita, para revisar el selector.
   *
   * Sólo con la empresa elegida —\`?clientId=\`—: la encuesta es de cada empresa, y la vista general
   * tiene que decir que se elige empresa primero.
   */
  [/\/settings(\/correos)?\?clientId=[^&]+$/, () => [
    ...ajustesDeCorreo('client'),
    { key: 'email.post_visit_survey_enabled', label: 'Encuesta después de la visita', description: 'Unas horas después de una reserva asistida.', valueType: 'boolean', value: true, source: 'client' },
    { key: 'email.post_visit_survey_id', label: 'Encuesta después de la visita · encuesta', description: 'Qué encuesta se envía.', valueType: 'text', value: 'visual-survey', source: 'client' },
    { key: 'email.post_visit_survey_hours', label: 'Encuesta después de la visita · espera', description: 'Horas después del fin de la visita.', valueType: 'number', value: 3, source: 'master_default', min: 1, max: 72, unit: 'horas' },
    { key: 'email.post_visit_survey_subject', label: 'Encuesta después de la visita · asunto', description: 'Variables: {{nombre}}, {{local}}, {{fecha}}.', valueType: 'text', value: '¿Cómo te fue en {{local}}?', source: 'master_default' },
    { key: 'email.post_visit_survey_body', label: 'Encuesta después de la visita · cuerpo', description: 'Variables: {{nombre}}, {{local}}, {{fecha}}.', valueType: 'text', value: 'Hola {{nombre}}:\n\nGracias por venir a {{local}}.', source: 'master_default' },
  ]],
  // Requisitos de cada aviso: una tarea corriendo, otra detenida y la encuesta sin elegir, para
  // poder revisar en pantalla los tres estados posibles.
  // Vista previa: un armazón parecido al real, suficiente para revisar el marco, el asunto y
  // cómo quedan las variables ya rellenadas.
  [/\/settings\/correos\/vista-previa$/, (config: any) => {
    // Axios entrega el cuerpo ya serializado: aquí llega como texto, no como objeto.
    const enviado = typeof config?.data === 'string' ? JSON.parse(config.data) : (config?.data ?? {});
    const cuerpo = String(enviado?.cuerpo ?? '');
    const asunto = String(enviado?.asunto ?? '');
    const rellenar = (texto: string) => texto
      .replace(/\{\{\s*nombre\s*\}\}/g, 'Camila')
      .replace(/\{\{\s*local\s*\}\}/g, 'Casa Costanera')
      .replace(/\{\{\s*fecha\s*\}\}/g, 'viernes 3 de octubre')
      .replace(/\{\{[^}]*\}\}/g, '');
    return {
      subject: rellenar(asunto),
      html: [
        '<div style="font-family:system-ui;background:#f6f4f5;padding:24px">',
        '<div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px">',
        '<p style="color:#ea0f63;font-weight:800;letter-spacing:.12em;font-size:11px;margin:0 0 14px">CASA COSTANERA</p>',
        '<div style="white-space:pre-wrap;color:#2b2730;line-height:1.6">' + rellenar(cuerpo) + '</div>',
        '<p style="color:#8b8490;font-size:12px;margin-top:24px">Enviado con Espartanos Reservas</p>',
        '</div></div>',
      ].join(''),
    };
  }],
  [/\/settings\/correos\/requisitos$/, () => ({
    casilla: true,
    tareas: {
      'recordatorio-reservas': { ultima: new Date().toISOString(), corriendo: true },
      'encuesta-post-visita': { ultima: null, corriendo: false },
      'cierre-asistencia': { ultima: null, corriendo: false },
      cumpleanos: { ultima: null, corriendo: false },
      'resumen-diario': { ultima: new Date().toISOString(), corriendo: true },
      'recordatorio-tareas': { ultima: null, corriendo: false },
      'collection-emails': { ultima: null, corriendo: false },
    },
    avisos: {
      'email.reservation_reminder': [{ clave: 'cron', tarea: 'recordatorio-reservas' }],
      'email.post_visit_survey': [{ clave: 'cron', tarea: 'encuesta-post-visita' }, { clave: 'asistencia' }, { clave: 'encuesta' }],
      'email.birthday': [{ clave: 'cron', tarea: 'cumpleanos' }],
      'email.daily_digest': [{ clave: 'cron', tarea: 'resumen-diario' }],
      'email.task_reminder': [{ clave: 'cron', tarea: 'recordatorio-tareas' }],
      'email.collection_overdue': [{ clave: 'cron', tarea: 'collection-emails' }],
      'email.team_new_reservation': [{ clave: 'equipo' }],
      'email.team_group_request': [{ clave: 'equipo' }],
      'email.team_waitlist': [{ clave: 'equipo' }],
    },
  })],
  [/\/settings\/destinatarios-de-prueba$/, () => [{ id: 'visual-user', name: 'Modo Visual', email: 'visual@espartanos.local' }]],
  [/\/settings\?prefix=security\.password$/, () => ({
    'security.password.minLength': '8',
    'security.password.requireUppercase': 'true',
    'security.password.requireNumber': 'true',
    'security.password.requireSpecial': 'false',
    'security.password.expiryDays': '90',
    'security.password.preventReuse': '5',
  })],
  [/\/organizations\/features$/, () => ({ features: forEveryModule(true) })],
  [/\/settings(\/correos)?$/, () => {
    const lifecycleSettings: Array<{ key: string; value: string; source: 'organization' }> = [];
    for (const mod of ORGANIZATION_MODULE_CATALOG) {
      lifecycleSettings.push({ key: `modules.lifecycle.${mod.key}`, value: mod.lifecycle, source: 'organization' });
    }
    return [...ajustesDeCorreo('master_default'), ...lifecycleSettings];
  }],
  // Solicitudes (modo visual): simula la bandeja en memoria para probar el flujo completo.
  [/\/service-requests(\?[^/]*)?$/i, (config) => {
    const method = (config?.method ?? 'get').toLowerCase();
    const body = typeof config?.data === 'string' ? JSON.parse(config.data) : config?.data;
    if (method === 'post') {
      const row: any = {
        id: `visual-request-${visualRequests.length + 1}`,
        type: body?.type ?? 'support',
        status: 'received',
        requesterName: body?.requesterName ?? 'Modo Visual',
        requesterEmail: (body?.requesterEmail ?? 'visual@espartanos.local').toLowerCase(),
        requesterRut: body?.requesterRut ?? '11111111-1',
        requesterPhone: body?.requesterPhone ?? null,
        message: body?.message ?? null,
        resolutionNote: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      visualRequests.unshift(row);
      return { id: row.id, status: row.status };
    }
    return visualRequests;
  }],
  [/\/service-requests\/status/i, (config) => {
    const url = config?.url ?? '';
    const email = new URLSearchParams((url.split('?')[1] ?? '')).get('email')?.toLowerCase() ?? '';
    const rut = new URLSearchParams((url.split('?')[1] ?? '')).get('rut') ?? '';
    return visualRequests
      .filter((r) => r.requesterEmail === email && r.requesterRut === rut)
      .map((r) => ({ id: r.id, type: r.type, status: r.status, message: r.message, resolutionNote: r.resolutionNote, createdAt: r.createdAt, resolvedAt: r.resolvedAt }));
  }],
  [/\/service-requests\/([^/?]+)\/anonymize$/i, (config) => {
    const id = config.url.split('/').filter(Boolean).pop();
    const row = visualRequests.find((r) => r.id === id);
    if (row) { row.status = 'resolved'; row.resolutionNote = 'Datos anonimizados (modo visual)'; row.resolvedBy = 'visual-user'; row.resolvedAt = new Date().toISOString(); }
    return row ?? { id, status: 'resolved' };
  }],
  [/\/service-requests\/([^/?]+)$/i, (config) => {
    const id = (config.url.match(/\/service-requests\/([^/?]+)$/) ?? [])[1];
    if (config.method?.toLowerCase() === 'put') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const row = visualRequests.find((r) => r.id === id);
      if (row) { row.status = body?.status ?? row.status; row.resolutionNote = body?.resolutionNote ?? row.resolutionNote; row.resolvedBy = 'visual-user'; row.resolvedAt = new Date().toISOString(); }
      return row ?? { id, status: 'resolved', resolutionNote: body?.resolutionNote };
    }
    return visualRequests.find((r) => r.id === id) ?? { id, status: 'received' };
  }],
];

/** Adaptador de axios que resuelve toda peticion en memoria, siempre con 200. */
const visualAdapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  const route = ROUTES.find(([pattern]) => pattern.test(url));
  return {
    data: route ? route[1](config) : emptyPayload(),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as never;
};

if (VISUAL_MODE) {
  /*
   * Se instala por partida doble a proposito. `defaults.adapter` cubre el caso normal, y el
   * envoltorio de `create` garantiza que la instancia de `core/api.ts` lo reciba aunque axios
   * cambie como fusiona los defaults. Este archivo se importa antes que `App` en `main.tsx`,
   * asi que ambos quedan puestos antes de que se construya esa instancia.
   */
  axios.defaults.adapter = visualAdapter;
  const createInstance = axios.create.bind(axios);
  axios.create = ((config = {}) =>
    createInstance({ ...config, adapter: visualAdapter })) as typeof axios.create;

  /*
   * Deja fuera la caché en disco que mantiene `query-persistence.ts`.
   *
   * Esa copia viaja por JSON, y `JSON.stringify` de un array descarta las propiedades que no
   * son índices: el vacío de arriba vuelve del disco convertido en `[]` pelado, sin `data` ni
   * los contenedores anidados, y una vista que lee `data.funnel.views` se cae antes de que la
   * primera peticion alcance a responder.
   *
   * Se apaga haciendo fallar la apertura, no borrando la base: `offline-store.ts` ya trata ese
   * caso como almacen no disponible y vuelve inocuas todas sus operaciones, mientras que
   * borrarla dependeria de ganarle la carrera al primer `restoreQueryCache`.
   */
  indexedDB.open = () => { throw new Error('modo visual: almacen local desactivado'); };
  indexedDB.deleteDatabase('espartanos');

  console.info(
    '[modo visual] Sin backend. Sesion abierta como admin y %d modulos visibles.',
    MODULE_KEYS.length,
  );
}
