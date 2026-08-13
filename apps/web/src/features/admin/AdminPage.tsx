import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { ROLE_LABELS } from '../../core/role-labels';
import {
  MODULE_LIFECYCLE_STATUSES,
  ORGANIZATION_MODULE_CATALOG,
  buildAgencyCoreOrganizationFeatures,
  isModuleLifecycleVisible,
  moduleLifecycleSettingKey,
  type ModuleLifecycleStatus,
  type OrganizationModuleKey,
} from '@espartanos/shared';
import type { PermissionLevel } from '../../core/permission-level';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { PageHero } from '../../shared/PageHero';
import { EmptyState } from '../../shared/EmptyState';
import { StatusBadge } from '../../shared/StatusBadge';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { matchesSearch } from '../../shared/search';

const LEVELS: PermissionLevel[] = ['none', 'view', 'edit', 'manage'];
const LEVEL_LABELS: Record<PermissionLevel, string> = { none: 'Sin acceso', view: 'Ver', edit: 'Editar', manage: 'Administrar' };
const LEVEL_COLORS: Record<PermissionLevel, string> = { none: '#706a73', view: '#1f6fb2', edit: '#9a5a00', manage: '#096f6b' };
const MODULE_CATALOG = ORGANIZATION_MODULE_CATALOG;
const ROLE_KEYS = Object.keys(ROLE_LABELS);
const ROLE_DEFAULTS: Record<string, PermissionLevel> = {
  admin: 'manage', commercial_director: 'edit', creative_director: 'edit',
  operations_director: 'edit', art_director: 'edit', av_director: 'edit',
  ai_lead: 'edit', community_manager: 'view', designer: 'view',
  audiovisual: 'view', client: 'none',
};

interface AccessException { id: string; userId: string; userName: string; userRole?: string; module: string; level: string; reason?: string; expiresAt?: string | null; status: 'active' | 'expired' | 'revoked'; createdAt?: string }
interface UserOption { id: string; name: string; role: string; isActive?: boolean }
interface OrganizationSetting { key: string; value: string | number | boolean | null; source: 'organization' | 'master_default' }
type OrganizationFeatures = Partial<Record<OrganizationModuleKey, boolean>>;
type Feedback = { tone: 'success' | 'error'; text: string } | null;

export function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'permisos' | 'modulos' | 'excepciones' | 'consentimiento'>('permisos');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dirty, setDirty] = useState(false);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [permView, setPermView] = useState<'matrix' | 'role'>('role');
  const [roleFocus, setRoleFocus] = useState<string>(ROLE_KEYS[0]);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionDraft, setExceptionDraft] = useState({ userId: '', userRole: '', module: '', level: 'view' as PermissionLevel, reason: '', expiresAt: '' });
  const [revokeTarget, setRevokeTarget] = useState<{ userId: string; module: string } | null>(null);
  const [exceptionSearch, setExceptionSearch] = useState('');
  const [exceptionClient, setExceptionClient] = useState('');
  const [consentDraft, setConsentDraft] = useState({ title: '', text: '' });
  const [consentPublishOpen, setConsentPublishOpen] = useState(false);
  const [pwdPolicy, setPwdPolicy] = useState({ minLength: 8, requireUppercase: true, requireNumber: true, requireSpecial: false, expiryDays: 90, preventReuse: 5 });

  const permsQuery = useQuery<{ matrix?: Record<string, Record<string, string>> }>({ queryKey: ['role-permissions'], queryFn: () => api.get('/roles/permissions') });
  const exceptionsQuery = useQuery<{ items?: AccessException[] }>({ queryKey: ['access-exceptions'], queryFn: () => api.get('/permission-overrides') });
  const usersQuery = useQuery<(UserOption[] | { data: UserOption[] })>({ queryKey: ['admin-users'], queryFn: () => api.get('/users?isActive=true') });
  const featuresQuery = useQuery<{ features?: OrganizationFeatures }>({ queryKey: ['organization-features'], queryFn: () => api.get('/organizations/features') });
  const settingsQuery = useQuery<OrganizationSetting[]>({ queryKey: ['organization-settings'], queryFn: () => api.get('/settings') });
  const consentVersionsQuery = useQuery<{ items?: Array<{ id: string; version: number; title: string; text: string; publishedAt: string; active: boolean }> }>({ queryKey: ['consent-versions'], queryFn: () => api.get('/consent/versions') });
  const consentUsersQuery = useQuery<{ items?: Array<{ userId: string; userName: string; acceptedVersion: number | null; acceptedAt?: string; status: 'accepted' | 'pending' | 'expired' }> }>({ queryKey: ['consent-users'], queryFn: () => api.get('/consent/users') });

  const matrix = permsQuery.data?.matrix;
  const exceptions = (exceptionsQuery.data as { items?: AccessException[] } | undefined)?.items ?? [];
  const rawUsers = usersQuery.data;
  const users = Array.isArray(rawUsers) ? rawUsers : (rawUsers as { data?: UserOption[] } | undefined)?.data ?? [];
  const features = featuresQuery.data?.features;
  const lifecycleSettings = new Map((settingsQuery.data ?? []).filter((s) => s.key.startsWith('modules.lifecycle.')).map((s) => [s.key, s.value]));

  const exceptionUsers = users.filter((u) => u.id && u.name);
  const visibleExceptions = exceptions.filter((e) => matchesSearch(exceptionSearch, [e.userName, e.module, e.level, e.reason]) && (!exceptionClient || e.userId === exceptionClient));

  const defaultMatrix = useMemo(() => {
    const result: Record<string, Record<string, PermissionLevel>> = {};
    for (const mod of MODULE_CATALOG) {
      result[mod.key] = {};
      for (const role of ROLE_KEYS) {
        result[mod.key][role] = (matrix?.[mod.key]?.[role] ?? ROLE_DEFAULTS[role] ?? 'none') as PermissionLevel;
      }
    }
    return result;
  }, [matrix]);

  const lifecycleSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    for (const mod of MODULE_CATALOG) {
      const lifecycle = (lifecycleSettings.get(moduleLifecycleSettingKey(mod.key)) as ModuleLifecycleStatus | undefined) ?? mod.lifecycle;
      summary[lifecycle] = (summary[lifecycle] ?? 0) + 1;
    }
    return summary;
  }, [lifecycleSettings]);

  const permMutation = useMutation({
    mutationFn: (m: Record<string, Record<string, PermissionLevel>>) => api.put('/roles/permissions', { matrix: m }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-permissions'] }); setDirty(false); setFeedback({ tone: 'success', text: 'Matriz de permisos guardada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  // La excepciÃ³n se identifica por la pareja persona + mÃ³dulo, que es como la guarda el
  // backend: una persona tiene a lo sumo una excepciÃ³n por mÃ³dulo, asÃ­ que crear y reemplazar
  // son la misma operaciÃ³n y no hace falta un identificador propio para dirigirla.
  const excCreateMutation = useMutation({
    mutationFn: (body: typeof exceptionDraft) => api.put(`/users/${body.userId}/permissions/${body.module}`, {
      level: body.level,
      reason: body.reason || undefined,
      // El `datetime-local` del formulario da hora local sin zona; el backend espera ISO 8601.
      expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-exceptions'] }); setExceptionOpen(false); setFeedback({ tone: 'success', text: 'ExcepciÃ³n de acceso creada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const excRevokeMutation = useMutation({
    mutationFn: (target: { userId: string; module: string }) => api.delete(`/users/${target.userId}/permissions/${target.module}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-exceptions'] }); setFeedback({ tone: 'success', text: 'ExcepciÃ³n revocada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const featuresMutation = useMutation({
    mutationFn: (f: Partial<OrganizationFeatures>) => api.put('/organizations/features', { features: f }),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['organization-features'] }), qc.invalidateQueries({ queryKey: ['auth'] })]); setFeedback({ tone: 'success', text: 'Acceso por mÃ³dulo actualizado.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (values: Record<string, string>) => api.put('/settings', { values }),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['organization-settings'] }), qc.invalidateQueries({ queryKey: ['auth'] })]); setFeedback({ tone: 'success', text: 'Ciclo de vida del mÃ³dulo actualizado.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const consentPublishMutation = useMutation({
    mutationFn: (body: { title: string; text: string }) => api.post('/consent/versions', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consent-versions'] }); qc.invalidateQueries({ queryKey: ['consent-users'] }); setConsentPublishOpen(false); setConsentDraft({ title: '', text: '' }); setFeedback({ tone: 'success', text: 'Nueva versiÃ³n de consentimiento publicada. Todos los usuarios deberÃ¡n aceptarla.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const consentGrantMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/consent/users/${userId}/grant`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consent-users'] }); setFeedback({ tone: 'success', text: 'Acceso otorgado sin aceptaciÃ³n. AuditorÃ­a registrada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const pwdPolicyMutation = useMutation({
    mutationFn: (values: Record<string, string | number | boolean>) => api.put('/settings', { values }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organization-settings'] }); setFeedback({ tone: 'success', text: 'PolÃ­tica de contraseÃ±as actualizada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const consentVersions = (consentVersionsQuery.data as { items?: Array<{ id: string; version: number; title: string; text: string; publishedAt: string; active: boolean }> } | undefined)?.items ?? [];
  const consentUsers = (consentUsersQuery.data as { items?: Array<{ userId: string; userName: string; acceptedVersion: number | null; acceptedAt?: string; status: 'accepted' | 'pending' | 'expired' }> } | undefined)?.items ?? [];
  const activeConsent = consentVersions.find(v => v.active);
  const pendingConsent = consentUsers.filter(u => u.status === 'pending');
  const loading = permsQuery.isLoading || exceptionsQuery.isLoading || usersQuery.isLoading || featuresQuery.isLoading || settingsQuery.isLoading || consentVersionsQuery.isLoading || consentUsersQuery.isLoading;
  const loadError = permsQuery.error || exceptionsQuery.error || usersQuery.error || featuresQuery.error || settingsQuery.error || consentVersionsQuery.error || consentUsersQuery.error;

  const setCell = (modKey: string, role: string, level: PermissionLevel) => {
    const next = { ...matrixDraft } as Record<string, Record<string, PermissionLevel>>;
    if (!next[modKey]) next[modKey] = {};
    next[modKey] = { ...(next[modKey] ?? defaultMatrix[modKey] ?? {}) } as Record<string, PermissionLevel>;
    next[modKey][role] = level;
    setMatrixDraft(next);
    setDirty(true);
  };

  const currentMatrix = dirty ? (Object.keys(matrixDraft).length ? matrixDraft : defaultMatrix) : defaultMatrix;

  const activeExceptions = visibleExceptions.filter((e) => e.status === 'active');
  const activeExCount = exceptions.filter((e) => e.status === 'active').length;
  const expiredExCount = exceptions.filter((e) => e.status === 'expired').length;

  const toggleFeature = (key: OrganizationModuleKey, enabled: boolean) => {
    featuresMutation.mutate({ [key]: enabled } as Partial<OrganizationFeatures>);
  };

  const applyAgencyCorePreset = () => {
    featuresMutation.mutate(buildAgencyCoreOrganizationFeatures());
  };

  const updateLifecycle = (key: OrganizationModuleKey, lifecycle: ModuleLifecycleStatus) => {
    lifecycleMutation.mutate({ [moduleLifecycleSettingKey(key)]: lifecycle });
  };

  const lifecycleOf = (key: OrganizationModuleKey, fallback: ModuleLifecycleStatus) =>
    (lifecycleSettings.get(moduleLifecycleSettingKey(key)) as ModuleLifecycleStatus | undefined) ?? fallback;

  if (loading) return <LoadingSpinner text="Abriendo panel de administraciÃ³n..." />;
  if (loadError) return <QueryErrorState title="No pudimos abrir el panel de administraciÃ³n" message={loadError.message} />;

  return <div className="page governance-page">
    <PageHero
      eyebrow="CONTROL DE ACCESO"
      title="Panel de AdministraciÃ³n"
      subtitle="Permisos por cargo, por persona y estado de mÃ³dulos."
      variant="feature"
      aside={<div className="page-hero-stats">
        <span><small>Cargos</small><strong>{ROLE_KEYS.length}</strong></span>
        <span><small>MÃ³dulos</small><strong>{MODULE_CATALOG.length}</strong></span>
        <span><small>Excepciones activas</small><strong>{activeExCount}</strong></span>
        <span><small>MÃ³dulos activos</small><strong>{lifecycleSummary.active ?? 0}</strong></span>
        <span><small>Pendientes consent.</small><strong>{pendingConsent.length}</strong></span>
      </div>}
    />
    <div className="admin-quick-links">
      <span className="page-eyebrow">ACCESO RÃPIDO</span>
      <div className="admin-quick-grid">
        <Link to="/users" className="admin-quick-card"><strong>Usuarios</strong><small>Gestionar personas y cargos</small></Link>
        <Link to="/governance" className="admin-quick-card"><strong>Gobernanza</strong><small>Flujos, pods y mÃ³dulos</small></Link>
        <Link to="/settings" className="admin-quick-card"><strong>ConfiguraciÃ³n</strong><small>OrganizaciÃ³n y sistema</small></Link>
        <Link to="/security" className="admin-quick-card"><strong>Seguridad</strong><small>Salud y auditorÃ­a</small></Link>
        <Link to="/integrations" className="admin-quick-card"><strong>Integraciones</strong><small>Meta, Cloudinary, GA4</small></Link>
        <Link to="/operations" className="admin-quick-card"><strong>Operaciones</strong><small>Pods y capacidad</small></Link>
      </div>
    </div>
    <nav className="governance-tabs">
      <button className={tab === 'permisos' ? 'active' : ''} onClick={() => { setTab('permisos'); setFeedback(null); }}><span>01</span><strong>Permisos por cargo</strong><small>Matriz de acceso por rol y mÃ³dulo</small></button>
      <button className={tab === 'modulos' ? 'active' : ''} onClick={() => { setTab('modulos'); setFeedback(null); }}><span>02</span><strong>MÃ³dulos</strong><small>Lifecycle y acceso por organizaciÃ³n</small></button>
      <button className={tab === 'excepciones' ? 'active' : ''} onClick={() => { setTab('excepciones'); setFeedback(null); }}><span>03</span><strong>Accesos por persona</strong><small>Excepciones y accesos temporales</small></button>
      <button className={tab === 'consentimiento' ? 'active' : ''} onClick={() => { setTab('consentimiento'); setFeedback(null); }}><span>04</span><strong>Consentimiento</strong><small>Versiones, aceptaciÃ³n y acceso</small></button>
    </nav>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}

    {tab === 'permisos' && <section className="permission-matrix-section">
      <div className="section-toolbar"><div><span className="page-eyebrow">MATRIZ DE ACCESO</span><h2>Permisos por cargo y mÃ³dulo</h2><p className="page-subtitle">Cada celda define quÃ© puede hacer un cargo en un mÃ³dulo. Los cambios se guardan al confirmar.</p></div>
        <div className="permission-view-toggle" role="group" aria-label="Forma de ver los permisos"><button className={permView === 'role' ? 'active' : ''} onClick={() => setPermView('role')}>Por cargo</button><button className={permView === 'matrix' ? 'active' : ''} onClick={() => setPermView('matrix')}>Matriz completa</button></div>
        {dirty && <div className="toolbar-actions"><button className="btn btn-outline btn-sm" onClick={() => { setMatrixDraft({}); setDirty(false); qc.invalidateQueries({ queryKey: ['role-permissions'] }); }}>Descartar cambios</button><button className="btn btn-primary btn-sm" disabled={permMutation.isPending} onClick={() => permMutation.mutate(currentMatrix)}>{permMutation.isPending ? 'Guardando...' : 'Guardar matriz'}</button></div>}
      </div>
      <div className="permission-help">
        <div className="help-inline"><strong>Niveles de permiso</strong>
          <div className="level-legend">{LEVELS.map((l) => <span key={l} className={`level-pill level-${l}`} style={{ backgroundColor: `${LEVEL_COLORS[l]}18`, color: LEVEL_COLORS[l], borderColor: LEVEL_COLORS[l] }}>{LEVEL_LABELS[l]}</span>)}</div>
        </div>
        <p>Sin acceso = el mÃ³dulo no aparece en el menÃº. Ver = navegable pero sin editar. Editar = modificar datos propios del mÃ³dulo. Administrar = cambiar configuraciÃ³n del mÃ³dulo.</p>
      </div>
      {permView === 'role' ? (
        <div className="permission-role-view">
          <div className="permission-role-picker" role="group" aria-label="Elegir cargo">{ROLE_KEYS.map((role) => <button key={role} className={roleFocus === role ? 'active' : ''} onClick={() => setRoleFocus(role)}>{ROLE_LABELS[role]}</button>)}</div>
          <div className="permission-role-modules">{MODULE_CATALOG.map((mod) => { const level = currentMatrix[mod.key]?.[roleFocus] ?? 'none'; const enabled = level !== 'none'; return <div className="permission-role-row" key={mod.key}><div className="permission-role-module"><strong>{mod.key}</strong><small>{mod.lifecycle}</small></div><div className="permission-role-controls"><label className="central-switch"><input type="checkbox" checked={enabled} onChange={(e) => setCell(mod.key, roleFocus, e.target.checked ? (currentMatrix[mod.key]?.[roleFocus] !== 'none' ? currentMatrix[mod.key]?.[roleFocus] as PermissionLevel : 'view') : 'none')} /><span></span><strong>{enabled ? 'Con acceso' : 'Sin acceso'}</strong></label>{enabled && <select className={`level-select level-${level}`} style={{ backgroundColor: `${LEVEL_COLORS[level]}15`, color: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }} value={level} onChange={(e) => setCell(mod.key, roleFocus, e.target.value as PermissionLevel)}>{LEVELS.filter((l) => l !== 'none').map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select>}</div></div>; })}</div>
        </div>
      ) : (
      <div className="permission-matrix-wrapper">
        <table className="permission-matrix">
          <thead><tr><th className="sticky-col">MÃ³dulo</th>{ROLE_KEYS.map((role) => <th key={role} className="matrix-role-col" title={ROLE_LABELS[role]}><span>{ROLE_LABELS[role]}</span></th>)}</tr></thead>
          <tbody>{MODULE_CATALOG.map((mod) => <tr key={mod.key}><td className="sticky-col module-label"><strong>{mod.key}</strong><small>{mod.lifecycle}</small></td>{ROLE_KEYS.map((role) => { const level = currentMatrix[mod.key]?.[role] ?? 'none'; return <td key={role} className="matrix-cell"><select className={`level-select level-${level}`} style={{ backgroundColor: `${LEVEL_COLORS[level]}15`, color: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }} value={level} onChange={(e) => setCell(mod.key, role, e.target.value as PermissionLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select></td>; })}</tr>)}</tbody>
        </table>
      </div>
      )}
    </section>}

    {tab === 'modulos' && <section className="modules-center">
      <div className="section-toolbar">
        <div>
          <span className="page-eyebrow">OFERTA Y ACCESO</span>
          <h2>Centro de mÃ³dulos</h2>
          <p className="page-subtitle">Controla si el producto muestra cada mÃ³dulo y si esta organizaciÃ³n puede usarlo. Un mÃ³dulo en desarrollo sigue oculto aunque estÃ© encendido para la organizaciÃ³n.</p>
        </div>
        <button className="btn btn-primary" type="button" disabled={featuresMutation.isPending} onClick={applyAgencyCorePreset}>Usar solo operaciÃ³n base</button>
      </div>
      <div className="reservation-flow-switch module-lifecycle-summary" role="group" aria-label="Resumen por lifecycle">
        <button className="active" type="button"><strong>{lifecycleSummary.active ?? 0}</strong><span>Activos</span></button>
        <button type="button"><strong>{lifecycleSummary.development ?? 0}</strong><span>En desarrollo</span></button>
        <button type="button"><strong>{lifecycleSummary.pilot ?? 0}</strong><span>Pilot</span></button>
        <button type="button"><strong>{lifecycleSummary.maintenance ?? 0}</strong><span>Mantenimiento</span></button>
        <button type="button"><strong>{lifecycleSummary.disabled ?? 0}</strong><span>Deshabilitados</span></button>
      </div>
      <div className="pod-governance-grid module-governance-grid">
        {MODULE_CATALOG.map((module) => {
          const lifecycle = lifecycleOf(module.key, module.lifecycle);
          const productVisible = isModuleLifecycleVisible(lifecycle);
          const orgEnabled = features?.[module.key] ?? module.defaultEnabled;
          return <article key={module.key} className="module-governance-card">
            <header>
              <div><span className={`status-dot ${productVisible && orgEnabled ? 'active' : 'paused'}`} /><div><h3>{module.key}</h3><small>{productVisible ? 'Visible en producto' : 'Oculto por lifecycle'}</small></div></div>
              <strong>{orgEnabled ? 'Activo' : 'Apagado'}</strong>
            </header>
            <div className="pod-facts">
              <span><small>Lifecycle</small><strong>{lifecycle}</strong></span>
              <span><small>Producto</small><strong>{productVisible ? 'Visible' : 'Oculto'}</strong></span>
              <span><small>Defecto</small><strong>{module.defaultEnabled ? 'Encendido' : 'Apagado'}</strong></span>
            </div>
            <div className="context-line">
              <span>Estado del producto</span>
              <select className="input" value={lifecycle} disabled={lifecycleMutation.isPending} onChange={(event) => updateLifecycle(module.key, event.target.value as ModuleLifecycleStatus)}>
                {MODULE_LIFECYCLE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="context-line">
              <span>Acceso organizaciÃ³n</span>
              <label className="toggle-row"><input type="checkbox" checked={orgEnabled} disabled={featuresMutation.isPending} onChange={(event) => toggleFeature(module.key, event.target.checked)} /> {orgEnabled ? 'MÃ³dulo activo' : 'MÃ³dulo apagado'}</label>
            </div>
            <p className="page-subtitle">{productVisible ? 'El menÃº lo mostrarÃ¡ solo si el rol tambiÃ©n tiene permiso.' : 'No aparece al usuario final hasta cambiar su lifecycle.'}</p>
          </article>;
        })}
      </div>
    </section>}

    {tab === 'excepciones' && <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">ACCESOS POR PERSONA</span><h2>Excepciones de acceso</h2><p className="page-subtitle">Otorga acceso temporal a un mÃ³dulo concreto para una persona, sin cambiar su cargo.</p></div><button className="btn btn-primary" onClick={() => { setExceptionDraft({ userId: '', userRole: '', module: '', level: 'view', reason: '', expiresAt: '' }); setExceptionOpen(true); }}>+ Nueva excepciÃ³n</button></div>
      <div className="exception-summary">{activeExCount > 0 || expiredExCount > 0 ? <div className="section-metrics"><span><strong>{activeExceptions.length}</strong><small>Activas visibles</small></span><span><strong>{activeExCount}</strong><small>Activas totales</small></span><span><strong>{expiredExCount}</strong><small>Vencidas</small></span></div> : null}</div>
      <div className="filters"><input className="input" value={exceptionSearch} onChange={(e) => setExceptionSearch(e.target.value)} placeholder="Buscar persona, mÃ³dulo o nivel..." /><select className="input" value={exceptionClient} onChange={(e) => setExceptionClient(e.target.value)}><option value="">Todas las personas</option>{exceptionUsers.map((u) => <option key={u.id} value={u.id}>{u.name} Â· {ROLE_LABELS[u.role] ?? u.role}</option>)}</select></div>
      {visibleExceptions.length === 0
        ? <EmptyState icon="lock" title="Sin excepciones" description={exceptions.length === 0 ? 'No hay excepciones de acceso. Crea una para otorgar acceso temporal.' : 'Ninguna excepciÃ³n coincide con el filtro.'} action={exceptions.length === 0 ? <button className="btn btn-primary" onClick={() => setExceptionOpen(true)}>Crear primera excepciÃ³n</button> : undefined} />
        : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Persona</th><th>Cargo</th><th>MÃ³dulo</th><th>Nivel</th><th>Vencimiento</th><th>Motivo</th><th></th></tr></thead><tbody>{visibleExceptions.map((e) => <tr key={e.id} className={e.status === 'expired' ? 'row-muted' : ''}><td><strong>{e.userName}</strong></td><td>{e.userRole ? (ROLE_LABELS[e.userRole] ?? e.userRole) : 'â€”'}</td><td>{e.module}</td><td><span className={`level-pill level-${e.level}`} style={{ backgroundColor: `${LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73'}18`, color: LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73', borderColor: LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73' }}>{LEVEL_LABELS[e.level as PermissionLevel] ?? e.level}</span></td><td>{e.expiresAt ? new Date(e.expiresAt).toLocaleDateString('es-CL') : 'Sin vencimiento'}<br /><small><StatusBadge status={e.status} /></small></td><td>{e.reason || 'â€”'}</td><td>{e.status === 'active' ? <button className="btn btn-outline btn-sm" onClick={() => setRevokeTarget({ userId: e.userId, module: e.module })}>Revocar</button> : null}</td></tr>)}</tbody></table></div>}
    </section>}

    {tab === 'consentimiento' && <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">CUMPLIMIENTO LEGAL</span><h2>Consentimiento y polÃ­ticas</h2><p className="page-subtitle">Administra las versiones del consentimiento informado, audita las aceptaciones y configura la polÃ­tica de contraseÃ±as. Cada nueva versiÃ³n requiere que todos los usuarios vuelvan a aceptar.</p></div><button className="btn btn-primary btn-sm" onClick={() => { setConsentDraft({ title: `VersiÃ³n ${(activeConsent?.version ?? 0) + 1}`, text: activeConsent?.text ?? '' }); setConsentPublishOpen(true); }}>Nueva versiÃ³n</button></div>
      <div className="pod-governance-grid module-governance-grid" style={{marginBottom:16}}>
        <article className="module-governance-card"><header><div><span className="status-dot active" /><div><h3>VersiÃ³n activa</h3><small>{activeConsent ? `v${activeConsent.version} Â· ${new Date(activeConsent.publishedAt).toLocaleDateString('es-CL')}` : 'Sin versiÃ³n publicada'}</small></div></div><strong>{activeConsent ? `v${activeConsent.version}` : 'â€”'}</strong></header><div className="pod-facts"><span><small>Aceptaron</small><strong>{consentUsers.filter(u => u.status === 'accepted').length}</strong></span><span><small>Pendientes</small><strong>{pendingConsent.length}</strong></span><span><small>Versiones</small><strong>{consentVersions.length}</strong></span></div></article>
      </div>
      {pendingConsent.length > 0 && <div className="permission-help" style={{marginBottom:16, borderColor:'var(--amber)', background:'var(--amber-bg)'}}><strong>{pendingConsent.length} usuario{pendingConsent.length !== 1 ? 's' : ''} con aceptaciÃ³n pendiente</strong><p style={{color:'var(--amber)'}}>Cuando se publica una nueva versiÃ³n, los usuarios deben aceptarla al iniciar sesiÃ³n. Si no la aceptan, puedes otorgar acceso manualmente desde aquÃ­. Cada otorgamiento queda auditado.</p></div>}
      <h3>Usuarios y estado de aceptaciÃ³n</h3>
      <div className="table-wrapper" style={{marginBottom:20}}><table className="data-table"><thead><tr><th>Usuario</th><th>VersiÃ³n aceptada</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
        {consentUsers.length === 0 ? <tr><td colSpan={5} style={{textAlign:'center',color:'var(--muted)',padding:24}}>Sin datos de consentimiento. Los usuarios aparecerÃ¡n aquÃ­ cuando se publique la primera versiÃ³n.</td></tr> : consentUsers.map(u => <tr key={u.userId}><td><strong>{u.userName}</strong></td><td>{u.acceptedVersion ?? 'â€”'}</td><td>{u.acceptedAt ? new Date(u.acceptedAt).toLocaleDateString('es-CL') : 'â€”'}</td><td><span className={`form-status-pill ${u.status === 'accepted' ? 'is-live' : u.status === 'pending' ? 'is-paused' : 'is-draft'}`}>{u.status === 'accepted' ? 'Aceptado' : u.status === 'pending' ? 'Pendiente' : 'Expirado'}</span></td><td>{u.status === 'pending' && <button className="btn btn-outline btn-sm" disabled={consentGrantMutation.isPending} onClick={() => consentGrantMutation.mutate(u.userId)}>Otorgar acceso</button>}</td></tr>)}
      </tbody></table></div>
      <h3>Historial de versiones</h3>
      {consentVersions.length === 0 ? <EmptyState icon="document" title="Sin versiones publicadas" description="Publica la primera versiÃ³n del consentimiento informado para comenzar a registrar aceptaciones." action={<button className="btn btn-primary btn-sm" onClick={() => { setConsentDraft({ title: 'VersiÃ³n 1 - Consentimiento inicial', text: '' }); setConsentPublishOpen(true); }}>Publicar primera versiÃ³n</button>} /> : <div className="table-wrapper" style={{marginBottom:20}}><table className="data-table"><thead><tr><th>VersiÃ³n</th><th>TÃ­tulo</th><th>Publicada</th><th>Estado</th></tr></thead><tbody>{consentVersions.map(v => <tr key={v.id}><td><strong>v{v.version}</strong></td><td>{v.title}</td><td>{new Date(v.publishedAt).toLocaleDateString('es-CL')}</td><td><span className={`form-status-pill ${v.active ? 'is-live' : 'is-draft'}`}>{v.active ? 'Activa' : 'HistÃ³rica'}</span></td></tr>)}</tbody></table></div>}
      <h3>PolÃ­tica de contraseÃ±as</h3>
      <p className="page-subtitle" style={{marginBottom:12}}>ConfiguraciÃ³n que aplica a todos los usuarios. La rotaciÃ³n periÃ³dica reduce el riesgo de accesos no autorizados.</p>
      <div className="pod-governance-grid module-governance-grid">
        <article className="module-governance-card"><div><h3>Caducidad</h3><small>DÃ­as antes de exigir cambio</small></div><div className="pod-facts"><span><small>DÃ­as</small><strong><input className="input" type="number" min={30} max={365} value={pwdPolicy.expiryDays} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, expiryDays: v}); pwdPolicyMutation.mutate({ 'security.password.expiryDays': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>Longitud mÃ­nima</h3><small>Caracteres requeridos</small></div><div className="pod-facts"><span><small>MÃ­nimo</small><strong><input className="input" type="number" min={6} max={64} value={pwdPolicy.minLength} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, minLength: v}); pwdPolicyMutation.mutate({ 'security.password.minLength': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>ReutilizaciÃ³n</h3><small>ContraseÃ±as previas bloqueadas</small></div><div className="pod-facts"><span><small>Cantidad</small><strong><input className="input" type="number" min={1} max={20} value={pwdPolicy.preventReuse} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, preventReuse: v}); pwdPolicyMutation.mutate({ 'security.password.preventReuse': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>Requisitos</h3><small>Complejidad exigida</small></div><div style={{display:'flex',flexDirection:'column',gap:6}}>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireUppercase} onChange={e => { setPwdPolicy({...pwdPolicy, requireUppercase: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireUppercase': String(e.target.checked) }); }} /> MayÃºscula obligatoria</label>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireNumber} onChange={e => { setPwdPolicy({...pwdPolicy, requireNumber: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireNumber': String(e.target.checked) }); }} /> NÃºmero obligatorio</label>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireSpecial} onChange={e => { setPwdPolicy({...pwdPolicy, requireSpecial: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireSpecial': String(e.target.checked) }); }} /> CarÃ¡cter especial obligatorio</label>
        </div></article>
      </div>
    </section>}

    <Modal open={consentPublishOpen} onClose={() => setConsentPublishOpen(false)} title="Publicar nueva versiÃ³n de consentimiento">
      <form className="modal-form" onSubmit={(e) => { e.preventDefault(); consentPublishMutation.mutate(consentDraft); }}>
        <div className="permission-help" style={{marginBottom:12}}><strong>AtenciÃ³n</strong><p>Al publicar una nueva versiÃ³n, todos los usuarios deberÃ¡n aceptarla al iniciar sesiÃ³n. Los que no acepten aparecerÃ¡n como pendientes y el administrador podrÃ¡ otorgar acceso manual.</p></div>
        <label>TÃ­tulo de la versiÃ³n<input className="input" required value={consentDraft.title} onChange={e => setConsentDraft({...consentDraft, title: e.target.value})} placeholder="v2 - ActualizaciÃ³n de tÃ©rminos" /></label>
        <label>Texto del consentimiento<textarea className="input" rows={8} required value={consentDraft.text} onChange={e => setConsentDraft({...consentDraft, text: e.target.value})} placeholder="Al utilizar esta plataforma, aceptas que tus datos personales serÃ¡n tratados de acuerdo a la Ley 19.628 sobre protecciÃ³n de la vida privada..." /></label>
        <small style={{color:'var(--muted)'}}>Este texto se presenta al usuario durante el registro y cuando se publica una nueva versiÃ³n. Debe cumplir con la legislaciÃ³n chilena de protecciÃ³n de datos (Ley 19.628).</small>
        {consentPublishMutation.error && <div className="alert alert-error">{consentPublishMutation.error.message}</div>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setConsentPublishOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={consentPublishMutation.isPending}>{consentPublishMutation.isPending ? 'Publicando...' : 'Publicar versiÃ³n'}</button></div>
      </form>
    </Modal>

    <Modal open={exceptionOpen} onClose={() => setExceptionOpen(false)} title="Nueva excepciÃ³n de acceso">
      <form className="modal-form" onSubmit={(e) => { e.preventDefault(); excCreateMutation.mutate(exceptionDraft); }}>
        <label>Persona<select className="input" required value={exceptionDraft.userId} onChange={(e) => { const found = exceptionUsers.find((u) => u.id === e.target.value); setExceptionDraft({ ...exceptionDraft, userId: e.target.value, userRole: found?.role ?? '' }); }}><option value="">Seleccionar persona</option>{exceptionUsers.map((u) => <option key={u.id} value={u.id}>{u.name} Â· {ROLE_LABELS[u.role] ?? u.role}</option>)}</select></label>
        <label>MÃ³dulo<select className="input" required value={exceptionDraft.module} onChange={(e) => setExceptionDraft({ ...exceptionDraft, module: e.target.value })}><option value="">Seleccionar mÃ³dulo</option>{MODULE_CATALOG.filter((m) => isModuleLifecycleVisible(lifecycleOf(m.key, m.lifecycle))).map((m) => <option key={m.key} value={m.key}>{m.key}</option>)}</select></label>
        <label>Nivel de acceso<select className="input" value={exceptionDraft.level} onChange={(e) => setExceptionDraft({ ...exceptionDraft, level: e.target.value as PermissionLevel })}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select></label>
        <label>Vencimiento (opcional)<input className="input" type="datetime-local" value={exceptionDraft.expiresAt} onChange={(e) => setExceptionDraft({ ...exceptionDraft, expiresAt: e.target.value })} /><small>Al vencer, el acceso vuelve al nivel de su cargo automÃ¡ticamente.</small></label>
        <label>Motivo<textarea className="input" rows={2} value={exceptionDraft.reason} onChange={(e) => setExceptionDraft({ ...exceptionDraft, reason: e.target.value })} placeholder="Reemplazo por vacaciones, proyecto especial..." /></label>
        <div className="permission-help-inline"><strong>Cada excepciÃ³n queda registrada en auditorÃ­a.</strong><p>El permiso efectivo es el mayor entre el cargo y las excepciones activas. Si el cargo ya tiene Administrar, la excepciÃ³n no suma nada; si tiene Sin acceso, la excepciÃ³n abre la puerta.</p></div>
        {excCreateMutation.error && <div className="alert alert-error">{excCreateMutation.error.message}</div>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setExceptionOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={excCreateMutation.isPending}>{excCreateMutation.isPending ? 'Creando...' : 'Crear excepciÃ³n'}</button></div>
      </form>
    </Modal>

    <ConfirmDialog open={!!revokeTarget} title="Revocar excepciÃ³n" description="La persona volverÃ¡ al nivel de acceso que su cargo define. Esta acciÃ³n se registra en auditorÃ­a." confirmLabel="Revocar" pending={excRevokeMutation.isPending} onClose={() => setRevokeTarget(null)} onConfirm={() => { if (revokeTarget) { excRevokeMutation.mutate(revokeTarget, { onSuccess: () => setRevokeTarget(null) }); } }} />
  </div>;
}
