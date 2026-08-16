/**
 * @fileoverview Pantalla de seguridad y privacidad: estado del sistema, política de
 * retención/anonimización de datos personales y bitácora de auditoría.
 *
 * Cada sección solo se muestra si hay un endpoint real que la respalde. No hay
 * datos simulados: si el backend no expone algo (por ejemplo solicitudes ARCO/GDPR
 * con flujo propio), la sección simplemente no existe acá.
 */

import { useQuery } from '@tanstack/react-query';
import { refetchWhenIdle } from '../../core/refetch-policy';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { useOrganizationSettings } from '../../core/organization-settings';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { PageHero } from '../../shared/PageHero';
import { AuditPanel } from '../governance/AuditPanel';
import { ServiceRequestsPanel } from './ServiceRequestsPanel';

interface HealthCheckResult {
  status: string;
  connected?: boolean;
  writable?: boolean;
  message?: string;
  usagePercent?: string;
  freeMb?: number;
  totalMb?: number;
}

interface HealthDetails {
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
  database: HealthCheckResult;
  memory: HealthCheckResult;
  disk: HealthCheckResult;
  redis: HealthCheckResult;
}

interface AnonymizationRow {
  id: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  reason?: string;
  occurredAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  User: 'Usuario', Lead: 'Lead', Contact: 'Contacto de campaña', Reservation: 'Reserva',
};

const STATUS_LABELS: Record<string, string> = {
  ok: 'Operativo', degraded: 'Degradado', error: 'Con errores', warning: 'Advertencia',
  not_configured: 'No configurado', configured_unverified: 'Configurado, sin verificar',
};

function statusColor(status: string): string {
  if (status === 'ok') return 'var(--success)';
  if (status === 'error') return 'var(--error)';
  if (status === 'not_configured') return 'var(--txt-muted)';
  return 'var(--warning)';
}

function StatusPill({ status }: { status: string }) {
  return <span style={{ color: statusColor(status), fontWeight: 600 }}>● {STATUS_LABELS[status] ?? status}</span>;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`;
  return `${hours} h ${minutes} min`;
}

export function SecurityPage() {
  const { user } = useAuth();
  const canSeeSystemHealth = user?.role === 'dev';
  const healthQuery = useQuery<HealthDetails>({
    queryKey: ['security-health'],
    queryFn: () => api.get('/health/details'),
    refetchInterval: refetchWhenIdle(60_000),
    enabled: canSeeSystemHealth,
  });
  const anonymizationsQuery = useQuery<AnonymizationRow[]>({
    queryKey: ['security-anonymizations'],
    queryFn: () => api.get('/audit?action=anonymize&limit=100'),
  });
  const consentActiveQuery = useQuery<{ id: string; version: number; title: string; text: string; publishedAt: string }>({
    queryKey: ['consent-active'],
    queryFn: () => api.get('/consent/active'),
  });
  const consentPendingQuery = useQuery<{ pending: number; total: number }>({
    queryKey: ['consent-pending'],
    queryFn: () => api.get('/consent/pending-count'),
  });
  const pwdPolicyQuery = useOrganizationSettings();

  return <div className="page security-page">
    <PageHero
      eyebrow="SEGURIDAD Y PRIVACIDAD"
      title="Qué se protege y qué queda registrado."
      subtitle={canSeeSystemHealth ? 'Estado del sistema, privacidad y bitácora de auditoría.' : 'Privacidad, consentimientos y bitácora de auditoría.'}
    />

    {canSeeSystemHealth && <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">RESUMEN</span><h2>Estado del sistema</h2><p>Base de datos, memoria, disco e integraciones, verificados en tiempo real.</p></div>
        <button className="btn btn-outline" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>{healthQuery.isFetching ? 'Actualizando...' : 'Actualizar'}</button>
      </div>
      {healthQuery.isLoading ? <LoadingSpinner text="Consultando estado del sistema..." /> :
        healthQuery.error ? <QueryErrorState title="No pudimos consultar el estado del sistema" message={healthQuery.error.message} onRetry={() => healthQuery.refetch()} retrying={healthQuery.isFetching} /> :
        healthQuery.data && <div className="security-health-grid">
          <article><span className="page-eyebrow">GENERAL</span><StatusPill status={healthQuery.data.status} /><p>Versión {healthQuery.data.version} · activo hace {formatUptime(healthQuery.data.uptime)}</p></article>
          <article><span className="page-eyebrow">BASE DE DATOS</span><StatusPill status={healthQuery.data.database.status} /><p>{healthQuery.data.database.connected ? 'Conexión activa' : (healthQuery.data.database.message ?? 'Sin conexión')}</p></article>
          <article><span className="page-eyebrow">MEMORIA</span><StatusPill status={healthQuery.data.memory.status} /><p>{healthQuery.data.memory.usagePercent} en uso ({healthQuery.data.memory.freeMb} MB libres de {healthQuery.data.memory.totalMb} MB)</p></article>
          <article><span className="page-eyebrow">DISCO</span><StatusPill status={healthQuery.data.disk.status} /><p>{healthQuery.data.disk.writable ? 'Escritura verificada' : (healthQuery.data.disk.message ?? 'No verificable')}</p></article>
          <article><span className="page-eyebrow">REDIS</span><StatusPill status={healthQuery.data.redis.status} /><p>{healthQuery.data.redis.status === 'not_configured' ? 'No configurado en este entorno' : 'Configurado; sin verificación de ping activa'}</p></article>
        </div>}
    </section>}

    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">RETENCIÓN Y ANONIMIZACIÓN</span><h2>Política de datos personales</h2><p>Qué se conserva, por cuánto tiempo y qué se anonimiza al vencer el plazo.</p></div>
      </div>
      <div className="security-policy-grid">
        <article>
          <h3>Reservas</h3>
          <p>Los datos del comensal (nombre, email, teléfono, identificadores de Meta y respuestas del formulario) se anonimizan automáticamente <strong>180 días</strong> después de la fecha de la reserva. Fecha, estado y formulario se conservan para que la analítica de asistencia siga siendo correcta.</p>
        </article>
        <article>
          <h3>Leads (pipeline propio)</h3>
          <p>Los leads descartados se revisan según <code>retentionReviewAt</code> (configurable por <code>CRM_LEAD_RETENTION_DAYS</code>) y se anonimizan automáticamente al vencer: se borra nombre, email, teléfono, empresa y origen detallado.</p>
        </article>
        <article>
          <h3>Contactos de campaña</h3>
          <p>No hay job automático hoy. La anonimización de un contacto (nombre, email, teléfono) es manual, a petición del titular, vía <code>DELETE /data-protection/contacts/:id/anonymize</code>.</p>
        </article>
        <article>
          <h3>Cuenta de usuario</h3>
          <p>Cualquier usuario puede exportar (<code>GET /data-protection/export</code>) o anonimizar (<code>DELETE /data-protection/anonymize</code>) sus propios datos en cualquier momento, conforme a la Ley 19.628.</p>
        </article>
      </div>

      <div className="section-toolbar" style={{ marginTop: '1.5rem' }}>
        <div><h3>Últimas anonimizaciones</h3><p>Registro real tomado de la bitácora de auditoría, filtrado por acción de anonimización.</p></div>
        <button className="btn btn-outline" onClick={() => anonymizationsQuery.refetch()} disabled={anonymizationsQuery.isFetching}>{anonymizationsQuery.isFetching ? 'Actualizando...' : 'Actualizar'}</button>
      </div>
      {anonymizationsQuery.isLoading ? <LoadingSpinner text="Cargando bitácora de anonimizaciones..." /> :
        anonymizationsQuery.error ? <QueryErrorState title="No pudimos cargar la bitácora" message={anonymizationsQuery.error.message} onRetry={() => anonymizationsQuery.refetch()} retrying={anonymizationsQuery.isFetching} /> :
        !anonymizationsQuery.data?.length ? <EmptyState icon="lock" title="Sin anonimizaciones registradas" description="Todavía no se ha anonimizado ningún dato personal en esta organización." /> :
        <table className="table security-anonymization-table">
          <thead><tr><th>Fecha</th><th>Responsable</th><th>Entidad</th><th>Registro</th><th>Motivo</th></tr></thead>
          <tbody>{anonymizationsQuery.data.map((row) => <tr key={row.id}>
            <td>{new Date(row.occurredAt).toLocaleString('es-CL')}</td>
            <td>{row.actorName ?? 'Sistema (job automático)'}</td>
            <td>{ENTITY_LABELS[row.entityType] ?? row.entityType}</td>
            <td>{row.entityId ? `${row.entityId.slice(0, 8)}…` : '—'}</td>
            <td>{row.reason ?? '—'}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">POLÍTICA DE CONTRASEÑAS</span><h2>Requisitos de seguridad</h2><p className="page-subtitle">Aplica a todos los usuarios. Se configura desde el panel de control de acceso.</p></div>
      </div>
      {pwdPolicyQuery.isLoading ? <LoadingSpinner text="Cargando política..." /> :
        <div className="security-policy-grid">
          <article>
            <h3>Caducidad</h3>
            <p>La contraseña debe cambiarse cada <strong>{pwdPolicyQuery.data?.['security.password.expiryDays'] ?? 90} días</strong>. Al cumplirse el plazo, el sistema exige el cambio al iniciar sesión.</p>
          </article>
          <article>
            <h3>Complejidad</h3>
            <p>Mínimo <strong>{pwdPolicyQuery.data?.['security.password.minLength'] ?? 8} caracteres</strong>{pwdPolicyQuery.data?.['security.password.requireUppercase'] !== 'false' ? ', al menos una mayúscula' : ''}{pwdPolicyQuery.data?.['security.password.requireNumber'] !== 'false' ? ', un número' : ''}{pwdPolicyQuery.data?.['security.password.requireSpecial'] === 'true' ? ', un carácter especial' : ''}.</p>
          </article>
          <article>
            <h3>Historial</h3>
            <p>No se puede reutilizar ninguna de las últimas <strong>{pwdPolicyQuery.data?.['security.password.preventReuse'] ?? 5} contraseñas</strong>.</p>
          </article>
          <article>
            <h3>Validación mensual</h3>
            <p>Cada {pwdPolicyQuery.data?.['security.password.expiryDays'] ?? 90} días el sistema solicita el cambio. El administrador recibe una notificación si hay usuarios con contraseña vencida.</p>
          </article>
        </div>}
    </section>

    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">CONSENTIMIENTO INFORMADO</span><h2>Versión activa y estado de aceptación</h2><p className="page-subtitle">Cumplimiento Ley 19.628. Cada nueva versión requiere re-aceptación de todos los usuarios.</p></div>
      </div>
      {consentActiveQuery.isLoading ? <LoadingSpinner text="Cargando consentimiento..." /> :
        consentActiveQuery.data ? <div className="security-policy-grid">
          <article>
            <h3>Versión activa</h3>
            <p><strong>v{consentActiveQuery.data.version}</strong> — {consentActiveQuery.data.title}</p>
            <p style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Publicada el {new Date(consentActiveQuery.data.publishedAt).toLocaleDateString('es-CL')}</p>
          </article>
          <article>
            <h3>Aceptación</h3>
            <p><strong>{consentPendingQuery.data ? consentPendingQuery.data.total - (consentPendingQuery.data.pending ?? 0) : '—'} de {consentPendingQuery.data?.total ?? '—'}</strong> usuarios aceptaron</p>
            {consentPendingQuery.data && consentPendingQuery.data.pending > 0 && <p style={{fontSize:11,color:'var(--amber)',marginTop:4}}>{consentPendingQuery.data.pending} usuario{consentPendingQuery.data.pending !== 1 ? 's' : ''} pendiente{consentPendingQuery.data.pending !== 1 ? 's' : ''} de aceptación</p>}
          </article>
          <article>
            <h3>Flujo legal</h3>
            <p>Al registrarse, cada usuario acepta la versión vigente. Si el consentimiento cambia, debe re-aceptarlo. El administrador puede otorgar acceso sin aceptación, dejando auditoría.</p>
          </article>
          <article>
            <h3>Derechos ARCO</h3>
            <p>Acceso, Rectificación, Cancelación y Oposición. Cualquier usuario puede solicitar la exportación o anonimización de sus datos desde su perfil.</p>
          </article>
        </div> : <EmptyState icon="contract" title="Sin consentimiento publicado" description="Publica la primera versión desde el panel de control de acceso para activar el registro de aceptaciones." />}
    </section>

    <ServiceRequestsPanel />

    <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">AUDITORÍA</span><h2>Bitácora de cambios</h2></div></div>
      <AuditPanel />
    </section>
  </div>;
}
