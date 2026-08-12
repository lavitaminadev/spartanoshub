/**
 * CONTRATOS API BACKEND — Endpoints pendientes de implementar en NestJS.
 *
 * Este archivo documenta todos los endpoints que el frontend asume disponibles.
 * Cada endpoint incluye método, ruta, payload esperado y respuesta.
 * Los que no existan aún deben implementarse en el backend para que las vistas
 * dejen de degradar a estados vacíos (EmptyState).
 *
 * Organizado por dominio. Cada sección indica el archivo frontend que lo consume.
 */

// =============================================================================
// 1. PERMISOS POR ROL (AdminPage — tab "Permisos por cargo")
// =============================================================================

/**
 * GET /roles/permissions
 * Respuesta: { matrix: Record<string, Record<string, string>> }
 *   - matrix[moduleKey][roleKey] = 'none' | 'view' | 'edit' | 'manage'
 *   - Si no hay configuración, devolver matrix vacío: {}
 * Frontend: src/features/admin/AdminPage.tsx (permsQuery)
 */
interface RolesPermissionsResponse {
  matrix: Record<string, Record<string, 'none' | 'view' | 'edit' | 'manage'>>;
}

/**
 * PUT /roles/permissions
 * Payload: { matrix: Record<string, Record<string, string>> }
 *   - Reemplaza la matriz completa. El backend debe validar que cada módulo y rol existan.
 * Respuesta: { matrix } (la matriz guardada)
 * Frontend: src/features/admin/AdminPage.tsx (permMutation)
 */

// =============================================================================
// 2. EXCEPCIONES DE ACCESO (AdminPage — tab "Accesos por persona")
// =============================================================================

/**
 * GET /role-access/exceptions
 * Respuesta: { items: AccessException[] }
 * Frontend: src/features/admin/AdminPage.tsx (exceptionsQuery)
 */
interface AccessException {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  module: string;
  level: 'none' | 'view' | 'edit' | 'manage';
  reason?: string;
  expiresAt?: string | null;   // ISO datetime
  status: 'active' | 'expired' | 'revoked';
  createdAt?: string;
}

/**
 * POST /role-access/exceptions
 * Payload: { userId, module, level, reason?, expiresAt? }
 *   - expiresAt opcional. Si no se envía, la excepción no vence.
 *   - Debe auditarse (crear registro en tabla de auditoría).
 * Respuesta: AccessException
 * Frontend: src/features/admin/AdminPage.tsx (excCreateMutation)
 */

/**
 * DELETE /role-access/exceptions/:id
 *   - Revoca la excepción (cambia status a 'revoked').
 *   - Debe auditarse.
 * Respuesta: { success: true }
 * Frontend: src/features/admin/AdminPage.tsx (excRevokeMutation)
 */

// =============================================================================
// 3. CONSENTIMIENTO INFORMADO (AdminPage — tab "Consentimiento")
//    Cumplimiento Ley 19.628 (Chile) de protección de datos personales.
// =============================================================================

/**
 * GET /consent/versions
 * Respuesta: { items: ConsentVersion[] }
 *   - Ordenado por version DESC.
 * Frontend: src/features/admin/AdminPage.tsx (consentVersionsQuery)
 */
interface ConsentVersion {
  id: string;
  version: number;         // autoincremental
  title: string;
  text: string;            // texto completo del consentimiento
  publishedAt: string;     // ISO datetime
  publishedBy?: string;    // ID del admin que publicó
  active: boolean;         // solo la última versión es active=true
}

/**
 * GET /consent/active
 * Respuesta: ConsentVersion | null
 *   - Devuelve la versión activa actual, o null si no hay ninguna.
 * Frontend: src/features/security/SecurityPage.tsx (consentActiveQuery)
 */

/**
 * POST /consent/versions
 * Payload: { title: string, text: string }
 *   - Crea una nueva versión. La versión anterior queda active=false.
 *   - Al publicar, TODOS los usuarios deben re-aceptar.
 *   - Debe auditarse.
 * Respuesta: ConsentVersion
 * Frontend: src/features/admin/AdminPage.tsx (consentPublishMutation)
 */

/**
 * GET /consent/users
 * Respuesta: { items: UserConsentStatus[] }
 *   - Estado de aceptación de cada usuario respecto a la versión activa.
 * Frontend: src/features/admin/AdminPage.tsx (consentUsersQuery)
 */
interface UserConsentStatus {
  userId: string;
  userName: string;
  acceptedVersion: number | null;   // null = nunca aceptó
  acceptedAt?: string;              // ISO datetime
  status: 'accepted' | 'pending' | 'expired';
}

/**
 * GET /consent/pending-count
 * Respuesta: { pending: number, total: number }
 *   - Cantidad de usuarios con aceptación pendiente.
 * Frontend: src/features/security/SecurityPage.tsx (consentPendingQuery)
 */

/**
 * POST /consent/users/:userId/grant
 *   - Otorga acceso al usuario sin que acepte el consentimiento.
 *   - Uso exclusivo del administrador.
 *   - DEBE AUDITARSE: registrar quién otorgó, a quién, fecha y motivo.
 * Respuesta: { success: true, userId, grantedBy, grantedAt }
 * Frontend: src/features/admin/AdminPage.tsx (consentGrantMutation)
 */

/**
 * GET /consent/my-status
 *   - Consultado por el usuario al iniciar sesión.
 *   - Si status='pending', el frontend muestra el modal de re-aceptación.
 * Respuesta: { needsAcceptance: boolean, version: ConsentVersion | null }
 * Frontend: usado en el flujo de login (AuthBootstrap o similar)
 */

/**
 * POST /consent/accept
 * Payload: { version: number }
 *   - El usuario acepta la versión indicada del consentimiento.
 *   - Debe auditarse.
 * Respuesta: { accepted: true, version, acceptedAt }
 * Frontend: modal de re-aceptación durante el login
 */

// =============================================================================
// 4. POLÍTICA DE CONTRASEÑAS (SecurityPage + Settings)
// =============================================================================

/**
 * GET /settings?prefix=security.password
 * Respuesta: Record<string, string>
 *   - Claves: security.password.minLength, security.password.requireUppercase,
 *     security.password.requireNumber, security.password.requireSpecial,
 *     security.password.expiryDays, security.password.preventReuse
 * Frontend: src/features/security/SecurityPage.tsx (pwdPolicyQuery)
 *         src/features/admin/AdminPage.tsx (pwdPolicyMutation)
 */

/**
 * PUT /settings
 * Payload: { values: Record<string, string> }
 *   - values['security.password.minLength'] = '8'
 *   - values['security.password.expiryDays'] = '90'
 *   - etc.
 * Respuesta: { updated: string[] }
 * Frontend: src/features/admin/AdminPage.tsx (pwdPolicyMutation)
 */

/**
 * GET /me/password-status
 *   - Devuelve cuántos días faltan para que expire la contraseña del usuario.
 * Respuesta: { daysUntilExpiry: number, expired: boolean }
 * Frontend: ChangePasswordPage — muestra advertencia si quedan pocos días
 */

// =============================================================================
// 5. ANONIMIZACIÓN Y RETENCIÓN (SecurityPage)
// =============================================================================

/**
 * GET /audit?action=anonymize&limit=100
 * Respuesta: AnonymizationRow[]
 *   - Ya implementado (usa el sistema de auditoría existente).
 * Frontend: src/features/security/SecurityPage.tsx
 */

/**
 * GET /data-protection/export
 *   - Exporta todos los datos personales del usuario autenticado.
 * Respuesta: JSON con los datos (formato portable).
 * Frontend: botón en perfil de usuario
 */

/**
 * DELETE /data-protection/anonymize
 *   - Anonimiza los datos personales del usuario autenticado.
 *   - Nombre → "Usuario anonimizado", email → anon-{id}@deleted, etc.
 *   - DEBE AUDITARSE.
 * Respuesta: { success: true, anonymizedAt }
 * Frontend: botón en perfil de usuario
 */

/**
 * DELETE /data-protection/contacts/:id/anonymize
 *   - Anonimiza un contacto de campaña específico.
 *   - Solo admin/operations_director.
 * Respuesta: { success: true }
 * Frontend: SecurityPage (mencionado en política)
 */

// =============================================================================
// 6. CONSENTIMIENTO EN RESERVAS PÚBLICAS (PublicReservationPage)
// =============================================================================

/**
 * GET /consent/public-text?formId=xxx
 *   - Devuelve el texto de consentimiento para el formulario público.
 *   - Si el form tiene designConfig.consentText, usa ese. Si no, el default de la org.
 * Respuesta: { text: string, version: number }
 * Frontend: src/features/reservations/PublicReservationPage.tsx
 *           Se muestra junto al campo "consent" (checkbox obligatorio).
 */

// =============================================================================
// 7. PIEZA — DETALLE (WorkDetailPage)
// =============================================================================

/**
 * GET /production/pieces/:id/detail
 * Respuesta: PieceDetail
 * Frontend: src/features/production/WorkDetailPage.tsx
 */
interface PieceDetail {
  piece: {
    id: string; title: string; type: string; status: string; udAmount: number;
    correctionCount: number; difficultyLevel?: number; clientName: string;
    clientId?: string; assignedTo?: string; assignedName?: string;
    dueDate?: string; createdAt: string; assignedAt?: string;
    description?: string; campaign?: string; dependencyIds?: string[];
  };
  sourceChain: Array<{ type: string; label: string; id?: string; name: string }>;
  requirements: Array<{ label: string; detail: string; completed: boolean }>;
  versions: Array<{
    id: string; kind: string; name: string; metadata: string;
    status: string; fileUrl?: string; createdAt: string;
  }>;
  comments: Array<{ id: string; author: string; text: string; createdAt: string }>;
  workflowStages: Array<{ name: string; owner: string }>;
  currentStageIndex: number;
  audit: Array<{ id: number; title: string; detail: string; actor: string; time: string; tone?: string }>;
}

/**
 * POST /production/pieces/:id/comments
 * Payload: { text: string }
 * Respuesta: { id: string, author: string, text: string, createdAt: string }
 * Frontend: src/features/production/WorkDetailPage.tsx (commentMutation)
 */

// =============================================================================
// 8. PLANTILLAS DE FORMULARIOS (ReservationBuilderPage)
// =============================================================================

/**
 * GET /reservation-templates
 * Respuesta: { items: ReservationTemplate[] }
 *   - Plantillas creadas por administradores desde el builder o desde la gestión.
 *   - Incluye tanto plantillas de diseño como de estructura de campos.
 * Frontend: ReservationBuilderPage (carga al abrir el paso Diseño)
 */
interface ReservationTemplate {
  id: string;
  name: string;
  type: 'design' | 'fields' | 'full';
  description?: string;
  /** Design config completo (colores, fuentes, fondos). Solo para type='design' o 'full'. */
  designConfig?: Record<string, string>;
  /** Campos predefinidos. Solo para type='fields' o 'full'. */
  fieldSchema?: Array<{
    type: string;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
  }>;
  /** Configuración de horario. Solo para type='full'. */
  scheduleConfig?: { windows: Array<{ day: number; start: string; end: string }> };
  createdBy?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * POST /reservation-templates
 * Payload: { name, type, designConfig?, fieldSchema?, scheduleConfig?, description? }
 *   - Guarda la configuración actual como plantilla reutilizable.
 * Respuesta: ReservationTemplate
 * Frontend: botón "Guardar diseño actual como plantilla" en ReservationBuilderPage
 */

/**
 * PUT /reservation-templates/:id
 * Payload: igual que POST
 *   - Actualiza una plantilla existente.
 * Respuesta: ReservationTemplate
 */

/**
 * DELETE /reservation-templates/:id
 *   - Elimina una plantilla. No afecta formularios que ya la usaron.
 * Respuesta: { success: true }
 */

/**
 * POST /reservation-templates/:id/apply
 * Payload: { formId: string }
 *   - Aplica la plantilla a un formulario existente, sobrescribiendo designConfig y fieldSchema.
 * Respuesta: ReservationForm
 * Frontend: selector de plantillas en el paso Diseño del builder
 */

// =============================================================================
// 9. GOOGLE REVIEWS — FLUJO DE CALIFICACIÓN POST-ENCUESTA
// =============================================================================

/**
 * FLUJO: Encuesta completada → Evaluar calificación → Decidir ruta
 *
 * 1. Usuario completa encuesta (reserva o dedicada).
 * 2. Si la encuesta tiene `googleReview.url` configurado:
 *    a. Si `rating >= googleReview.minRating` (default 4):
 *       → Redirige directo a Google Reviews (nueva pestaña).
 *    b. Si `rating < googleReview.minRating`:
 *       → Muestra pantalla intermedia: "Lamentamos que tu experiencia no haya sido la mejor.
 *          ¿Quieres que alguien del equipo te contacte?"
 *       → Botón "Sí, que me contacten" → registra solicitud de contacto.
 *         - POST /surveys/:id/contact-request { respondentEmail?, respondentPhone?, message? }
 *         - Notifica al administrador por email.
 *         - Muestra: "Gracias. Alguien del equipo te contactará pronto."
 *       → Botón "No, gracias" → redirige a Google Reviews igual.
 * 3. Si la encuesta NO tiene googleReview configurado → muestra éxito normal.
 *
 * UX: El usuario NUNCA se va sin opción. Incluso con mala experiencia, puede dejar
 *     su reseña en Google o pedir contacto. Esto protege la reputación online porque
 *     las reseñas negativas se canalizan primero al equipo antes de llegar a Google.
 */

/**
 * POST /surveys/:surveyId/contact-request
 * Payload: { responseId: string, email?: string, phone?: string, message?: string }
 *   - Registra una solicitud de contacto post-encuesta con calificación baja.
 *   - Dispara notificación al administrador.
 * Respuesta: { success: true, contactRequestId: string }
 * Frontend: pantalla intermedia post-encuesta
 */

/**
 * GET /surveys/:surveyId/contact-requests
 *   - Lista de solicitudes de contacto para una encuesta.
 * Respuesta: { items: Array<{ id: string, responseId: string, email?: string, phone?: string, message?: string, status: 'pending' | 'contacted' | 'resolved', createdAt: string }> }
 * Frontend: panel de administración de encuestas (sección de seguimiento)
 */

/**
 * PATCH /surveys/contact-requests/:id
 * Payload: { status: 'contacted' | 'resolved', notes?: string }
 *   - Marca una solicitud de contacto como contactada o resuelta.
 * Respuesta: { success: true }
 */

// =============================================================================
// 10. META PIXEL + CAPI — REQUISITOS DEL BACKEND (auditoría externa)
// =============================================================================

/**
 * Hallazgos de la auditoría y cómo debe implementarlos el backend.
 * El frontend (este repo) ya cubre su parte:
 * - `src/shared/MetaPixel.tsx`: carga fbevents.js, hace init y PageView por pixelId.
 * - `src/shared/meta-match.ts`: lee fbclid → genera fbc (`fb.1.{epoch}.{fbclid}`), lee
 *   cookie _fbp, y PublicReservationPage envía gclid/gbraid/wbraid/fbclid/fbc/fbp +
 *   eventSourceUrl. IP y user-agent los aporta el backend desde el request HTTP.
 * - Dedup: el navegador dispara `Schedule`/`Lead` con eventID `${event}:${reservationId}`;
 *   el backend DEBE enviar el mismo event_name + event_id para que Meta deduplique.
 *
 * REQUISITOS BACKEND:
 *
 * 1. Pixel POR CLIENTE (no global de organización):
 *    - `POST /integrations/meta/client-pixels/setup` ya existe con { clientId, mode,
 *      pixelId, pixelName, accessToken, existingPixelId }.
 *    - El token CAPI debe guardarse cifrado (AES-256-GCM) por cliente, NUNCA usar
 *      META_CONVERSIONS_ACCESS_TOKEN global para las conversiones de un cliente.
 *    - `GET /integrations/meta/client-pixels/catalog` debe devolver el estado real por
 *      binding: { clientId, pixelId, pixelName, tokenConfigured }.
 *
 * 2. META_TEST_EVENT_CODE solo desde el endpoint de prueba:
 *    - El flag test_event_code SOLO se envía en `POST /integrations/meta/test-event`.
 *    - Los eventos reales (Schedule/Lead desde reservas) nunca deben llevarlo.
 *
 * 3. Señales de atribución completas (CAPI):
 *    - El servidor debe enviar: client_ip_address, client_user_agent, event_source_url,
 *      fbc, fbp, y PII hasheada (SHA-256 de email y phone, con normalización: lowercase,
 *      trim, formato E.164 para teléfonos).
 *    - La PII debe hashearse ANTES de persistir en el outbox, no al momento de enviar.
 *
 * 4. Deduplicación:
 *    - El evento CAPI debe llevar event_id idéntico al del navegador
 *      (`schedule:{reservationId}` o `lead:{surveyResponseId}`) y el mismo event_name.
 *
 * 5. Retención del outbox:
 *    - Definir retención (ej. 30 días) para los eventos procesados/failed/expired.
 *    - Nunca persistir PII cruda; solo hash + referencias no sensibles.
 *
 * 6. Errores diagnosticables:
 *    - No reemplazar el error de Graph API por un mensaje genérico: guardar el detalle
 *      (status, code, subcode) en el outbox y exponerlo en
 *      `GET /integrations/meta/conversions/outbox` (ya existe el endpoint; agregar
 *      campos lastErrorCode/lastErrorMessage).
 */
