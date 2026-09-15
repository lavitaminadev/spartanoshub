import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { CATEGORIAS_DE_EVENTO, leerTiposDeEvento, type CategoriaDeEvento } from './tipos-de-evento';
import { SaludDeMedicion } from './SaludDeMedicion';
import { SelectorDeDegradado, leerDegradado } from '../../shared/SelectorDeDegradado';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { triggerToast } from '../../shared/toast-events';
import { ImageUpload } from '../../shared/ImageUpload';
import type { DesignConfig, FormField, ReservationForm } from './types';
import { localDateBoundsUtc, localInputToUtc, plainDateInZone, utcToLocalInput } from './local-time';
import { contrastText, normalizeHexColor } from '../../shared/color-contrast';
import { VitaIcons } from '../../shared/Icons';
import { publicReservationUrl } from '../../core/public-url';
import { imageOverlayAlpha, leerOcasiones, safeDesignChoice, safeNumber, uuid, visible } from './booking-utils';
import { safeUrl } from '../../core/safe-url';
import { camposVisibles } from '@espartanos/shared';

const FIELD_LIBRARY = [
  ['text', 'Texto corto'], ['textarea', 'Texto largo'], ['email', 'Correo'],
  ['phone', 'Teléfono'], ['rut', 'RUT'], ['select', 'Elegir una opción'], ['multi_select', 'Elegir varias opciones'],
  ['number', 'Número'], ['date', 'Fecha'], ['consent', 'Casilla para confirmar'],
  ['rating', 'Calificación'], ['coupon', 'Cupón promocional'],
] as const;

/** Qué hace cada campo, en palabras de quien arma el formulario. */
const FIELD_HINTS: Record<string, string> = {
  text: 'Una línea: nombre de empresa, patente…', textarea: 'Un comentario o detalle largo',
  email: 'Ayuda a medir campañas', phone: 'Ayuda a medir campañas', rut: 'Con dígito verificador; opcional',
  select: 'Botones o lista: marca sólo una', multi_select: 'Casillas: puede marcar varias',
  number: 'Sólo números', date: 'Calendario para elegir un día', consent: 'Obligatoria al agregarla',
};
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Campos que caben en el formulario sin salirse del alcance acordado.
 *
 * El alcance pide lo mínimo —nombre, teléfono, correo opcional y número de personas— más
 * el consentimiento; la fecha y la hora las aporta la agenda. Pasado ese número se avisa,
 * pero no se bloquea: hay clientes con una necesidad puntual que lo justifica.
 */
const RECOMMENDED_FIELD_COUNT = 5;
const STEPS = ['Lo esencial', 'Disponibilidad', 'Diseño público', 'Medición opcional', 'Datos y textos legales', 'Publicar'];
const STEP_BY_SECTION: Record<string, number> = { esencial: 0, disponibilidad: 1, diseno: 2, medicion: 3, ajustes: 4, publicar: 5 };
/** Pasos que ve cada quien: la medición la lleva la agencia, no la empresa dueña del local. */
const PASOS_VISIBLES: { equipo: number[]; cliente: number[] } = { equipo: [0, 1, 2, 3, 4, 5], cliente: [0, 1, 2, 4, 5] };
const TIMEZONES = (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') ? Intl.supportedValuesOf('timeZone').filter((tz: string) => tz.includes('America') || tz.includes('Europe/Madrid') || tz.includes('Atlantic')) : ['America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid'];
const DESIGN_TEMPLATES: Array<{ name: string; config: Record<string, string> }> = [
  { name: 'Espartano', config: { primaryColor: '#0ec6b8', accentColor: '#ea0f63', backgroundColor: '#f4f5f7', textColor: '#0b0b0c', fontFamily: 'system-ui', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f4f5f7 0%, #d8f3f0 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10' } },
  { name: 'Editorial', config: { primaryColor: '#222222', accentColor: '#c56d3d', backgroundColor: '#f4eee5', textColor: '#37332f', fontFamily: 'Georgia, serif', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(145deg, #f4eee5 0%, #e5d3bf 100%)', backgroundOpacity: '84', backgroundPosition: 'center', buttonRadius: '4', fieldRadius: '4' } },
  { name: 'Energía', config: { primaryColor: '#40205f', accentColor: '#ff4f87', backgroundColor: '#f8f2ff', textColor: '#332541', fontFamily: 'Inter, sans-serif', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #fff0f6 0%, #eee5ff 100%)', backgroundOpacity: '82', backgroundPosition: 'center', buttonRadius: '999', fieldRadius: '16' } },
  { name: 'Minimal', config: { primaryColor: '#151317', accentColor: '#ec0b61', backgroundColor: '#f6f4f5', textColor: '#151317', fontFamily: 'system-ui', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f6f4f5 0%, #ffffff 100%)', backgroundOpacity: '90', backgroundPosition: 'center', buttonRadius: '8', fieldRadius: '8' } },
  { name: 'Cuartel', config: { primaryColor: '#087e79', accentColor: '#b90749', backgroundColor: '#f6f4f5', textColor: '#151317', fontFamily: "'Espartano Sans', system-ui, sans-serif", backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #e9fbf9 0%, #fff0f6 100%)', backgroundOpacity: '86', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '12' } },
  { name: 'Noche', config: { primaryColor: '#0fb9b1', accentColor: '#ec0b61', backgroundColor: '#171417', textColor: '#ffffff', fontFamily: 'system-ui', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(145deg, #151317 0%, #30272c 100%)', backgroundOpacity: '92', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10' } },
];
/** Lo que Meta usa para reconocer a la persona. Nombre ya viene fijo en el formulario. */
// Correo y teléfono son los datos con que Meta empareja a quien reserva. La casilla libre no mide
// nada: la medición la da la aceptación fija del bloque de aceptaciones.
const RECOMMENDED_FIELDS = new Set(['phone', 'email']);
/** Un distintivo por tipo: con las dos primeras letras, texto corto, texto largo y teléfono decían «TE». */
const FIELD_BADGES: Record<string, string> = { text: 'Aa', textarea: '¶', email: '@', phone: 'Tel', rut: 'RUT', select: '◉', multi_select: '☰', number: '123', date: 'Día', consent: '✓', rating: '★', coupon: '%' };
const DURACIONES = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const DEFAULT_BACKGROUND_GRADIENT = 'linear-gradient(135deg, #f4f5f7 0%, #d8f3f0 100%)';
const BACKGROUND_POSITIONS = [
  ['left top', 'Arriba izquierda'], ['center top', 'Arriba centro'], ['right top', 'Arriba derecha'],
  ['left center', 'Centro izquierda'], ['center center', 'Centro'], ['right center', 'Centro derecha'],
  ['left bottom', 'Abajo izquierda'], ['center bottom', 'Abajo centro'], ['right bottom', 'Abajo derecha'],
] as const;
const BACKGROUND_SIZES = [['cover', 'Cubrir pantalla'], ['contain', 'Mostrar completa'], ['auto', 'Tamaño original']] as const;
const LAYOUT_POSITIONS = [['right', 'Formulario derecha'], ['center', 'Formulario centro'], ['left', 'Formulario izquierda']] as const;
const LOGO_POSITIONS = [['left', 'Logo izquierda'], ['center', 'Logo centro'], ['right', 'Logo derecha']] as const;
const NEW_FIELD_TRANSFER = 'application/x-espartanos-new-field';
const EXISTING_FIELD_TRANSFER = 'application/x-espartanos-field';

/**
 * Los navegadores no tratan igual los tipos personalizados de DataTransfer. Guardamos además
 * una copia con text/plain para que el constructor funcione en Chrome, Safari y controles web
 * embebidos, sin confundir un campo nuevo con uno que se está reordenando.
 */
function beginNewFieldDrag(event: DragEvent<HTMLElement>, type: string) {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(NEW_FIELD_TRANSFER, type);
  event.dataTransfer.setData('text/plain', `new-field:${type}`);
}

function beginExistingFieldDrag(event: DragEvent<HTMLElement>, fieldId: string) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(EXISTING_FIELD_TRANSFER, fieldId);
  event.dataTransfer.setData('text/plain', `field:${fieldId}`);
}

export function builderDragPayload(event: Pick<DragEvent<HTMLElement>, 'dataTransfer'>) {
  const plain = event.dataTransfer.getData('text/plain');
  const newField = event.dataTransfer.getData(NEW_FIELD_TRANSFER) || (plain.startsWith('new-field:') ? plain.slice('new-field:'.length) : '');
  const fieldId = event.dataTransfer.getData(EXISTING_FIELD_TRANSFER) || (plain.startsWith('field:') ? plain.slice('field:'.length) : '');
  return { newField, fieldId };
}

function isSurveyMode(mode?: string) {
  return mode === 'survey' || mode === 'request';
}

/** El enlace que se comparte es siempre estable y corto. La campaña se guarda en el local. */
function campaignReservationUrl(form: ReservationForm, baseUrl = publicReservationUrl(form.publicSlug, form.publicUrl)): string {
  void form;
  return baseUrl;
}

function reservationDesignStyle(design: DesignConfig): CSSProperties {
  const primary = normalizeHexColor(design.primaryColor, '#0ec6b8');
  const accent = normalizeHexColor(design.accentColor, '#ea0f63');
  const background = normalizeHexColor(design.backgroundColor, '#f6f4f5');
  const backgroundOpacity = imageOverlayAlpha(design.backgroundOpacity);
  const backgroundImage = design.backgroundMode === 'gradient'
    ? design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT
    : (design.backgroundMode === 'image' || !design.backgroundMode) && design.backgroundImage
      ? `linear-gradient(rgba(243,245,239,${backgroundOpacity}),rgba(243,245,239,${backgroundOpacity})),url(${design.backgroundImage})`
      : undefined;
  return {
    '--booking-primary': primary,
    '--booking-primary-contrast': contrastText(primary),
    '--booking-primary-text': accessiblePreviewForeground(primary, background, '#0ec6b8'),
    '--booking-primary-page-text': accessiblePreviewForeground(primary, background, '#0ec6b8'),
    '--booking-accent': accent,
    '--booking-accent-contrast': contrastText(accent),
    '--booking-accent-text': accessiblePreviewForeground(accent, background, '#9f3e26'),
    '--booking-bg': background,
    '--booking-text': design.textColor || '#3f4e49',
    '--booking-card-ink': accessiblePreviewForeground(design.textColor || '#3f4e49', '#ffffff', '#1c1a1d'),
    '--booking-font': design.fontFamily || 'system-ui',
    '--booking-button-radius': `${design.buttonRadius || '12'}px`,
    '--booking-field-radius': `${design.fieldRadius || '10'}px`,
    '--booking-logo-size': `${safeNumber(design.logoSize, 96, 32, 240)}px`,
    '--booking-title-size': `${safeNumber(design.titleSize, 72, 32, 96)}px`,
    '--booking-welcome-size': `${safeNumber(design.welcomeSize, 16, 12, 24)}px`,
    color: design.textColor || '#3f4e49',
    fontFamily: design.fontFamily || 'system-ui',
    backgroundColor: background,
    backgroundImage,
    '--booking-logo-align': safeDesignChoice(design.logoPosition, ['left', 'center', 'right'], 'left'),
    backgroundPosition: design.backgroundAnchor || design.backgroundPosition || 'center center',
    backgroundSize: safeDesignChoice(design.backgroundSize, ['cover', 'contain', 'auto'], 'cover'),
  } as CSSProperties;
}

function accessiblePreviewForeground(color: string, background: string, fallback: string) {
  return contrastText(background) === '#ffffff' ? '#ffffff' : color || fallback;
}

function updatePayload(form: Partial<ReservationForm>): Partial<ReservationForm> {
  const payload: Partial<ReservationForm> = {
    name: form.name, status: form.status, timezone: form.timezone,
    durationMinutes: form.durationMinutes, bufferMinutes: form.bufferMinutes,
    dailyCapacity: form.dailyCapacity,
    capacityPerSlot: form.capacityPerSlot, minimumNoticeHours: form.minimumNoticeHours,
    maximumAdvanceDays: form.maximumAdvanceDays, confirmationMode: form.confirmationMode,
    fieldSchema: form.fieldSchema, designConfig: form.designConfig,
    scheduleConfig: form.scheduleConfig, servicesConfig: form.servicesConfig,
    campaignId: form.campaignId,
    // `resourcesConfig`, `calendarEnabled` y `teamNotifications` los edita «Ajustes especiales».
    // Enviarlos desde aqui sin editarlos revertia lo guardado alli cuando ambas pantallas
    // estaban abiertas: gana la ultima en guardar, y esta mandaba su copia vieja.
    metaCapiEnabled: form.metaCapiEnabled,
    ga4MeasurementId: form.ga4MeasurementId,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)) as Partial<ReservationForm>;
}

export function ReservationBuilderPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navegar = useNavigate();
  const { user } = useAuth();
  const clientMode = user?.role === 'client';
  const qc = useQueryClient();
  const requestedStep = STEP_BY_SECTION[new URLSearchParams(location.search).get('section') || ''];
  const [step, setStep] = useState(clientMode && requestedStep === 3 ? 4 : requestedStep ?? 0);
  const [draft, setDraft] = useState<ReservationForm | null>(null);
  /*
   * Un enlace directo apunta a un bloque concreto —«Zonas y sectores», por ejemplo—, y el paso
   * puede ser largo. El ancla se resuelve cuando el borrador ya pintó el bloque; antes no existe.
   */
  useEffect(() => {
    const ancla = location.hash.replace('#', '');
    if (!ancla || !draft) return;
    const id = window.setTimeout(() => document.getElementById(ancla)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => window.clearTimeout(id);
  }, [draft, location.hash]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  const [block, setBlock] = useState({ startsAt: '', endsAt: '', reason: '' });
  const [blockRepeat, setBlockRepeat] = useState(1);
  const [blockMonth, setBlockMonth] = useState(0);
  /** Cambiar la zona horaria mueve lo ya publicado: se pide a propósito, no de pasada. */
  const [cambiandoZona, setCambiandoZona] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingDraft, setEditingDraft] = useState<FormField | null>(null);
  /** Texto crudo de las opciones: se parsea al escribir, pero el cuadro conserva líneas nuevas y espacios. */
  const [opcionesTexto, setOpcionesTexto] = useState('');
  const openEditor = (field: FormField) => { setEditingField(field); setEditingDraft({ ...field }); setOpcionesTexto((field.options ?? []).join('\n')); };
  const closeEditor = (save: boolean) => {
    if (save && editingDraft) {
      change({ fieldSchema: sincronizarPreguntaDeOcasiones(draft?.designConfig || {}, fields.map((f) => f.id === editingField?.id ? editingDraft : f)) });
    }
    setEditingField(null); setEditingDraft(null);
  };
  const updateEditor = (patch: Partial<FormField>) => { if (editingDraft) setEditingDraft({ ...editingDraft, ...patch }); };
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ReservationForm>({ queryKey: ['reservation-form', id], queryFn: () => api.get(`/reservations/forms/${id}`) });
  const { data: blocks = [] } = useQuery<Array<{ id: string; startsAt: string; endsAt: string; reason?: string }>>({ queryKey: ['reservation-blocks', id], queryFn: () => api.get(`/reservations/forms/${id}/blocks`) });
  // El servidor manda solo mientras no haya cambios sin guardar. React Query vuelve a pedir el
  // formulario al regresar a la pestana, y pisar el borrador ahi borraba lo que la persona
  // estaba editando sin avisarle.
  useEffect(() => { if (data && saved) setDraft(data); }, [data, saved]);
  useEffect(() => { if (requestedStep !== undefined) setStep(clientMode && requestedStep === 3 ? 4 : requestedStep); }, [clientMode, requestedStep]);
  useEffect(() => {
    if (saved) return undefined;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [saved]);
  const copyTimeoutRef = useRef<number>(0);
  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);
  const change = useCallback((patch: Partial<ReservationForm>) => { setDraft((current) => (current ? { ...current, ...patch } : current)); setSaved(false); }, []);
  const publicUrl = useMemo(() => draft ? publicReservationUrl(draft.publicSlug, draft.publicUrl) : '', [draft]);
  const campaignUrl = useMemo(() => draft ? campaignReservationUrl(draft, publicUrl) : '', [draft, publicUrl]);
  const safeCampaignUrl = safeUrl(campaignUrl);
  const designPreviewStyle = useMemo(() => reservationDesignStyle(draft?.designConfig || {}), [draft?.designConfig]);

  const saveMutation = useMutation({
    mutationFn: (body: Partial<ReservationForm>) => api.patch<ReservationForm>(`/reservations/forms/${id}`, updatePayload(body)),
    onSuccess: (next) => { setDraft(next); setSaved(true); qc.setQueryData(['reservation-form', id], next); qc.setQueryData(['reservation-local', id], next); void qc.invalidateQueries({ queryKey: ['reservation-forms'] }); void qc.invalidateQueries({ queryKey: ['reservation-locals'] }); triggerToast(isSurveyMode(next.mode) ? 'Encuesta guardada' : 'Configuración de la sucursal guardada'); },
  });
  const saveDesignAsset = useCallback((key: 'logoUrl' | 'backgroundImage', url: string) => {
    if (!draft) return;
    const designConfig = key === 'backgroundImage' && url
      ? { ...draft.designConfig, [key]: url, backgroundMode: 'image' }
      : key === 'logoUrl' && url
        ? { ...draft.designConfig, [key]: url, showLogo: 'true' }
        : { ...draft.designConfig, [key]: url };
    change({ designConfig });
    saveMutation.mutate({ ...draft, designConfig });
  }, [change, draft, saveMutation]);
  const blockMutation = useMutation({
    mutationFn: (body: { startsAt: string; endsAt: string; reason?: string }) => api.post(`/reservations/forms/${id}/blocks`, { ...body, startsAt: localInputToUtc(body.startsAt, draft?.timezone || 'America/Santiago'), endsAt: localInputToUtc(body.endsAt, draft?.timezone || 'America/Santiago') }),
    onSuccess: () => { setBlock({ startsAt: '', endsAt: '', reason: '' }); setBlockRepeat(1); qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); triggerToast('Bloqueo agregado'); },
  });
  const batchBlockMutation = useMutation({
    mutationFn: async (body: { startsAt: string; endsAt: string; reason?: string; repeat: number }) => {
      const tz = draft?.timezone || 'America/Santiago';
      const addWeeks = (localStr: string, weeks: number) => {
        const date = new Date(localStr + 'T00:00:00');
        date.setDate(date.getDate() + weeks * 7);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const time = localStr.slice(11, 16);
        return `${y}-${m}-${d}T${time}`;
      };
      const dtos = Array.from({ length: body.repeat }, (_, index) => {
        const s = addWeeks(body.startsAt, index);
        const e = addWeeks(body.endsAt, index);
        return { startsAt: localInputToUtc(s, tz), endsAt: localInputToUtc(e, tz), reason: body.reason };
      });
      return api.post(`/reservations/forms/${id}/blocks/batch`, dtos);
    },
    onSuccess: () => { setBlock({ startsAt: '', endsAt: '', reason: '' }); setBlockRepeat(1); qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); },
  });
  const timezone = draft?.timezone || 'America/Santiago';
  /**
   * Reparte los bloqueos existentes por fecha local del formulario.
   *
   * `closed` guarda el bloqueo que cubre el día entero, que es el que se puede quitar
   * tocando el día. `partial` marca los días con cierres de solo algunas horas, que se
   * señalan pero se administran desde la lista.
   */
  const blocksByDate = useMemo(() => {
    const closed = new Map<string, string>();
    const partial = new Set<string>();
    for (const item of blocks) {
      const start = new Date(item.startsAt);
      const end = new Date(item.endsAt);
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const key = plainDateInZone(cursor, timezone);
        const inicioDia = new Date(localInputToUtc(`${key}T00:00`, timezone));
        const ultimoMinuto = new Date(localInputToUtc(`${key}T23:59`, timezone));
        const finDia = new Date(localDateBoundsUtc(key, timezone).to);
        // Un bloqueo que termina justo al empezar el día no cierra nada en él. Sin esta salida,
        // uno escrito con fin exclusivo pintaba el día siguiente como si tuviera horas cerradas.
        if (end <= inicioDia || start > finDia) continue;
        if (start <= inicioDia && end >= ultimoMinuto) closed.set(key, item.id);
        else partial.add(key);
      }
    }
    return { closed, partial };
  }, [blocks, timezone]);

  /**
   * Rejilla del mes visible, alineada a semanas que empiezan en lunes.
   *
   * El mes arranca en el del local, no en el del servidor ni en UTC: de noche en Chile la fecha
   * UTC ya es la del día siguiente, y con ella el calendario abría en el mes que viene sin dejar
   * volver al actual.
   */
  const blockCalendar = useMemo(() => {
    const hoy = plainDateInZone(new Date(), timezone);
    const [anoActual, mesActual] = hoy.split('-').map(Number);
    const anchor = new Date(Date.UTC(anoActual, mesActual - 1 + blockMonth, 1));
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leading = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const cells: Array<{ key: string; day: number } | null> = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, day });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: typeof cells[] = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    return { label: anchor.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }), weeks, hoy };
  }, [blockMonth, timezone]);

  /** Cierra el día si está abierto; si ya estaba cerrado por completo, pide confirmar el retiro. */
  const toggleDayClosed = (dateKey: string) => {
    const existing = blocksByDate.closed.get(dateKey);
    if (existing) { setConfirmDeleteBlock(existing); return; }
    blockMutation.mutate({ startsAt: `${dateKey}T00:00`, endsAt: `${dateKey}T23:59`, reason: 'Cierre de día completo' });
  };
  /*
   * Los ajustes que antes vivían en una pantalla aparte.
   *
   * Eran la misma configuración de la misma sucursal en dos direcciones distintas, cada una con
   * su propio borrador y su propio botón de guardar: se podía editar en las dos y perder una.
   * Ahora son un paso más del recorrido y comparten el borrador, así que solo hay un «Guardar».
   */
  const cambiarAjuste = (clave: string, valor: string) => change({ designConfig: { ...draft?.designConfig, [clave]: valor } });
  /** Desde cuántas personas es grupo: el mismo cálculo que usa la página pública. */
  const umbralDeGrupo = Math.max(2, Math.min(100, Number(draft?.designConfig?.groupThreshold) || 8));
  /** Datos legales propios de la sucursal: si alguno está escrito, se muestran para editar. */
  const [usaDatosPropios, setUsaDatosPropios] = useState<boolean | null>(null);
  const zones = draft?.resourcesConfig ?? [];
  const setZones = (next: NonNullable<ReservationForm['resourcesConfig']>) => change({ resourcesConfig: next });
  const updateZone = (index: number, patch: Partial<NonNullable<ReservationForm['resourcesConfig']>[number]>) => setZones(zones.map((zone, current) => (current === index ? { ...zone, ...patch } : zone)));
  const addZone = () => setZones([...zones, { id: `zona-${Date.now()}`, name: '', capacity: draft?.capacityPerSlot ?? 1, description: '', smokingAllowed: false }]);
  const teamEmails = (draft?.teamNotifications || []).join(', ');
  /** No hay hora posible cuando lo más temprano reservable cae después de lo más lejano. */
  const ventanaImposible = draft !== null && draft.minimumNoticeHours > draft.maximumAdvanceDays * 24;
  /** La pausa se escribe en la zona del local: una hora que no existe allí se rechaza al guardar. */
  /*
   * La pausa se guarda al momento y por su propia ruta: no espera al «Guardar» del editor ni
   * viaja con él, así una pausa puesta desde «Hoy» no se pierde al guardar otra cosa aquí.
   */
  const pausaMutation = useMutation({
    mutationFn: (until: string) => api.patch<ReservationForm>(`/reservations/forms/${id}/pause`, { until }),
    onSuccess: (next) => {
      setDraft((current) => (current ? { ...current, designConfig: { ...current.designConfig, bookingPausedUntil: next.designConfig?.bookingPausedUntil } } : current));
      qc.setQueryData(['reservation-form', id], next);
      void qc.invalidateQueries({ queryKey: ['agenda-forms'] });
      triggerToast(next.designConfig?.bookingPausedUntil ? 'Reservas pausadas' : 'Pausa quitada');
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo cambiar la pausa', 'error'),
  });
  const setBookingPause = (valor: string) => {
    if (!valor) { pausaMutation.mutate(''); return; }
    try { pausaMutation.mutate(localInputToUtc(valor, draft?.timezone || 'America/Santiago')); }
    catch { triggerToast('Selecciona una hora válida para la zona de la sucursal.', 'error'); }
  };

  const deleteBlock = useMutation({ mutationFn: (blockId: string) => api.delete(`/reservations/blocks/${blockId}`), onError: (error: Error) => triggerToast(error.message || 'No se pudo quitar el bloqueo', 'error'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); triggerToast('Bloqueo eliminado'); } });

  if (isLoading || !draft) return <LoadingSpinner text="Abriendo constructor del flujo..." />;
  const fields = draft.fieldSchema || [];
  // Un formulario guardado antes de que existiera la personalización no trae `designConfig`, y
  // leer una propiedad suya sin proteger tumbaba el constructor entero en vez de abrirlo con
  // los valores por defecto.
  const design = draft.designConfig || {};
  const windows = draft.scheduleConfig?.windows || [];
  const diasHabilitados = new Set(windows.map((window) => window.day)).size;
  const surveyMode = isSurveyMode(draft.mode);
  const flowLabel = surveyMode ? 'encuesta post-visita' : 'formulario de reserva';
  const fieldLibrary = FIELD_LIBRARY.filter(([type]) => type !== 'coupon' && (surveyMode || type !== 'rating'));

  const addField = (type: string) => {
    const field: FormField = { id: `field_${uuid().slice(0, 8)}`, type, label: type === 'consent' ? 'Acepto las condiciones de la reserva' : type === 'select' ? '¿Cuál prefieres?' : type === 'multi_select' ? '¿Cuáles prefieres?' : FIELD_LIBRARY.find(([key]) => key === type)?.[1] || 'Campo', required: type === 'consent', ...(type === 'rut' ? { placeholder: '12.345.678-9' } : {}), ...(['select', 'multi_select'].includes(type) ? { options: ['Opción 1', 'Opción 2'] } : {}) };
    change({ fieldSchema: [...fields, field] }); setSelected(field.id);
  };
  const moveField = (fieldId: string, direction: -1 | 1) => {
    const from = fields.findIndex((field) => field.id === fieldId); const to = from + direction;
    if (from < 0 || to < 0 || to >= fields.length) return;
    const next = [...fields]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); change({ fieldSchema: next });
  };
  const reorder = (fromId: string, toId: string) => {
    const from = fields.findIndex((field) => field.id === fromId); const to = fields.findIndex((field) => field.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...fields]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); change({ fieldSchema: next });
  };
  const UI_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0];
  const toggleDay = (uiDay: number) => {
    const jsDay = UI_TO_JS_DAY[uiDay];
    change({ scheduleConfig: { windows: windows.some((window) => window.day === jsDay) ? windows.filter((window) => window.day !== jsDay) : [...windows, { day: jsDay, start: '09:00', end: '18:00' }] } });
  };
  const updateWindow = (index: number, patch: { start?: string; end?: string }) => change({ scheduleConfig: { windows: windows.map((window, current) => current === index ? { ...window, ...patch } : window) } });
  const addWindow = (uiDay: number) => {
    const jsDay = UI_TO_JS_DAY[uiDay];
    change({ scheduleConfig: { windows: [...windows, { day: jsDay, start: '20:00', end: '23:00' }] } });
  };
  const removeWindow = (index: number) => change({ scheduleConfig: { windows: windows.filter((_, current) => current !== index) } });
  const copyLink = async () => { await navigator.clipboard.writeText(campaignUrl); setCopied(true); clearTimeout(copyTimeoutRef.current); copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1800); };
  const publicPreviewReady = draft.status === 'published' && saved;
  const publishedButDirty = draft.status === 'published' && !saved;
  const previewLabel = publicPreviewReady ? 'Vista previa pública' : 'Vista previa interna';
  const openPreview = () => {
    if (publicPreviewReady && safeCampaignUrl) window.open(safeCampaignUrl, '_blank', 'noopener,noreferrer');
    else if (publishedButDirty) savePublishAndPreview();
    else setStep(2);
  };
  function savePublishAndPreview() {
    if (!draft || windows.length === 0) return;
    saveMutation.mutate(
      { ...draft, status: 'published' },
      { onSuccess: (next) => { const nextUrl = safeUrl(campaignReservationUrl(next)); if (nextUrl) window.open(nextUrl, '_blank', 'noopener,noreferrer'); } },
    );
  }

  return <div className="reservation-builder">
    <header className="builder-top">
      <div><Link to={clientMode ? `/portal/reservations/locals/${id}` : `/reservations/locals/${id}`}>← Volver a la sucursal</Link><div><input type="text" autoComplete="off" aria-label={`Nombre del ${flowLabel}`} value={draft.name} disabled={clientMode} onChange={(event) => change({ name: event.target.value })} /><span className={saveMutation.isPending ? 'saving' : saved ? 'saved' : 'unsaved'}>{saveMutation.isPending ? 'Guardando...' : saved ? 'Todos los cambios guardados' : 'Cambios sin guardar'}</span></div></div>
      <div className="builder-top-actions">
        {draft.metaCapiEnabled && <span className="meta-conversion" title="La conversión se enviará cuando exista consentimiento de medición.">CAPI activada</span>}
        <button type="button" className="btn btn-outline btn-sm" onClick={openPreview}>{previewLabel}</button></div>
    </header>
    {saveMutation.error && <div className="builder-error alert alert-error">{saveMutation.error.message}</div>}
    <div className="builder-progress">{(clientMode ? PASOS_VISIBLES.cliente : PASOS_VISIBLES.equipo).map((real, index) => <button className={step === real ? 'active' : step > real ? 'done' : ''} key={STEPS[real]} onClick={() => setStep(real)}><span>{step > real ? '✓' : index + 1}</span>{STEPS[real]}</button>)}</div>

    {step === 0 && <Fragment>
      <div className="builder-grid paso-esencial">
        <div className="field-extras">
          <strong className="field-extras-title">Preguntas de la visita</strong>
          <small className="schedule-nota">Estas preguntas son fijas a propósito: sus respuestas alimentan los avisos de la lista, el correo y la exportación, así que renombrarlas haría que el sistema mostrara una etiqueta y guardara otra cosa. Para cualquier otra pregunta, agrega un campo propio al formulario de aquí al lado.</small>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askChildren === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askChildren: String(event.target.checked) } })} /> Preguntar por niños o silla infantil</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askAccessibility === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askAccessibility: String(event.target.checked) } })} /> Preguntar por accesibilidad <small className="toggle-nota">· dato de salud: se pide autorización expresa</small></label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askAllergies === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askAllergies: String(event.target.checked) } })} /> Preguntar por restricciones alimentarias <small className="toggle-nota">· dato de salud: se pide autorización expresa</small></label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askSmoking === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askSmoking: String(event.target.checked) } })} /> Preguntar si prefiere zona de fumadores{zones.length > 0 && <small className="toggle-nota"> · con zonas, se indica en el sector</small>}</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askSeating === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askSeating: String(event.target.checked) } })} /> Preguntar preferencia de mesa (tranquila, ventana, barra)</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askFirstVisit === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askFirstVisit: String(event.target.checked) } })} /> Preguntar si es su primera visita</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askHowFound === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askHowFound: String(event.target.checked) } })} /> Preguntar cómo nos conoció</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.couponEnabled !== 'false'} onChange={(event) => change({ designConfig: { ...draft.designConfig, couponEnabled: event.target.checked ? 'true' : 'false' } })} /> Aceptar cupones promocionales</label>
        </div>
        <aside className="field-library"><span className="page-eyebrow">BIBLIOTECA DE CAMPOS</span><h3>Agrega campos</h3><p>Arrastra al formulario o usa los botones.</p>
          <div className="field-library-help field-library-meta"><strong>Para que Meta reconozca a quien reserva</strong><small>Teléfono y correo son los datos con que Meta sabe qué anuncio trajo la reserva. Las aceptaciones legales y la de medición ya van incluidas en la página: no hace falta agregarlas.</small></div>{fieldLibrary.map(([type, label]) => <button draggable onDragStart={(event) => beginNewFieldDrag(event, type)} onDragEnd={() => setCanvasDragOver(false)} onClick={() => addField(type)} key={type} className={RECOMMENDED_FIELDS.has(type) ? 'recommended' : ''}><span aria-hidden="true">{FIELD_BADGES[type] ?? label.slice(0, 2)}</span><div><strong>{label}</strong><small>{FIELD_HINTS[type] ?? 'Opcional'}</small></div><em>Agregar</em></button>)}</aside>
        <main className={`builder-canvas ${canvasDragOver ? 'drag-over' : ''}`} onDragEnter={() => setCanvasDragOver(true)} onDragLeave={(event) => { if (event.currentTarget === event.target) setCanvasDragOver(false); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setCanvasDragOver(true); }} onDrop={(event) => { event.preventDefault(); setCanvasDragOver(false); const { newField, fieldId } = builderDragPayload(event); if (newField) { addField(newField); return; } if (fieldId && fields.length > 1) { const current = fields.find((field) => field.id === fieldId); if (current && fields[fields.length - 1]?.id !== fieldId) change({ fieldSchema: [...fields.filter((field) => field.id !== fieldId), current] }); } }}>
          <div className="canvas-intro"><span>FORMULARIO</span><h2>{design.title || draft.name}</h2><p>{design.welcome}</p><small>Arrastra campos o usa los botones de cada fila.</small></div>
          {fields.length > RECOMMENDED_FIELD_COUNT && <div className="canvas-scope-hint" role="status">
            <strong>{fields.length} campos en el formulario</strong>
            <span>El alcance pide lo mínimo: nombre, teléfono, correo opcional y número de personas. La fecha y la hora las resuelve la agenda. Cada campo extra baja la tasa de reserva desde el celular, que es por donde llega casi todo el tráfico de los anuncios.</span>
          </div>}
          {fields.map((field, index) => <article tabIndex={0} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const { fieldId } = builderDragPayload(event); if (fieldId) reorder(fieldId, field.id); }} className={`canvas-field ${selected === field.id ? 'selected' : ''}`} key={field.id} onClick={() => setSelected(field.id)} onFocus={() => setSelected(field.id)}>
            <span className="drag-handle" draggable onDragStart={(event) => beginExistingFieldDrag(event, field.id)} aria-label="Arrastrar para ordenar" title="Arrastrar para ordenar">⠿</span><div><label>{field.label}{field.required && ' *'}{field.system && <em> Protegido</em>}{field.id === 'partySize' && <em> Se pregunta en el paso 1, no en este orden</em>}{field.id === 'consent' && !surveyMode && <em> Va en el bloque de aceptaciones</em>}{field.type === 'coupon' && <em> Se muestra con «Aceptar cupones»</em>}</label>{['select', 'multi_select'].includes(field.type) && field.options?.length
                ? <div className={`field-preview-opciones ${field.type === 'multi_select' ? 'es-multiple' : ''}`}>{field.options.map((opcion) => <span key={opcion}>{opcion}</span>)}</div>
                : <div className="field-preview-input">{field.placeholder || 'Respuesta del visitante'}</div>}</div><div className="field-actions">
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Editar ${field.label}`} onClick={(e) => { e.stopPropagation(); openEditor(field); }} title="Editar campo"><VitaIcons.edit /></button>
              {!field.system && <button type="button" className="btn btn-sm btn-outline btn-danger" aria-label={`Eliminar ${field.label}`} onClick={(e) => { e.stopPropagation(); setConfirmDeleteField(field.id); }} title="Eliminar campo"><VitaIcons.delete /></button>}
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Subir ${field.label}`} disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveField(field.id, -1); }} title="Subir">↑</button>
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Bajar ${field.label}`} disabled={index === fields.length - 1} onClick={(e) => { e.stopPropagation(); moveField(field.id, 1); }} title="Bajar">↓</button>
            </div>
          </article>)}
          <div className="canvas-drop"><strong>Todo este flujo es zona para arrastrar</strong><span>Suelta en cualquier espacio libre para agregar al final, o sobre un campo para ordenar.</span></div>
        </main>
        {/* Al lado de lo que se edita, cómo lo verá quien reserva en su teléfono. Se actualiza sola. */}
        <aside className="builder-vista-previa" aria-label="Vista previa">
          <div className="builder-vista-previa-titulo"><strong>Así se verá</strong><small>Vista de teléfono · se actualiza al editar</small></div>
          <ReservationLivePreview draft={draft} fields={fields} previewDevice="mobile" style={designPreviewStyle} />
        </aside>
      </div>
      {editingField && editingDraft && <div className="field-editor-overlay" onClick={() => closeEditor(true)}><div className="field-editor-popup" onClick={(e) => e.stopPropagation()}>
        <div className="field-editor-header"><h3>Editar {editingDraft.label}</h3><button type="button" className="btn btn-sm btn-outline" onClick={() => closeEditor(true)}>✕</button></div>
        <div className="field-editor-body">
          <label>Etiqueta<input className="input" value={editingDraft.label} onChange={(e) => updateEditor({ label: e.target.value })} /></label>
          <label>Texto de ayuda<input className="input" value={editingDraft.placeholder || ''} onChange={(e) => updateEditor({ placeholder: e.target.value })} /></label>
          {!editingDraft.system && <label className="toggle-row"><input type="checkbox" checked={editingDraft.required} onChange={(e) => updateEditor({ required: e.target.checked })} /> Campo obligatorio</label>}
          {!editingDraft.system && <label className="toggle-row"><input type="checkbox" checked={Boolean(editingDraft.sensible)} onChange={(e) => updateEditor({ sensible: e.target.checked })} /> <span>Pide salud, alergias u otro dato sensible<small className="toggle-nota bloque">Quien responda deberá autorizarlo expresamente.</small></span></label>}
          {editingDraft.options && draft.designConfig?.ocasionesPreguntaId === editingDraft.id && <small className="schedule-nota">Las opciones de esta pregunta salen de la «Grilla de ocasiones» (paso Diseño público). Cámbialas allí y se actualizan aquí solas.</small>}
          {editingDraft.options && draft.designConfig?.ocasionesPreguntaId !== editingDraft.id && <label>Opciones <small className="toggle-nota">una por línea</small><textarea className="input" rows={6} value={opcionesTexto} onChange={(e) => { setOpcionesTexto(e.target.value); updateEditor({ options: [...new Set(e.target.value.split('\n').map((v) => v.trim()).filter(Boolean))] }); }} />{editingDraft.options.length < 2 && <small className="error-text">Agrega al menos dos opciones.</small>}</label>}
          {editingDraft.type === 'select' && <label>Cómo se muestra<select className="input" value={editingDraft.display || ''} onChange={(e) => updateEditor({ display: e.target.value || undefined })}>
            <option value="">Automático: botones hasta 5 opciones, lista desde 6</option>
            <option value="radio">Siempre como botones</option>
            <option value="select">Siempre como lista desplegable</option>
          </select></label>}
          {/*
            * Preguntar sólo cuando corresponde.
            *
            * Antes esto era una bandera en la configuración y una condición escrita a mano en la
            * página pública, así que cada pregunta condicional nueva exigía desplegar. La misma
            * regla la lee el servidor para no exigir un campo que nadie llegó a ver.
            */}
          {!editingDraft.system && <div className="field-editor-regla">
            <strong>Mostrar esta pregunta</strong>
            <select className="input" aria-label="Cuándo se muestra" value={editingDraft.mostrarSi?.campo || ''} onChange={(event) => updateEditor({ mostrarSi: event.target.value ? { campo: event.target.value, operador: editingDraft.mostrarSi?.operador || 'igual', valor: editingDraft.mostrarSi?.valor || '' } : undefined })}>
              <option value="">Siempre</option>
              {fields.filter((campo) => campo.id !== editingDraft.id && campo.type !== 'consent').map((campo) => <option key={campo.id} value={campo.id}>Según «{campo.label}»</option>)}
            </select>
            {editingDraft.mostrarSi && <div className="form-row">
              <label>Cuando la respuesta<select className="input" value={editingDraft.mostrarSi.operador} onChange={(event) => updateEditor({ mostrarSi: { ...editingDraft.mostrarSi!, operador: event.target.value as FormField['mostrarSi'] extends undefined ? never : NonNullable<FormField['mostrarSi']>['operador'] } })}>
                <option value="igual">sea igual a</option>
                <option value="distinto">sea distinta de</option>
                <option value="contiene">contenga</option>
                <option value="mayor_que">sea mayor que</option>
                <option value="respondido">esté respondida</option>
                <option value="vacio">esté vacía</option>
              </select></label>
              {!['respondido', 'vacio'].includes(editingDraft.mostrarSi.operador) && (() => {
                const origen = fields.find((campo) => campo.id === editingDraft.mostrarSi!.campo);
                const cambiarValor = (valor: string) => updateEditor({ mostrarSi: { ...editingDraft.mostrarSi!, valor } });
                return <label>Este valor{origen?.options?.length
                  ? <select className="input" value={editingDraft.mostrarSi!.valor || ''} onChange={(event) => cambiarValor(event.target.value)}><option value="">Elige una opción</option>{origen.options.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}</select>
                  : <input className="input" value={editingDraft.mostrarSi!.valor || ''} onChange={(event) => cambiarValor(event.target.value)} />}</label>;
              })()}
            </div>}
            {editingDraft.mostrarSi && editingDraft.required && <small className="error-text">Es obligatoria y condicional: mientras esté oculta no se pedirá, y volverá a ser obligatoria al aparecer.</small>}
          </div>}
          <div className="field-editor-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { const copy = { ...editingDraft, id: editingDraft.id, label: `${editingDraft.label} copia`, system: false }; const idx = fields.findIndex((f) => f.id === editingDraft.id); const next = [...fields]; next.splice(idx + 1, 0, copy); change({ fieldSchema: next }); closeEditor(false); }}>Duplicar</button>
            {!editingDraft.system && <button type="button" className="btn btn-outline btn-danger btn-sm" onClick={() => { const id = editingDraft.id; closeEditor(false); setConfirmDeleteField(id); }}>Eliminar campo</button>}
          </div>
        </div>
        <div className="field-editor-footer"><button type="button" className="btn btn-outline btn-sm" onClick={() => closeEditor(false)}>Descartar cambios</button><button type="button" className="btn btn-primary btn-sm" onClick={() => closeEditor(true)}>Guardar</button></div>
      </div></div>}
    </Fragment>}

    {step === 1 && <div className="builder-stage"><div className="stage-heading"><span className="page-eyebrow">AGENDA Y CAPACIDAD</span><h2>¿Cuándo pueden reservar?</h2><p>Define el horario habitual y bloqueos.</p></div><div className="schedule-layout">
      <div className="schedule-card">
        <h3>Cuánto puedes recibir</h3>
        <div className="schedule-capacity">
          <label className="capacity-primary">Tope diario de personas<small>Se suman las personas de cada reserva: 120 pueden ser 30 mesas de 4. 0 = sin límite. Al alcanzarlo, el día se muestra completo.</small><input className="input" type="number" min="0" max="5000" value={draft.dailyCapacity ?? 0} onChange={(event) => change({ dailyCapacity: Number(event.target.value) })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.enforceCompanyDailyCap !== 'false'} onChange={(event) => cambiarAjuste('enforceCompanyDailyCap', String(event.target.checked))} /> Respetar también el tope diario de la empresa</label>
          <small className="schedule-nota">{(draft.companyDailyCap ?? 0) > 0
            ? draft.designConfig?.enforceCompanyDailyCap !== 'false'
              ? `La empresa tiene un tope de ${draft.companyDailyCap} personas al día sumando todas sus sucursales. Manda el que se llene primero${draft.dailyCapacity > 0 && draft.dailyCapacity > (draft.companyDailyCap ?? 0) ? ': aquí el de la empresa es más bajo que el de esta sucursal' : ''}.`
              : `La empresa tiene un tope de ${draft.companyDailyCap} personas al día, pero esta sucursal no lo aplica.`
            : 'La empresa no tiene tope diario propio: sólo cuenta el de esta sucursal.'}</small>
          <label>Personas por horario<small>Cuántas personas pueden llegar en un mismo horario (no mesas).</small><input className="input" type="number" min="1" max="500" value={draft.capacityPerSlot} onChange={(event) => change({ capacityPerSlot: Number(event.target.value) })} /></label>
          {draft.capacityPerSlot < umbralDeGrupo && <div className="alert alert-warning cupo-aviso">Con {draft.capacityPerSlot} persona{draft.capacityPerSlot === 1 ? '' : 's'} por horario, una reserva de {draft.capacityPerSlot + 1} a {umbralDeGrupo} personas nunca verá horarios. Si pensabas en mesas, escribe cuántas personas caben en total.</div>}
          <label>Duración de cada reserva<select className="input" value={draft.durationMinutes} onChange={(event) => change({ durationMinutes: Number(event.target.value) })}>{[...new Set([...DURACIONES, draft.durationMinutes])].sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label>
        </div>
        <div className="schedule-timezone">
          <span>Zona horaria</span>
          <strong>{draft.timezone}</strong>
          {cambiandoZona
            ? <select className="input" aria-label="Zona horaria" value={draft.timezone} onChange={(event) => { change({ timezone: event.target.value }); setCambiandoZona(false); }}>{TIMEZONES.map((timezone) => <option key={timezone}>{timezone}</option>)}</select>
            : <button type="button" className="btn btn-outline btn-xs" onClick={() => setCambiandoZona(true)}>Cambiar</button>}
          <small>Con esta hora se calculan los horarios, los bloqueos y los recordatorios. Cambiarla mueve también lo que ya está publicado y reservado.</small>
        </div>

        <RitmoDeHorarios duracion={draft.durationMinutes} separacion={draft.bufferMinutes} ritmo={Number(draft.designConfig?.slotCadenceMinutes || '15')} ventana={windows[0]} />
        {/* Fuera del desplegable: avisaba de una agenda que no ofrece nada, escondido tras un
            resumen cerrado que justamente no se abre cuando todo parece estar bien. */}
        {ventanaImposible && <div className="alert alert-error">La anticipación mínima ({draft.minimumNoticeHours} h) cae fuera de la ventana máxima ({draft.maximumAdvanceDays} día{draft.maximumAdvanceDays === 1 ? '' : 's'}): con estos valores la página no ofrece ningún horario. Está en «Ajustes avanzados».</div>}
        <details className="schedule-advanced" open={ventanaImposible}>
          <summary>Ajustes avanzados</summary>
          <div className="schedule-settings schedule-settings-wide"><label>Margen entre reservas (min)<small>Tiempo para dejar lista la mesa.</small><input className="input" type="number" min="0" max="240" value={draft.bufferMinutes} onChange={(event) => change({ bufferMinutes: Number(event.target.value) })} /></label><label>Anticipación mínima (h)<input className="input" type="number" min="0" value={draft.minimumNoticeHours} onChange={(event) => change({ minimumNoticeHours: Number(event.target.value) })} /></label><label>Ventana máxima (días)<input className="input" type="number" min="1" max="365" value={draft.maximumAdvanceDays} onChange={(event) => change({ maximumAdvanceDays: Number(event.target.value) })} aria-invalid={ventanaImposible} /></label><label>Confirmación<select className="input" value={draft.confirmationMode} onChange={(event) => change({ confirmationMode: event.target.value })}><option value="automatic">Automática</option><option value="manual">Revisión manual</option></select></label>
            <label>Una llegada cada (min)<small>Cada cuánto se ofrece un horario.</small><input className="input" type="number" min="5" max="240" value={String(draft.designConfig?.slotCadenceMinutes || '15')} onChange={(event) => change({ designConfig: { ...draft.designConfig, slotCadenceMinutes: event.target.value } })} /></label><label>Retener cupo (min)<input className="input" type="number" min="1" max="30" value={String(draft.designConfig?.holdMinutes || '5')} onChange={(event) => change({ designConfig: { ...draft.designConfig, holdMinutes: event.target.value } })} /></label></div>
        </details>
      <section className="reservation-readiness zonas-en-agenda" id="zonas"><div><span className="page-eyebrow">ZONAS Y PREFERENCIAS</span><h2>Zonas y sectores</h2><p className="page-subtitle">Terraza, salón o barra, con su cupo de personas. Quien reserva elige el sector y ve si permite fumar. Desactivar conserva la zona y su historial.</p></div>{zones.some((zona) => zona.active !== false && (zona.capacity || draft.capacityPerSlot) < umbralDeGrupo) && <div className="alert alert-warning cupo-aviso">Hay zonas con cupo menor a {umbralDeGrupo} personas: quien elija esa zona con un grupo más grande no verá horarios.</div>}{draft.designConfig?.askSmoking === 'true' && zones.length > 0 && <small className="schedule-nota">Con zonas cargadas, la preferencia de fumadores se muestra en el selector de sector («· fumadores») y no se pregunta aparte.</small>}{zones.map((zone, index) => <div className="reservation-zone-row" key={zone.id}><label>Nombre<input className="input" value={zone.name} onChange={(e) => updateZone(index, { name: e.target.value })} placeholder="Ej. Terraza" /></label><label>Cupo<input className="input" type="number" min="1" max="500" value={zone.capacity || draft.capacityPerSlot} onChange={(e) => updateZone(index, { capacity: Number(e.target.value) })} /></label><label>Descripción<input className="input" value={zone.description || ''} onChange={(e) => updateZone(index, { description: e.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={Boolean(zone.smokingAllowed)} onChange={(e) => updateZone(index, { smokingAllowed: e.target.checked })} /> Fumadores</label><label className="toggle-row"><input type="checkbox" checked={zone.active !== false} onChange={(e) => updateZone(index, { active: e.target.checked })} /> Disponible para reservar</label><button type="button" className="btn btn-outline btn-sm" onClick={() => updateZone(index, { active: zone.active === false })}>{zone.active === false ? 'Activar' : 'Desactivar'}</button></div>)}<button type="button" className="btn btn-outline btn-sm" onClick={addZone}>Agregar zona</button></section>
        <h3>Grupos grandes y eventos</h3>
        <div className="schedule-capacity">
          <label className="capacity-primary">Solicitudes de evento o grupo<small>Botón «Solicitar evento» en la página y opción «{umbralDeGrupo + 1} o más personas». No toma cupo: el equipo lo resuelve desde Reservas → Grupos.</small>
            <select className="input" value={draft.designConfig?.groupRequestEnabled === 'false' ? 'no' : 'si'} onChange={(event) => change({ designConfig: { ...draft.designConfig, groupRequestEnabled: event.target.value === 'si' ? 'true' : 'false' } })}>
              <option value="si">Aceptar solicitudes</option>
              <option value="no">No aceptar</option>
            </select>
          </label>
          {draft.designConfig?.groupRequestEnabled !== 'false' && <div className="capacity-primary tipos-de-evento">
            <strong>Tipos de evento que ofreces</strong>
            <small>Nómbralos como tu local. Cada uno cuenta en una categoría para los reportes. {draft.designConfig?.ocasionesPreguntaId ? 'Como la grilla de ocasiones está conectada, la página usa esas ocasiones en lugar de esta lista.' : ''}</small>
            {leerTiposDeEvento(draft.designConfig?.tiposDeEvento, true).map((tipo, indice, lista) => (
              <div className="tipo-de-evento" key={indice}>
                <input className="input" value={tipo.nombre} maxLength={60} aria-label={`Nombre del tipo ${indice + 1}`} onChange={(e) => { const nueva = [...lista]; nueva[indice] = { ...tipo, nombre: e.target.value }; cambiarAjuste('tiposDeEvento', JSON.stringify(nueva)); }} />
                <select className="input" value={tipo.categoria} aria-label="Categoría" onChange={(e) => { const nueva = [...lista]; nueva[indice] = { ...tipo, categoria: e.target.value as CategoriaDeEvento }; cambiarAjuste('tiposDeEvento', JSON.stringify(nueva)); }}>
                  {CATEGORIAS_DE_EVENTO.map((categoria) => <option key={categoria.valor} value={categoria.valor}>{categoria.nombre}</option>)}
                </select>
                <button type="button" className="btn btn-outline btn-sm" disabled={lista.length <= 1} onClick={() => cambiarAjuste('tiposDeEvento', JSON.stringify(lista.filter((_, i) => i !== indice)))}>Quitar</button>
              </div>
            ))}
            {leerTiposDeEvento(draft.designConfig?.tiposDeEvento, true).length < 12 && <button type="button" className="btn btn-outline btn-sm" onClick={() => cambiarAjuste('tiposDeEvento', JSON.stringify([...leerTiposDeEvento(draft.designConfig?.tiposDeEvento, true), { nombre: '', categoria: 'otro' }]))}>Agregar tipo</button>}
          </div>}
          {draft.designConfig?.groupRequestEnabled !== 'false' && <div className="capacity-primary textos-evento">
            <strong>Botón en la página</strong>
            <small>Vacío usa el texto de siempre. Se ve bajo el calendario.</small>
            <label>Título<input className="input" maxLength={80} placeholder="¿Es un evento o una celebración?" value={String(draft.designConfig?.eventoCtaTitulo || '')} onChange={(e) => cambiarAjuste('eventoCtaTitulo', e.target.value)} /></label>
            <label>Texto<input className="input" maxLength={180} placeholder={`Cumpleaños, empresa o grupos de ${umbralDeGrupo + 1} o más. El local te contacta para coordinar fecha y detalles.`} value={String(draft.designConfig?.eventoCtaTexto || '')} onChange={(e) => cambiarAjuste('eventoCtaTexto', e.target.value)} /></label>
            <label>Botón<input className="input" maxLength={40} placeholder="Solicitar evento" value={String(draft.designConfig?.eventoCtaBoton || '')} onChange={(e) => cambiarAjuste('eventoCtaBoton', e.target.value)} /></label>
          </div>}
          <label>Grupo grande desde<small>Desde {umbralDeGrupo + 1} personas la página ofrece «Solicitar evento» en vez de horarios.</small><input className="input" type="number" min="2" max="100" value={String(draft.designConfig?.groupThreshold || '8')} onChange={(event) => change({ designConfig: { ...draft.designConfig, groupThreshold: event.target.value } })} /></label>
          {draft.designConfig?.groupRequestEnabled !== 'false' && <label className="capacity-primary">Mensaje de WhatsApp para grupos<small>Texto con que se abre el chat al pedir un evento. {draft.designConfig?.whatsappBusinessNumber ? `Se envía al ${draft.designConfig.whatsappBusinessNumber}.` : 'Falta el WhatsApp del local: agrégalo aquí abajo en «Datos del local».'}</small><textarea className="input" rows={2} value={String(draft.designConfig?.whatsappGroupMessage || '')} onChange={(e) => cambiarAjuste('whatsappGroupMessage', e.target.value)} /></label>}
        </div>

        <h3>Cuándo se cierra el turno</h3>
        <div className="schedule-settings">
          <label>Tolerancia antes de no-show (min)<input className="input" type="number" min="0" value={String(draft.designConfig?.toleranceMinutes || '15')} onChange={(event) => change({ designConfig: { ...draft.designConfig, toleranceMinutes: event.target.value } })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.autoCloseAttendance !== 'false'} onChange={(event) => change({ designConfig: { ...draft.designConfig, autoCloseAttendance: String(event.target.checked) } })} /> Cerrar la asistencia sola</label>
          <label>Margen posterior (min)<input className="input" type="number" min="15" max="1440" disabled={draft.designConfig?.autoCloseAttendance === 'false'} value={String(draft.designConfig?.autoCloseAfterMinutes || '60')} onChange={(event) => change({ designConfig: { ...draft.designConfig, autoCloseAfterMinutes: event.target.value } })} /></label>
        </div>

        <h3>Semana habitual</h3><div className="week-editor week-editor-multi">{DAYS.map((label, uiDay) => { const jsDay = UI_TO_JS_DAY[uiDay]; const dayWindows = windows.map((window, index) => ({ window, index })).filter((entry) => entry.window.day === jsDay); return <div key={label} className={dayWindows.length ? 'enabled' : ''}><label className="toggle-row"><input type="checkbox" checked={dayWindows.length > 0} onChange={() => toggleDay(uiDay)} /><strong>{label}</strong></label><div className="day-windows">{dayWindows.map(({ window, index }) => <div key={`${jsDay}-${index}`}><input aria-label={`Inicio ${label}`} type="time" value={window.start} onChange={(event) => updateWindow(index, { start: event.target.value })} /><span>a</span><input aria-label={`Fin ${label}`} type="time" value={window.end} onChange={(event) => updateWindow(index, { end: event.target.value })} /><button type="button" aria-label={`Quitar franja de ${label}`} onClick={() => removeWindow(index)}>×</button></div>)}{dayWindows.length > 0 && dayWindows.length < 4 && <button type="button" className="add-window" onClick={() => addWindow(uiDay)}>+ Agregar franja</button>}{dayWindows.length === 0 && <em>Cerrado</em>}</div></div>; })}</div></div>
      <section className="schedule-card" id="pausa"><div><h3>Detener todo por un tiempo</h3><p className="page-subtitle">La página pública no ofrecerá horarios hasta la fecha indicada. No elimina reservas ni despublica el local. Se aplica al elegir la fecha, sin «Guardar»; es la misma pausa del botón de «Hoy».</p></div><div className="schedule-settings"><label>Reanudar automáticamente el<input className="input" type="datetime-local" min={utcToLocalInput(new Date().toISOString(), draft.timezone)} disabled={pausaMutation.isPending} value={utcToLocalInput(draft.designConfig?.bookingPausedUntil, draft.timezone)} onChange={(event) => setBookingPause(event.target.value)} /></label></div><button type="button" className="btn btn-outline btn-sm" disabled={!draft.designConfig?.bookingPausedUntil || pausaMutation.isPending} onClick={() => setBookingPause('')}>Quitar pausa programada</button></section>
      <aside className="schedule-card"><h3>Cierres y bloqueos</h3><p className="page-subtitle">Toca un día para cerrarlo. Vuelve a tocarlo para reabrirlo.</p>
        <div className="block-calendar">
          <div className="block-calendar-nav"><button type="button" className="btn btn-outline btn-xs" disabled={blockMonth <= 0} onClick={() => setBlockMonth((value) => Math.max(0, value - 1))}>←</button><span>{blockCalendar.label}</span><button type="button" className="btn btn-outline btn-xs" onClick={() => setBlockMonth((value) => value + 1)}>→</button></div>
          <div className="block-calendar-weekdays"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
          {blockCalendar.weeks.map((week, weekIndex) => <div className="block-calendar-week" key={weekIndex}>{week.map((cell, cellIndex) => {
            if (!cell) return <span key={`empty-${cellIndex}`} className="block-calendar-day is-empty" />;
            const isPast = cell.key < blockCalendar.hoy;
            const isClosed = blocksByDate.closed.has(cell.key);
            const isPartial = !isClosed && blocksByDate.partial.has(cell.key);
            return <button
              type="button"
              key={cell.key}
              className={`block-calendar-day ${isClosed ? 'is-closed' : ''} ${isPartial ? 'is-partial' : ''} ${isPast ? 'is-past' : ''} ${cell.key === blockCalendar.hoy ? 'is-today' : ''}`}
              aria-pressed={isClosed}
              aria-label={`${cell.day} de ${blockCalendar.label}${isPast ? ', ya pasó' : isClosed ? ', cerrado' : isPartial ? ', con horas bloqueadas' : ', abierto'}`}
              disabled={blockMutation.isPending || isPast}
              onClick={() => toggleDayClosed(cell.key)}
            >{cell.day}</button>;
          })}</div>)}
          <div className="block-calendar-hint"><span className="dot closed" /> Cerrado <span className="dot partial" /> Horas bloqueadas</div>
        </div>
        {blockMutation.error && <div className="alert alert-error">{blockMutation.error.message}</div>}
        <details className="block-range">
          <summary>Bloquear solo algunas horas</summary>
          <form className="block-form" onSubmit={(event) => { event.preventDefault(); if (blockRepeat > 1) { batchBlockMutation.mutate({ ...block, repeat: blockRepeat }); } else { blockMutation.mutate(block); } }}><label>Desde<input className="input" type="datetime-local" required min={utcToLocalInput(new Date().toISOString(), draft.timezone)} value={block.startsAt} onChange={(event) => setBlock({ ...block, startsAt: event.target.value })} /></label><label>Hasta<input className="input" type="datetime-local" required min={block.startsAt || utcToLocalInput(new Date().toISOString(), draft.timezone)} value={block.endsAt} onChange={(event) => setBlock({ ...block, endsAt: event.target.value })} /></label><label>Motivo<input className="input" value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Feriado, evento interno..." /></label><label>Repetir durante<small>Cantidad de semanas consecutivas.</small><input className="input" type="number" min="1" max="12" value={blockRepeat} onChange={(event) => setBlockRepeat(Number(event.target.value))} /></label>{batchBlockMutation.error && <div className="alert alert-error">{batchBlockMutation.error.message}</div>}<button className="btn btn-primary btn-block" disabled={blockMutation.isPending || batchBlockMutation.isPending}>{batchBlockMutation.isPending ? 'Creando bloqueos...' : blockRepeat > 1 ? `Crear ${blockRepeat} bloqueos` : 'Agregar bloqueo'}</button></form>
        </details>
        <div className="block-list">{blocks.length === 0 ? <p className="page-subtitle">No hay bloqueos futuros.</p> : blocks.map((item) => <div key={item.id}><div><strong>{item.reason || 'Agenda cerrada'}</strong><small>{new Date(item.startsAt).toLocaleString('es-CL')} → {new Date(item.endsAt).toLocaleString('es-CL')}</small></div><button onClick={() => setConfirmDeleteBlock(item.id)}>Quitar</button></div>)}</div></aside>
    </div></div>}

    {step === 2 && <div className="builder-stage">
      <div className="stage-heading"><span className="page-eyebrow">ENTORNO VISUAL</span><h2>Haz que {surveyMode ? 'la encuesta' : 'la reserva'} se sienta propia.</h2><p>Elige una plantilla y ajusta solo lo que quieras cambiar. Cada bloque cerrado ya trae un valor que funciona.</p></div>
      <div className="design-studio">
        <DesignStudioControls design={design} fields={fields} surveyMode={surveyMode} onChange={(designConfig) => change({ designConfig, fieldSchema: sincronizarPreguntaDeOcasiones(designConfig, fields) })} onAsset={saveDesignAsset} clientId={draft.clientId} />
        <div className="design-preview-column">
          <div className="preview-device-toggle"><button type="button" className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>Vista móvil</button><button type="button" className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>Vista escritorio</button></div>
          <ReservationLivePreview draft={draft} fields={fields} previewDevice={previewDevice} style={designPreviewStyle} />
        </div>
      </div>
    </div>}

    {!clientMode && step === 3 && <div className="builder-stage">
      {/*
        * Cuánto vale una reserva para el local.
        *
        * Sin esto, las campañas optimizan tratando igual una mesa de dos y un grupo de doce.
        * No se inventa un promedio: si se deja en cero, el evento viaja sin valor, que es
        * preferible a enseñarle a la campaña una cifra falsa.
        */}
      <section className="reservation-readiness"><div><span className="page-eyebrow">VALOR DE UNA RESERVA</span><h2>Para que la campaña sepa cuál le conviene</h2><p className="page-subtitle">Es el consumo esperado por persona, una estimación para ordenar campañas entre sí. No cuadra con la caja ni se le muestra a quien reserva.</p></div><div className="form-row"><label>Consumo esperado por persona<input className="input" type="number" min="0" step="500" value={String(draft.designConfig?.valorPorPersona || '')} placeholder="0 = no enviar valor" onChange={(event) => cambiarAjuste('valorPorPersona', event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={String(draft.designConfig?.moneda || 'CLP')} onChange={(event) => cambiarAjuste('moneda', event.target.value.toUpperCase())} /></label></div>{Number(draft.designConfig?.valorPorPersona || '0') > 0 && <small>Una reserva de 4 personas se reportará como {(Number(draft.designConfig?.valorPorPersona) * 4).toLocaleString('es-CL')} {String(draft.designConfig?.moneda || 'CLP')}.</small>}</section>
      <div className="stage-heading"><span className="page-eyebrow">MEDICIÓN</span><h2>Conecta el origen y las conversiones.</h2><p>Esta parte es opcional para compartir el enlace, pero clave si el formulario se usará en campañas pagadas.</p></div>
      <div className="publish-grid">
        <div className="publish-summary">
          <h3>Qué se mide</h3>
          <ul className="publish-checklist">
            <li className={draft.metaCapiEnabled ? 'is-ok' : draft.capabilities?.metaConversions ? 'is-warning' : 'is-blocking'}>
              <strong>{draft.metaCapiEnabled ? 'Meta CAPI activo' : draft.capabilities?.metaConversions ? 'Meta CAPI disponible' : 'Meta no configurado'}</strong>
              <small>{draft.metaCapiEnabled
                ? 'Cuando alguien reserve, el evento se enviará a Meta para optimizar campañas.'
                : draft.capabilities?.metaConversions
                  ? 'Puedes activarlo si este formulario recibirá tráfico desde anuncios.'
                  : 'Se puede publicar igual, pero primero Administración/Dev debe conectar el Pixel y token.'}</small>
            </li>
            <li className={draft.campaignId?.trim() ? 'is-ok' : 'is-warning'}>
              <strong>{draft.campaignId?.trim() ? `Campaña: ${draft.campaignId}` : 'Campaña sin etiqueta'}</strong>
              <small>La etiqueta ayuda a identificar de dónde viene cada reserva sin cambiar el enlace base del formulario.</small>
            </li>
            <li className={draft.ga4MeasurementId?.trim() ? 'is-ok' : 'is-warning'}>
              <strong>{draft.ga4MeasurementId?.trim() ? 'GA4 configurado' : 'GA4 opcional'}</strong>
              <small>Sirve para contar visitas y reservas en Google Analytics. No reemplaza Meta CAPI.</small>
            </li>
          </ul>
        </div>

        <div className="publish-summary">
          <h3>Configuración de medición</h3>
          <div className="publish-tracking-body">
            {!clientMode && <label className={`meta-publication-toggle ${draft.metaCapiEnabled ? 'active' : ''}`}>
              <input type="checkbox" checked={Boolean(draft.metaCapiEnabled)} disabled={!draft.capabilities?.metaConversions} onChange={(event) => change({ metaCapiEnabled: event.target.checked })} />
              <span><strong>Avisarle a Meta cuando alguien reserva</strong><small>Permite que Facebook e Instagram sepan qué anuncio trajo cada reserva y muestren el anuncio a gente parecida.</small></span>
            </label>}

            {draft.capabilities?.metaConversions && <div className={`publish-meta-state ${draft.metaReady ? 'is-ok' : 'is-warning'}`}>
              <strong>{draft.metaReady ? 'Meta está listo' : 'Falta configurar Meta'}</strong>
              <small>{draft.metaReady
                ? `Cuenta conectada${draft.pixelName ? `: ${draft.pixelName}` : ''}. Las reservas se informarán automáticamente.`
                : 'Se puede publicar igual, pero las reservas no llegarán a Meta hasta completar la integración.'}</small>
              {!draft.metaReady && <Link className="btn btn-outline btn-sm" to="/integrations">Conectar la cuenta de Meta</Link>}
              {draft.metaReady && draft.metaCapiEnabled && <SaludDeMedicion formId={id} />}
            </div>}

            <label>Nombre de esta campaña
              <input className="input" value={draft.campaignId || ''} onChange={(event) => change({ campaignId: event.target.value })} placeholder="Ej.: invierno-reservas-2026" />
              <small>Se guarda como atribución predeterminada. El enlace corto no cambia.</small>
            </label>

            <label>Google Analytics
              <input className="input" value={draft.ga4MeasurementId || ''} onChange={(event) => change({ ga4MeasurementId: event.target.value.trim() })} placeholder="G-XXXXXXXXXX" />
              <small>Si tu empresa usa GA4, pega su identificador. Déjalo vacío si no lo usas.</small>
            </label>
          </div>
        </div>
      </div>
    </div>}

    {step === 5 && <div className="builder-stage">
      <div className="stage-heading"><span className="page-eyebrow">PUBLICACIÓN</span><h2>Revisa, publica y comparte.</h2><p>Comprueba que esté todo listo, publícalo y copia el enlace que vas a repartir.</p></div>
      <div className="publish-grid">
        <div className="publish-summary">
          <h3>Antes de publicar</h3>
          <ul className="publish-checklist">
            <li className={windows.length > 0 ? 'is-ok' : 'is-blocking'}>
              <strong>{diasHabilitados > 0 ? `${diasHabilitados} día${diasHabilitados !== 1 ? 's' : ''} de atención` : 'Sin días de atención'}</strong>
              <small>{diasHabilitados > 0 ? 'Los visitantes solo verán horarios en estos días.' : 'Vuelve al paso «Disponibilidad» y marca al menos un día. Sin esto no se puede publicar.'}</small>
            </li>
            <li className="is-ok">
              <strong>{fields.length} campo{fields.length !== 1 ? 's' : ''} que se piden</strong>
              <small>Es lo que la persona completa al reservar. Puedes cambiarlo en el paso «Campos».</small>
            </li>
            <li className={design.logoUrl || design.backgroundImage ? 'is-ok' : 'is-warning'}>
              <strong>{design.logoUrl || design.backgroundImage ? 'Identidad personalizada' : 'Usando la plantilla de la sucursal'}</strong>
              <small>{design.logoUrl || design.backgroundImage ? 'El logo o la portada ya se mostrarán a quien reserva.' : 'Puedes publicar así o agregar logo y portada en «Diseño público». '}</small>
            </li>
          </ul>
        </div>

        <div className="publish-link">
          <span>ENLACE PÚBLICO DE LA SUCURSAL</span>
          <strong>{campaignUrl}</strong>
          <div>
            <button className="btn btn-outline" onClick={copyLink}>{copied ? 'Copiado' : 'Copiar enlace'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>Personalizar vista</button>
            {publicPreviewReady && safeCampaignUrl
              ? <a className="btn btn-outline" href={safeCampaignUrl} target="_blank" rel="noreferrer">Abrir como visitante</a>
              : <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>{publishedButDirty ? 'Guarda para poder abrirlo' : 'Ver cómo se verá'}</button>}
          </div>
          <small>{publicPreviewReady ? 'Comparte este único enlace. Las etiquetas de campaña no cambian la dirección.' : 'El enlace estará disponible cuando publiques.'}</small>

          <button className="btn reservation-cta" disabled={saveMutation.isPending || windows.length === 0} onClick={() => saveMutation.mutate({ ...draft, status: 'published' })}>
            {saveMutation.isPending ? 'Publicando...' : draft.status === 'published' ? 'Guardar cambios' : surveyMode ? 'Publicar encuesta' : 'Publicar formulario'}
          </button>
          {draft.status === 'published' && !saved && <small>Ya está publicado. Guarda para que los cambios se vean.</small>}
          {draft.status === 'published' && saved && <>
            <small>Todo listo y publicado. Esta sucursal ya recibe reservas.</small>
            <button type="button" className="btn btn-outline" onClick={() => navegar(`${clientMode ? '/portal/reservations' : '/reservations'}/forms/${id}`)}>Terminar y volver a la sucursal</button>
          </>}
          {windows.length === 0 && <small className="publish-blocker">Marca al menos un día de atención para poder publicar.</small>}
        </div>
      </div>
    </div>}

    {step === 4 && <div className="builder-stage builder-stage-ajustes">
      <div className="stage-heading"><span className="page-eyebrow">DATOS DEL LOCAL</span><h2>Quién responde, a quién se avisa y qué se acepta</h2><p>Contacto, correos y consentimientos de esta sucursal.</p></div>
      <section className="reservation-readiness"><div><span className="page-eyebrow">RESPONSABLE Y CONTACTO</span><h2>Información visible para quien reserva</h2><p className="page-subtitle">Los datos legales los mantiene la empresa en su portal y valen para todas sus sucursales.</p></div>
        <div className="datos-heredados">
          <div><span>Razón social</span><strong>{draft.datosLegalesEmpresa?.legalName || 'Sin completar'}</strong></div>
          <div><span>RUT</span><strong>{draft.datosLegalesEmpresa?.taxId || 'Sin completar'}</strong></div>
          <div><span>Correo para derechos</span><strong>{draft.datosLegalesEmpresa?.privacyEmail || 'Sin completar'}</strong></div>
          <div><span>Privacidad</span><strong>{draft.datosLegalesEmpresa?.legalMode === 'texto' ? 'Texto propio' : draft.datosLegalesEmpresa?.privacyUrl || 'Sin completar'}</strong></div>
        </div>
        {(!draft.datosLegalesEmpresa?.legalName || !draft.datosLegalesEmpresa?.taxId || !draft.datosLegalesEmpresa?.privacyEmail) && <p className="datos-heredados-nota">Faltan datos de la empresa. Los completa la empresa en su portal («Datos legales») o el equipo desde Clientes → Editar cliente.</p>}
        <div className="form-row"><label>WhatsApp del local<small>Para grupos, eventos y cuando no hay horarios.</small><input className="input" value={String(draft.designConfig?.whatsappBusinessNumber || '')} onChange={(e) => cambiarAjuste('whatsappBusinessNumber', e.target.value)} placeholder="+56 9 1234 5678" /></label></div>
        <label className="toggle-row"><input type="checkbox" checked={usaDatosPropios ?? Boolean(draft.designConfig?.legalCompanyName || draft.designConfig?.legalCompanyId || draft.designConfig?.privacyUrl || draft.designConfig?.termsUrl)} onChange={(e) => {
          setUsaDatosPropios(e.target.checked);
          // Volver a los de la empresa borra los propios: si no, seguirían mandando sin verse.
          if (!e.target.checked) change({ designConfig: { ...draft.designConfig, legalCompanyName: '', legalCompanyId: '', privacyUrl: '', termsUrl: '' } });
        }} /> Esta sucursal usa otra razón social o política</label>
        {(usaDatosPropios ?? Boolean(draft.designConfig?.legalCompanyName || draft.designConfig?.legalCompanyId || draft.designConfig?.privacyUrl || draft.designConfig?.termsUrl)) && <><div className="form-row"><label>Razón social o responsable<input className="input" placeholder={draft.datosLegalesEmpresa?.legalName || 'Completa la ficha de la empresa'} value={String(draft.designConfig?.legalCompanyName || '')} onChange={(e) => cambiarAjuste('legalCompanyName', e.target.value)} /></label><label>RUT / identificador<input className="input" placeholder={draft.datosLegalesEmpresa?.taxId || 'Completa la ficha de la empresa'} value={String(draft.designConfig?.legalCompanyId || '')} onChange={(e) => cambiarAjuste('legalCompanyId', e.target.value)} /></label></div><div className="form-row"><label>URL de privacidad<input className="input" type="url" value={String(draft.designConfig?.privacyUrl || '')} onChange={(e) => cambiarAjuste('privacyUrl', e.target.value)} placeholder={draft.datosLegalesEmpresa?.privacyUrl || 'https://...'} /></label><label>URL de condiciones<input className="input" type="url" value={String(draft.designConfig?.termsUrl || '')} onChange={(e) => cambiarAjuste('termsUrl', e.target.value)} placeholder={draft.datosLegalesEmpresa?.termsUrl || 'https://...'} /></label></div></>}</section>
      {/*
        * Los correos salen siempre desde el servidor de Espartanos. Esta casilla no cambia el
        * remitente: dice a qué bandejas del local llega el aviso de cada reserva nueva. Sin
        * ninguna dirección, el equipo sólo se entera entrando al panel.
        *
        * El calendario aparece únicamente si Google está conectado en la organización; activarlo
        * sin conexión dejaba reservas esperando un evento que nunca se creaba.
        */}
      <section className="reservation-readiness correos-del-local"><div><span className="page-eyebrow">CORREOS</span><h2>Quién envía, quién responde y a quién se avisa</h2><p className="page-subtitle">Tres casillas con tres funciones distintas.</p></div>
        <div className="correo-rol"><strong>1. Quién envía y qué dice</strong><small>La casilla que envía y el texto de confirmación, recordatorio y encuesta se configuran en {clientMode ? 'Espartanos, por el equipo que lleva tu cuenta' : <Link to="/correos">Correos</Link>}. Aquí sólo se definen las dos casillas del local.</small></div>
        <label className="correo-rol"><strong>2. A dónde llegan las respuestas del cliente</strong><small>Si quien reserva contesta un correo, le llega a esta casilla. También se muestra en la página para cambios y cancelaciones.</small><input className="input" type="email" value={String(draft.designConfig?.supportEmail || '')} onChange={(e) => cambiarAjuste('supportEmail', e.target.value)} placeholder={draft.datosLegalesEmpresa?.privacyEmail || 'contacto@local.cl'} /></label>
        <label className="correo-rol"><strong>3. A quién se avisa de cada reserva nueva</strong><small>Casillas del equipo, separadas por coma. También reciben los comentarios de encuestas con nota baja. No las ve quien reserva.</small><input className="input" value={teamEmails} onChange={(e) => change({ teamNotifications: e.target.value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean) })} placeholder="reservas@local.cl, gerente@local.cl" /></label>{draft.calendarReady ? <label className="toggle-row"><input type="checkbox" checked={Boolean(draft.calendarEnabled)} onChange={(e) => change({ calendarEnabled: e.target.checked })} /> Crear también el evento en el calendario de Google conectado</label> : <small className="page-subtitle">El calendario de Google no está conectado en esta organización, así que no se ofrece.</small>}</section>
      {/*
        * Tres finalidades distintas, tres casillas separadas.
        *
        * Dejar el texto en blanco usa el redactado por defecto, que nombra al responsable, la
        * finalidad, la conservación y cómo revocar. Lo aceptado se guarda con la reserva tal como
        * se mostró: cambiar estos textos afecta a quien reserve desde ahora, nunca a lo ya
        * aceptado. Por eso cada uno lleva versión: si cambia el texto, conviene cambiarla.
        */}
      <section className="reservation-readiness"><div><span className="page-eyebrow">CONSENTIMIENTOS</span><h2>Lo que acepta quien reserva</h2><p className="page-subtitle">Sólo el primero es obligatorio. Los otros dos son opcionales y no condicionan la reserva.</p></div>
        <label>Gestionar la reserva <small>(obligatorio)</small><textarea className="input" rows={3} value={String(draft.designConfig?.reservationConsentText || '')} onChange={(e) => cambiarAjuste('reservationConsentText', e.target.value)} placeholder="En blanco usa el texto por defecto, que ya nombra al responsable, la finalidad y cómo ejercer derechos." /></label>
        <div className="form-row"><label>Novedades y promociones <small>(opcional)</small><textarea className="input" rows={3} value={String(draft.designConfig?.marketingConsentText || '')} onChange={(e) => cambiarAjuste('marketingConsentText', e.target.value)} /></label><label>Versión<input className="input" value={String(draft.designConfig?.marketingConsentVersion || 'mkt-v2')} onChange={(e) => cambiarAjuste('marketingConsentVersion', e.target.value)} /></label></div>
        <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.networkConsentEnabled === 'true'} onChange={(e) => cambiarAjuste('networkConsentEnabled', String(e.target.checked))} /> Pedir autorización para reconocer a la persona en los demás locales de la red</label>
        <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.beneficiosDelGrupo === 'true'} onChange={(e) => cambiarAjuste('beneficiosDelGrupo', String(e.target.checked))} /> <span>El permiso de beneficios incluye a los demás locales de la red<small className="toggle-nota bloque">Una sola casilla: «Quiero beneficios y novedades de este local y sus locales». Usa el nombre de la red de abajo.</small></span></label>
        {draft.designConfig?.networkConsentEnabled === 'true' && <div className="form-row"><label>Nombre de la red<input className="input" value={String(draft.designConfig?.networkBrandName || '')} onChange={(e) => cambiarAjuste('networkBrandName', e.target.value)} placeholder="Espartanos" /></label><label>Texto de la autorización<textarea className="input" rows={3} value={String(draft.designConfig?.networkConsentText || '')} onChange={(e) => cambiarAjuste('networkConsentText', e.target.value)} /></label><label>Versión<input className="input" value={String(draft.designConfig?.networkConsentVersion || 'red-v1')} onChange={(e) => cambiarAjuste('networkConsentVersion', e.target.value)} /></label></div>}
        {draft.designConfig?.networkConsentEnabled === 'true' && !draft.designConfig?.privacyUrl && <small className="error-text">Falta la URL de privacidad: sin ella, quien reserva no tiene dónde leer el detalle de ese tratamiento.</small>}
      </section>
    </div>}

    <footer className="builder-footer"><span>Paso {(clientMode ? PASOS_VISIBLES.cliente : PASOS_VISIBLES.equipo).indexOf(step) + 1} de {clientMode ? PASOS_VISIBLES.cliente.length : PASOS_VISIBLES.equipo.length}</span>{step > 0 && <button className="btn btn-outline btn-sm" onClick={() => setStep(clientMode && step === 4 ? 2 : step - 1)}>Anterior</button>}{step < STEPS.length - 1 && <button className="btn btn-primary btn-sm" onClick={() => setStep(clientMode && step === 2 ? 4 : step + 1)}>Continuar</button>}{step < STEPS.length - 1 && <button className={`btn btn-sm ${saved ? 'btn-outline' : 'btn-primary'}`} disabled={saved || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>{saveMutation.isPending ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}</button>}</footer>
    <ConfirmDialog open={Boolean(confirmDeleteField)} title="Eliminar campo" description="¿Eliminar este campo? Las respuestas ya recibidas siguen guardadas, pero al quedarse sin enunciado pasan a mostrarse con su nombre técnico en el detalle y en la exportación." confirmLabel="Eliminar" onClose={() => setConfirmDeleteField(null)} onConfirm={() => { if (confirmDeleteField) { change({ fieldSchema: fields.filter((field) => field.id !== confirmDeleteField) }); setSelected(null); } setConfirmDeleteField(null); }} />
    <ConfirmDialog open={Boolean(confirmDeleteBlock)} title="Quitar bloqueo" description="¿Eliminar este bloqueo? La agenda volverá a mostrar disponibilidad en ese horario." confirmLabel="Quitar" onClose={() => setConfirmDeleteBlock(null)} onConfirm={() => { if (confirmDeleteBlock) { deleteBlock.mutate(confirmDeleteBlock); } setConfirmDeleteBlock(null); }} />
  </div>;
}

/**
 * Controles del entorno visual del formulario público.
 *
 * Presenta primero la decisión que resuelve casi todo —la plantilla— y deja visible solo lo
 * que cambia el aspecto de un vistazo: textos, logo, colores y tipo de fondo. El resto vive
 * en bloques plegados que se abren cuando hacen falta, de modo que la personalización sigue
 * completa: cada clave de `DesignConfig` se sigue editando desde aquí.
 *
 * Los ajustes de fondo (posición, tamaño, visibilidad) aparecen solo con degradado o imagen,
 * que es cuando tienen efecto: sobre un color plano no cambian nada y solo hacían dudar.
 */
/**
 * Mantiene las opciones de la pregunta conectada a la grilla de ocasiones: «No» más cada ocasión.
 *
 * La grilla y la pregunta mostraban lo mismo sin estar unidas, y editar una no cambiaba la otra.
 * Conectadas, hay una sola lista; el servidor sigue validando la respuesta contra estas opciones.
 */
export function sincronizarPreguntaDeOcasiones(design: DesignConfig, fields: FormField[]): FormField[] {
  const idConectado = design.ocasionesPreguntaId;
  if (!idConectado) return fields;
  const titulos = leerOcasiones(design.ocasiones).map((ocasion) => ocasion.titulo.trim()).filter((titulo) => titulo && titulo.toLowerCase() !== 'nueva ocasión');
  if (titulos.length === 0) return fields;
  const opciones = ['No', ...new Set(titulos.filter((titulo) => titulo.toLowerCase() !== 'no'))];
  return fields.map((field) => (field.id === idConectado && field.type === 'select' ? { ...field, options: opciones } : field));
}

/** Frase con los primeros horarios que resultan de duración, margen y ritmo. */
function RitmoDeHorarios({ duracion, separacion, ritmo, ventana }: { duracion: number; separacion: number; ritmo: number; ventana?: { start: string; end: string } }) {
  if (!ventana || !(ritmo > 0)) return null;
  const aMinutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };
  const aHora = (minutos: number) => `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  const inicio = aMinutos(ventana.start); const fin = aMinutos(ventana.end) || 24 * 60;
  const horarios: string[] = [];
  for (let minuto = inicio; minuto + duracion <= fin && horarios.length < 5; minuto += ritmo) horarios.push(aHora(minuto));
  return <div className="ritmo-de-horarios" role="note">
    <strong>Así se ofrecen los horarios</strong>
    <span>Reservas de {duracion} min, una llegada cada {ritmo} min{separacion > 0 ? `, ${separacion} min para dejar lista la mesa` : ''}.</span>
    <span>{horarios.length > 0 ? `Ej. ${ventana.start}–${ventana.end}: ${horarios.join(', ')}${horarios.length === 5 ? '…' : ''}` : `Con ${duracion} min no cabe ninguna reserva entre ${ventana.start} y ${ventana.end}.`}</span>
    {ritmo < duracion && <small>Los horarios se superponen: el cupo «Personas por horario» se cuenta por cada llegada, no por la noche entera.</small>}
  </div>;
}

function DesignStudioControls({
  design,
  fields,
  surveyMode,
  onChange,
  onAsset,
  clientId,
}: {
  design: DesignConfig;
  fields: FormField[];
  surveyMode: boolean;
  onChange: (design: DesignConfig) => void;
  onAsset: (key: 'logoUrl' | 'backgroundImage', url: string) => void;
  clientId?: string;
}) {
  const update = (patch: Partial<DesignConfig>) => onChange({ ...design, ...patch });
  const backgroundMode = design.backgroundMode || (design.backgroundImage ? 'image' : 'color');
  const activePosition = design.backgroundAnchor || design.backgroundPosition || 'center center';
  const activeLayout = design.layoutPosition || 'right';
  const activeLogo = design.logoPosition || 'left';

  return (
    <div className="design-controls">
      <section className="design-starter">
        <span className="design-starter-eyebrow">EMPIEZA POR AQUÍ</span>
        <strong>Plantillas visuales</strong>
        <small>Una combinación completa de colores, letra y formas. Con elegir una alcanza para publicar.</small>
        <div className="design-templates">{DESIGN_TEMPLATES.map((template) => <button type="button" key={template.name} onClick={() => onChange({ ...design, ...template.config })}>{template.name}</button>)}</div>
      </section>

      <section className="design-essentials">
        <div className="design-quick-help"><strong>Lo esencial</strong><small>Título, logo, colores y fondo. Lo demás son ajustes finos que ya vienen resueltos por la plantilla.</small></div>
        <label>Título público<input className="input" value={design.title || ''} onChange={(event) => update({ title: event.target.value })} /></label>
        <label>Frase bajo el título<textarea className="input" rows={3} value={design.welcome || ''} onChange={(event) => update({ welcome: event.target.value })} /></label>
        <ImageUpload label="Logo de la empresa" value={design.logoUrl} onChange={(url) => onAsset('logoUrl', url)} placeholder="https://empresa.cl/logo.png" maxSizeMB={3} maxWidth={480} clientId={clientId} />
        <div className="color-controls"><label>Principal<input type="color" value={design.primaryColor || '#0ec6b8'} onChange={(event) => update({ primaryColor: event.target.value })} /></label><label>Acento<input type="color" value={design.accentColor || '#ea0f63'} onChange={(event) => update({ accentColor: event.target.value })} /></label><label>Fondo<input type="color" value={design.backgroundColor || '#f6f4f5'} onChange={(event) => update({ backgroundColor: event.target.value })} /></label><label>Letras<input type="color" value={design.textColor || '#3f4e49'} onChange={(event) => update({ textColor: event.target.value })} /></label></div>
        <div className="fondo-modos-campo"><span>Tipo de fondo</span>
          <div className="fondo-modos" role="radiogroup" aria-label="Tipo de fondo">
            {([['color', 'Color'], ['gradient', 'Degradado'], ['image', 'Imagen']] as const).map(([valor, etiqueta]) => (
              <button key={valor} type="button" role="radio" aria-checked={backgroundMode === valor} className={backgroundMode === valor ? 'active' : ''}
                onClick={() => update({ backgroundMode: valor, ...(valor === 'gradient' && !design.backgroundGradient ? { backgroundGradient: DEFAULT_BACKGROUND_GRADIENT } : {}) })}>{etiqueta}</button>
            ))}
          </div>
          {backgroundMode === 'color' && <small>Usa el color «Fondo» de arriba.</small>}
        </div>
        {backgroundMode === 'gradient' && <SelectorDeDegradado valor={design.backgroundGradient} alCambiar={(backgroundGradient) => update({ backgroundGradient })} predeterminado={leerDegradado(DEFAULT_BACKGROUND_GRADIENT)!} />}
        {backgroundMode === 'image' && <ImageUpload label="Imagen de fondo" value={design.backgroundImage} onChange={(url) => onAsset('backgroundImage', url)} placeholder="https://..." maxSizeMB={5} maxWidth={1920} clientId={clientId} />}
        {/* La claridad va junto a la imagen: escondida en «Cómo se recorta» nadie la encontraba. */}
        {backgroundMode === 'image' && <label className="fondo-claridad">Claridad sobre la imagen ({design.backgroundOpacity || '88'}%)<small>Cuánto se aclara la imagen para que el texto siga legible.</small><input type="range" min="0" max="100" value={design.backgroundOpacity || '88'} onChange={(event) => update({ backgroundOpacity: event.target.value })} /></label>}
      </section>

      {!surveyMode && <details className="design-section">
        <summary>Grilla de ocasiones (opcional)</summary>
        <div className="design-section-body">
          <small>Tarjetas con las ocasiones que atiende el local —cumpleaños, aniversario, after office—.</small>
          <label>Pregunta del formulario conectada<select className="input" value={design.ocasionesPreguntaId || ''} onChange={(event) => update({ ocasionesPreguntaId: event.target.value })}>
            <option value="">Ninguna: la grilla es sólo decorativa</option>
            {fields.filter((campo) => campo.type === 'select' && !campo.system).map((campo) => <option key={campo.id} value={campo.id}>«{campo.label}»</option>)}
          </select><small>{design.ocasionesPreguntaId ? 'Las opciones de esa pregunta son estas ocasiones (más «No»), y tocar una tarjeta la deja respondida.' : 'Si tu formulario pregunta qué celebra, conéctala para no mantener dos listas.'}</small></label>
          <label className="toggle-row"><input type="checkbox" checked={design.ocasionesEnabled === 'true'} onChange={(event) => update({ ocasionesEnabled: event.target.checked ? 'true' : 'false' })} /> Mostrarla en la página, al lado del formulario</label>
          <small>Independiente del aviso al entrar: puedes mostrarla sólo como aviso, sólo en la página, en los dos lugares o en ninguno.</small>
          <label className="toggle-row"><input type="checkbox" checked={design.ocasionesPopup === 'true'} onChange={(event) => update({ ocasionesPopup: event.target.checked ? 'true' : 'false', ...(event.target.checked ? { welcomePopupEnabled: 'false', ocasionesVeces: design.ocasionesVeces || '1' } : {}) })} /> Mostrarla como aviso al entrar</label>
          {design.ocasionesPopup === 'true' && <div className="ocasiones-aviso-ajustes">
            <label>Frase bajo el título <small>(opcional)</small><textarea className="input" rows={2} value={design.ocasionesTexto || ''} placeholder="Ej. Cuéntanos qué celebras y lo preparamos." onChange={(event) => update({ ocasionesTexto: event.target.value })} /></label>
            <label>Texto del botón<input className="input" value={design.ocasionesBoton || ''} placeholder="Reservar ahora" onChange={(event) => update({ ocasionesBoton: event.target.value })} /></label>
            <label>Veces que se muestra<select className="input" value={design.ocasionesVeces || '1'} onChange={(event) => update({ ocasionesVeces: event.target.value })}><option value="1">Una vez</option><option value="2">Dos veces</option><option value="3">Tres veces</option><option value="siempre">En cada visita</option></select><small>Se cuenta por navegador. Repetirlo siempre molesta a quien ya lo vio y viene a reservar.</small></label>
          </div>}
          <label className="toggle-row"><input type="checkbox" checked={design.ocasionesEnEmail === 'true'} onChange={(event) => update({ ocasionesEnEmail: event.target.checked ? 'true' : 'false' })} /> Incluirla en el correo de confirmación</label>
          <label>Fotos<select className="input" value={design.ocasionesFoto || 'completa'} onChange={(event) => update({ ocasionesFoto: event.target.value })}><option value="completa">Completas, sin recortar</option><option value="horizontal">Recortadas iguales, horizontales (4:3)</option><option value="cuadrada">Recortadas iguales, cuadradas</option><option value="vertical">Recortadas iguales, verticales (3:4)</option></select><small>Completas muestran toda la foto; recortadas dejan todas las tarjetas del mismo alto.</small></label>
          <label>Título de la grilla<input className="input" value={design.ocasionesTitulo || ''} placeholder="Ej. Para cada ocasión" onChange={(event) => update({ ocasionesTitulo: event.target.value })} /></label>
          {leerOcasiones(design.ocasiones).map((ocasion, indice) => (
            <div className="ocasion-fila" key={indice}>
              <label>Título<input className="input" value={ocasion.titulo} onChange={(event) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], titulo: event.target.value }; update({ ocasiones: JSON.stringify(lista) }); }} /></label>
              <label>Texto corto<input className="input" value={ocasion.texto || ''} onChange={(event) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], texto: event.target.value }; update({ ocasiones: JSON.stringify(lista) }); }} /></label>
              <ImageUpload label="Imagen" value={ocasion.imagen} maxSizeMB={3} maxWidth={800} clientId={clientId} placeholder="https://..." onChange={(url) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], imagen: url }; update({ ocasiones: JSON.stringify(lista) }); }} />
              <button type="button" className="btn btn-outline btn-xs" onClick={() => { const lista = leerOcasiones(design.ocasiones).filter((_, i) => i !== indice); update({ ocasiones: JSON.stringify(lista) }); }}>Quitar</button>
            </div>
          ))}
          {leerOcasiones(design.ocasiones).length < 6 && <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ ocasiones: JSON.stringify([...leerOcasiones(design.ocasiones), { titulo: 'Nueva ocasión' }]) })}>Agregar ocasión</button>}
        </div>
      </details>}

      <details className="design-section">
        <summary>Mensaje de bienvenida (opcional)</summary>
        <div className="design-section-body">
          <small>Un cuadro antes de empezar a reservar. Si la grilla de ocasiones se muestra al entrar, ese es el aviso y este mensaje no se usa.</small>
          <label className="toggle-row"><input type="checkbox" disabled={design.ocasionesPopup === 'true'} checked={design.welcomePopupEnabled === 'true' && design.ocasionesPopup !== 'true'} onChange={(event) => update({ welcomePopupEnabled: event.target.checked ? 'true' : 'false' })} /> Mostrar un mensaje de bienvenida al entrar</label>
          {design.welcomePopupEnabled === 'true' && design.ocasionesPopup !== 'true' && <div className="form-row"><label>Título<input className="input" value={design.welcomePopupTitle || ''} onChange={(event) => update({ welcomePopupTitle: event.target.value })} /></label><label>Texto<textarea className="input" rows={2} value={design.welcomePopupText || ''} onChange={(event) => update({ welcomePopupText: event.target.value })} /></label></div>}
          {design.welcomePopupEnabled === 'true' && design.ocasionesPopup !== 'true' && <label>Texto del botón<input className="input" value={design.welcomePopupBoton || ''} placeholder="Continuar" onChange={(event) => update({ welcomePopupBoton: event.target.value })} /></label>}
        </div>
      </details>

      <details className="design-section">
        <summary>Letra y bordes</summary>
        <div className="design-section-body">
          <label>Tipo de letra<select className="input" value={design.fontFamily || 'system-ui'} onChange={(event) => update({ fontFamily: event.target.value })}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Monospace</option></select></label>
          <div className="design-mini-grid"><label>Forma de botones<select className="input" value={design.buttonRadius || '12'} onChange={(event) => update({ buttonRadius: event.target.value })}><option value="4">Rectos</option><option value="12">Suaves</option><option value="999">Píldora</option></select></label><label>Forma de campos<select className="input" value={design.fieldRadius || '10'} onChange={(event) => update({ fieldRadius: event.target.value })}><option value="2">Rectos</option><option value="10">Suaves</option><option value="18">Redondeados</option></select></label></div>
        </div>
      </details>

      {/* Posición y tamaño sólo cambian algo con una imagen; con degradado no hacen nada. */}
      {backgroundMode === 'image' && <details className="design-section">
        <summary>Cómo se recorta el fondo</summary>
        <div className="design-section-body">
          <div className="design-control-group">
            <span>Posición del fondo</span>
            <div className="position-grid">
              {BACKGROUND_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activePosition === value ? 'active' : ''} title={label} aria-label={label} onClick={() => update({ backgroundAnchor: value, backgroundPosition: value.includes('top') ? 'top' : value.includes('bottom') ? 'bottom' : value.includes('left') ? 'left' : value.includes('right') ? 'right' : 'center' })} />)}
            </div>
          </div>
          <div className="segmented-control">
            <span>Tamaño del fondo</span>
            <div>{BACKGROUND_SIZES.map(([value, label]) => <button type="button" key={value} className={(design.backgroundSize || 'cover') === value ? 'active' : ''} onClick={() => update({ backgroundSize: value })}>{label}</button>)}</div>
          </div>
        </div>
      </details>}

      <details className="design-section">
        <summary>Qué se muestra arriba: logo, título y sellos</summary>
        <div className="design-section-body">
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showLogo)} onChange={(event) => update({ showLogo: String(event.target.checked) })} /> Mostrar logo</label>
          <label>Tamaño del logo ({design.logoSize || '96'}px de alto)<input type="range" min="32" max="240" value={design.logoSize || '96'} onChange={(event) => update({ logoSize: event.target.value })} /></label>
          <div className="segmented-control">
            <span>Alineación del logo</span>
            <div>{LOGO_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activeLogo === value ? 'active' : ''} onClick={() => update({ logoPosition: value })}>{label}</button>)}</div>
          </div>
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showEyebrow)} onChange={(event) => update({ showEyebrow: String(event.target.checked) })} /> Mostrar etiqueta superior</label>
          <label>Texto de la etiqueta<input className="input" value={design.eyebrowText || 'AGENDA EN LÍNEA'} onChange={(event) => update({ eyebrowText: event.target.value })} /></label>
          <label>Tamaño del título ({design.titleSize || '72'}px)<input type="range" min="32" max="96" value={design.titleSize || '72'} onChange={(event) => update({ titleSize: event.target.value })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showWelcome)} onChange={(event) => update({ showWelcome: String(event.target.checked) })} /> Mostrar la frase bajo el título</label>
          <label>Tamaño del mensaje ({design.welcomeSize || '16'}px)<input type="range" min="12" max="24" value={design.welcomeSize || '16'} onChange={(event) => update({ welcomeSize: event.target.value })} /></label>
          <div className="segmented-control">
            <span>Ubicación del formulario</span>
            <div>{LAYOUT_POSITIONS.map(([value, label]) => <button type="button" key={value} className={activeLayout === value ? 'active' : ''} onClick={() => update({ layoutPosition: value })}>{label}</button>)}</div>
          </div>
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showPoweredBy)} onChange={(event) => update({ showPoweredBy: String(event.target.checked) })} /> Mostrar “Gestionado con”</label>
          <label>Texto del pie<textarea className="input" rows={2} value={design.poweredByText || 'Gestionado con\nEspartanos Reservas'} onChange={(event) => update({ poweredByText: event.target.value })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showSecureBadge)} onChange={(event) => update({ showSecureBadge: String(event.target.checked) })} /> Mostrar sello “Reserva segura”</label>
          <label>Texto del sello<input className="input" value={design.secureBadgeText || 'Reserva segura'} onChange={(event) => update({ secureBadgeText: event.target.value })} /></label>
        </div>
      </details>

      <details className="design-section">
        <summary>Etiquetas de duración y confirmación</summary>
        <div className="design-section-body">
          <small>Los dos datos que aparecen bajo el título: cuánto dura la visita y si la reserva queda confirmada al momento.</small>
          <label className="toggle-row"><input type="checkbox" checked={visible(design.showFacts)} onChange={(event) => update({ showFacts: String(event.target.checked) })} /> Mostrarlos en la página</label>
          {visible(design.showFacts) && <div className="design-mini-grid"><label>Palabra para la duración<input className="input" value={design.durationLabel || 'minutos'} onChange={(event) => update({ durationLabel: event.target.value })} /></label><label>Palabra para la confirmación<input className="input" value={design.confirmationLabel || 'confirmación'} onChange={(event) => update({ confirmationLabel: event.target.value })} /></label></div>}
          {visible(design.showFacts) && <div className="design-mini-grid"><label>Si confirma sola<input className="input" value={design.automaticLabel || 'Directa'} onChange={(event) => update({ automaticLabel: event.target.value })} /></label><label>Si la revisa el local<input className="input" value={design.manualLabel || 'Manual'} onChange={(event) => update({ manualLabel: event.target.value })} /></label></div>}
        </div>
      </details>

      <details className="design-section">
        <summary>Pantalla de confirmación</summary>
        <div className="design-section-body">
          <label>Política de cancelación<small>Se muestra al reservar y en la confirmación.</small><textarea className="input" rows={3} value={design.cancellationPolicy || ''} onChange={(event) => update({ cancellationPolicy: event.target.value })} placeholder="Ej. Puedes cancelar sin costo hasta 2 horas antes." /></label>
          <label>Mensaje de confirmación<textarea className="input" rows={3} value={design.confirmationMessage || ''} onChange={(event) => update({ confirmationMessage: event.target.value })} placeholder="Tu reserva quedó registrada. Te esperamos." /></label>
          <label className="toggle-row"><input type="checkbox" checked={design.calendarSaveEnabled !== 'false'} onChange={(event) => update({ calendarSaveEnabled: String(event.target.checked) })} /> Ofrecer guardar la reserva en calendario</label>
          <label>Texto de esa opción<textarea className="input" rows={2} value={design.calendarSaveText || 'Al tocar una opción, tu dispositivo abrirá su calendario y te pedirá confirmar antes de guardar.'} onChange={(event) => update({ calendarSaveText: event.target.value })} /></label>
        </div>
      </details>

      {surveyMode && <details className="design-section">
        <summary>Encuesta y reseñas</summary>
        <div className="design-section-body">
          <label>Título de encuesta<input className="input" value={design.surveyTitle || ''} onChange={(event) => update({ surveyTitle: event.target.value })} placeholder="Cuéntanos cómo fue tu experiencia" /></label>
          <label>Ayuda de encuesta<textarea className="input" rows={2} value={design.surveyHelpText || ''} onChange={(event) => update({ surveyHelpText: event.target.value })} placeholder="Tus respuestas ayudan al local a mejorar cada visita." /></label>
          <label>URL de reseña en Google<input className="input" value={design.googleReviewUrl || ''} onChange={(event) => update({ googleReviewUrl: event.target.value })} placeholder="https://g.page/r/..." /></label>
          <label>Destacar Google desde ({design.googleReviewMinRating || '4'} estrellas)<input type="range" min="1" max="5" value={design.googleReviewMinRating || '4'} onChange={(event) => update({ googleReviewMinRating: event.target.value })} /></label>
        </div>
      </details>}

      <button type="button" className="btn btn-outline btn-sm design-reset" onClick={() => update({ showPoweredBy: 'true', poweredByText: 'Gestionado con\nEspartanos Reservas', showSecureBadge: 'true', secureBadgeText: 'Reserva segura', showLogo: 'true', showEyebrow: 'true', eyebrowText: 'AGENDA EN LÍNEA', showWelcome: 'true', showFacts: 'true', logoSize: '64', titleSize: '72', welcomeSize: '16', durationLabel: 'minutos', confirmationLabel: 'confirmación', automaticLabel: 'Directa', manualLabel: 'Manual', backgroundOpacity: '88', backgroundAnchor: 'center center', backgroundPosition: 'center', backgroundSize: 'cover', layoutPosition: 'right', logoPosition: 'left' })}>Restablecer diseño público</button>
    </div>
  );
}

function ReservationLivePreview({
  draft,
  fields,
  previewDevice,
  style,
}: {
  draft: ReservationForm;
  fields: FormField[];
  previewDevice: 'mobile' | 'desktop';
  style: CSSProperties;
}) {
  const design = draft.designConfig || {};
  /*
   * Las mismas preguntas y en el mismo orden que la página pública: sin las que se contestan en
   * otro lugar y con las condicionales ocultas, como las ve alguien al abrirla.
   */
  const camposEnOrden = camposVisibles(fields.filter((field) => field.id !== 'partySize' && field.type !== 'coupon' && field.id !== 'consent'), {});
  const ocultas = fields.filter((field) => field.mostrarSi?.campo).length - camposEnOrden.filter((field) => field.mostrarSi?.campo).length;
  const zonasActivas = (draft.resourcesConfig ?? []).filter((zona) => zona.active !== false);
  // Las mismas preguntas y condiciones que muestra la página pública.
  const preguntasDeVisita = ([
    ['askChildren', '¿Vienen niños o necesitas silla infantil?'],
    ['askAccessibility', '¿Alguien necesita accesibilidad?'],
    ['askAllergies', '¿Restricciones alimentarias?'],
    ['askSmoking', '¿Zona de fumadores?'],
    ['askSeating', '¿Qué mesa prefieres?'],
    ['askFirstVisit', '¿Es tu primera visita?'],
    ['askHowFound', '¿Cómo nos conociste?'],
  ] as const).filter(([clave]) => (design as Record<string, unknown>)[clave] === 'true' && !(clave === 'askSmoking' && zonasActivas.length > 0)).map(([, texto]) => texto);
  const ventana = draft.scheduleConfig?.windows?.[0];
  const ritmo = Number(design.slotCadenceMinutes || '15') || 15;
  const sampleSlots: string[] = [];
  if (ventana) {
    const [hi, mi] = ventana.start.split(':').map(Number); const [hf, mf] = ventana.end.split(':').map(Number);
    for (let minuto = hi * 60 + mi; minuto + draft.durationMinutes <= hf * 60 + mf && sampleSlots.length < 3; minuto += ritmo) sampleSlots.push(`${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`);
  }

  return (
    <div className={`design-preview live ${previewDevice} layout-${safeDesignChoice(design.layoutPosition, ['left', 'center', 'right'], 'right')}`} style={style}>
      <div className="preview-public-shell">
        <section className="preview-public-intro">
          {design.logoUrl && visible(design.showLogo) && <img className="reservation-logo-preview" src={design.logoUrl} alt="Logo configurado" />}
          <span>AGENDA EN LÍNEA</span>
          <h2>{design.title || draft.name}</h2>
          <p>{design.welcome || 'Elige el horario que mejor te acomode.'}</p>
          <div className="preview-public-facts">
            <div><strong>{draft.durationMinutes}</strong><span>minutos</span></div>
            <div><strong>{draft.confirmationMode === 'automatic' ? 'Directa' : 'Manual'}</strong><span>confirmación</span></div>
            <div><strong>{draft.timezone?.split('/').pop()?.replaceAll('_', ' ')}</strong><span>zona horaria</span></div>
          </div>
        </section>
        <section className="preview-public-card">
          <div className="booking-step-title"><span>01</span><div><strong>Selecciona fecha y hora</strong><small>Personas, fecha y hora se eligen aquí.</small></div></div>
          <div className="preview-slot-group">
            <h3>{sampleSlots.length ? 'Horarios de ejemplo' : 'Sin días de atención configurados'}</h3>
            <div>{sampleSlots.map((slot, index) => <button type="button" className={index === 0 ? 'active' : ''} key={slot}>{slot}<small>{draft.capacityPerSlot} disp.</small></button>)}</div>
          </div>
          <div className="booking-step-title"><span>02</span><div><strong>Datos de la reserva</strong><small>Estos son los campos configurados.</small></div></div>
          <div className="preview-public-fields">
            {camposEnOrden.map((field) => <PreviewField key={field.id} label={field.label} required={field.required} type={field.type} options={field.options} />)}
            {ocultas > 0 && <small className="preview-nota">{ocultas} pregunta{ocultas === 1 ? '' : 's'} más aparece{ocultas === 1 ? '' : 'n'} según lo que se responda.</small>}
            {preguntasDeVisita.length > 0 && <div className="preview-preferencias"><strong>Preferencias de la visita (opcional)</strong>{preguntasDeVisita.map((pregunta) => <PreviewField key={pregunta} label={pregunta} type="select" />)}</div>}
          </div>
          {design.groupRequestEnabled !== 'false' && <div className="preview-evento"><strong>¿Es un evento o una celebración?</strong><span>Solicitar evento →</span></div>}
          <span className="preview-submit">Confirmar reserva</span>
          <p className="privacy-note">Tus datos no son públicos y quedan asociados exclusivamente a esta empresa.</p>
        </section>
      </div>
    </div>
  );
}

function PreviewField({ label, required, type = 'text', options }: { label: string; required?: boolean; type?: string; options?: string[] }) {
  if ((type === 'select' || type === 'multi_select') && options?.length) return <fieldset className="preview-opciones"><legend>{label}{required ? ' *' : ''}</legend>{options.slice(0, 6).map((opcion) => <span key={opcion}><i className={type === 'multi_select' ? 'es-casilla' : 'es-radio'} />{opcion}</span>)}</fieldset>;
  if (type === 'consent') return <label className="preview-consent"><span className="preview-checkbox" />{label}{required ? ' *' : ''}</label>;
  if (type === 'textarea') return <label>{label}{required ? ' *' : ''}<span className="preview-input textarea" /></label>;
  if (type === 'select' || type === 'multi_select') return <label>{label}{required ? ' *' : ''}<span className="preview-input select">Selecciona una opción</span></label>;
  return <label>{label}{required ? ' *' : ''}<span className="preview-input" /></label>;
}
