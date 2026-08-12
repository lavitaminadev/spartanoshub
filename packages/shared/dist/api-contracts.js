"use strict";
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
//# sourceMappingURL=api-contracts.js.map