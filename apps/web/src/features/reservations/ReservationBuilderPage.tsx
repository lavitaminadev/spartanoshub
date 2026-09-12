import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
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

const FIELD_LIBRARY = [
  ['text', 'Texto corto'], ['textarea', 'Texto largo'], ['email', 'Correo'],
  ['phone', 'Teléfono'], ['select', 'Selector'], ['multi_select', 'Selección múltiple'],
  ['number', 'Número'], ['date', 'Fecha'], ['consent', 'Aceptación'],
  ['rating', 'Calificación'], ['coupon', 'Cupón promocional'],
] as const;
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
const RECOMMENDED_FIELDS = new Set(['text', 'phone', 'email', 'number', 'consent', 'rating']);
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
    '--booking-logo-size': `${safeNumber(design.logoSize, 64, 32, 180)}px`,
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
  const openEditor = (field: FormField) => { setEditingField(field); setEditingDraft({ ...field }); };
  const closeEditor = (save: boolean) => {
    if (save && editingDraft) {
      change({ fieldSchema: fields.map((f) => f.id === editingField?.id ? editingDraft : f) });
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
  const zones = draft?.resourcesConfig ?? [];
  const setZones = (next: NonNullable<ReservationForm['resourcesConfig']>) => change({ resourcesConfig: next });
  const updateZone = (index: number, patch: Partial<NonNullable<ReservationForm['resourcesConfig']>[number]>) => setZones(zones.map((zone, current) => (current === index ? { ...zone, ...patch } : zone)));
  const addZone = () => setZones([...zones, { id: `zona-${Date.now()}`, name: '', capacity: draft?.capacityPerSlot ?? 1, description: '', smokingAllowed: false }]);
  const teamEmails = (draft?.teamNotifications || []).join(', ');
  /** No hay hora posible cuando lo más temprano reservable cae después de lo más lejano. */
  const ventanaImposible = Boolean(draft) && draft.minimumNoticeHours > draft.maximumAdvanceDays * 24;
  /** La pausa se escribe en la zona del local: una hora que no existe allí se rechaza al guardar. */
  const setBookingPause = (valor: string) => {
    try { cambiarAjuste('bookingPausedUntil', valor ? localInputToUtc(valor, draft?.timezone || 'America/Santiago') : ''); }
    catch { triggerToast('Selecciona una hora válida para la zona de la sucursal.', 'error'); }
  };

  const deleteBlock = useMutation({ mutationFn: (blockId: string) => api.delete(`/reservations/blocks/${blockId}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservation-blocks', id] }); triggerToast('Bloqueo eliminado'); } });

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
  const fieldLibrary = surveyMode ? FIELD_LIBRARY : FIELD_LIBRARY.filter(([type]) => type !== 'rating');

  const addField = (type: string) => {
    const field: FormField = { id: `field_${uuid().slice(0, 8)}`, type, label: FIELD_LIBRARY.find(([key]) => key === type)?.[1] || 'Campo', required: false, ...(['select', 'multi_select'].includes(type) ? { options: ['Opción 1', 'Opción 2'] } : {}) };
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
        <button type="button" className="btn btn-outline btn-sm" onClick={openPreview}>{previewLabel}</button><button className="btn btn-primary btn-sm" disabled={saved || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>{saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}</button></div>
    </header>
    {saveMutation.error && <div className="builder-error alert alert-error">{saveMutation.error.message}</div>}
    <div className="builder-progress">{(clientMode ? PASOS_VISIBLES.cliente : PASOS_VISIBLES.equipo).map((real, index) => <button className={step === real ? 'active' : step > real ? 'done' : ''} key={STEPS[real]} onClick={() => setStep(real)}><span>{step > real ? '✓' : index + 1}</span>{STEPS[real]}</button>)}</div>

    {step === 0 && <Fragment>
      <div className="builder-grid">
        <div className="field-extras">
          <strong className="field-extras-title">Preguntas de la visita</strong>
          <small className="schedule-nota">Estas tres son fijas a propósito: sus respuestas alimentan los avisos de la lista, el correo y la exportación, así que renombrarlas haría que el sistema mostrara una etiqueta y guardara otra cosa. Para cualquier otra pregunta, agrega un campo propio al formulario de aquí al lado.</small>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askChildren === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askChildren: String(event.target.checked) } })} /> Preguntar por niños o silla infantil</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askAccessibility === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askAccessibility: String(event.target.checked) } })} /> Preguntar por accesibilidad</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.askAllergies === 'true'} onChange={(event) => change({ designConfig: { ...draft.designConfig, askAllergies: String(event.target.checked) } })} /> Preguntar por restricciones alimentarias</label>
          <label className="toggle-row wide"><input type="checkbox" checked={draft.designConfig?.couponEnabled !== 'false'} onChange={(event) => change({ designConfig: { ...draft.designConfig, couponEnabled: event.target.checked ? 'true' : 'false' } })} /> Aceptar cupones promocionales</label>
        </div>
        <aside className="field-library"><span className="page-eyebrow">BIBLIOTECA DE CAMPOS</span><h3>Agrega campos</h3><p>Arrastra al formulario o usa los botones.</p>
          <div className="field-library-help field-library-meta"><strong>Campos que mejoran CAPI</strong><small>Nombre, teléfono, correo y consentimiento aumentan la calidad de coincidencia en Meta (EMQ). Cada campo que agregues sin estos reduce la tasa de match.</small></div>{fieldLibrary.map(([type, label]) => <button draggable onDragStart={(event) => beginNewFieldDrag(event, type)} onDragEnd={() => setCanvasDragOver(false)} onClick={() => addField(type)} key={type} className={RECOMMENDED_FIELDS.has(type) ? 'recommended' : ''}><span>{label.slice(0, 2).toUpperCase()}</span><div><strong>{label}</strong><small>{RECOMMENDED_FIELDS.has(type) ? 'Recomendado para reservas' : 'Campo opcional'}</small></div><em>Agregar</em></button>)}</aside>
        <main className={`builder-canvas ${canvasDragOver ? 'drag-over' : ''}`} onDragEnter={() => setCanvasDragOver(true)} onDragLeave={(event) => { if (event.currentTarget === event.target) setCanvasDragOver(false); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setCanvasDragOver(true); }} onDrop={(event) => { event.preventDefault(); setCanvasDragOver(false); const { newField, fieldId } = builderDragPayload(event); if (newField) { addField(newField); return; } if (fieldId && fields.length > 1) { const current = fields.find((field) => field.id === fieldId); if (current && fields[fields.length - 1]?.id !== fieldId) change({ fieldSchema: [...fields.filter((field) => field.id !== fieldId), current] }); } }}>
          <div className="canvas-intro"><span>FORMULARIO</span><h2>{design.title || draft.name}</h2><p>{design.welcome}</p><small>Arrastra campos o usa los botones de cada fila.</small></div>
          {fields.length > RECOMMENDED_FIELD_COUNT && <div className="canvas-scope-hint" role="status">
            <strong>{fields.length} campos en el formulario</strong>
            <span>El alcance pide lo mínimo: nombre, teléfono, correo opcional y número de personas. La fecha y la hora las resuelve la agenda. Cada campo extra baja la tasa de reserva desde el celular, que es por donde llega casi todo el tráfico de los anuncios.</span>
          </div>}
          {fields.map((field, index) => <article tabIndex={0} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const { fieldId } = builderDragPayload(event); if (fieldId) reorder(fieldId, field.id); }} className={`canvas-field ${selected === field.id ? 'selected' : ''}`} key={field.id} onClick={() => setSelected(field.id)} onFocus={() => setSelected(field.id)}>
            <span className="drag-handle" draggable onDragStart={(event) => beginExistingFieldDrag(event, field.id)} aria-label="Arrastrar para ordenar" title="Arrastrar para ordenar">⠿</span><div><label>{field.label}{field.required && ' *'}{field.system && <em> Protegido</em>}</label><div className="field-preview-input">{field.placeholder || (['select', 'multi_select'].includes(field.type) ? 'Selecciona una opcion' : 'Respuesta del visitante')}</div></div><div className="field-actions">
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Editar ${field.label}`} onClick={(e) => { e.stopPropagation(); openEditor(field); }} title="Editar campo"><VitaIcons.edit /></button>
              {!field.system && <button type="button" className="btn btn-sm btn-outline btn-danger" aria-label={`Eliminar ${field.label}`} onClick={(e) => { e.stopPropagation(); setConfirmDeleteField(field.id); }} title="Eliminar campo"><VitaIcons.delete /></button>}
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Subir ${field.label}`} disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveField(field.id, -1); }} title="Subir">↑</button>
              <button type="button" className="btn btn-sm btn-outline" aria-label={`Bajar ${field.label}`} disabled={index === fields.length - 1} onClick={(e) => { e.stopPropagation(); moveField(field.id, 1); }} title="Bajar">↓</button>
            </div>
          </article>)}
          <div className="canvas-drop"><strong>Todo este flujo es zona para arrastrar</strong><span>Suelta en cualquier espacio libre para agregar al final, o sobre un campo para ordenar.</span></div>
        </main>
      </div>
      {editingField && editingDraft && <div className="field-editor-overlay" onClick={() => closeEditor(true)}><div className="field-editor-popup" onClick={(e) => e.stopPropagation()}>
        <div className="field-editor-header"><h3>Editar {editingDraft.label}</h3><button type="button" className="btn btn-sm btn-outline" onClick={() => closeEditor(true)}>✕</button></div>
        <div className="field-editor-body">
          <label>Etiqueta<input className="input" value={editingDraft.label} onChange={(e) => updateEditor({ label: e.target.value })} /></label>
          <label>Texto de ayuda<input className="input" value={editingDraft.placeholder || ''} onChange={(e) => updateEditor({ placeholder: e.target.value })} /></label>
          {!editingDraft.system && <label className="toggle-row"><input type="checkbox" checked={editingDraft.required} onChange={(e) => updateEditor({ required: e.target.checked })} /> Campo obligatorio</label>}
          {editingDraft.options && <label>Opciones (una por linea)<textarea className="input" rows={6} value={editingDraft.options.join('\n')} onChange={(e) => updateEditor({ options: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean) })} /></label>}
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
          <label className="capacity-primary">Tope diario de reservas<small>0 = sin límite. Al alcanzarlo, el día se muestra completo en la página pública.</small><input className="input" type="number" min="0" max="5000" value={draft.dailyCapacity ?? 0} onChange={(event) => change({ dailyCapacity: Number(event.target.value) })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.enforceCompanyDailyCap !== 'false'} onChange={(event) => cambiarAjuste('enforceCompanyDailyCap', String(event.target.checked))} /> Aplicar además el tope diario global de la empresa</label>
          <label>Cupos por bloque<input className="input" type="number" min="1" max="500" value={draft.capacityPerSlot} onChange={(event) => change({ capacityPerSlot: Number(event.target.value) })} /></label>
          <label>Duración<select className="input" value={draft.durationMinutes} onChange={(event) => change({ durationMinutes: Number(event.target.value) })}>{[15, 30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label>
        </div>
        <div className="schedule-timezone">
          <span>Zona horaria</span>
          <strong>{draft.timezone}</strong>
          {cambiandoZona
            ? <select className="input" aria-label="Zona horaria" value={draft.timezone} onChange={(event) => { change({ timezone: event.target.value }); setCambiandoZona(false); }}>{TIMEZONES.map((timezone) => <option key={timezone}>{timezone}</option>)}</select>
            : <button type="button" className="btn btn-outline btn-xs" onClick={() => setCambiandoZona(true)}>Cambiar</button>}
          <small>Con esta hora se calculan los horarios, los bloqueos y los recordatorios. Cambiarla mueve también lo que ya está publicado y reservado.</small>
        </div>

        {/* Fuera del desplegable: avisaba de una agenda que no ofrece nada, escondido tras un
            resumen cerrado que justamente no se abre cuando todo parece estar bien. */}
        {ventanaImposible && <div className="alert alert-error">La anticipación mínima ({draft.minimumNoticeHours} h) cae fuera de la ventana máxima ({draft.maximumAdvanceDays} día{draft.maximumAdvanceDays === 1 ? '' : 's'}): con estos valores la página no ofrece ningún horario. Está en «Ajustes avanzados».</div>}
        <details className="schedule-advanced" open={ventanaImposible}>
          <summary>Ajustes avanzados</summary>
          <div className="schedule-settings schedule-settings-wide"><label>Separación (min)<input className="input" type="number" min="0" max="240" value={draft.bufferMinutes} onChange={(event) => change({ bufferMinutes: Number(event.target.value) })} /></label><label>Anticipación mínima (h)<input className="input" type="number" min="0" value={draft.minimumNoticeHours} onChange={(event) => change({ minimumNoticeHours: Number(event.target.value) })} /></label><label>Ventana máxima (días)<input className="input" type="number" min="1" max="365" value={draft.maximumAdvanceDays} onChange={(event) => change({ maximumAdvanceDays: Number(event.target.value) })} aria-invalid={ventanaImposible} /></label><label>Confirmación<select className="input" value={draft.confirmationMode} onChange={(event) => change({ confirmationMode: event.target.value })}><option value="automatic">Automática</option><option value="manual">Revisión manual</option></select></label>
            <label>Ritmo de llegadas (min)<input className="input" type="number" min="5" max="240" value={String(draft.designConfig?.slotCadenceMinutes || '15')} onChange={(event) => change({ designConfig: { ...draft.designConfig, slotCadenceMinutes: event.target.value } })} /></label><label>Retener cupo (min)<input className="input" type="number" min="1" max="30" value={String(draft.designConfig?.holdMinutes || '5')} onChange={(event) => change({ designConfig: { ...draft.designConfig, holdMinutes: event.target.value } })} /></label></div>
        </details>
        <h3>Grupos grandes y eventos</h3>
        <div className="schedule-capacity">
          <label className="capacity-primary">Solicitudes de evento o grupo<small>Quien no encuentre hora puede pedir un evento sin tomar cupo. El equipo lo resuelve desde Reservas.</small>
            <select className="input" value={draft.designConfig?.groupRequestEnabled === 'false' ? 'no' : 'si'} onChange={(event) => change({ designConfig: { ...draft.designConfig, groupRequestEnabled: event.target.value === 'si' ? 'true' : 'false' } })}>
              <option value="si">Aceptar solicitudes</option>
              <option value="no">No aceptar</option>
            </select>
          </label>
          <label>Grupo grande desde<small>Sobre esta cantidad la reserva pasa por el equipo.</small><input className="input" type="number" min="2" max="100" value={String(draft.designConfig?.groupThreshold || '8')} onChange={(event) => change({ designConfig: { ...draft.designConfig, groupThreshold: event.target.value } })} /></label>
        </div>

        <h3>Cuándo se cierra el turno</h3>
        <div className="schedule-settings">
          <label>Tolerancia antes de no-show (min)<input className="input" type="number" min="0" value={String(draft.designConfig?.toleranceMinutes || '15')} onChange={(event) => change({ designConfig: { ...draft.designConfig, toleranceMinutes: event.target.value } })} /></label>
          <label className="toggle-row"><input type="checkbox" checked={draft.designConfig?.autoCloseAttendance !== 'false'} onChange={(event) => change({ designConfig: { ...draft.designConfig, autoCloseAttendance: String(event.target.checked) } })} /> Cerrar la asistencia sola</label>
          <label>Margen posterior (min)<input className="input" type="number" min="15" max="1440" disabled={draft.designConfig?.autoCloseAttendance === 'false'} value={String(draft.designConfig?.autoCloseAfterMinutes || '60')} onChange={(event) => change({ designConfig: { ...draft.designConfig, autoCloseAfterMinutes: event.target.value } })} /></label>
        </div>

        <h3>Semana habitual</h3><div className="week-editor week-editor-multi">{DAYS.map((label, uiDay) => { const jsDay = UI_TO_JS_DAY[uiDay]; const dayWindows = windows.map((window, index) => ({ window, index })).filter((entry) => entry.window.day === jsDay); return <div key={label} className={dayWindows.length ? 'enabled' : ''}><label className="toggle-row"><input type="checkbox" checked={dayWindows.length > 0} onChange={() => toggleDay(uiDay)} /><strong>{label}</strong></label><div className="day-windows">{dayWindows.map(({ window, index }) => <div key={`${jsDay}-${index}`}><input aria-label={`Inicio ${label}`} type="time" value={window.start} onChange={(event) => updateWindow(index, { start: event.target.value })} /><span>a</span><input aria-label={`Fin ${label}`} type="time" value={window.end} onChange={(event) => updateWindow(index, { end: event.target.value })} /><button type="button" aria-label={`Quitar franja de ${label}`} onClick={() => removeWindow(index)}>×</button></div>)}{dayWindows.length > 0 && dayWindows.length < 4 && <button type="button" className="add-window" onClick={() => addWindow(uiDay)}>+ Agregar franja</button>}{dayWindows.length === 0 && <em>Cerrado</em>}</div></div>; })}</div></div>
      <section className="schedule-card" id="pausa"><div><h3>Detener todo por un tiempo</h3><p className="page-subtitle">La página pública no ofrecerá horarios hasta la fecha indicada. No elimina reservas ni despublica el local.</p></div><div className="schedule-settings"><label>Reanudar automáticamente el<input className="input" type="datetime-local" value={utcToLocalInput(draft.designConfig?.bookingPausedUntil, draft.timezone)} onChange={(event) => setBookingPause(event.target.value)} /></label></div><button type="button" className="btn btn-outline btn-sm" disabled={!draft.designConfig?.bookingPausedUntil} onClick={() => cambiarAjuste('bookingPausedUntil', '')}>Quitar pausa programada</button></section>
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
          <form className="block-form" onSubmit={(event) => { event.preventDefault(); if (blockRepeat > 1) { batchBlockMutation.mutate({ ...block, repeat: blockRepeat }); } else { blockMutation.mutate(block); } }}><label>Desde<input className="input" type="datetime-local" required value={block.startsAt} onChange={(event) => setBlock({ ...block, startsAt: event.target.value })} /></label><label>Hasta<input className="input" type="datetime-local" required value={block.endsAt} onChange={(event) => setBlock({ ...block, endsAt: event.target.value })} /></label><label>Motivo<input className="input" value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Feriado, evento interno..." /></label><label>Repetir durante<small>Cantidad de semanas consecutivas.</small><input className="input" type="number" min="1" max="12" value={blockRepeat} onChange={(event) => setBlockRepeat(Number(event.target.value))} /></label>{batchBlockMutation.error && <div className="alert alert-error">{batchBlockMutation.error.message}</div>}<button className="btn btn-primary btn-block" disabled={blockMutation.isPending || batchBlockMutation.isPending}>{batchBlockMutation.isPending ? 'Creando bloqueos...' : blockRepeat > 1 ? `Crear ${blockRepeat} bloqueos` : 'Agregar bloqueo'}</button></form>
        </details>
        <div className="block-list">{blocks.length === 0 ? <p className="page-subtitle">No hay bloqueos futuros.</p> : blocks.map((item) => <div key={item.id}><div><strong>{item.reason || 'Agenda cerrada'}</strong><small>{new Date(item.startsAt).toLocaleString('es-CL')} → {new Date(item.endsAt).toLocaleString('es-CL')}</small></div><button onClick={() => setConfirmDeleteBlock(item.id)}>Quitar</button></div>)}</div></aside>
    </div></div>}

    {step === 2 && <div className="builder-stage">
      <div className="stage-heading"><span className="page-eyebrow">ENTORNO VISUAL</span><h2>Haz que {surveyMode ? 'la encuesta' : 'la reserva'} se sienta propia.</h2><p>Elige una plantilla y ajusta solo lo que quieras cambiar. Cada bloque cerrado ya trae un valor que funciona.</p></div>
      <div className="design-studio">
        <DesignStudioControls design={design} surveyMode={surveyMode} onChange={(designConfig) => change({ designConfig })} onAsset={saveDesignAsset} />
        <div className="design-preview-column">
          <div className="preview-device-toggle"><button type="button" className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>Vista móvil</button><button type="button" className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>Vista escritorio</button></div>
          <ReservationLivePreview draft={draft} fields={fields} previewDevice={previewDevice} style={designPreviewStyle} />
        </div>
      </div>
    </div>}

    {!clientMode && step === 3 && <div className="builder-stage">
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
      <div className="stage-heading"><span className="page-eyebrow">DATOS DEL LOCAL</span><h2>Quién responde, a quién se avisa y qué se acepta</h2><p>Los horarios se configuran en Disponibilidad y la apariencia en Diseño público.</p></div>
      <section className="reservation-readiness"><div><span className="page-eyebrow">RESPONSABLE Y CONTACTO</span><h2>Información visible para quien reserva</h2></div><div className="form-row"><label>Razón social o responsable<input className="input" value={String(draft.designConfig?.legalCompanyName || '')} onChange={(e) => cambiarAjuste('legalCompanyName', e.target.value)} /></label><label>RUT / identificador<input className="input" value={String(draft.designConfig?.legalCompanyId || '')} onChange={(e) => cambiarAjuste('legalCompanyId', e.target.value)} /></label><label>Correo de soporte<input className="input" type="email" value={String(draft.designConfig?.supportEmail || '')} onChange={(e) => cambiarAjuste('supportEmail', e.target.value)} /></label></div><div className="form-row"><label>WhatsApp del local<input className="input" value={String(draft.designConfig?.whatsappBusinessNumber || '')} onChange={(e) => cambiarAjuste('whatsappBusinessNumber', e.target.value)} placeholder="+56 9 1234 5678" /></label><label>Mensaje para grupos<textarea className="input" value={String(draft.designConfig?.whatsappGroupMessage || '')} onChange={(e) => cambiarAjuste('whatsappGroupMessage', e.target.value)} /></label></div><div className="form-row"><label>URL de privacidad<input className="input" type="url" value={String(draft.designConfig?.privacyUrl || '')} onChange={(e) => cambiarAjuste('privacyUrl', e.target.value)} placeholder="https://..." /></label><label>URL de condiciones<input className="input" type="url" value={String(draft.designConfig?.termsUrl || '')} onChange={(e) => cambiarAjuste('termsUrl', e.target.value)} placeholder="https://..." /></label></div><label>Política de cancelación visible<textarea className="input" value={String(draft.designConfig?.cancellationPolicy || '')} onChange={(e) => cambiarAjuste('cancellationPolicy', e.target.value)} /></label></section>
      {/*
        * Los correos salen siempre desde el servidor de Espartanos. Esta casilla no cambia el
        * remitente: dice a qué bandejas del local llega el aviso de cada reserva nueva. Sin
        * ninguna dirección, el equipo sólo se entera entrando al panel.
        *
        * El calendario aparece únicamente si Google está conectado en la organización; activarlo
        * sin conexión dejaba reservas esperando un evento que nunca se creaba.
        */}
      <section className="reservation-readiness"><div><span className="page-eyebrow">AVISOS AL EQUIPO</span><h2>A quién le llega cada reserva nueva</h2></div><label>Casillas del local<input className="input" value={teamEmails} onChange={(e) => change({ teamNotifications: e.target.value.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean) })} placeholder="reservas@local.cl, gerente@local.cl" /><small>Separa varias con coma. El correo lo envía Espartanos a estas casillas; no cambia el remitente que ve quien reserva.</small></label>{draft.calendarReady ? <label className="toggle-row"><input type="checkbox" checked={Boolean(draft.calendarEnabled)} onChange={(e) => change({ calendarEnabled: e.target.checked })} /> Crear también el evento en el calendario de Google conectado</label> : <small className="page-subtitle">El calendario de Google no está conectado en esta organización, así que no se ofrece.</small>}</section>
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
        {draft.designConfig?.networkConsentEnabled === 'true' && <div className="form-row"><label>Nombre de la red<input className="input" value={String(draft.designConfig?.networkBrandName || '')} onChange={(e) => cambiarAjuste('networkBrandName', e.target.value)} placeholder="Espartanos" /></label><label>Texto de la autorización<textarea className="input" rows={3} value={String(draft.designConfig?.networkConsentText || '')} onChange={(e) => cambiarAjuste('networkConsentText', e.target.value)} /></label><label>Versión<input className="input" value={String(draft.designConfig?.networkConsentVersion || 'red-v1')} onChange={(e) => cambiarAjuste('networkConsentVersion', e.target.value)} /></label></div>}
        {draft.designConfig?.networkConsentEnabled === 'true' && !draft.designConfig?.privacyUrl && <small className="error-text">Falta la URL de privacidad: sin ella, quien reserva no tiene dónde leer el detalle de ese tratamiento.</small>}
      </section>
      <section className="reservation-readiness" id="zonas"><div><span className="page-eyebrow">ZONAS Y PREFERENCIAS</span><h2>Terraza, salón y condiciones de visita</h2><p className="page-subtitle">Desactivar conserva la zona y su historial, pero deja de mostrarla para nuevas reservas.</p></div>{zones.map((zone, index) => <div className="reservation-zone-row" key={zone.id}><label>Nombre<input className="input" value={zone.name} onChange={(e) => updateZone(index, { name: e.target.value })} placeholder="Ej. Terraza" /></label><label>Cupo<input className="input" type="number" min="1" max="500" value={zone.capacity || draft.capacityPerSlot} onChange={(e) => updateZone(index, { capacity: Number(e.target.value) })} /></label><label>Descripción<input className="input" value={zone.description || ''} onChange={(e) => updateZone(index, { description: e.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={Boolean(zone.smokingAllowed)} onChange={(e) => updateZone(index, { smokingAllowed: e.target.checked })} /> Fumadores</label><label className="toggle-row"><input type="checkbox" checked={zone.active !== false} onChange={(e) => updateZone(index, { active: e.target.checked })} /> Disponible para reservar</label><button type="button" className="btn btn-outline btn-sm" onClick={() => updateZone(index, { active: zone.active === false })}>{zone.active === false ? 'Activar' : 'Desactivar'}</button></div>)}<button type="button" className="btn btn-outline btn-sm" onClick={addZone}>Agregar zona</button></section>
    </div>}

    <footer className="builder-footer"><span>Paso {(clientMode ? PASOS_VISIBLES.cliente : PASOS_VISIBLES.equipo).indexOf(step) + 1} de {clientMode ? PASOS_VISIBLES.cliente.length : PASOS_VISIBLES.equipo.length}</span>{step > 0 && <button className="btn btn-outline btn-sm" onClick={() => setStep(clientMode && step === 4 ? 2 : step - 1)}>Anterior</button>}{step < STEPS.length - 1 && <button className="btn btn-primary btn-sm" onClick={() => setStep(clientMode && step === 2 ? 4 : step + 1)}>Continuar</button>}{step < STEPS.length - 1 && <button className="btn btn-outline btn-sm" disabled={saved || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>Guardar</button>}</footer>
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
function DesignStudioControls({
  design,
  surveyMode,
  onChange,
  onAsset,
}: {
  design: DesignConfig;
  surveyMode: boolean;
  onChange: (design: DesignConfig) => void;
  onAsset: (key: 'logoUrl' | 'backgroundImage', url: string) => void;
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
        <ImageUpload label="Logo de la empresa" value={design.logoUrl} onChange={(url) => onAsset('logoUrl', url)} placeholder="https://empresa.cl/logo.png" maxSizeMB={3} />
        <div className="color-controls"><label>Principal<input type="color" value={design.primaryColor || '#0ec6b8'} onChange={(event) => update({ primaryColor: event.target.value })} /></label><label>Acento<input type="color" value={design.accentColor || '#ea0f63'} onChange={(event) => update({ accentColor: event.target.value })} /></label><label>Fondo<input type="color" value={design.backgroundColor || '#f6f4f5'} onChange={(event) => update({ backgroundColor: event.target.value })} /></label><label>Letras<input type="color" value={design.textColor || '#3f4e49'} onChange={(event) => update({ textColor: event.target.value })} /></label></div>
        <label>Tipo de fondo<select className="input" value={backgroundMode} onChange={(event) => update({ backgroundMode: event.target.value, ...(event.target.value === 'gradient' && !design.backgroundGradient ? { backgroundGradient: DEFAULT_BACKGROUND_GRADIENT } : {}) })}><option value="color">Color plano</option><option value="gradient">Degradado</option><option value="image">Imagen</option></select></label>
        {backgroundMode === 'gradient' && <label>Degradado<input className="input" value={design.backgroundGradient || DEFAULT_BACKGROUND_GRADIENT} onChange={(event) => update({ backgroundGradient: event.target.value })} /></label>}
        {backgroundMode === 'image' && <ImageUpload label="Imagen de fondo" value={design.backgroundImage} onChange={(url) => onAsset('backgroundImage', url)} placeholder="https://..." maxSizeMB={5} />}
      </section>

      {!surveyMode && <details className="design-section">
        <summary>Grilla de ocasiones (opcional)</summary>
        <div className="design-section-body">
          <small>Una grilla con las ocasiones que atiende el local —cumpleaños, aniversario, after office—. Es solo visual: ayuda a que quien entra se imagine su visita.</small>
          <label className="toggle-row"><input type="checkbox" checked={design.ocasionesEnabled === 'true'} onChange={(event) => update({ ocasionesEnabled: event.target.checked ? 'true' : 'false' })} /> Mostrar la grilla en la página</label>
          <label className="toggle-row"><input type="checkbox" checked={design.ocasionesEnEmail === 'true'} onChange={(event) => update({ ocasionesEnEmail: event.target.checked ? 'true' : 'false' })} /> Incluirla en el correo de confirmación</label>
          <label>Título de la grilla<input className="input" value={design.ocasionesTitulo || ''} placeholder="Ej. Para cada ocasión" onChange={(event) => update({ ocasionesTitulo: event.target.value })} /></label>
          {leerOcasiones(design.ocasiones).map((ocasion, indice) => (
            <div className="ocasion-fila" key={indice}>
              <label>Título<input className="input" value={ocasion.titulo} onChange={(event) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], titulo: event.target.value }; update({ ocasiones: JSON.stringify(lista) }); }} /></label>
              <label>Texto corto<input className="input" value={ocasion.texto || ''} onChange={(event) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], texto: event.target.value }; update({ ocasiones: JSON.stringify(lista) }); }} /></label>
              <ImageUpload label="Imagen" value={ocasion.imagen} maxSizeMB={3} placeholder="https://..." onChange={(url) => { const lista = leerOcasiones(design.ocasiones); lista[indice] = { ...lista[indice], imagen: url }; update({ ocasiones: JSON.stringify(lista) }); }} />
              <button type="button" className="btn btn-outline btn-xs" onClick={() => { const lista = leerOcasiones(design.ocasiones).filter((_, i) => i !== indice); update({ ocasiones: JSON.stringify(lista) }); }}>Quitar</button>
            </div>
          ))}
          {leerOcasiones(design.ocasiones).length < 6 && <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ ocasiones: JSON.stringify([...leerOcasiones(design.ocasiones), { titulo: 'Nueva ocasión' }]) })}>Agregar ocasión</button>}
        </div>
      </details>}

      <details className="design-section">
        <summary>Aviso al entrar (opcional)</summary>
        <div className="design-section-body">
          <small>Un cuadro antes de empezar a reservar. Se elige uno solo: había dos interruptores distintos y, encendidos a la vez, se abrían uno encima del otro.</small>
          <label>Qué se muestra al entrar<select className="input" value={design.ocasionesPopup === 'true' ? 'ocasiones' : design.welcomePopupEnabled === 'true' ? 'bienvenida' : 'nada'} onChange={(event) => update({
            welcomePopupEnabled: event.target.value === 'bienvenida' ? 'true' : 'false',
            ocasionesPopup: event.target.value === 'ocasiones' ? 'true' : 'false',
          })}>
            <option value="nada">Nada, entra directo a reservar</option>
            <option value="bienvenida">Un mensaje de bienvenida</option>
            <option value="ocasiones">La grilla de ocasiones</option>
          </select></label>
          {design.ocasionesPopup === 'true' && design.ocasionesEnabled !== 'true' && <small className="error-text">La grilla no tiene ocasiones activas: enciéndela en «Grilla de ocasiones» o no se mostrará nada.</small>}
        {design.welcomePopupEnabled === 'true' && <div className="form-row"><label>Título del popup<input className="input" value={design.welcomePopupTitle || ''} onChange={(event) => update({ welcomePopupTitle: event.target.value })} /></label><label>Texto del popup<textarea className="input" rows={2} value={design.welcomePopupText || ''} onChange={(event) => update({ welcomePopupText: event.target.value })} /></label></div>}
          {design.welcomePopupEnabled === 'true' && <label>Texto del botón<input className="input" value={design.welcomePopupBoton || ''} placeholder="Continuar" onChange={(event) => update({ welcomePopupBoton: event.target.value })} /></label>}
          {design.ocasionesPopup === 'true' && <label>Frase bajo el título <small>(opcional)</small><textarea className="input" rows={2} value={design.ocasionesTexto || ''} placeholder="Ej. Cuéntanos qué celebras y lo preparamos." onChange={(event) => update({ ocasionesTexto: event.target.value })} /></label>}
          {design.ocasionesPopup === 'true' && <label>Texto del botón<input className="input" value={design.ocasionesBoton || ''} placeholder="Reservar ahora" onChange={(event) => update({ ocasionesBoton: event.target.value })} /></label>}
          {design.ocasionesPopup === 'true' && <label>Veces que se muestra<select className="input" value={design.ocasionesVeces || '1'} onChange={(event) => update({ ocasionesVeces: event.target.value })}><option value="1">Una vez</option><option value="2">Dos veces</option><option value="3">Tres veces</option><option value="siempre">En cada visita</option></select><small>Se cuenta por navegador. Repetirlo siempre molesta a quien ya lo vio y viene a reservar.</small></label>}
        </div>
      </details>

      <details className="design-section">
        <summary>Letra y bordes</summary>
        <div className="design-section-body">
          <label>Tipo de letra<select className="input" value={design.fontFamily || 'system-ui'} onChange={(event) => update({ fontFamily: event.target.value })}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option><option value="'Courier New', monospace">Monospace</option></select></label>
          <div className="design-mini-grid"><label>Forma de botones<select className="input" value={design.buttonRadius || '12'} onChange={(event) => update({ buttonRadius: event.target.value })}><option value="4">Rectos</option><option value="12">Suaves</option><option value="999">Píldora</option></select></label><label>Forma de campos<select className="input" value={design.fieldRadius || '10'} onChange={(event) => update({ fieldRadius: event.target.value })}><option value="2">Rectos</option><option value="10">Suaves</option><option value="18">Redondeados</option></select></label></div>
        </div>
      </details>

      {backgroundMode !== 'color' && <details className="design-section">
        <summary>Cómo se recorta el fondo</summary>
        <div className="design-section-body">
          {backgroundMode === 'image' && <label>Visibilidad del fondo ({design.backgroundOpacity || '88'}%)<small>Cuánto se aclara la imagen para que el texto siga legible.</small><input type="range" min="0" max="100" value={design.backgroundOpacity || '88'} onChange={(event) => update({ backgroundOpacity: event.target.value })} /></label>}
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
          <label>Tamaño del logo ({design.logoSize || '64'}px)<input type="range" min="32" max="180" value={design.logoSize || '64'} onChange={(event) => update({ logoSize: event.target.value })} /></label>
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
  const systemFields = new Map(fields.map((field) => [field.id, field]));
  const customFields = fields.filter((field) => !['name', 'email', 'phone'].includes(field.id)).slice(0, 6);
  const sampleSlots = ['12:00', '13:30', '20:00'];

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
          <div className="booking-step-title"><span>01</span><div><strong>Selecciona fecha y hora</strong><small>Vista previa de disponibilidad.</small></div></div>
          <div className="preview-slot-group">
            <h3>Hoy</h3>
            <div>{sampleSlots.map((slot, index) => <button type="button" className={index === 0 ? 'active' : ''} key={slot}>{slot}<small>{draft.capacityPerSlot} disp.</small></button>)}</div>
          </div>
          <div className="booking-step-title"><span>02</span><div><strong>Datos de la reserva</strong><small>Estos son los campos configurados.</small></div></div>
          <div className="preview-public-fields">
            <PreviewField label={systemFields.get('name')?.label || 'Nombre completo'} required={systemFields.get('name')?.required !== false} />
            <PreviewField label={systemFields.get('phone')?.label || 'Teléfono'} required={Boolean(systemFields.get('phone')?.required)} />
            <PreviewField label={systemFields.get('email')?.label || 'Correo'} required={Boolean(systemFields.get('email')?.required)} />
            <PreviewField label="Número de personas" />
            {customFields.map((field) => <PreviewField key={field.id} label={field.label} required={field.required} type={field.type} />)}
          </div>
          <span className="preview-submit">Confirmar reserva</span>
          <p className="privacy-note">Tus datos no son públicos y quedan asociados exclusivamente a esta empresa.</p>
        </section>
      </div>
    </div>
  );
}

function PreviewField({ label, required, type = 'text' }: { label: string; required?: boolean; type?: string }) {
  if (type === 'consent') return <label className="preview-consent"><span className="preview-checkbox" />{label}{required ? ' *' : ''}</label>;
  if (type === 'textarea') return <label>{label}{required ? ' *' : ''}<span className="preview-input textarea" /></label>;
  if (type === 'select' || type === 'multi_select') return <label>{label}{required ? ' *' : ''}<span className="preview-input select">Selecciona una opción</span></label>;
  return <label>{label}{required ? ' *' : ''}<span className="preview-input" /></label>;
}
