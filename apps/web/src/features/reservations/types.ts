export interface FormField { id: string; type: string; label: string; required: boolean; placeholder?: string; options?: string[]; system?: boolean; display?: string }
export interface DesignConfig {
  primaryColor?: string; accentColor?: string; backgroundColor?: string; textColor?: string;
  title?: string; welcome?: string; confirmationMessage?: string;
  logoUrl?: string; backgroundImage?: string; backgroundMode?: string; backgroundGradient?: string;
  backgroundOpacity?: string; backgroundPosition?: string; backgroundAnchor?: string; backgroundSize?: string;
  layoutPosition?: string; logoPosition?: string; logoSize?: string; showLogo?: string;
  showPoweredBy?: string; poweredByText?: string; showSecureBadge?: string; secureBadgeText?: string;
  showEyebrow?: string; eyebrowText?: string; showWelcome?: string; showFacts?: string;
  titleSize?: string; welcomeSize?: string; durationLabel?: string; confirmationLabel?: string;
  timezoneLabel?: string; automaticLabel?: string; manualLabel?: string; timezoneValue?: string;
  calendarSaveEnabled?: string; calendarSaveText?: string;
  legalCompanyName?: string; legalCompanyId?: string; privacyUrl?: string; termsUrl?: string;
  supportEmail?: string; cancellationPolicy?: string; reservationConsentText?: string;
  marketingConsentText?: string; marketingConsentVersion?: string; campaignAlias?: string;
  /** Autorización opcional para reutilizar los datos en los demás locales de la red. */
  networkConsentEnabled?: string; networkConsentText?: string; networkConsentVersion?: string; networkBrandName?: string;
  welcomePopupEnabled?: string; welcomePopupTitle?: string; welcomePopupText?: string;
  askChildren?: string; askAccessibility?: string; askAllergies?: string;
  whatsappBusinessNumber?: string; whatsappGroupMessage?: string;
  groupThreshold?: string; holdMinutes?: string; slotCadenceMinutes?: string; lastReservableMinutesBeforeClose?: string;
  autoCloseAttendance?: string; autoCloseAfterMinutes?: string;
  bookingPausedUntil?: string; enforceCompanyDailyCap?: string;
  metaMeasurementEnabled?: string; metaMeasurementNote?: string;
  buttonRadius?: string; fieldRadius?: string; fontFamily?: string; couponEnabled?: string;
  /** Grilla de ocasiones: se guarda como JSON porque son varias y el resto de la config es plana. */
  ocasionesEnabled?: string; ocasionesTitulo?: string; ocasionesPopup?: string; ocasiones?: string;
  [key: string]: string | undefined;
}
export interface ReservationForm { id: string; clientId: string; name: string; publicSlug: string; publicUrl?: string; status: string; mode: string; timezone: string; durationMinutes: number; bufferMinutes: number; capacityPerSlot: number; dailyCapacity: number; minimumNoticeHours: number; maximumAdvanceDays: number; confirmationMode: string; fieldSchema: FormField[]; designConfig: DesignConfig; scheduleConfig: { windows?: Array<{ day: number; start: string; end: string }> }; servicesConfig?: Array<{ id: string; name: string; durationMinutes?: number; capacity?: number; active?: boolean }>; resourcesConfig?: Array<{ id: string; name: string; capacity?: number; description?: string; smokingAllowed?: boolean; active?: boolean }>; campaignId?: string; crmEnabled?: boolean; calendarEnabled?: boolean; metaCapiEnabled?: boolean; teamNotifications?: string[]; pixelId?: string | null; pixelName?: string | null; metaReady?: boolean; calendarReady?: boolean; ga4MeasurementId?: string | null; capabilities?: { reservations: boolean; crm: boolean; metaConversions?: boolean; googleConversions?: boolean }; updatedAt: string }
export interface Reservation { id: string; formId: string; referenceCode: string; status: string; startsAt: string; partySize: number; guestName: string; guestEmail?: string; guestPhone?: string; answers?: Record<string, unknown>; serviceId?: string; resourceId?: string; endsAt?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; internalNotes?: string; couponCode?: string; createdAt?: string; metaConversion?: MetaConversionStatus; contactId?: string; workflowState?: ReservationState;
  /** Consentimientos, con el instante en que se aceptaron y el texto exacto que se mostró. */
  reservationConsentAt?: string | null; reservationConsentText?: string | null;
  marketingConsentAt?: string | null; marketingConsentText?: string | null; marketingConsentVersion?: string | null;
  networkConsentAt?: string | null; networkConsentText?: string | null; networkConsentVersion?: string | null;
  measurementConsentAt?: string | null; adultDeclaredAt?: string | null; guestConfirmedAt?: string | null }

/** Veces que quien reserva ya estuvo en la misma empresa. */
export interface GuestHistory {
  total: number;
  attended: number;
  noShow: number;
  anteriores: Array<{ id: string; referenceCode: string; startsAt: string; status: string; partySize: number }>;
}

/**
 * Etapa del flujo operativo agencia → cliente de una reserva.
 *
 * Es independiente del `status` de asistencia (pending/confirmed/attended/...): ese describe
 * si la visita ocurrió, este describe en qué parte de la producción del servicio está la
 * reserva, desde que es una propuesta interna hasta que el cliente recibió lo acordado.
 * Ausente en una reserva existente, se trata como `draft` (ver `resolveWorkflowState`).
 */
export type ReservationState = 'draft' | 'sent' | 'confirmed' | 'preparation' | 'execution' | 'delivered';

/**
 * Estado del circuito de conversión de una reserva.
 *
 * `schedule` es el evento de reserva y `attended` el de asistencia; `null` significa que
 * todavía no se encoló. `matchFields` cuenta los identificadores con que Meta puede
 * atribuir la reserva a la campaña: en cero, el evento llega sin coincidencia.
 */
export interface MetaConversionStatus { schedule: string | null; attended: string | null; matchFields: number }

/** Solicitud de grupo o evento: no toma cupo hasta que el equipo acuerda una fecha. */
export interface GroupRequest {
  id: string; clientId: string; formId: string;
  guestName: string; guestEmail?: string; guestPhone?: string;
  partySize: number; eventType: string;
  preferredDate?: string; preferredTime?: string; notes?: string;
  details?: Record<string, unknown>;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmContent?: string | null;
  status: string; quoteAmount?: string; quoteMessage?: string; quoteExpiresAt?: string;
  createdAt: string;
}
