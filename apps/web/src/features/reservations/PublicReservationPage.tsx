import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { leerTiposDeEvento } from './tipos-de-evento';
import { retirarMedicion } from '../../shared/consentimiento-medicion';
import { AvisoDeMedicion, EnlacePreferenciasDeMedicion } from '../../shared/AvisoDeMedicion';
import { optimizedUrl } from '../../shared/imagen-optimizada';
import { origenDeEstaVisita } from '../../shared/origen-automatico';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PieLegal } from '../../shared/PieLegal';
import { DialogoModal } from '../../shared/DialogoModal';
import { resumenDeHorarios } from './resumen-de-horarios';
import { VERSION_BENEFICIOS, formatearRut, rutValido, traeDatosSensibles, TEXTO_MEDICION, VERSION_MEDICION, documentoATexto, faltantesDeIdentidadLegal, nombreLegalDelLocal, politicaDePrivacidadDelLocal, rutaDocumentoLegal, textosDeAceptacionDeReserva, type IdentidadLegal } from '@espartanos/shared';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../core/api';
import { camposVisibles } from '@espartanos/shared';
import './PublicReservationPage.premium.css';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import type { FormField, ReservationForm } from './types';
import { plainDateInZone } from './local-time';
import { accessibleForeground, contrastText, normalizeHexColor } from '../../shared/color-contrast';
import { BrandMark } from '../../shared/Brand';
import { MetaPixel } from '../../shared/MetaPixel';
import { ShareBooking } from './success/ShareBooking';
import { VenueTips } from './success/VenueTips';
import { Ga4Tag } from '../../shared/Ga4Tag';
import { trackGa4Event } from '../../shared/ga4-events';
import { readMetaMatchData } from '../../shared/meta-match';
import { META_DEDUPLICATED_EVENTS, metaEventId } from '@espartanos/shared';
import { imageOverlayAlpha, leerOcasiones, safeDesignChoice, safeNumber, uuid, visible, slotDateKey } from './booking-utils';
import { safeUrl } from '../../core/safe-url';
import { VitaIcons } from '../../shared/Icons';

interface Slot { startsAt: string; available: number }
interface Created { id: string; kind?: 'group_request'; referenceCode?: string; status?: string; startsAt?: string; couponCode?: string; createdAt?: string; managementToken?: string }
const DEFAULT_BACKGROUND_GRADIENT = 'linear-gradient(135deg, #f6f4f5 0%, var(--surface-sage) 100%)';

/** Clave de `sessionStorage` donde vive la clave de idempotencia de la reserva en curso. */
const BOOKING_KEY_STORAGE = 'vh-booking-key';

const RESERVA_RECORDADA = 'vh-reserva-gestion';

/** Lo minimo para volver a una reserva desde el mismo navegador que la creo. */
interface ReservaRecordada { token: string; referenceCode?: string; startsAt?: string }

/**
 * Recuerda el enlace de gestion de la ultima reserva hecha en este navegador.
 *
 * El enlace es la unica llave para modificar o cancelar y hasta ahora solo se veia en la
 * pantalla de exito y en el correo: cerrar la pestana dejaba a la persona sin forma de volver
 * desde la propia pagina. Vive en el dispositivo de quien reservo y se olvida solo cuando la
 * visita ya paso, o cuando la persona lo pide.
 */
function leerReservaRecordada(slug: string): ReservaRecordada | null {
  try {
    const crudo = localStorage.getItem(`${RESERVA_RECORDADA}:${slug}`);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as ReservaRecordada;
    if (!dato?.token) return null;
    if (dato.startsAt && new Date(dato.startsAt).getTime() < Date.now()) {
      localStorage.removeItem(`${RESERVA_RECORDADA}:${slug}`);
      return null;
    }
    return dato;
  } catch {
    return null;
  }
}

function guardarReservaRecordada(slug: string, dato: ReservaRecordada): void {
  try { localStorage.setItem(`${RESERVA_RECORDADA}:${slug}`, JSON.stringify(dato)); } catch { /* el navegador puede tener el almacenamiento bloqueado */ }
}

function olvidarReservaRecordada(slug: string): void {
  try { localStorage.removeItem(`${RESERVA_RECORDADA}:${slug}`); } catch { /* idem */ }
}
/** Mantiene la misma regla visible que protege la API pública. */
export function isValidChileanMobilePhone(value: string): boolean {
  return /^(?:\+?56[\s-]?)?9[\s-]?\d{4}[\s-]?\d{4}$/.test(value.trim());
}
function businessWhatsAppUrl(rawNumber: string | undefined, message: string): string | undefined {
  const number = rawNumber?.replace(/\D/g, '');
  return number && /^[1-9]\d{7,14}$/.test(number) ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : undefined;
}

export function PublicReservationPage() {
  const { slug = '' } = useParams();
  const params = new URLSearchParams(window.location.search);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [guest, setGuest] = useState({ guestName: '', guestEmail: '', guestPhone: '', partySize: 1 });
  const [fotoAmpliada, setFotoAmpliada] = useState<{ src: string; titulo: string } | null>(null);
  const [reservationConsent, setReservationConsent] = useState(false);
  /** Consentimiento expreso para salud o alimentación; sólo se pide si la persona escribió algo así. */
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  /*
   * La medición se puede aceptar al entrar, no sólo al final.
   *
   * Sólo existía la casilla del paso de datos: el Pixel cargaba recién ahí, así que el inicio del
   * formulario casi nunca llegaba a Meta y las campañas no veían el paso intermedio. La elección
   * se recuerda por local en este navegador; la casilla del final sigue cambiándola.
   */
  const claveMedicion = `vh-medicion:${slug}`;
  const [eleccionMedicion, setEleccionMedicion] = useState<'si' | 'no' | ''>(() => {
    try { const valor = localStorage.getItem(claveMedicion); return valor === 'si' || valor === 'no' ? valor : ''; } catch { return ''; }
  });
  const [measurementConsent, setMeasurementConsentState] = useState(eleccionMedicion === 'si');
  const [avisoMedicionAbierto, setAvisoMedicionAbierto] = useState(false);
  const setMeasurementConsent = (valor: boolean) => {
    setMeasurementConsentState(valor);
    setEleccionMedicion(valor ? 'si' : 'no');
    setAvisoMedicionAbierto(false);
    try { localStorage.setItem(claveMedicion, valor ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
    // Retirar surte efecto de inmediato: Meta y Google dejan de enviar y se borran sus cookies.
    if (!valor) retirarMedicion();
  };
  const [networkConsent, setNetworkConsent] = useState(false);
  /** Elegir el día tiene que dejar los horarios a la vista, no debajo del pliegue. */
  const slotPickerRef = useRef<HTMLDivElement>(null);
  const [groupEventType, setGroupEventType] = useState('');
  const [groupEventNotes, setGroupEventNotes] = useState('');
  const [requestMode, setRequestMode] = useState(false);
  const [requestPreference, setRequestPreference] = useState({ date: '', time: '' });
  /** Privacidad o condiciones escritas por la empresa, mostradas dentro de la página. */
  const [documentoLegal, setDocumentoLegal] = useState<{ titulo: string; texto: string } | null>(null);
  const [visitNeeds, setVisitNeeds] = useState({ childrenCount: 0, accessibilityNeed: '', dietaryNotes: '', smokingPreference: '', seatingPreference: '', firstVisit: '', howFound: '' });
  // Campo trampa: invisible para la persona, presente en el HTML para los bots, que
  // rellenan todo lo que encuentran. El servidor descarta cualquier envío que lo traiga.
  const [website, setWebsite] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [slotDays, setSlotDays] = useState(28);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [slotIssue, setSlotIssue] = useState('');
  /**
   * Cuenta atras del cupo retenido.
   *
   * El servidor lo guarda unos minutos y despues lo suelta. Sin mostrarlo, la persona que
   * tardaba en completar sus datos recibia «ese horario acaba de ocuparse» sin entender por que.
   */
  const [holdExpiraEn, setHoldExpiraEn] = useState('');
  const [holdRestante, setHoldRestante] = useState(0);

  const started = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<number>(0);
  const horarioTimerRef = useRef<number>(0);
  /** Cuántas personas había elegido antes de pasarse a la solicitud de evento. */
  const personasAntesDeSolicitar = useRef(1);
  // Los dos desplazamientos son diferidos: al salir de la página no deben quedar pendientes.
  useEffect(() => () => { window.clearTimeout(focusTimerRef.current); window.clearTimeout(horarioTimerRef.current); }, []);
  const retryRef = useRef(false);

  /**
   * Clave de idempotencia de la reserva en curso.
   *
   * Persiste en `sessionStorage` para que un reintento tras un corte de red no genere una
   * reserva duplicada: el backend reconoce la clave y devuelve la reserva ya creada.
   *
   * Se descarta al confirmarse la reserva, de modo que una segunda reserva en la misma
   * pestaña use una clave nueva y no reciba de vuelta la anterior.
   */
  const [idempotencyKey] = useState(() => {
    const stored = sessionStorage.getItem(BOOKING_KEY_STORAGE);
    if (stored) return stored;
    const key = uuid();
    sessionStorage.setItem(BOOKING_KEY_STORAGE, key);
    return key;
  });
  const [sessionId] = useState(() => uuid());
  const [reservaRecordada, setReservaRecordada] = useState(() => leerReservaRecordada(slug));
  /*
   * El aviso de ocasiones se muestra una vez por navegador.
   *
   * Repetirlo en cada visita molesta a quien ya lo vio y viene a reservar, así que se recuerda
   * que ya se mostró. Si el navegador tiene el almacenamiento bloqueado, se comporta como si
   * fuera la primera vez: enseñarlo de más es mejor que romper la página por un aviso.
   */
  const [vecesMostrado, setVecesMostrado] = useState(() => {
    try { return Number(localStorage.getItem(`vh-ocasiones:${slug}`) || '0') || 0; } catch { return 0; }
  });
  /*
   * Cerrar el aviso y contar que se mostró son dos cosas distintas.
   *
   * Mostrarlo dependía sólo del contador contra el límite, y con «en cada visita» ese límite es
   * infinito: el botón guardaba la cuenta y el aviso seguía ahí, sin forma de llegar a la página.
   * Esta marca dura lo que dura la visita; el contador es el que decide si vuelve a aparecer la
   * próxima vez.
   */
  const [avisoCerrado, setAvisoCerrado] = useState(false);
  const cerrarOcasiones = () => {
    setAvisoCerrado(true);
    const siguiente = vecesMostrado + 1;
    setVecesMostrado(siguiente);
    try { localStorage.setItem(`vh-ocasiones:${slug}`, String(siguiente)); } catch { /* el navegador puede tenerlo bloqueado */ }
  };
  // Volver a una reserva desde cualquier dispositivo, sin depender del correo ni del navegador.
  const navegar = useNavigate();
  const [codigoBuscado, setCodigoBuscado] = useState('');
  const [contactoBuscado, setContactoBuscado] = useState('');
  const buscarReserva = useMutation({
    mutationFn: () => api.post<{ token: string }>(`/public/reservations/${slug}/lookup`, { referenceCode: codigoBuscado.trim(), contact: contactoBuscado.trim() }),
    onSuccess: (respuesta) => navegar(`/book/manage/${respuesta.token}`),
  });
  // Sin código: el enlace se manda al correo de la reserva, nunca se muestra en pantalla.
  const [correoRecuperar, setCorreoRecuperar] = useState('');
  const recuperar = useMutation({
    mutationFn: () => api.post(`/public/reservations/${slug}/recover`, { contact: correoRecuperar.trim() }),
  });
  const [renderedAt] = useState(() => new Date().toISOString());

  const requestedUtmSource = params.get('utm_source') || undefined;
  const requestedUtmMedium = params.get('utm_medium') || undefined;
  const requestedUtmCampaign = params.get('utm_campaign') || undefined;
  const requestedUtmContent = params.get('utm_content') || undefined;

  const { data: form, isLoading, error } = useQuery<ReservationForm>({ queryKey: ['public-form', slug], queryFn: () => api.get(`/public/reservations/${slug}`), retry: false });
  // Igual que el servidor: salud o alimentación escrita exige su casilla propia.
  const hayDatosSensibles = traeDatosSensibles((form?.fieldSchema ?? []) as Array<{ id: string; sensible?: boolean }>, answers, visitNeeds);
  /** La bienvenida se muestra sola: mientras siga abierta, el aviso de ocasiones espera. */
  const bienvenidaPendiente = welcomeOpen && form?.designConfig?.welcomePopupEnabled === 'true';
  const groupThreshold = Math.max(2, Math.min(100, Number(form?.designConfig?.groupThreshold) || 8));
  const isSurvey = form ? ['request', 'survey'].includes(form.mode) : false;
  // El enlace base es orgánico/directo. Sólo una UTM explícita atribuye una campaña;
  // de otro modo se contaminarían reservas llegadas por QR, WhatsApp o búsqueda.
  // Sin UTM se usa lo detectado (anuncio, app o sitio de origen), fijado al entrar: el referrer
  // no cambia mientras la persona completa el formulario.
  const [detectado] = useState(() => (requestedUtmSource ? null : origenDeEstaVisita()));
  const utmSource = requestedUtmSource ?? detectado?.source;
  const utmMedium = requestedUtmSource ? requestedUtmMedium : detectado?.medium;
  const utmCampaign = requestedUtmCampaign;
  // Lo detectado no ocupa el campo del anuncio: viaja como marca aparte.
  const utmContent = requestedUtmContent;
  const origenDetectado = Boolean(detectado);

  useEffect(() => {
    if (isSurvey) setStep(2);
  }, [isSurvey]);
  useEffect(() => {
    if (form?.designConfig?.welcomePopupEnabled === 'false') setWelcomeOpen(false);
  }, [form?.designConfig?.welcomePopupEnabled]);

  const from = form ? plainDateInZone(new Date(), form.timezone) : new Date().toISOString().slice(0, 10);
  const fromDate = useMemo(() => {
    if (!form) return from;
    const [y, m, d] = from.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    start.setUTCMonth(start.getUTCMonth() + monthOffset);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  }, [from, monthOffset, form]);

  // El calendario no ofrece mas horizonte del que el formulario permite reservar: la API
  // acota el rango a `maximumAdvanceDays`, asi que el rango pedido se recorta a ese tope.
  const maxSlotDays = Math.min(form?.maximumAdvanceDays || 31, 62);
  const rangoDias = Math.min(slotDays, maxSlotDays);
  const slotParams = new URLSearchParams({ from: fromDate, days: String(rangoDias), partySize: String(guest.partySize), ...(serviceId ? { serviceId } : {}), ...(resourceId ? { resourceId } : {}) });
  const { data: availability, isFetching: loadingSlots } = useQuery<{ slots: Slot[]; fullDays: string[]; pausedUntil?: string }>({ queryKey: ['public-slots', slug, fromDate, rangoDias, guest.partySize, serviceId, resourceId], queryFn: () => api.get(`/public/reservations/${slug}/slots?${slotParams}`), enabled: Boolean(form) && !isSurvey, staleTime: 30_000, gcTime: 60_000 });
  const slots = useMemo(() => availability?.slots ?? [], [availability]);
  /** Dias que alcanzaron el tope diario: se muestran completos, no cerrados. */
  const fullDays = useMemo(() => new Set(availability?.fullDays ?? []), [availability]);
  /*
   * Sin horarios para el grupo elegido, se consulta si los habría para una persona. Así la página
   * puede decir «para 4 personas no queda cupo» en vez de mostrar un calendario vacío que parece
   * un local cerrado. Sólo se pide cuando hace falta.
   */
  const sinHorariosParaGrupo = Boolean(availability) && !availability?.pausedUntil && (availability?.slots.length ?? 0) === 0 && guest.partySize > 1;
  const paramsUnaPersona = new URLSearchParams({ from: fromDate, days: String(rangoDias), partySize: '1', ...(serviceId ? { serviceId } : {}), ...(resourceId ? { resourceId } : {}) });
  const { data: disponibilidadUnaPersona } = useQuery<{ slots: Slot[] }>({ queryKey: ['public-slots', slug, fromDate, rangoDias, 1, serviceId, resourceId], queryFn: () => api.get(`/public/reservations/${slug}/slots?${paramsUnaPersona}`), enabled: sinHorariosParaGrupo && !isSurvey, staleTime: 30_000 });
  const cupoMaximoVisto = Math.max(0, ...(disponibilidadUnaPersona?.slots ?? []).map((slot) => slot.available));
  const faltaCupoParaElGrupo = sinHorariosParaGrupo && (disponibilidadUnaPersona?.slots.length ?? 0) > 0;

  const hold = useMutation({
    mutationFn: () => api.post<{ expiresAt?: string }>(`/public/reservations/${slug}/hold`, {
      startsAt: selected, partySize: guest.partySize, serviceId: serviceId || undefined,
      resourceId: resourceId || undefined, holdKey: idempotencyKey,
      website, renderedAt,
    }),
    onSuccess: (data: { expiresAt?: string }) => { setSlotIssue(''); setHoldExpiraEn(data?.expiresAt || ''); },
    onError: (err: Error) => {
      setHoldExpiraEn('');
      setSlotIssue(err.message || 'No pudimos retener ese horario. Elige otro para continuar.');
      setSelected('');
      setSelectedDate('');
      setStep(1);
    },
  });

  // Retiene el turno mientras se completan los datos. El servidor vuelve a validar al
  // confirmar y la retención vence sola, así que cerrar la pestaña nunca bloquea la agenda.
  useEffect(() => {
    if (!selected || !form || isSurvey) return;
    hold.mutate();
  // `mutate` es estable; depende de los datos que definen exactamente el turno retenido.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, form, guest.partySize, idempotencyKey, isSurvey, resourceId, serviceId, slug, hold.mutate]);

  useEffect(() => {
    if (!holdExpiraEn) { setHoldRestante(0); return; }
    const tick = () => setHoldRestante(Math.max(0, Math.round((new Date(holdExpiraEn).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [holdExpiraEn]);

  const pageTitle = useMemo(() => form ? `${form.name} · Reserva en línea · Espartanos` : 'Reserva en línea · Espartanos', [form]);
  const pageDescription = useMemo(() => form ? `Reserva tu hora para ${form.name}. ${form.designConfig?.welcome || 'Agenda fácil y segura.'}` : 'Agenda tu hora de forma fácil y segura.', [form]);

  useEffect(() => {
    const prevTitle = document.title;
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    const prevDesc = metaDesc?.content;
    const prevOgTitle = ogTitle?.content;
    const prevOgDesc = ogDesc?.content;
    document.title = pageTitle;
    const setMeta = (selector: string, content: string) => { const el = document.querySelector(selector) as HTMLMetaElement | null; if (el) el.content = content; };
    setMeta('meta[name="description"]', pageDescription);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', pageDescription);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[property="og:url"]', window.location.href);
    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== undefined) metaDesc.content = prevDesc;
      if (ogTitle && prevOgTitle !== undefined) ogTitle.content = prevOgTitle;
      if (ogDesc && prevOgDesc !== undefined) ogDesc.content = prevOgDesc;
    };
  }, [pageTitle, pageDescription]);

  useEffect(() => {
    // El conteo de visitas del local no lleva datos personales ni va a Meta: se registra siempre,
    // o «Resultados» sólo contaba a quienes aceptaban la medición publicitaria.
    if (!form) return;
    api.post<{ id?: string }>(`/public/reservations/${slug}/events`, { type: 'view', sessionId, utmSource, utmMedium, utmCampaign, utmContent, origenDetectado }).catch(() => undefined);
  }, [form, sessionId, slug, utmCampaign, utmContent, utmMedium, utmSource]);

  /**
   * Avisa —una sola vez por sesión— de que la persona empezó a llenar el formulario.
   *
   * El servidor traduce este `start` a `InitiateCheckout` de Meta, así que viaja con las señales
   * del navegador para poder emparejarlo. El identificador del evento lo devuelve el servidor y
   * con él se dispara el Pixel, para que Meta no cuente el inicio dos veces.
   */
  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    enviarInicio();
  };
  /**
   * Con qué local y de qué tipo es la conversión.
   *
   * Meta separa los resultados por estos dos parámetros, no por el Pixel, así que un mismo Pixel
   * distingue reservas, eventos y encuestas de cada local. Tienen que ser los mismos que manda el
   * servidor por Conversions API: al deduplicar, Meta conserva el evento que llega primero, y si
   * el del navegador llegara sin ellos la conversión quedaría sin la etiqueta que la separa.
   */
  const segmento = (tipo: 'reservation' | 'group_request' | 'survey') => (form?.contentId
    ? { content_type: tipo, content_ids: [form.contentId] }
    : {});

  /** El inicio va siempre al embudo; a Meta sólo con la medición aceptada (lo decide el servidor). */
  const enviarInicio = () => {
    const meta = measurementConsent ? readMetaMatchData() : { fbc: undefined, fbp: undefined };
    api.post<{ id?: string }>(`/public/reservations/${slug}/events`, {
      type: 'start', sessionId, utmSource, utmMedium, utmCampaign, utmContent, origenDetectado, measurementConsent,
        fbc: meta.fbc, fbp: meta.fbp, eventSourceUrl: window.location.href,
    }).then((evento: { id?: string }) => {
      if (!measurementConsent || !evento?.id || !window.fbq || !form?.pixelId) return;
      const evt = META_DEDUPLICATED_EVENTS.INITIATE_CHECKOUT;
      window.fbq('trackSingle', form.pixelId, evt, segmento('reservation'), { eventID: metaEventId(evt, evento.id) });
    }).catch(() => undefined);
  };

  /*
   * Respuestas tal como se envían: sin las preguntas que quedaron ocultas y con la aceptación
   * base tomada del bloque legal. La usan la reserva, la solicitud de grupo y la lista de espera;
   * la espera mandaba las respuestas crudas y el servidor la rechazaba por la aceptación.
   */
  const respuestasParaEnviar = () => {
    /*
     * Una respuesta que dejó de verse no se envía.
     *
     * Cambiar una respuesta puede esconder la pregunta siguiente —«¿cuántos niños?» tras decir
     * que no vienen niños—. Lo ya escrito seguía en el estado y se mandaba igual: el local
     * recibía «3 niños» de alguien que acababa de decir que venía sin ellos.
     */
    const visiblesAlEnviar = new Set(camposVisibles(
      (form?.fieldSchema || []),
      { ...answers, name: guest.guestName, email: guest.guestEmail, phone: guest.guestPhone, partySize: guest.partySize },
    ).map((field) => field.id));
    const respuestasVisibles = Object.fromEntries(Object.entries(answers).filter(([clave]) => visiblesAlEnviar.has(clave) || !(form?.fieldSchema || []).some((field) => field.id === clave)));
    return isSurvey ? respuestasVisibles : { ...respuestasVisibles, ...Object.fromEntries((form?.fieldSchema || []).filter((field) => field.type === 'consent' && field.id === 'consent').map((field) => [field.id, reservationConsent])) };
  };
  // Si acepta la medición después de haber empezado, el inicio se informa en ese momento.
  useEffect(() => {
    if (measurementConsent && started.current) enviarInicio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementConsent]);

  const submit = useMutation({
    mutationFn: () => {
      // Sin permiso de medición no se leen, no se recuerdan y no se envían identificadores de anuncio.
      const meta = measurementConsent ? readMetaMatchData() : { fbclid: undefined, fbc: undefined, fbp: undefined };
      const reservationAnswers = respuestasParaEnviar();
      const baseBody = {
        ...guest, answers: reservationAnswers, idempotencyKey, website, measurementConsent, sensitiveConsent: hayDatosSensibles && sensitiveConsent,
        eventSourceUrl: window.location.href,
        utmSource, utmMedium, utmCampaign, utmContent, origenDetectado,
        // Cada plataforma recibe su propio identificador. Mandarlos por un campo común hacía
        // que un fbclid terminara subido a Google Ads como gclid, donde Google lo descarta.
        ...(measurementConsent ? {
          gclid: params.get('gclid') || undefined,
          gbraid: params.get('gbraid') || undefined,
          wbraid: params.get('wbraid') || undefined,
          fbclid: meta.fbclid || undefined,
          fbc: meta.fbc, fbp: meta.fbp,
          measurementConsentVersion: VERSION_MEDICION,
        } : {}),
      };
      if (isSurvey) return api.post<Created>(`/public/reservations/${slug}/survey`, baseBody);
      if (requestMode) return api.post<Created>(`/public/reservations/${slug}/group-request`, {
        guestName: guest.guestName, guestEmail: guest.guestEmail || undefined, guestPhone: guest.guestPhone || undefined,
        partySize: Math.max(groupThreshold + 1, guest.partySize), eventType: tipoDeEvento, notes: groupEventNotes.trim() || undefined,
        preferredDate: requestPreference.date || undefined, preferredTime: requestPreference.time || undefined,
        reservationConsent, sensitiveConsent: hayDatosSensibles && sensitiveConsent, marketingConsent, networkConsent, idempotencyKey, website, renderedAt, utmSource, utmMedium, utmCampaign, utmContent, origenDetectado,
        measurementConsent, ...(measurementConsent ? { fbc: meta.fbc, fbp: meta.fbp, fbclid: meta.fbclid, eventSourceUrl: window.location.href, measurementConsentVersion: VERSION_MEDICION } : {}),
        details: {
          answers: reservationAnswers,
          // El nombre que eligió la persona, tal como lo ofrece el local.
          tipoDeEvento: preguntaDeOcasiones ? undefined : groupEventType || undefined,
          serviceId: serviceId || undefined,
          resourceId: resourceId || undefined,
          childrenCount: visitNeeds.childrenCount || undefined,
          accessibilityNeed: visitNeeds.accessibilityNeed.trim() || undefined,
          dietaryNotes: visitNeeds.dietaryNotes.trim() || undefined,
          smokingPreference: visitNeeds.smokingPreference || undefined,
          seatingPreference: visitNeeds.seatingPreference || undefined,
          firstVisit: visitNeeds.firstVisit || undefined,
          howFound: visitNeeds.howFound || undefined,
        },
      });
      return api.post<Created>(`/public/reservations/${slug}`, {
        startsAt: selected, serviceId: serviceId || undefined, resourceId: resourceId || undefined,
        groupEventType: guest.partySize > groupThreshold ? tipoDeEvento || undefined : undefined,
        groupEventNotes: guest.partySize > groupThreshold ? groupEventNotes.trim() || undefined : undefined,
        childrenCount: visitNeeds.childrenCount || undefined,
        accessibilityNeed: visitNeeds.accessibilityNeed.trim() || undefined,
        dietaryNotes: visitNeeds.dietaryNotes.trim() || undefined,
        smokingPreference: visitNeeds.smokingPreference || undefined,
        seatingPreference: visitNeeds.seatingPreference || undefined,
        firstVisit: visitNeeds.firstVisit || undefined,
        howFound: visitNeeds.howFound || undefined,
        ...baseBody, renderedAt, consentVersion: 'reservation-v3', reservationConsent,
        marketingConsent, marketingConsentVersion: VERSION_BENEFICIOS,
        couponCode: couponCode.trim() || undefined, measurementConsent,
        networkConsent, networkConsentVersion: String(form?.designConfig?.networkConsentVersion || 'red-v1'),
      });
    },
  });

  const waitlist = useMutation({
    mutationFn: () => api.post<Created>(`/public/reservations/${slug}/waitlist`, {
      startsAt: selected, serviceId: serviceId || undefined, resourceId: resourceId || undefined,
      ...guest, answers: respuestasParaEnviar(), idempotencyKey, reservationConsent, sensitiveConsent: hayDatosSensibles && sensitiveConsent, marketingConsent, measurementConsent, networkConsent,
      accessibilityNeed: visitNeeds.accessibilityNeed.trim() || undefined, dietaryNotes: visitNeeds.dietaryNotes.trim() || undefined,
      ...(measurementConsent ? (() => { const meta = readMetaMatchData(); return { fbc: meta.fbc, fbp: meta.fbp, fbclid: meta.fbclid, gclid: params.get('gclid') || undefined, gbraid: params.get('gbraid') || undefined, wbraid: params.get('wbraid') || undefined }; })() : {}),
      consentVersion: 'reservation-v3', marketingConsentVersion: VERSION_BENEFICIOS,
      utmSource, utmMedium, utmCampaign, utmContent, origenDetectado,
    }),
  });

  const validateCoupon = useMutation({
    mutationFn: () => api.post(`/public/reservations/${slug}/coupon-validate`, { code: couponCode.trim(), startsAt: selected || undefined }),
    onSuccess: () => { setCouponValid(true); setCouponMsg('Cupón válido'); },
    onError: (err: Error) => { setCouponValid(false); setCouponMsg(err.message); },
  });

  // Confirmada la reserva, la clave cumplió su función. Liberarla evita que una segunda
  // reserva en la misma pestaña reutilice la clave y reciba de vuelta la primera.
  useEffect(() => {
    if (submit.data?.id) sessionStorage.removeItem(BOOKING_KEY_STORAGE);
    if (submit.data?.managementToken) guardarReservaRecordada(slug, { token: submit.data.managementToken, referenceCode: submit.data.referenceCode, startsAt: submit.data.startsAt });
  }, [slug, submit.data?.id, submit.data?.managementToken, submit.data?.referenceCode, submit.data?.startsAt]);

  // El nombre y el id del evento tienen que coincidir con los que emite el servidor por
  // Conversions API, o Meta no puede deduplicar y cuenta la conversión dos veces. Para las
  // encuestas el servidor manda `Lead`; disparar `Schedule` acá dejaba ambos eventos sin
  // pareja y además inventaba una reserva que nunca existió.
  useEffect(() => {
    if (!measurementConsent || !submit.data?.id || !window.fbq) return;
    if (!form?.pixelId) return;
    // Una solicitud de grupo no reservó nada: es un Lead, igual que lo informa el servidor.
    const esSolicitud = submit.data.kind === 'group_request';
    const eventName = isSurvey || esSolicitud ? META_DEDUPLICATED_EVENTS.LEAD : META_DEDUPLICATED_EVENTS.SCHEDULE;
    const personasDelEvento = esSolicitud ? Math.max(groupThreshold + 1, guest.partySize) : guest.partySize;
    /*
     * El valor viaja por los dos canales.
     *
     * El servidor ya lo calcula igual —el mismo monto por persona por la misma cantidad—, pero si
     * el navegador manda el evento sin valor, el que llegue primero es el que Meta conserva al
     * deduplicar, y una de cada dos reservas quedaría valiendo cero.
     */
    const porPersona = Number(form?.designConfig?.valorPorPersona || '0');
    const valor = !isSurvey && porPersona > 0
      ? { value: Math.round(porPersona * (personasDelEvento || 1)), currency: String(form?.designConfig?.moneda || 'CLP').toUpperCase() }
      : {};
    window.fbq('trackSingle', form.pixelId, eventName, { ...segmento(isSurvey ? 'survey' : esSolicitud ? 'group_request' : 'reservation'), ...valor }, { eventID: metaEventId(eventName, submit.data.id) });
  }, [form?.contentId, form?.pixelId, form?.designConfig?.valorPorPersona, form?.designConfig?.moneda, guest.partySize, groupThreshold, isSurvey, measurementConsent, submit.data?.id, submit.data?.kind]);

  useEffect(() => {
    if (!measurementConsent || !submit.data?.id || !form?.ga4MeasurementId) return;
    trackGa4Event(form.ga4MeasurementId, isSurvey ? 'survey_submitted' : 'reservation_created', {
      transaction_id: submit.data.id,
      form_slug: slug,
      form_name: form.name,
      form_mode: form.mode,
    });
  }, [form?.ga4MeasurementId, form?.mode, form?.name, isSurvey, measurementConsent, slug, submit.data?.id]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!guest.guestName.trim()) errs.name = 'El nombre es obligatorio';
    if (hayDatosSensibles && !sensitiveConsent) errs.sensitiveConsent = 'Autoriza el uso de la información de salud o alimentación, o bórrala para continuar';
    if (!isSurvey && !reservationConsent) errs.reservationConsent = requestMode ? 'Debes aceptar las condiciones para enviar la solicitud' : 'Debes aceptar las condiciones para gestionar la reserva';
    if (!isSurvey && (guest.partySize > groupThreshold || requestMode) && (!tipoDeEvento || (preguntaDeOcasiones && !ocasionElegida))) errs.groupEvent = 'Cuéntanos qué tipo de grupo o celebración es';
    if (requestMode && requestPreference.date && requestPreference.date < hoyEnElLocal) errs.groupEvent = 'La fecha preferida ya pasó: elige hoy o una fecha futura';
    if (systemFields.phone?.required && !guest.guestPhone.trim()) errs.phone = 'El teléfono es obligatorio';
    else if (guest.guestPhone.trim() && !isValidChileanMobilePhone(guest.guestPhone)) errs.phone = 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678';
    if (systemFields.email?.required && !guest.guestEmail.trim()) errs.email = 'El correo es obligatorio';
    else if (guest.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.guestEmail)) errs.email = 'Correo inválido';
    for (const field of customFields) {
      if (field.required && field.type === 'consent' && !answers[field.id]) errs[field.id] = 'Debes aceptar';
      const valor = answers[field.id];
      const vacio = valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim()) || (Array.isArray(valor) && valor.length === 0);
      if (field.required && field.type !== 'consent' && vacio) errs[field.id] = 'Campo obligatorio';
      else if (!vacio && field.type === 'number' && !Number.isFinite(Number(valor))) errs[field.id] = 'Ingresa un número';
      else if (!vacio && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor))) errs[field.id] = 'Correo inválido';
      else if (!vacio && field.type === 'rut' && !rutValido(String(valor))) errs[field.id] = 'RUT inválido: revisa el dígito verificador';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToConfirm = () => {
    if (!isSurvey && !requestMode && !selected) return;
    if (!validate()) return;
    if (isSurvey) { submit.mutate(); return; }
    confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(3);
  };

  /*
   * Del día al horario.
   *
   * La grilla de horarios se dibuja bajo el calendario: en un teléfono queda fuera de pantalla y
   * parecía que elegir el día no hacía nada. Se espera un cuadro para que el elemento exista
   * antes de buscarlo.
   */
  const irAlHorario = () => {
    window.clearTimeout(horarioTimerRef.current);
    horarioTimerRef.current = window.setTimeout(() => slotPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  const goToForm = () => {
    if (!selectedDate && selected) setSelectedDate(slotDateKey(selected, form!.timezone));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(2);
    window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => nameInputRef.current?.focus(), 300);
  };

  /*
   * Salir de la solicitud de evento.
   *
   * Entrar subía el número de personas al mínimo de grupo y dejaba ocasión, notas y fecha
   * preferida cargadas. Al volver, esos datos seguían ahí y se enviaban con una reserva normal.
   */
  /** Pasa a la solicitud de grupo o evento, que no toma horario y confirma el local. */
  const entrarASolicitud = (personas: number) => {
    personasAntesDeSolicitar.current = Math.min(guest.partySize, groupThreshold);
    setRequestMode(true);
    setGuest((actual) => ({ ...actual, partySize: Math.max(groupThreshold + 1, personas) }));
    setSelected(''); setSelectedDate('');
    setStep(2);
  };

  const volverAReservar = () => {
    setRequestMode(false);
    setGuest((actual) => ({ ...actual, partySize: Math.min(personasAntesDeSolicitar.current, groupThreshold) }));
    setGroupEventType('');
    setGroupEventNotes('');
    setRequestPreference({ date: '', time: '' });
    setStep(1);
  };

  const goBackToSlots = () => {
    setStep(1);
    setSelectedDate('');
    setSelected('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retrySubmit = () => {
    retryRef.current = true;
    submit.reset();
  };

  // `mutate` es estable en react-query, así que se depende de el y no del objeto de la
  // mutacion completo: incluir `submit` reejecutaria el efecto en cada cambio de estado.
  // El reintento lo gobierna retryRef, que se limpia antes de disparar.
  const submitMutate = submit.mutate;
  useEffect(() => {
    if (retryRef.current && !submit.isPending && !submit.error && !submit.data) {
      retryRef.current = false;
      submitMutate();
    }
  }, [submit.isPending, submit.error, submit.data, submitMutate]);

  useEffect(() => {
    if (submit.isError && submit.error?.message?.includes('acaba de ocuparse')) {
      setStep(2);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [submit.isError, submit.error]);

  // ── TODOS los hooks se llaman ANTES de cualquier return ──
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = slotDateKey(slot.startsAt, form?.timezone || 'UTC');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots, form]);

  const calendarDays = useMemo(() => {
    if (!form) return { rawDays: [], weeks: [] };
    const [y, m, d] = fromDate.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const rawDays: Array<{ date: string; day: number; weekday: string; slots: Slot[]; hasSlots: boolean; isFull: boolean }> = [];
    // Sólo los días que se consultaron. Antes la rejilla pintaba 28 con 14 cargados y la segunda
    // mitad aparecía como «cerrada» aunque el local abriera.
    for (let i = 0; i < Math.min(rangoDias, 62); i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = String(date.getUTCDate()).padStart(2, '0');
      const key = `${year}-${month}-${dayNum}`;
      // `date` ya representa el día calendario del formulario, así que se formatea en UTC.
      // Convertirlo a la zona del cliente lo corría un día y la etiqueta no coincidía con
      // la columna: el 27 aparecía como domingo estando en la columna del lunes.
      const weekday = new Intl.DateTimeFormat('es-CL', { weekday: 'short', timeZone: 'UTC' }).format(date);
      const daySlots = slotsByDate.get(key) || [];
      rawDays.push({ date: key, day: date.getUTCDate(), weekday, slots: daySlots, hasSlots: daySlots.length > 0, isFull: fullDays.has(key) });
    }
    // Agrupar en semanas que empiezan en lunes.
    //
    // La primera semana se rellena con huecos hasta el día que corresponde: sin ese relleno
    // el primer día ocupa la columna del lunes sea cual sea, y toda la rejilla queda
    // corrida respecto a la cabecera de días.
    type Cell = typeof rawDays[number] | null;
    const weeks: Cell[][] = [];
    let currentWeek: Cell[] = [];
    if (rawDays.length > 0) {
      const firstDow = new Date(rawDays[0].date + 'T00:00:00Z').getUTCDay();
      const leading = (firstDow + 6) % 7;
      currentWeek = Array.from({ length: leading }, () => null);
    }
    for (const day of rawDays) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    return { rawDays, weeks };
  }, [fromDate, slotsByDate, form, fullDays, rangoDias]);

  /*
   * Salida cuando la agenda no tiene nada que ofrecer.
   *
   * Un día lleno o un grupo que no cabe dejaban el camino cerrado con un aviso: quien reserva se
   * iba sin saber que el local igual podía acomodarlo moviendo mesas o abriendo otra hora. El
   * WhatsApp ya estaba configurado y solo se usaba para grupos. Aparece únicamente si el local
   * puso su número, y el mensaje va escrito con la fecha y la cantidad para no tener que repetirlas.
   */
  const diasSinNada = calendarDays.rawDays.length === 0 || calendarDays.rawDays.every((day) => !day.hasSlots);
  const hayDiasLlenos = calendarDays.rawDays.some((day) => day.isFull);
  const whatsappSinCupo = businessWhatsAppUrl(
    form?.designConfig?.whatsappBusinessNumber,
    `Hola, quiero reservar en ${form?.name ?? 'el local'}${selectedDate ? ` el ${selectedDate}` : ''} para ${guest.partySize} persona${guest.partySize === 1 ? '' : 's'} y no veo horarios disponibles. ¿Tienen alguna posibilidad?`,
  );

  // ── Caminos de render ──
  if (isLoading) return <LoadingSpinner text="Cargando disponibilidad..." />;
  if (error || !form) return <div className="public-booking-error"><BrandMark /><h1>Este formulario no está disponible</h1><p>Puede estar pausado o el enlace ya no es válido.</p></div>;

  const design = form.designConfig || {};
  const ocasiones = leerOcasiones(design.ocasiones);
  /*
   * La grilla en la página y la grilla como aviso se deciden por separado.
   *
   * El aviso exigía que la grilla estuviera encendida también en la página: quien quería mostrarla
   * sólo al entrar, sin repetirla abajo del formulario, no tenía cómo. Apagar una apagaba las dos.
   */
  const hayOcasiones = ocasiones.length > 0;
  const ocasionesEncendidas = design.ocasionesEnabled === 'true' && hayOcasiones;
  const ocasionesComoAviso = design.ocasionesPopup === 'true' && hayOcasiones;
  /*
   * Si la grilla está conectada a una pregunta del formulario, tocar una tarjeta la responde.
   * Sólo cuando la ocasión es una opción válida de esa pregunta: el servidor rechaza cualquier otra.
   */
  /*
   * La pregunta conectada sólo existe si la grilla tiene ocasiones reales: con «No» como única
   * opción (la grilla vacía o sólo con el texto de relleno) no hay nada que elegir y se oculta.
   */
  const preguntaConectada = design.ocasionesPreguntaId ? (form?.fieldSchema || []).find((field) => field.id === design.ocasionesPreguntaId && field.type === 'select') : undefined;
  const opcionesReales = (preguntaConectada?.options ?? []).filter((opcion) => opcion.trim().toLowerCase() !== 'nueva ocasión');
  const preguntaDeOcasiones = preguntaConectada && opcionesReales.length > 1 ? { ...preguntaConectada, options: opcionesReales } : undefined;
  /*
   * Con la grilla conectada no se pregunta dos veces qué se celebra: el tipo de evento sale de
   * la respuesta a esa pregunta. Sin respuesta o con «No», el grupo cuenta como «otro».
   */
  // Los nombra el local; al servidor viaja su categoría, que es lo que usan los reportes.
  const tiposDeEvento = leerTiposDeEvento(design.tiposDeEvento);
  /** Ocasiones válidas para un evento: sin las respuestas que dicen que no se celebra nada. */
  const opcionesDeEvento = (preguntaDeOcasiones?.options ?? []).filter((opcion) => !/^(no|ninguna|nada|nueva ocasión)$/i.test(opcion.trim()));
  const ocasionElegida = preguntaDeOcasiones && opcionesDeEvento.includes(String(answers[preguntaDeOcasiones.id] ?? '')) ? String(answers[preguntaDeOcasiones.id]) : '';
  const tipoDeEvento = preguntaDeOcasiones ? tipoDeEventoDesde(answers[preguntaDeOcasiones.id]) : (tiposDeEvento.find((tipo) => tipo.nombre === groupEventType)?.categoria ?? '');
  const elegirOcasion = (titulo: string) => {
    if (!preguntaDeOcasiones?.options?.includes(titulo)) return;
    setAnswers((actuales) => ({ ...actuales, [preguntaDeOcasiones.id]: titulo }));
  };
  /**
   * Tarjeta de una ocasión.
   *
   * @param enAviso En el aviso al entrar la foto se carga de inmediato: con carga diferida, varios
   *   navegadores de teléfono no la pedían dentro de una ventana superpuesta hasta hacer scroll.
   */
  const tarjetaDeOcasion = (ocasion: { titulo: string; texto?: string; imagen?: string }, alElegir?: () => void, enAviso = false) => {
    const elegible = Boolean(preguntaDeOcasiones?.options?.includes(ocasion.titulo));
    const elegida = elegible && answers[preguntaDeOcasiones!.id] === ocasion.titulo;
    const contenido = <>
      {ocasion.imagen && <img src={optimizedUrl(ocasion.imagen, 800)} alt="" loading={enAviso ? 'eager' : 'lazy'} decoding="async" />}
      <strong>{ocasion.titulo}</strong>
      {ocasion.texto && <small>{ocasion.texto}</small>}
    </>;
    const tarjeta = elegible
      ? <button type="button" className={`booking-ocasion-elegible ${elegida ? 'is-elegida' : ''}`} aria-pressed={elegida} onClick={(event) => { event.stopPropagation(); elegirOcasion(ocasion.titulo); alElegir?.(); }}>{contenido}</button>
      : <article>{contenido}</article>;
    return (
      <div className="booking-ocasion" key={ocasion.titulo}>
        {tarjeta}
        {ocasion.imagen && <button type="button" className="booking-ocasion-ampliar" aria-label={`Ver foto de ${ocasion.titulo}`} onClick={(event) => { event.stopPropagation(); setFotoAmpliada({ src: ocasion.imagen!, titulo: ocasion.titulo }); }}>⤢</button>}
      </div>
    );
  };
  const horarioDeAtencion = resumenDeHorarios((form?.scheduleConfig as { windows?: Array<{ day: number; start: string; end: string }> } | undefined)?.windows);
  /** Aviso libre del local, en la página antes del formulario. Vacío no muestra nada. */
  const notasDelLocal = String(design.notasDelLocal || '').trim();
  /** Cuánto espera el local a quien se atrasa. Cero o vacío significa que prefiere no decirlo. */
  const toleranciaEnMinutos = Math.max(0, Math.min(120, Number(design.toleranciaMinutos || '0') || 0));
  const consultasPorWhatsapp = businessWhatsAppUrl(design.whatsappBusinessNumber, String(design.whatsappConsultas || 'Hola, tengo una duda sobre una reserva.'));
  const limiteDeAvisos = design.ocasionesVeces === 'siempre' ? Number.POSITIVE_INFINITY : Math.max(1, Number(design.ocasionesVeces || '1') || 1);
  const primary = normalizeHexColor(design.primaryColor, '#0ec6b8');
  const accent = normalizeHexColor(design.accentColor, '#ea0f63');
  const background = normalizeHexColor(design.backgroundColor, '#f6f4f5');
  const textColor = design.textColor || '#3f4e49';
  const fontFamily = design.fontFamily || 'system-ui';
  const backgroundOpacity = imageOverlayAlpha(design.backgroundOpacity);
  const backgroundImage = design.backgroundMode === 'gradient'
    ? design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT
    // Formularios guardados antes del selector de modo sólo tienen la URL. Se interpreta como
    // imagen para que una portada ya cargada nunca quede invisible; una elección explícita de
    // color o gradiente sigue prevaleciendo.
    : (design.backgroundMode === 'image' || !design.backgroundMode) && design.backgroundImage
      ? `linear-gradient(rgba(243,245,239,${backgroundOpacity}),rgba(243,245,239,${backgroundOpacity})),url(${optimizedUrl(design.backgroundImage, 1920)})`
      : undefined;
  const style = {
    '--booking-primary': primary, '--booking-primary-contrast': contrastText(primary),
    '--booking-primary-text': accessibleForeground(primary, '#ffffff', '#0ec6b8'),
    '--booking-primary-page-text': accessibleForeground(primary, background, '#0ec6b8'),
    '--booking-accent': accent, '--booking-accent-contrast': contrastText(accent),
    '--booking-accent-text': accessibleForeground(accent, background, '#9f3e26'),
    '--booking-bg': background, '--booking-text': textColor, '--booking-font': fontFamily,
    '--booking-card-ink': accessibleForeground(textColor, '#ffffff', '#1c1a1d'),
    '--booking-button-radius': `${design.buttonRadius || '12'}px`,
    '--booking-field-radius': `${design.fieldRadius || '10'}px`,
    '--booking-logo-align': safeDesignChoice(design.logoPosition, ['left', 'center', 'right'], 'left'),
    '--booking-logo-size': `${safeNumber(design.logoSize, 96, 32, 240)}px`,
    '--booking-title-size': `${safeNumber(design.titleSize, 72, 32, 96)}px`,
    '--booking-welcome-size': `${safeNumber(design.welcomeSize, 16, 12, 24)}px`,
    color: textColor, fontFamily, backgroundColor: background, backgroundImage,
    backgroundPosition: design.backgroundAnchor || design.backgroundPosition || 'center center',
    backgroundSize: safeDesignChoice(design.backgroundSize, ['cover', 'contain', 'auto'], 'cover'),
    backgroundRepeat: 'no-repeat',
  } as CSSProperties;

  // La reserva tiene una aceptación operativa única, versionada fuera del esquema heredado.
  // Las encuestas conservan sus consentimientos propios porque son un propósito distinto.
  /*
   * Cuántas personas vienen se elige en el primer paso y se muestra en el resumen. Un formulario
   * antiguo que además lo traiga como campo lo repetía dos veces en el paso de datos, y ese
   * segundo control no volvía a comprobar que el horario elegido siguiera alcanzando.
   */
  /*
   * Todas las preguntas visibles, en el orden del editor.
   *
   * Quedan fuera sólo las que se contestan en otro lugar: el número de personas (paso 1), la
   * aceptación base `consent` (bloque de aceptaciones) y el cupón, que depende de «Aceptar
   * cupones». Cualquier otro campo agregado —selector, fecha, aceptación propia— aparece aquí.
   */
  const camposEnOrden = camposVisibles(
    (form.fieldSchema || []).map((field) => field.options ? { ...field, options: field.options.filter((opcion) => opcion.trim().toLowerCase() !== 'nueva ocasión') } : field).filter((field) => !(preguntaConectada && !preguntaDeOcasiones && (field.id === preguntaConectada.id || field.mostrarSi?.campo === preguntaConectada.id))).filter((field) => field.id !== 'partySize' && field.type !== 'coupon' && (isSurvey || field.id !== 'consent'))
      // En la solicitud de evento, lo que depende de la ocasión ya lo pide «Cuéntanos lo importante».
      .filter((field) => !(requestMode && preguntaDeOcasiones && field.mostrarSi?.campo === preguntaDeOcasiones.id)),
    { ...answers, name: guest.guestName, email: guest.guestEmail, phone: guest.guestPhone, partySize: guest.partySize },
  );
  /** Hoy en la zona del local: el mínimo de las fechas que puede elegir quien reserva. */
  const hoyEnElLocal = slotDateKey(new Date().toISOString(), form.timezone);
  const customFields = camposEnOrden.filter((field) => !['name', 'email', 'phone'].includes(field.id));
  const services = form.servicesConfig || [];
  const resources = form.resourcesConfig || [];
  const selectedService = services.find((service) => service.id === serviceId);
  const systemFields = Object.fromEntries((form.fieldSchema || []).map((field) => [field.id, field]));
  const poweredByText = design.poweredByText || 'Gestionado con\nEspartanos Reservas';
  const badgeText = design.secureBadgeText || 'Reserva segura';
  const eyebrowText = design.eyebrowText || 'AGENDA EN LÍNEA';
  const durationLabel = design.durationLabel || 'minutos';
  const confirmationLabel = design.confirmationLabel || 'confirmación';
  const selectedDaySlots = slotsByDate.get(selectedDate) || [];
  const identidadLegal: IdentidadLegal = { razonSocial: design.legalCompanyName, rut: design.legalCompanyId, correo: design.supportEmail, nombreComercial: form.name };
  const responsableLegal = nombreLegalDelLocal(identidadLegal);
  /*
   * Los textos se repiten en el servidor, que es el que guarda la evidencia junto a la reserva.
   * Acá se muestran; allá quedan escritos tal como se mostraron. Si divergen, manda el servidor.
   */
  const textosBase = textosDeAceptacionDeReserva(identidadLegal, { red: design.networkBrandName, grupo: design.beneficiosDelGrupo === 'true' });
  const networkBrand = String(design.networkBrandName || 'Espartanos');
  const reservationConsentText = String(design.reservationConsentText || textosBase.reserva);
  const marketingConsentText = String(design.marketingConsentText || textosBase.novedades);
  const networkConsentText = String(design.networkConsentText || textosBase.red);

  // Página de éxito
  if (waitlist.data) return <main className="public-booking" style={style}><section className="booking-success"><span className="success-icon">✓</span><span className="success-state is-pending">LISTA DE ESPERA</span><h1>Te avisaremos si se libera un cupo</h1><p>No se confirmó una reserva ni se tomó un cupo. El local revisará tu solicitud en orden de llegada.</p><p className="success-datetime">{selected && new Date(selected).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone })}</p><div className="success-code"><strong>Código {waitlist.data.referenceCode}</strong></div><Link className="btn btn-outline" to={`/book/${slug}`}>Volver al inicio</Link></section></main>;

  if (submit.data) {
    const googleReviewUrl = safeUrl(design.googleReviewUrl || '');
    const rating = Number(answers.rating || answers.experience_rating || 0);
    const reviewMinRating = safeNumber(design.googleReviewMinRating, 4, 1, 5);
    if (isSurvey) return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} enabled={measurementConsent} /><Ga4Tag measurementId={form?.ga4MeasurementId} enabled={measurementConsent} /><section className="booking-success"><span className="success-icon">✓</span><h1>{design.surveySuccessTitle || 'Gracias por tu opinión'}</h1><p>{design.confirmationMessage || 'Tu respuesta fue registrada correctamente.'}</p>{Number.isFinite(rating) && rating > 0 && <p className="success-datetime">Calificación recibida: {rating}/5</p>}<div className="success-actions">{googleReviewUrl ? <a className="btn btn-primary" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">{rating >= reviewMinRating ? 'Dejar reseña en Google' : 'Ir a Google si quieres opinar públicamente'}</a> : null}<Link className="btn btn-outline" to={`/book/${slug}`}>Enviar otra respuesta</Link></div><small className="success-note">La reseña en Google es opcional y queda a tu criterio.</small></section></main>;
    if (submit.data.kind === 'group_request') { const whatsappUrl = businessWhatsAppUrl(design.whatsappBusinessNumber, String(design.whatsappGroupMessage || `Hola, envié una solicitud de ${groupEventType || 'grupo'} para ${Math.max(groupThreshold + 1, guest.partySize)} personas desde la reserva web.`)); return <main className="public-booking" style={style}><section className="booking-success"><span className="success-icon">✓</span><span className="success-state is-pending">SOLICITUD RECIBIDA</span><h1>Revisaremos tu solicitud</h1><p>No se tomó ningún cupo ni se confirmó una reserva. El local te contactará para acordar disponibilidad y detalles.</p><p className="success-datetime">Grupo de {Math.max(groupThreshold + 1, guest.partySize)} personas · {ocasionElegida || groupEventType || 'evento'}</p><div className="success-actions">{whatsappUrl && <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noreferrer">Continuar por WhatsApp</a>}<Link className="btn btn-outline" to={`/book/${slug}`}>Volver al inicio</Link></div>{design.supportEmail && <small className="success-note">Si necesitas agregar algo, escribe a {design.supportEmail}</small>}</section></main>; }
    const svcDuration = serviceId ? (form.servicesConfig || []).find((s) => s.id === serviceId)?.durationMinutes : null;
    const icsDuration = (svcDuration || form.durationMinutes || 60) * 60000;
    /*
     * La fecha puede no venir, y esta pantalla no puede caerse.
     *
     * Se daba por segura con una aserción, pero el tipo la declara opcional y hay respuestas que
     * no la traen. Sin fecha, `toISOString` lanza y lo que aparece es la pantalla de error
     * genérica **justo después de reservar**: la reserva quedó hecha en el servidor y la persona
     * pierde su código, que es lo único con lo que puede volver a ella.
     *
     * Sin fecha se muestra la confirmación con el código y sin el bloque de calendario, que es lo
     * único que dependía de ella.
     */
    const fechaLeida = submit.data.startsAt ? new Date(submit.data.startsAt) : null;
    const startDate = fechaLeida && Number.isFinite(fechaLeida.getTime()) ? fechaLeida : null;
    const fechaUtil = startDate !== null;
    const endDate = startDate ? new Date(startDate.getTime() + icsDuration) : null;
    const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const icsBody = !startDate || !endDate ? '' : `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${formatIcsDate(startDate)}\nDTEND:${formatIcsDate(endDate)}\nSUMMARY:${form.name}\nDESCRIPTION:Reserva ${submit.data.referenceCode}\nEND:VEVENT\nEND:VCALENDAR`;
    const gcalUrl = !startDate || !endDate ? '' : safeUrl(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(form.name)}&dates=${formatIcsDate(startDate)}/${formatIcsDate(endDate)}&details=${encodeURIComponent('Reserva ' + submit.data.referenceCode)}`);
    const icsBlob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
    const icsUrl = URL.createObjectURL(icsBlob);
    const calendarSaveEnabled = design.calendarSaveEnabled !== 'false' && fechaUtil;
    const isPending = submit.data.status === 'pending';
    return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} enabled={measurementConsent} /><Ga4Tag measurementId={form?.ga4MeasurementId} enabled={measurementConsent} /><section className="booking-success"><span className="success-icon">✓</span><span className={`success-state ${isPending ? 'is-pending' : ''}`}>{isPending ? 'PENDIENTE DE CONFIRMACIÓN' : 'RESERVA CONFIRMADA'}</span><h1>{isPending ? 'Recibimos tu reserva' : '¡Te esperamos!'}</h1><p>{isPending ? 'Aún no está confirmada. El local revisará tu solicitud y te responderá al correo indicado.' : (design.confirmationMessage || 'Tu reserva quedó registrada. Te esperamos.')}</p><p className="success-datetime">{startDate ? startDate.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone }) : 'Te confirmaremos la fecha por correo.'}</p>{/* Resumen de lo que quedó registrado. Antes la pantalla confirmaba sin mostrar con qué datos:
    quien se equivocaba en el nombre o en la cantidad de personas no tenía cómo darse cuenta, y el
    error aparecía recién al llegar al local. */}
{!marketingConsent && submit.data?.managementToken && <OfertaDeBeneficios token={submit.data.managementToken} texto={textosBase.novedades} nombre={identidadLegal.nombreComercial || responsableLegal} />}
<dl className="success-summary">
  {guest.guestName.trim() && <><dt>A nombre de</dt><dd>{guest.guestName.trim()}</dd></>}
  {guest.guestPhone.trim() && <><dt>Teléfono</dt><dd>{guest.guestPhone.trim()}</dd></>}
  <dt>Personas</dt><dd>{guest.partySize}</dd>
</dl><div className="success-code"><strong>Código {submit.data.referenceCode}</strong></div>{submit.data.couponCode && <p className="success-coupon"><VitaIcons.ticket /> Cupón <strong>{submit.data.couponCode}</strong> aplicado a esta reserva</p>}<small className="success-note">{guest.guestEmail ? `Enviaremos los detalles a ${guest.guestEmail}. ` : ''}Guarda este código para cualquier cambio o consulta.</small><div className="success-actions">{submit.data.managementToken && <Link className="btn btn-outline" to={`/book/manage/${submit.data.managementToken}`}>Gestionar reserva</Link>}
      {/* Volver siempre, también cuando la reserva queda pendiente. Antes ese caso mostraba solo
          un aviso y ninguna salida: quien reservaba y quedaba a la espera se encontraba con una
          pantalla sin ningún botón, y la única forma de salir era cerrar la pestaña. */}
      <Link className="btn btn-primary" to={`/book/${slug}`}>Volver al inicio</Link>
      {calendarSaveEnabled && gcalUrl ? <a className="btn btn-outline" href={gcalUrl} target="_blank" rel="noopener noreferrer">Android / Google Calendar</a> : null}
      {calendarSaveEnabled ? <a className="btn btn-outline" href={icsUrl} download={`reserva-${submit.data.referenceCode}.ics`}>iPhone / Apple Calendar</a> : null}
      {/* Llevarse el código a donde la persona lo va a buscar. El calendario avisa a la hora;
          WhatsApp conserva el código. No manda nada solo: abre la aplicación con el texto. */}
      <ShareBooking
        formName={form.name}
        when={new Date(submit.data.startsAt!).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: form.timezone })}
        referenceCode={submit.data.referenceCode!}
        partySize={guest.partySize}
        venuePhone={design.venuePhone}
        label={design.whatsappShareText}
      />
    </div>
    <VenueTips raw={design.venueTips} />
    {design.cancellationPolicy && <small className="success-note">{design.cancellationPolicy}</small>}{design.supportEmail && <small className="success-note">¿Necesitas ayuda? {design.supportEmail}</small>}{calendarSaveEnabled && <small className="success-note">{design.calendarSaveText || 'Al tocar una opción, tu dispositivo abrirá su calendario y te pedirá confirmar antes de guardar.'}</small>}</section></main>;
  }

  if (form.status === 'paused') return <main className="public-booking" style={style}><MetaPixel pixelId={form?.pixelId} enabled={measurementConsent} /><Ga4Tag measurementId={form?.ga4MeasurementId} enabled={measurementConsent} /><section className="booking-success"><h1>Reservas temporalmente cerradas</h1><p>Este local no acepta reservas en este momento. Vuelve más tarde o contacta al establecimiento.</p></section></main>;

  return <main className={`public-booking layout-${safeDesignChoice(design.layoutPosition, ['left', 'center', 'right'], 'right')}`} style={style} onFocusCapture={markStarted} onPointerDown={markStarted}>
    <MetaPixel pixelId={form.pixelId} enabled={measurementConsent} />
    {(form.pixelId || form.ga4MeasurementId) && <AvisoDeMedicion abierto={eleccionMedicion === '' || avisoMedicionAbierto} aceptada={measurementConsent} onElegir={setMeasurementConsent} onCerrar={eleccionMedicion !== '' ? () => setAvisoMedicionAbierto(false) : undefined} />}
    <Ga4Tag measurementId={form.ga4MeasurementId} enabled={measurementConsent} />
    {(form.pixelId || form.ga4MeasurementId) && eleccionMedicion !== '' && !avisoMedicionAbierto && <div className="preferencias-medicion-pie"><EnlacePreferenciasDeMedicion aceptada={measurementConsent} onAbrir={() => setAvisoMedicionAbierto(true)} /></div>}
    {/* La bienvenida va primero: los dos avisos se abrían a la vez, uno tapando al otro. */}
    {fotoAmpliada && <DialogoModal etiqueta={`Foto de ${fotoAmpliada.titulo}`} className="booking-foto-ampliada" onCerrar={() => setFotoAmpliada(null)}>
      <button type="button" className="booking-foto-cerrar" aria-label="Cerrar foto" onClick={() => setFotoAmpliada(null)}>×</button>
      {/* Sólo la foto retiene el toque: cualquier otro punto de la pantalla, incluso junto a la foto, la cierra. */}
      <figure>
        <img data-retiene-toque src={optimizedUrl(fotoAmpliada.src, 1600)} alt={fotoAmpliada.titulo} decoding="async" onError={(event) => { if (event.currentTarget.src !== fotoAmpliada.src) event.currentTarget.src = fotoAmpliada.src; }} />
        <figcaption>{fotoAmpliada.titulo}</figcaption>
        <button type="button" className="btn btn-primary" autoFocus onClick={() => setFotoAmpliada(null)}>Cerrar</button>
      </figure>
    </DialogoModal>}
    {ocasionesComoAviso && !avisoCerrado && vecesMostrado < limiteDeAvisos && !isSurvey && !bienvenidaPendiente && <DialogoModal etiqueta={design.ocasionesTitulo || 'Ocasiones'} className="booking-ocasiones-aviso" onCerrar={cerrarOcasiones} activo={!fotoAmpliada}>
      <section data-retiene-toque>
        <h2>{design.ocasionesTitulo || 'Para cada ocasión'}</h2>
        {design.ocasionesTexto && <p>{design.ocasionesTexto}</p>}
        <div className={`booking-ocasiones-grilla foto-${safeDesignChoice(design.ocasionesFoto, ['completa', 'horizontal', 'cuadrada', 'vertical'], 'completa')}`}>
          {ocasiones.map((ocasion) => tarjetaDeOcasion(ocasion, cerrarOcasiones, true))}
        </div>
        <div className="booking-ocasiones-cierre"><button type="button" className="btn btn-primary" autoFocus onClick={cerrarOcasiones}>{design.ocasionesBoton || 'Reservar ahora'}</button></div>
      </section>
    </DialogoModal>}
    {/*
      * El cuadro se dimensionaba con estilos fijos y sin alto máximo: con un texto largo o una
      * pantalla baja crecía más que la ventana, se salía por abajo y no se podía desplazar, así
      * que el botón para cerrarlo quedaba fuera de alcance. Ahora se limita al alto visible y
      * desplaza su contenido, igual que el aviso de ocasiones.
      */}
    {welcomeOpen && !isSurvey && form.designConfig?.welcomePopupEnabled === 'true' && <DialogoModal etiqueta="Bienvenida a reservas" className="booking-aviso" onCerrar={() => setWelcomeOpen(false)}><section data-retiene-toque>{form.designConfig?.logoUrl && <img src={optimizedUrl(form.designConfig.logoUrl, 480)} alt={`Logo ${form.name}`} style={{ maxWidth: 120, maxHeight: 56, objectFit: 'contain' }} />}<h2 style={{ margin: '12px 0 8px' }}>{form.designConfig?.welcomePopupTitle || `Reserva en ${form.name}`}</h2><p style={{ margin: '0 0 18px' }}>{form.designConfig?.welcomePopupText || 'Revisa los horarios disponibles y completa tus datos para continuar.'}</p><button type="button" className="btn btn-primary" autoFocus onClick={() => setWelcomeOpen(false)}>{form.designConfig?.welcomePopupBoton || 'Continuar'}</button></section></DialogoModal>}
    {(visible(design.showPoweredBy) || visible(design.showSecureBadge)) && <header>{visible(design.showPoweredBy) ? <div className="public-brand"><BrandMark decorative /><small>{poweredByText.split('\n').map((line) => <Fragment key={line}>{line}<br /></Fragment>)}</small></div> : <span />}{visible(design.showSecureBadge) && <em>{badgeText}</em>}</header>}
    {reservaRecordada && !isSurvey && <aside className="booking-recordatorio">
      <div>
        <strong>Ya tienes una reserva en este local</strong>
        <small>{reservaRecordada.referenceCode ? `Código ${reservaRecordada.referenceCode}` : 'Reserva guardada en este dispositivo'}{reservaRecordada.startsAt ? ` · ${new Date(reservaRecordada.startsAt).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: form.timezone })}` : ''}</small>
      </div>
      <div className="booking-recordatorio-acciones">
        <Link className="btn btn-primary btn-sm" to={`/book/manage/${reservaRecordada.token}`}>Cambiar hora o cancelar</Link>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { olvidarReservaRecordada(slug); setReservaRecordada(null); }}>No es mía</button>
      </div>
    </aside>}
    {!isSurvey && <details className="booking-buscar">
      <summary>¿Ya tienes una reserva? Cámbiala o cancélala</summary>
      <form onSubmit={(event) => { event.preventDefault(); buscarReserva.mutate(); }}>
        <label>Código de reserva<input className="input" value={codigoBuscado} onChange={(event) => setCodigoBuscado(event.target.value)} placeholder="Aparece en tu confirmación" required autoComplete="off" /></label>
        <label>Correo o teléfono con que reservaste<input className="input" value={contactoBuscado} onChange={(event) => setContactoBuscado(event.target.value)} required /></label>
        <button className="btn btn-primary btn-sm" disabled={buscarReserva.isPending}>{buscarReserva.isPending ? 'Buscando...' : 'Buscar mi reserva'}</button>
        {buscarReserva.error && <small className="error-text">{buscarReserva.error.message}</small>}
      </form>
      <div className="booking-buscar-alt">
        <strong>¿No tienes el código?</strong>
        {recuperar.isSuccess
          ? <p>Si hay reservas con ese correo en este local, te enviamos un enlace para gestionarlas. Revisa también la carpeta de spam.</p>
          : <form onSubmit={(event) => { event.preventDefault(); recuperar.mutate(); }}>
            <label>Te enviamos el enlace al correo con que reservaste<input className="input" type="email" value={correoRecuperar} onChange={(event) => setCorreoRecuperar(event.target.value)} required autoComplete="email" /></label>
            <button className="btn btn-outline btn-sm" disabled={recuperar.isPending}>{recuperar.isPending ? 'Enviando...' : 'Enviarme el enlace'}</button>
            {recuperar.error && <small className="error-text">{recuperar.error.message}</small>}
          </form>}
        {(design.whatsappBusinessNumber || design.supportEmail) && <small>¿Reservaste solo con teléfono o ya no usas ese correo? {businessWhatsAppUrl(design.whatsappBusinessNumber, 'Hola, necesito cambiar o cancelar mi reserva.') ? <a href={businessWhatsAppUrl(design.whatsappBusinessNumber, 'Hola, necesito cambiar o cancelar mi reserva.')} target="_blank" rel="noreferrer">Escríbele al local por WhatsApp</a> : null}{design.supportEmail ? ` ${design.whatsappBusinessNumber ? 'o' : 'Escribe'} a ${design.supportEmail}` : ''}.</small>}
      </div>
    </details>}
    <div className="public-booking-layout">
      <section className="public-booking-intro">{design.logoUrl && visible(design.showLogo) && <img className="public-booking-logo" src={optimizedUrl(design.logoUrl, 480)} alt="Logo de la empresa" />}{visible(design.showEyebrow) && <span>{requestMode ? 'SOLICITUD DE EVENTO' : eyebrowText}</span>}<h1>{requestMode ? 'Solicita tu evento' : design.title || form.name}</h1>{visible(design.showWelcome) && <p>{requestMode ? 'Cuéntanos tu evento y el local te contactará para coordinar fecha y detalles.' : design.welcome || 'Elige el horario que mejor te acomode.'}</p>}{!requestMode && visible(design.showFacts) && <div className="public-booking-facts"><div><strong>{selectedService?.durationMinutes || form.durationMinutes}</strong><span>{durationLabel}</span></div><div><strong>{form.confirmationMode === 'automatic' ? (design.automaticLabel || 'Directa') : (design.manualLabel || 'Manual')}</strong><span>{confirmationLabel}</span></div></div>}
        {/*
          * Lo que hay que saber antes de elegir una hora.
          *
          * El horario, cuánta anticipación pide el local y cuánto espera si alguien se atrasa.
          * Nada de eso estaba: quien entraba un día cerrado veía una grilla vacía, y quien llegaba
          * tarde no sabía si su mesa seguía guardada. Son las tres preguntas que terminan en una
          * llamada al local, y la única forma de no contestarlas es no decirlas.
          */}
        {step === 1 && notasDelLocal && <p className="booking-notas-local">{notasDelLocal}</p>}

        {!requestMode && step === 1 && (horarioDeAtencion || form.minimumNoticeHours > 0 || toleranciaEnMinutos > 0) && <ul className="booking-reglas">
          {horarioDeAtencion && <li><span>Horario</span><strong>{horarioDeAtencion}</strong></li>}
          {form.minimumNoticeHours > 0 && <li><span>Anticipación</span><strong>Se reserva con {form.minimumNoticeHours} {form.minimumNoticeHours === 1 ? 'hora' : 'horas'} de anticipación</strong></li>}
          {toleranciaEnMinutos > 0 && <li><span>Tolerancia</span><strong>Te esperamos {toleranciaEnMinutos} minutos; después la mesa queda disponible</strong></li>}
          {consultasPorWhatsapp && <li><span>Dudas</span><strong><a href={consultasPorWhatsapp} target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a></strong></li>}
        </ul>}

        {/* Sólo mientras se elige: en datos y confirmación empujaba el formulario hacia abajo. */}
        {ocasionesEncendidas && step === 1 && <div className="booking-ocasiones">
          {design.ocasionesTitulo && <h2>{design.ocasionesTitulo}</h2>}
          <div className={`booking-ocasiones-grilla foto-${safeDesignChoice(design.ocasionesFoto, ['completa', 'horizontal', 'cuadrada', 'vertical'], 'completa')}`}>
            {ocasiones.map((ocasion) => tarjetaDeOcasion(ocasion))}
          </div>
        </div>}
      </section>
      <form className={`public-booking-card ${isSurvey ? 'is-survey' : ''}`} onSubmit={(event) => { event.preventDefault(); if (step === 3) { submit.mutate(); } else if (step === 2) { goToConfirm(); } else { goToForm(); } }}>
        {/* Se oculta desplazándolo fuera de pantalla y no con `display:none`, que los bots
            reconocen como campo técnico y omiten. `aria-hidden` y `tabIndex={-1}` lo dejan
            fuera del alcance de lectores de pantalla y de la navegación con teclado. */}
        <input
          className="booking-honeypot"
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        {/*
          * Cada flujo muestra sus propios pasos.
          *
          * La solicitud de evento entra directamente en el paso 2 y marcaba como cumplido un
          * «Personas y fecha» por el que nunca pasó, porque justamente no toma horario.
          */}
        <div className="booking-steps">{isSurvey ? <><div className="booking-step-dot active"><span>1</span><small>Experiencia</small></div><div className={`booking-step-dot ${submit.isSuccess ? 'active' : ''}`}><span>2</span><small>Gracias</small></div></>
          : requestMode ? <><div className="booking-step-dot active"><span>1</span><small>Tu solicitud</small></div><div className={`booking-step-dot ${step >= 3 ? 'active' : ''}`}><span>2</span><small>Revisar y enviar</small></div></>
          : <><div className={`booking-step-dot ${step >= 1 ? 'active' : ''}`}><span>1</span><small>Personas y fecha</small></div><div className={`booking-step-dot ${step >= 2 ? 'active' : ''}`}><span>2</span><small>Datos</small></div><div className={`booking-step-dot ${step >= 3 ? 'active' : ''}`}><span>3</span><small>Confirmar</small></div></>}</div>

        {step === 1 && <div>
          <div className="public-field public-party-size"><label>¿Para cuántas personas?<select value={Math.min(guest.partySize, groupThreshold + 1)} onChange={(event) => {
            const personas = Number(event.target.value);
            setSelected(''); setSelectedDate('');
            // Un grupo grande no toma horario: pasa directo a la solicitud, que confirma el local.
            if (personas > groupThreshold && design.groupRequestEnabled !== 'false') { entrarASolicitud(personas); return; }
            setGuest({ ...guest, partySize: personas });
          }}>{Array.from({ length: groupThreshold }, (_, i) => i + 1).map((size) => <option key={size} value={size}>{size} persona{size === 1 ? '' : 's'}</option>)}<option value={groupThreshold + 1}>{groupThreshold + 1} o más personas</option></select></label>{guest.partySize > groupThreshold && design.groupRequestEnabled === 'false' && <small className="group-flow-hint">Grupo grande: elige fecha y horario; el local confirmará la reserva antes de dejarla lista.</small>}</div>
          {(services.length > 0 || resources.length > 0) && <div className="public-resource-choice">
            {services.length > 0 && (services.length <= 4 ? <div className="public-resource-tiles"><label>Servicio</label><div className="resource-tile-grid">{services.map((service) => <button type="button" key={service.id} className={`resource-tile ${serviceId === service.id ? 'selected' : ''}`} onClick={() => { setServiceId(serviceId === service.id ? '' : service.id); setSelected(''); }}><strong>{service.name}</strong><small>{service.durationMinutes ? `${service.durationMinutes} min` : ''}</small></button>)}</div></div> : <label>Servicio<select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(''); }}><option value="">Selecciona un servicio</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}</option>)}</select></label>)}
            {resources.length > 0 && <label>Sector preferido <small>(opcional)</small><select value={resourceId} onChange={(event) => { setResourceId(event.target.value); setSelected(''); }}><option value="">Sin preferencia</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}{resource.description ? ` · ${resource.description}` : ''}{resource.smokingAllowed ? ' · fumadores' : ''}</option>)}</select></label>}
          </div>}
          {loadingSlots && <div className="no-slots"><LoadingSpinner text="Buscando disponibilidad..." /></div>}
          {!loadingSlots && calendarDays.rawDays.length > 0 && <div>
            <div className="calendar-month-nav"><button type="button" className="calendar-month-btn" aria-label="Mes anterior" disabled={monthOffset <= 0} onClick={() => { setMonthOffset((m) => Math.max(0, m - 1)); setSelected(''); setSelectedDate(''); }}>‹</button><span>{(() => { const texto = new Date(fromDate + 'T12:00:00Z').toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }); return texto.charAt(0).toUpperCase() + texto.slice(1); })()}</span><button type="button" className="calendar-month-btn" aria-label="Mes siguiente" onClick={() => { setMonthOffset((m) => m + 1); setSelected(''); setSelectedDate(''); }}>›</button></div>
            <div className="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
            <div className="calendar-grid">{calendarDays.weeks.map((week, weekIndex) => <div key={weekIndex} className="calendar-week">{week.map((day, dayIndex) => day === null
              ? <span key={`empty-${dayIndex}`} className="calendar-day is-empty" aria-hidden="true" />
              : <button type="button" key={day.date} className={`calendar-day ${day.hasSlots ? 'has-slots' : day.isFull ? 'is-full' : 'no-slots'} ${selectedDate === day.date ? 'selected' : ''}`} disabled={!day.hasSlots} aria-label={`${day.weekday} ${day.day}${day.hasSlots ? '' : day.isFull ? ', completo' : ', cerrado'}`} onClick={() => { if (day.hasSlots) { setSelectedDate(day.date); setSelected(''); irAlHorario(); } }}><span className="calendar-weekday">{day.weekday}</span><span className="calendar-number">{day.day}</span>{day.isFull && !day.hasSlots && <span className="calendar-day-tag">Completo</span>}</button>)}</div>)}</div>
            <div className="calendar-hint"><span className="dot available" /> Disponible <span className="dot full" /> Completo <span className="dot taken" /> Cerrado</div>
            {slotDays < maxSlotDays && <button type="button" className="btn btn-outline btn-sm calendar-load-more" onClick={() => setSlotDays((d) => Math.min(d + 14, maxSlotDays))}>Cargar más fechas</button>}
          </div>}
          {!loadingSlots && availability?.pausedUntil && <div className="no-slots"><strong>Las reservas están pausadas temporalmente</strong><p>Volverán a estar disponibles el {new Date(availability.pausedUntil).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: form.timezone })}.</p></div>}
          {!loadingSlots && !availability?.pausedUntil && calendarDays.rawDays.length === 0 && <div className="no-slots"><strong>Sin horarios disponibles</strong><p>Prueba otro servicio o contacta al local.</p></div>}
          {!loadingSlots && !availability?.pausedUntil && whatsappSinCupo && (diasSinNada || hayDiasLlenos) && <div className="no-slots sin-cupo-whatsapp">
            <a className="btn btn-primary" href={whatsappSinCupo} target="_blank" rel="noreferrer">{diasSinNada ? 'Sin horarios: escríbenos por WhatsApp' : '¿Otra hora? Escríbenos por WhatsApp'}</a>
          </div>}

          {slotIssue && <div className="alert alert-error" role="alert">{slotIssue}</div>}
          {/*
            * La solicitud de evento es otro flujo: no toma horario y la responde el local. Estaba
            * en medio de la elección de fecha, así que interrumpía a quien sólo quería reservar.
            * Va al final, separada, y el local puede no ofrecerla.
            */}
          {faltaCupoParaElGrupo && <div className="no-slots sin-cupo-grupo">
            <strong>Para {guest.partySize} personas no quedan horarios en estas fechas</strong>
            <p>{cupoMaximoVisto > 0 ? `Hay horarios con espacio para hasta ${cupoMaximoVisto} persona${cupoMaximoVisto === 1 ? '' : 's'}. ` : ''}{resourceId ? 'Prueba sin preferencia de sector, otras fechas o escríbenos.' : 'Prueba otras fechas o escríbenos.'}</p>
            {resourceId && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setResourceId(''); setSelected(''); }}>Ver sin preferencia de sector</button>}
          </div>}

          {selectedDate && <div className="slot-time-picker" ref={slotPickerRef}>
            <h3>Horarios de {calendarDays.rawDays.find((d) => d.date === selectedDate)?.weekday} {calendarDays.rawDays.find((d) => d.date === selectedDate)?.day}</h3>
            <div className="slot-time-grid">{selectedDaySlots.map((slot) => <button type="button" className={`slot-time-btn ${selected === slot.startsAt ? 'active' : ''}`} onClick={() => { setSlotIssue(''); setSelected(slot.startsAt); goToForm(); }} key={slot.startsAt}>
              <strong>{new Date(slot.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</strong>
              <small>{slot.available} cupo{slot.available !== 1 ? 's' : ''}</small>
            </button>)}</div>
          </div>}
          {/*
            * Eventos y grupos: un camino propio y visible, que no toma horario y coordina el local.
            * Es lo que más vale para el local, así que se destaca; elegir «X o más» lleva al mismo lugar.
            */}
          {!requestMode && design.groupRequestEnabled !== 'false' && <div className="public-other-flow public-evento-cta">
            <div><strong>{design.eventoCtaTitulo || '¿Es un evento o una celebración?'}</strong><small>{design.eventoCtaTexto || `Cumpleaños, empresa o grupos de ${groupThreshold + 1} o más. El local te contacta para coordinar fecha y detalles.`}</small></div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => entrarASolicitud(guest.partySize)}>{design.eventoCtaBoton || 'Solicitar evento'} →</button>
          </div>}
        </div>}

        {step === 2 && <div ref={formRef}>
          <div className="booking-step-title"><span>{isSurvey || requestMode ? '01' : '02'}</span><div><strong>{isSurvey ? (design.surveyTitle || 'Cuéntanos cómo fue tu experiencia') : requestMode ? 'Tus datos y tu evento' : 'Tus datos'}</strong><small>{isSurvey ? (design.surveyHelpText || 'Tus respuestas ayudan al local a mejorar cada visita.') : requestMode ? 'No se toma un horario: el local te contactará para acordar fecha y detalles.' : 'Se usarán solo para gestionar tu atención.'}</small></div></div>
          {/*
            * Recordatorio de lo elegido.
            *
            * Al pasar a los datos, el paso anterior se desmonta: personas, servicio y sector
            * desaparecían y no quedaba forma de revisarlos sin volver atrás y perder el horario.
            */}
          {!requestMode && <div className="booking-recap">
            <span><strong>{guest.partySize}</strong> persona{guest.partySize === 1 ? '' : 's'}</span>
            {selectedService && <span>{selectedService.name}</span>}
            {resources.find((zona) => zona.id === resourceId) && <span>{resources.find((zona) => zona.id === resourceId)?.name}</span>}
          </div>}
          <div className="booking-selected-slot">{selected && <div className="selected-slot-badge"><span><VitaIcons.calendar /></span><strong>{new Date(selected).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: form.timezone })}</strong>{hold.isPending && <small aria-live="polite">Guardando tu cupo...</small>}{hold.isSuccess && holdRestante > 0 && <small className="success-text" aria-live="polite">Cupo retenido {Math.floor(holdRestante / 60)}:{String(holdRestante % 60).padStart(2, "0")}</small>}{hold.isSuccess && holdExpiraEn && holdRestante === 0 && <small aria-live="polite">La retención venció. Puedes seguir, pero confirmaremos que el horario siga libre.</small>}<button type="button" className="btn btn-outline btn-xs" onClick={goBackToSlots}>Cambiar</button></div>}</div>
          <div className="public-form-fields">
            {/* El orden es el del editor: los campos fijos van donde se los puso, no siempre arriba. */}
            {camposEnOrden.filter((field) => !(preguntaDeOcasiones && field.id === preguntaDeOcasiones.id && (requestMode || guest.partySize > groupThreshold))).map((field) => field.id === 'name' ? <Fragment key="name"><div className={`public-field ${errors.name ? 'has-error' : ''}`}><label>{systemFields.name.label} {systemFields.name.required ? <span className="required-star">*</span> : null}<input ref={nameInputRef} className={errors.name ? 'input-error' : ''} type="text" required={systemFields.name.required} placeholder={systemFields.name.placeholder || 'Tu nombre completo'} value={guest.guestName} onChange={(event) => setGuest({ ...guest, guestName: event.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'error-name' : undefined} /></label>{errors.name && <span className="field-error" id="error-name" role="alert">{errors.name}</span>}</div></Fragment>
              : field.id === 'phone' ? <Fragment key="phone"><div className={`public-field ${errors.phone ? 'has-error' : ''}`}><label>{systemFields.phone.label} {systemFields.phone.required ? <span className="required-star">*</span> : null}<input className={errors.phone ? 'input-error' : ''} type="tel" required={systemFields.phone.required} placeholder={systemFields.phone.placeholder || '+56 9 ...'} value={guest.guestPhone} onChange={(event) => setGuest({ ...guest, guestPhone: event.target.value })} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'error-phone' : undefined} /></label>{errors.phone && <span className="field-error" id="error-phone" role="alert">{errors.phone}</span>}</div></Fragment>
              : field.id === 'email' ? <Fragment key="email"><div className={`public-field ${errors.email ? 'has-error' : ''}`}><label>{systemFields.email.label} {systemFields.email.required ? <span className="required-star">*</span> : null}<input className={errors.email ? 'input-error' : ''} type="email" required={systemFields.email.required} placeholder={systemFields.email.placeholder || 'tu@correo.com'} value={guest.guestEmail} onChange={(event) => setGuest({ ...guest, guestEmail: event.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'error-email' : undefined} /></label>{errors.email && <span className="field-error" id="error-email" role="alert">{errors.email}</span>}</div></Fragment>
              : <Fragment key={field.id}>{renderField(field, answers[field.id], (value) => setAnswers({ ...answers, [field.id]: value }), errors[field.id])}</Fragment>)}
            {/* ---- Evento o grupo: todo lo del evento junto, separado de las preferencias de una visita normal. */}
            {!isSurvey && (guest.partySize > groupThreshold || requestMode) && <section className={`booking-bloque ${errors.groupEvent ? 'has-error' : ''}`} aria-labelledby="bloque-evento">
              <h3 id="bloque-evento">{requestMode ? 'Sobre tu evento' : 'Sobre tu grupo'}</h3>
              {!requestMode && <p className="booking-bloque-ayuda">Los grupos grandes los confirma el local antes de dejar la reserva lista.</p>}
              {preguntaDeOcasiones
                ? <Fragment>{renderField({ ...preguntaDeOcasiones, label: '¿Qué ocasión es?', required: true, options: opcionesDeEvento }, answers[preguntaDeOcasiones.id], (value) => setAnswers({ ...answers, [preguntaDeOcasiones.id]: value }), errors[preguntaDeOcasiones.id])}</Fragment>
                : <label>¿Qué ocasión es?<select required value={groupEventType} onChange={(event) => setGroupEventType(event.target.value)}><option value="">Selecciona una opción</option>{tiposDeEvento.map((tipo) => <option key={tipo.nombre} value={tipo.nombre}>{tipo.nombre}</option>)}</select></label>}
              {requestMode && <label>¿Cuántas personas?<input type="number" min={groupThreshold + 1} max={500} value={guest.partySize} onChange={(event) => setGuest({ ...guest, partySize: Math.max(groupThreshold + 1, Math.min(500, Number(event.target.value) || groupThreshold + 1)) })} /></label>}
              {requestMode && <div className="form-row"><label>Fecha preferida <small>(opcional)</small><input type="date" min={hoyEnElLocal} value={requestPreference.date} onChange={(event) => setRequestPreference({ ...requestPreference, date: event.target.value })} /></label><label>Horario preferido <small>(opcional)</small><input value={requestPreference.time} onChange={(event) => setRequestPreference({ ...requestPreference, time: event.target.value })} maxLength={80} placeholder="Ej. viernes desde 20:00" /></label></div>}
              <label>Cuéntanos lo importante <small>(opcional)</small><textarea value={groupEventNotes} onChange={(event) => setGroupEventNotes(event.target.value)} maxLength={1000} placeholder="Ej. torta, decoración, menú, horario flexible…" /></label>
              {errors.groupEvent && <span className="field-error" role="alert">{errors.groupEvent}</span>}
            </section>}

            {/* ---- Preferencias de la visita: plegadas, porque son opcionales y no deben alargar el paso. */}
            {!isSurvey && ['askChildren', 'askAccessibility', 'askAllergies', 'askSmoking', 'askSeating', 'askFirstVisit', 'askHowFound'].some((clave) => (form.designConfig as Record<string, unknown> | undefined)?.[clave] === 'true' ) && <details className="booking-bloque booking-bloque-plegable">
              <summary><span>Preferencias de la visita <small>(opcional)</small></span><small>Niños, accesibilidad, alimentación y mesa</small></summary>
              <p className="booking-bloque-ayuda">El local hará lo posible por considerarlas; no reemplazan una coordinación directa.</p>
              {form.designConfig?.askChildren === 'true' && <label>¿Cuántos niños vienen?<select value={visitNeeds.childrenCount} onChange={(event) => setVisitNeeds({ ...visitNeeds, childrenCount: Number(event.target.value) })}><option value={0}>No vienen niños / prefiero no indicar</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} niño{count > 1 ? 's' : ''}</option>)}</select></label>}
              {form.designConfig?.askAccessibility === 'true' && <label>Accesibilidad o comodidad<input value={visitNeeds.accessibilityNeed} onChange={(event) => setVisitNeeds({ ...visitNeeds, accessibilityNeed: event.target.value })} maxLength={500} placeholder="Ej. acceso sin escalón, espacio para coche" /></label>}
              {form.designConfig?.askAllergies === 'true' && <label>Restricciones alimentarias<textarea value={visitNeeds.dietaryNotes} onChange={(event) => setVisitNeeds({ ...visitNeeds, dietaryNotes: event.target.value })} maxLength={1000} placeholder="Ej. vegetariano, sin gluten. Confirma siempre directamente con el local." /></label>}
              {form.designConfig?.askSmoking === 'true' && <label>¿Fumas?<small className="ayuda-del-campo">El local te ubica según lo que respondas.</small><select value={visitNeeds.smokingPreference} onChange={(event) => setVisitNeeds({ ...visitNeeds, smokingPreference: event.target.value })}><option value="">Prefiero no indicar</option><option value="Zona de fumadores">Sí, prefiero zona de fumadores</option><option value="Zona de no fumadores">No, prefiero zona de no fumadores</option><option value="Me da lo mismo">Me da lo mismo</option></select>{visitNeeds.smokingPreference === 'Zona de no fumadores' && resources.find((zona) => zona.id === resourceId)?.smokingAllowed && <small className="error-text">El sector que elegiste permite fumar.</small>}{visitNeeds.smokingPreference === 'Zona de fumadores' && resources.length > 0 && !resources.some((zona) => zona.smokingAllowed) && <small>Este local no tiene sectores para fumadores.</small>}</label>}
              {form.designConfig?.askSeating === 'true' && <label>¿Qué mesa prefieres?<select value={visitNeeds.seatingPreference} onChange={(event) => setVisitNeeds({ ...visitNeeds, seatingPreference: event.target.value })}><option value="">Sin indicar</option><option value="Mesa tranquila">Mesa tranquila</option><option value="Cerca de una ventana">Cerca de una ventana</option><option value="Cerca de la barra">Cerca de la barra</option><option value="Sin preferencia">Sin preferencia</option></select></label>}
              {form.designConfig?.askFirstVisit === 'true' && <label>¿Es tu primera visita?<select value={visitNeeds.firstVisit} onChange={(event) => setVisitNeeds({ ...visitNeeds, firstVisit: event.target.value })}><option value="">Prefiero no indicar</option><option value="Sí, es mi primera vez">Sí, es mi primera vez</option><option value="No, ya he venido">No, ya he venido</option></select></label>}
              {form.designConfig?.askHowFound === 'true' && <label>¿Cómo nos conociste?<select value={visitNeeds.howFound} onChange={(event) => setVisitNeeds({ ...visitNeeds, howFound: event.target.value })}><option value="">Prefiero no indicar</option><option value="Redes sociales">Redes sociales</option><option value="Recomendación">Recomendación</option><option value="Google o mapas">Google o mapas</option><option value="Pasé por fuera">Pasé por fuera</option><option value="Otro">Otro</option></select></label>}
            </details>}

            {/* ---- Cupón: sólo para una reserva con horario; una solicitud no tiene precio todavía. */}
            {!requestMode && form.designConfig?.couponEnabled !== 'false' && <div className="public-field"><label>Cupón de descuento <small>(opcional)</small><div className="public-coupon-row"><input className={couponValid === false ? 'input-error' : ''} type="text" placeholder="Código" value={couponCode} onChange={(event) => { setCouponCode(event.target.value); setCouponValid(null); setCouponMsg(''); }} /><button type="button" className="btn btn-outline btn-sm" disabled={!couponCode.trim() || validateCoupon.isPending} onClick={() => validateCoupon.mutate()}>{validateCoupon.isPending ? '...' : 'Aplicar'}</button></div>{couponMsg && <small className={couponValid ? 'success-text' : 'error-text'}>{couponMsg}</small>}</label></div>}

            {/*
              * Aceptaciones: una casilla por finalidad, ninguna marcada de antemano, texto corto y el
              * detalle completo a un toque. El servidor guarda el texto completo tal como se mostró.
              */}
            <section className="booking-bloque booking-aceptaciones" aria-labelledby="bloque-aceptaciones">
              <h3 id="bloque-aceptaciones">{isSurvey ? 'Antes de enviar' : 'Aceptaciones'}</h3>
              {!isSurvey && <div className={`public-consent ${errors.reservationConsent ? 'has-error' : ''}`}>
                <label><input type="checkbox" required checked={reservationConsent} onChange={(event) => setReservationConsent(event.target.checked)} aria-invalid={Boolean(errors.reservationConsent)} /><span><strong>Acepto las condiciones de la {requestMode ? 'solicitud' : 'reserva'} y leí la política de privacidad <span className="required-star">*</span></strong></span></label>
                <details className="consent-detalle"><summary>Ver detalle</summary><p>{reservationConsentText}</p><p className="consent-legal">Responsable de tus datos: {responsableLegal}. Plataforma: Espartanos, encargada por el local.</p><EnlacesLegales design={design as Record<string, unknown>} identidad={identidadLegal} onAbrir={setDocumentoLegal} /></details>
                {errors.reservationConsent && <span className="field-error" role="alert">{errors.reservationConsent}</span>}
              </div>}
              {hayDatosSensibles && <div className={`public-consent public-consent-sensible ${errors.sensitiveConsent ? 'has-error' : ''}`}>
                <label><input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} aria-invalid={Boolean(errors.sensitiveConsent)} /><span><strong>Autorizo el uso de la información de salud o alimentación que indiqué <span className="required-star">*</span></strong></span></label>
                <details className="consent-detalle"><summary>Ver detalle</summary><p>{textosBase.sensibles}</p></details>
                {errors.sensitiveConsent && <span className="field-error" role="alert">{errors.sensitiveConsent}</span>}
              </div>}
              {!isSurvey && <div className="public-consent public-marketing-consent">
                <label><input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} /><span><strong>Quiero beneficios y novedades de {identidadLegal.nombreComercial || responsableLegal}{design.beneficiosDelGrupo === 'true' ? ` y sus locales` : ''} <small>(opcional)</small></strong><small className="consent-beneficio">Promociones, beneficios de cumpleaños y eventos, cuando el local los ofrezca.</small></span></label>
                <details className="consent-detalle"><summary>Ver detalle</summary><p>{marketingConsentText}</p></details>
              </div>}
              {!isSurvey && design.networkConsentEnabled === 'true' && <div className="public-consent public-marketing-consent">
                <label><input type="checkbox" checked={networkConsent} onChange={(event) => setNetworkConsent(event.target.checked)} /><span><strong>Recordar mis datos en los locales de {networkBrand} <small>(opcional)</small></strong></span></label>
                <details className="consent-detalle"><summary>Ver qué se comparte</summary><p>{networkConsentText}</p></details>
              </div>}
              {/* La medición ya respondida al entrar no se vuelve a preguntar: se muestra y se puede cambiar. */}
              {(form.pixelId || form.ga4MeasurementId || isSurvey) && (eleccionMedicion !== '' && !isSurvey
                ? <EnlacePreferenciasDeMedicion aceptada={measurementConsent} onAbrir={() => setAvisoMedicionAbierto(true)} />
                : <div className="public-consent public-marketing-consent">
                  <label><input type="checkbox" checked={measurementConsent} onChange={(event) => setMeasurementConsent(event.target.checked)} /><span><strong>{isSurvey ? 'Ayudar a medir esta encuesta' : 'Medición publicitaria (Meta y Google)'} <small>(opcional)</small></strong></span></label>
                  <details className="consent-detalle"><summary>Ver detalle</summary><p>{TEXTO_MEDICION}</p><p className="consent-enlaces"><a href={rutaDocumentoLegal('medicion')} target="_blank" rel="noopener">Medición y cookies</a></p></details>
                </div>)}
            </section>
            {documentoLegal && <DialogoModal etiqueta={documentoLegal.titulo} className="documento-legal" onCerrar={() => setDocumentoLegal(null)}>
              <section data-retiene-toque>
                <header><h2>{documentoLegal.titulo}</h2><button type="button" className="btn btn-outline btn-sm" onClick={() => setDocumentoLegal(null)} autoFocus>Cerrar</button></header>
                <div className="documento-legal-texto">{documentoLegal.texto}</div>
                <small>{responsableLegal}</small>
              </section>
            </DialogoModal>}
          </div>
          <button className="public-submit" type="submit" disabled={submit.isPending}><span>{isSurvey ? (submit.isPending ? 'Enviando...' : 'Enviar') : 'Continuar →'}</span></button>
          {!isSurvey && <button type="button" className="btn btn-outline btn-sm btn-back" onClick={() => { if (requestMode) { volverAReservar(); } else goBackToSlots(); }}>← {requestMode ? 'Volver a reservar' : 'Personas y fecha'}</button>}
          {isSurvey && submit.isError && <div className="alert alert-error"><p>{submit.error instanceof Error ? submit.error.message : 'Error al enviar la respuesta'}</p></div>}
        </div>}

        {step === 3 && <div ref={confirmRef}>
          <div className="booking-step-title"><span>{requestMode ? '02' : '03'}</span><div><strong>{requestMode ? 'Revisa tu solicitud' : 'Confirma tu reserva'}</strong><small>{requestMode ? 'El local te responderá para acordar la fecha. No se toma un horario.' : 'Revisa los datos antes de enviar.'}</small></div></div>
          <div className="booking-confirm-details">
            <div className="confirm-row"><span>{selectedService ? 'Servicio' : 'Local'}</span><strong>{selectedService?.name || form.name}</strong></div>
            {selected && <div className="confirm-row"><span>Fecha y hora</span><strong>{new Date(selected).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: form.timezone })}</strong></div>}
            {/* Una solicitud no tiene hora tomada: lo que hay que revisar es lo que pidió. */}
            <div className="confirm-row"><span>Personas</span><strong>{requestMode ? Math.max(groupThreshold + 1, guest.partySize) : guest.partySize}</strong></div>
            {requestMode && <div className="confirm-row"><span>Ocasión</span><strong>{ocasionElegida || groupEventType || ({ cumpleanos: 'Cumpleaños', aniversario: 'Aniversario o celebración', empresa: 'Comida o evento de empresa', otro: 'Otro grupo' } as Record<string, string>)[tipoDeEvento] || 'Sin indicar'}</strong></div>}
            {requestMode && (requestPreference.date || requestPreference.time) && <div className="confirm-row"><span>Preferencia</span><strong>{[requestPreference.date, requestPreference.time].filter(Boolean).join(' · ')}</strong></div>}
            <div className="confirm-row"><span>Nombre</span><strong>{guest.guestName}</strong></div>
            {guest.guestPhone && <div className="confirm-row"><span>Teléfono</span><strong>{guest.guestPhone}</strong></div>}
            {guest.guestEmail && <div className="confirm-row"><span>Correo</span><strong>{guest.guestEmail}</strong></div>}
            {customFields.filter((f) => f.type !== 'consent' && textoDeRespuesta(f, answers[f.id]) !== '' && !(requestMode && f.id === preguntaDeOcasiones?.id)).map((f) => <div className="confirm-row" key={f.id}><span>{f.label}</span><strong>{textoDeRespuesta(f, answers[f.id])}</strong></div>)}
          </div>
          <button className="public-submit" type="submit" disabled={submit.isPending}>{submit.isPending ? 'Enviando...' : requestMode ? 'Enviar solicitud' : 'Confirmar reserva'}</button>
          {/* La lista de espera guarda un cupo concreto: no tiene sentido para una solicitud sin horario. */}
          {submit.isError && <div className="alert alert-error"><p>{submit.error instanceof Error ? submit.error.message : requestMode ? 'Error al enviar la solicitud' : 'Error al crear la reserva'}</p>{!requestMode && /cupo|tope|ocup/i.test(submit.error instanceof Error ? submit.error.message : '') && <button type="button" className="btn btn-primary btn-sm" disabled={waitlist.isPending} onClick={() => waitlist.mutate()}>{waitlist.isPending ? 'Guardando...' : 'Unirme a la lista de espera'}</button>}<button type="button" className="btn btn-outline btn-sm" onClick={retrySubmit}>Intentar de nuevo</button>{waitlist.error && <p>{waitlist.error instanceof Error && waitlist.error.message ? waitlist.error.message : 'No se pudo registrar la espera. Revisa los datos e inténtalo nuevamente.'}</p>}</div>}
          <button type="button" className="btn btn-outline btn-sm btn-back" onClick={() => setStep(2)}>← Volver</button>
        </div>}
      </form>
      <PieLegal />
    </div>
  </main>;
}

/**
 * Enlaces legales de la reserva. Siempre hay política del local y documentos de Espartanos:
 *
 * - Política del local: la suya (enlace o texto) o, si no publicó una, la generada con sus datos
 *   reales. Sin datos legales completos no se genera: el formulario tampoco se puede publicar.
 * - Condiciones: las del local si las tiene; siempre las de uso de la plataforma.
 */
function EnlacesLegales({ design, identidad, onAbrir }: { design: Record<string, unknown>; identidad: IdentidadLegal; onAbrir: (documento: { titulo: string; texto: string }) => void }) {
  const enTexto = design.legalMode === 'texto';
  const propio = (url: unknown, texto: unknown) => (enTexto ? (typeof texto === 'string' && texto.trim() ? { texto } : null) : (typeof url === 'string' && url ? { url } : null));
  const privacidad = propio(design.privacyUrl, design.privacyText);
  const condiciones = propio(design.termsUrl, design.termsText);
  const generada = !privacidad && faltantesDeIdentidadLegal(identidad).length === 0 ? politicaDePrivacidadDelLocal(identidad) : null;
  const enlace = (titulo: string, doc: { url?: unknown; texto?: unknown }) => (doc.url
    ? <a href={safeUrl(String(doc.url))} target="_blank" rel="noreferrer">{titulo}</a>
    : <button type="button" className="enlace" onClick={() => onAbrir({ titulo, texto: String(doc.texto) })}>{titulo}</button>);
  return <p className="consent-enlaces">
    {privacidad && enlace('Privacidad del local', privacidad)}
    {generada && <button type="button" className="enlace" onClick={() => onAbrir({ titulo: generada.titulo, texto: documentoATexto(generada) })}>Privacidad del local</button>}
    {condiciones && <>{' · '}{enlace('Condiciones del local', condiciones)}</>}
    {(privacidad || generada || condiciones) && ' · '}
    <a href={rutaDocumentoLegal('terminos')} target="_blank" rel="noopener">Condiciones de uso</a>{' · '}
    <a href={rutaDocumentoLegal('privacidad')} target="_blank" rel="noopener">Privacidad de Espartanos</a>
  </p>;
}

/** Cómo se lee una respuesta en la confirmación: listas separadas por coma y fechas en palabras. */
function textoDeRespuesta(field: FormField, valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '';
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if ((field.type === 'date' || field.type === 'birthdate') && /^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  return String(valor);
}

/** Tipo de evento que espera el servidor, a partir de la ocasión elegida en la pregunta conectada. */
function tipoDeEventoDesde(valor: unknown): string {
  const texto = String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (texto.includes('cumple')) return 'cumpleanos';
  if (texto.includes('aniversario') || texto.includes('matrimonio') || texto.includes('boda')) return 'aniversario';
  if (texto.includes('empresa') || texto.includes('corporativ') || texto.includes('after')) return 'empresa';
  return 'otro';
}

function renderField(field: FormField, value: unknown, onChange: (v: string | boolean | string[]) => void, error?: string) {
  if (field.type === 'coupon') return null;
  const errorId = `error-${field.id}`;
  /*
   * Selección múltiple: el constructor la ofrecía y la página no la pintaba.
   *
   * Caía en el campo de texto del final, así que se enviaba una cadena donde el servidor espera
   * una lista de opciones válidas y rechazaba la reserva entera con «Respuesta inválida». Es
   * decir: agregar este campo rompía el formulario en vez de agregar una pregunta.
   */
  if (field.type === 'multi_select') {
    const elegidas = Array.isArray(value) ? (value as string[]) : [];
    return <fieldset className={`public-multi ${error ? 'has-error' : ''}`} aria-describedby={error ? errorId : undefined}>
      <legend>{field.label}{field.required && <span className="required-star"> *</span>}</legend>
      {(field.options || []).map((opcion) => <label key={opcion}>
        <input
          type="checkbox"
          checked={elegidas.includes(opcion)}
          onChange={(evento) => onChange(evento.target.checked ? [...elegidas, opcion] : elegidas.filter((actual) => actual !== opcion))}
        />
        {opcion}
      </label>)}
      {error && <small className="field-error" id={errorId}>{error}</small>}
    </fieldset>;
  }
  if (field.type === 'consent') return <div className={`public-consent ${error ? 'has-error' : ''}`}><label><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /><span>{field.label}{field.required && <span className="required-star"> *</span>}</span></label>{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</div>;
  if (field.type === 'rating') return <fieldset className={`public-radio-group public-rating ${error ? 'has-error' : ''}`}><legend>{field.label}{field.required && <span className="required-star"> *</span>}</legend>{[1, 2, 3, 4, 5].map((rating) => <label key={rating}><input type="radio" name={field.id} required={field.required} checked={String(value || '') === String(rating)} onChange={() => onChange(String(rating))} /> <span>{rating}</span></label>)}{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</fieldset>;
  if (field.type === 'select' && (field.display === 'radio' || (field.options?.length || 0) <= 5)) return <fieldset className={`public-radio-group ${error ? 'has-error' : ''}`}><legend>{field.label}{field.required && <span className="required-star"> *</span>}</legend>{field.options?.map((option) => <label key={option}><input type="radio" name={field.id} required={field.required} checked={String(value || '') === option} onChange={() => onChange(option)} /> <span>{option}</span></label>)}{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</fieldset>;
  if (field.type === 'select') return <label>{field.label}{field.required && <span className="required-star"> *</span>}<select className={error ? 'input-error' : ''} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}><option value="">Selecciona</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</label>;
  if (field.type === 'rut') return <div className={`public-field ${error ? 'has-error' : ''}`}><label>{field.label} {field.required ? <span className="required-star">*</span> : <small>(opcional)</small>}<input className={error ? 'input-error' : ''} inputMode="text" autoComplete="off" maxLength={12} placeholder={field.placeholder || '12.345.678-9'} value={String(value || '')} onChange={(event) => onChange(event.target.value.replace(/[^0-9kK.\-]/g, ''))} onBlur={(event) => { if (rutValido(event.target.value)) onChange(formatearRut(event.target.value)); }} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></label>{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</div>;
  if (field.type === 'textarea') return <label>{field.label}{field.required && <span className="required-star"> *</span>}<textarea className={error ? 'input-error' : ''} required={field.required} value={String(value || '')} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</label>;
  return <div className={`public-field ${error ? 'has-error' : ''}`}><label>{field.label} {field.required ? <span className="required-star">*</span> : null}<input className={error ? 'input-error' : ''} type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' || field.type === 'birthdate' ? 'date' : field.type === 'number' ? 'number' : 'text'} required={field.required} placeholder={field.placeholder} value={String(value || '')} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></label>{error && <span className="field-error" id={errorId} role="alert">{error}</span>}</div>;
}

/**
 * Segunda oportunidad de aceptar beneficios, en la pantalla de éxito: el mismo permiso y texto de
 * la casilla, sin condicionar nada, con un toque.
 */
function OfertaDeBeneficios({ token, texto, nombre }: { token: string; texto: string; nombre: string }) {
  const aceptar = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${encodeURIComponent(token)}/beneficios`, {}) });
  if (aceptar.isSuccess) return <div className="oferta-beneficios is-lista" role="status"><strong>¡Listo!</strong><span>Te avisaremos de beneficios y novedades de {nombre}.</span></div>;
  return <div className="oferta-beneficios">
    <div><strong>¿Quieres beneficios de {nombre}?</strong><span>Promociones, beneficios de cumpleaños y eventos, cuando el local los ofrezca.</span></div>
    <button type="button" className="btn btn-primary btn-sm" disabled={aceptar.isPending} onClick={() => aceptar.mutate()}>{aceptar.isPending ? 'Guardando…' : 'Sí, quiero beneficios'}</button>
    <details className="consent-detalle"><summary>Qué acepto</summary><p>{texto}</p></details>
    {aceptar.isError && <small className="error-text">No se pudo guardar. Inténtalo de nuevo.</small>}
  </div>;
}
