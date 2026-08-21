import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { ROLE_LABELS } from '../../core/role-labels';
import {
  MODULE_LIFECYCLE_LABELS,
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
  const user = useAuth((state) => state.user);
  /**
   * Ajustar quién ve qué: administración y desarrollo.
   *
   * Es la función que el dueño de la organización resuelve desde configuración sin depender de
   * nadie. Estaba fijada a `dev`, así que la pestaña existía y no se dibujaba nunca para él.
   */
  const esDesarrollo = user?.role === 'dev';
  const canManagePermissions = esDesarrollo || user?.role === 'admin';

  /**
   * Encender y apagar módulos: solo desarrollo.
   *
   * Va después de actualizar el servidor y comprobar que el módulo funciona, así que lo decide
   * quien despliega. Es una decisión distinta de la anterior aunque vivan en la misma pantalla:
   * una dice qué existe y la otra quién lo ve, y tenerlas bajo la misma condición obligaba a
   * elegir entre ocultarle a administración lo suyo o darle lo que no le toca.
   */
  const canManageModules = esDesarrollo;
  const [tab, setTab] = useState<'permisos' | 'modulos' | 'excepciones' | 'consentimiento'>('excepciones');
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

  const permsQuery = useQuery<{ matrix?: Record<string, Record<string, string>> }>({ queryKey: ['role-permissions'], queryFn: () => api.get('/roles/permissions'), enabled: canManagePermissions });
  const exceptionsQuery = useQuery<{ items?: AccessException[] }>({ queryKey: ['access-exceptions'], queryFn: () => api.get('/permission-overrides') });
  const usersQuery = useQuery<(UserOption[] | { data: UserOption[] })>({ queryKey: ['admin-users'], queryFn: () => api.get('/users?isActive=true') });
  const featuresQuery = useQuery<{ features?: OrganizationFeatures }>({ queryKey: ['organization-features'], queryFn: () => api.get('/organizations/features'), enabled: canManageModules });
  const settingsQuery = useQuery<OrganizationSetting[]>({ queryKey: ['organization-settings'], queryFn: () => api.get('/settings') });
  const consentVersionsQuery = useQuery<{ items?: Array<{ id: string; version: number; title: string; text: string; publishedAt: string; active: boolean }> }>({ queryKey: ['consent-versions'], queryFn: () => api.get('/consent/versions') });
  const consentUsersQuery = useQuery<{ items?: Array<{ userId: string; userName: string; acceptedVersion: number | null; acceptedAt?: string; status: 'accepted' | 'pending' | 'expired' }> }>({ queryKey: ['consent-users'], queryFn: () => api.get('/consent/users') });

  const matrix = permsQuery.data?.matrix;
  const exceptions = (exceptionsQuery.data as { items?: AccessException[] } | undefined)?.items ?? [];
  const rawUsers = usersQuery.data;
  const users = Array.isArray(rawUsers) ? rawUsers : (rawUsers as { data?: UserOption[] } | undefined)?.data ?? [];
  const features = featuresQuery.data?.features;
  // Memorizado: se construía un `Map` nuevo en cada render, así que el `useMemo` del resumen
  // por ciclo de vida dependía de una referencia distinta cada vez y no memorizaba nada.
  const lifecycleSettings = useMemo(
    () => new Map((settingsQuery.data ?? []).filter((s) => s.key.startsWith('modules.lifecycle.')).map((s) => [s.key, s.value])),
    [settingsQuery.data],
  );

  useEffect(() => {
    if ((!canManagePermissions && tab === 'permisos') || (!canManageModules && tab === 'modulos')) setTab('excepciones');
  }, [canManagePermissions, canManageModules, tab]);

  // Las personas con cargo de desarrollo solo se listan para desarrollo: conceder excepciones
  // sobre ese cargo es lo mismo que ampliarse el acceso a uno mismo por la puerta de al lado.
  const exceptionUsers = users.filter((u) => u.id && u.name && (esDesarrollo || u.role !== 'dev'));
  const visibleExceptions = exceptions.filter((e) =>
    (esDesarrollo || e.userRole !== 'dev') &&
    matchesSearch(exceptionSearch, [e.userName, e.module, e.level, e.reason]) &&
    (!exceptionClient || e.userId === exceptionClient)
  );

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

  // La excepción se identifica por la pareja persona + módulo, que es como la guarda el
  // backend: una persona tiene a lo sumo una excepción por módulo, así que crear y reemplazar
  // son la misma operación y no hace falta un identificador propio para dirigirla.
  const excCreateMutation = useMutation({
    mutationFn: (body: typeof exceptionDraft) => api.put(`/users/${body.userId}/permissions/${body.module}`, {
      level: body.level,
      reason: body.reason || undefined,
      // El `datetime-local` del formulario da hora local sin zona; el backend espera ISO 8601.
      expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-exceptions'] }); setExceptionOpen(false); setFeedback({ tone: 'success', text: 'Excepción de acceso creada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const excRevokeMutation = useMutation({
    mutationFn: (target: { userId: string; module: string }) => api.delete(`/users/${target.userId}/permissions/${target.module}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-exceptions'] }); setFeedback({ tone: 'success', text: 'Excepción revocada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const featuresMutation = useMutation({
    mutationFn: (f: Partial<OrganizationFeatures>) => api.put('/organizations/features', { features: f }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organization-features'] });
      // `user.features` vive en Zustand, no en React Query. Sin recargar este perfil el
      // interruptor se guardaba y el menú seguía representando el estado anterior; si esa
      // recarga falla hay que decirlo, porque el resultado es un menú que ofrece lo que el
      // servidor ya está bloqueando.
      try {
        await useAuth.getState().refreshProfile();
        setFeedback({ tone: 'success', text: 'Acceso por módulo actualizado.' });
      } catch {
        setFeedback({
          tone: 'error',
          text: 'Se guardó el cambio, pero no se pudo recargar tu perfil: el menú puede seguir mostrando el estado anterior. Vuelve a cargar la página.',
        });
      }
    },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (values: Record<string, string>) => api.put('/settings', { values }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organization-settings'] });
      /*
        Si el perfil no se recarga, hay que decirlo.

        El cambio ya está guardado y el servidor lo aplica de inmediato, pero el menú se arma
        con el perfil que tiene el navegador. Cuando esa recarga fallaba en silencio, quedaba la
        peor combinación posible: el menú seguía ofreciendo el módulo y al entrar respondía que
        no hay acceso. Se lee como que el sistema se contradice, y en realidad es una pantalla
        con datos viejos.
      */
      try {
        await useAuth.getState().refreshProfile();
        setFeedback({ tone: 'success', text: 'Ciclo de vida del módulo actualizado.' });
      } catch {
        setFeedback({
          tone: 'error',
          text: 'Se guardó el cambio, pero no se pudo recargar tu perfil: el menú puede seguir mostrando el estado anterior. Vuelve a cargar la página.',
        });
      }
    },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const consentPublishMutation = useMutation({
    mutationFn: (body: { title: string; text: string }) => api.post('/consent/versions', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consent-versions'] }); qc.invalidateQueries({ queryKey: ['consent-users'] }); setConsentPublishOpen(false); setConsentDraft({ title: '', text: '' }); setFeedback({ tone: 'success', text: 'Nueva versión de consentimiento publicada. Todos los usuarios deberán aceptarla.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const consentGrantMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/consent/users/${userId}/grant`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consent-users'] }); setFeedback({ tone: 'success', text: 'Acceso otorgado sin aceptación. Auditoría registrada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });
  const pwdPolicyMutation = useMutation({
    mutationFn: (values: Record<string, string | number | boolean>) => api.put('/settings', { values }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organization-settings'] }); setFeedback({ tone: 'success', text: 'Política de contraseñas actualizada.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const consentVersions = (consentVersionsQuery.data as { items?: Array<{ id: string; version: number; title: string; text: string; publishedAt: string; active: boolean }> } | undefined)?.items ?? [];
  const consentUsers = (consentUsersQuery.data as { items?: Array<{ userId: string; userName: string; acceptedVersion: number | null; acceptedAt?: string; status: 'accepted' | 'pending' | 'expired' }> } | undefined)?.items ?? [];
  const activeConsent = consentVersions.find(v => v.active);
  const pendingConsent = consentUsers.filter(u => u.status === 'pending');
  const loading = (canManagePermissions && permsQuery.isLoading) || exceptionsQuery.isLoading || usersQuery.isLoading || (canManageModules && featuresQuery.isLoading) || settingsQuery.isLoading || consentVersionsQuery.isLoading || consentUsersQuery.isLoading;
  const loadError = (canManagePermissions && permsQuery.error) || exceptionsQuery.error || usersQuery.error || (canManageModules && featuresQuery.error) || settingsQuery.error || consentVersionsQuery.error || consentUsersQuery.error;

  const setCell = (modKey: string, role: string, level: PermissionLevel) => {
    const next = { ...matrixDraft } as Record<string, Record<string, PermissionLevel>>;
    if (!next[modKey]) next[modKey] = {};
    next[modKey] = { ...(next[modKey] ?? defaultMatrix[modKey] ?? {}) } as Record<string, PermissionLevel>;
    next[modKey][role] = level;
    setMatrixDraft(next);
    setDirty(true);
  };

  const currentMatrix = dirty ? (Object.keys(matrixDraft).length ? matrixDraft : defaultMatrix) : defaultMatrix;

  const lifecycleOf = (key: OrganizationModuleKey, fallback: ModuleLifecycleStatus) =>
    (lifecycleSettings.get(moduleLifecycleSettingKey(key)) as ModuleLifecycleStatus | undefined) ?? fallback;

  const activeExceptions = visibleExceptions.filter((e) => e.status === 'active');
  const activeExCount = exceptions.filter((e) => e.status === 'active').length;
  const expiredExCount = exceptions.filter((e) => e.status === 'expired').length;
  const exceptionModuleOptions = MODULE_CATALOG.filter((module) => {
    const lifecycle = canManageModules
      ? lifecycleOf(module.key, module.lifecycle)
      : (user?.moduleLifecycle?.[module.key] ?? module.lifecycle);
    const orgEnabled = canManageModules
      ? (features?.[module.key] ?? module.defaultEnabled)
      : (user?.features?.[module.key] ?? module.defaultEnabled);
    return orgEnabled && isModuleLifecycleVisible(lifecycle);
  });

  const toggleFeature = (key: OrganizationModuleKey, enabled: boolean) => {
    featuresMutation.mutate({ [key]: enabled } as Partial<OrganizationFeatures>);
  };

  const applyAgencyCorePreset = () => {
    featuresMutation.mutate(buildAgencyCoreOrganizationFeatures());
  };

  const activateAllForReview = () => {
    if (!window.confirm('¿Encender todos los módulos y marcarlos como activos para esta organización? Podrás apagarlos individualmente después.')) return;
    const allFeatures = Object.fromEntries(MODULE_CATALOG.map((module) => [module.key, true])) as Partial<OrganizationFeatures>;
    const allLifecycle = Object.fromEntries(MODULE_CATALOG.map((module) => [moduleLifecycleSettingKey(module.key), 'active'])) as Record<string, string>;
    featuresMutation.mutate(allFeatures);
    lifecycleMutation.mutate(allLifecycle);
  };

  const updateLifecycle = (key: OrganizationModuleKey, lifecycle: ModuleLifecycleStatus) => {
    lifecycleMutation.mutate({ [moduleLifecycleSettingKey(key)]: lifecycle });
  };

  if (loading) return <LoadingSpinner text="Abriendo panel de administración..." />;
  if (loadError) return <QueryErrorState title="No pudimos abrir el panel de administración" message={loadError.message} />;

  return <div className="page governance-page">
    <PageHero
      eyebrow="CONTROL DE ACCESO"
      title="Accesos y seguridad"
      subtitle={canManagePermissions ? 'Matriz base, excepciones, consentimiento y estado de módulos.' : 'Personas, accesos puntuales, consentimiento y seguridad operativa.'}
      variant="feature"
      aside={<div className="page-hero-stats">
        <span><small>Cargos</small><strong>{ROLE_KEYS.length}</strong></span>
        <span><small>Excepciones activas</small><strong>{activeExCount}</strong></span>
        {canManageModules && <span><small>Módulos</small><strong>{MODULE_CATALOG.length}</strong></span>}
        {canManageModules && <span><small>Módulos activos</small><strong>{lifecycleSummary.active ?? 0}</strong></span>}
        <span><small>Pendientes consent.</small><strong>{pendingConsent.length}</strong></span>
      </div>}
    />
    <div className="admin-quick-links">
      <span className="page-eyebrow">ACCESO RÁPIDO</span>
      <div className="admin-quick-grid">
        <Link to="/users" className="admin-quick-card"><strong>Usuarios</strong><small>Gestionar personas y cargos</small></Link>
        <Link to="/security" className="admin-quick-card"><strong>Seguridad</strong><small>Salud y auditoría</small></Link>
        <Link to="/integrations" className="admin-quick-card"><strong>Integraciones</strong><small>Meta, Cloudinary, GA4</small></Link>
        {esDesarrollo && <Link to="/governance" className="admin-quick-card"><strong>Gobierno del producto</strong><small>Flujos, pods y módulos</small></Link>}
        {esDesarrollo && <Link to="/settings" className="admin-quick-card"><strong>Configuración técnica</strong><small>Parámetros del producto</small></Link>}
        {esDesarrollo && <Link to="/operations" className="admin-quick-card"><strong>Estado del sistema</strong><small>Diagnóstico y capacidad</small></Link>}
      </div>
    </div>
    <nav className="governance-tabs">
      {canManagePermissions && <button className={tab === 'permisos' ? 'active' : ''} onClick={() => { setTab('permisos'); setFeedback(null); }}><span>01</span><strong>Permisos por cargo</strong><small>Matriz de acceso por rol y módulo</small></button>}
      {canManageModules && <button className={tab === 'modulos' ? 'active' : ''} onClick={() => { setTab('modulos'); setFeedback(null); }}><span>02</span><strong>Módulos</strong><small>Ciclo de vida y acceso por organización</small></button>}
      <button className={tab === 'excepciones' ? 'active' : ''} onClick={() => { setTab('excepciones'); setFeedback(null); }}><span>03</span><strong>Accesos por persona</strong><small>Excepciones y accesos temporales</small></button>
      <button className={tab === 'consentimiento' ? 'active' : ''} onClick={() => { setTab('consentimiento'); setFeedback(null); }}><span>04</span><strong>Consentimiento</strong><small>Versiones, aceptación y acceso</small></button>
    </nav>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}

    {canManagePermissions && tab === 'permisos' && <section className="permission-matrix-section">
      <div className="section-toolbar"><div><span className="page-eyebrow">MATRIZ DE ACCESO</span><h2>Permisos por cargo y módulo</h2><p className="page-subtitle">Cada celda define qué puede hacer un cargo en un módulo. Los cambios se guardan al confirmar.</p></div>
        <div className="permission-view-toggle" role="group" aria-label="Forma de ver los permisos"><button className={permView === 'role' ? 'active' : ''} onClick={() => setPermView('role')}>Por cargo</button><button className={permView === 'matrix' ? 'active' : ''} onClick={() => setPermView('matrix')}>Matriz completa</button></div>
        {dirty && <div className="toolbar-actions"><button className="btn btn-outline btn-sm" onClick={() => { setMatrixDraft({}); setDirty(false); qc.invalidateQueries({ queryKey: ['role-permissions'] }); }}>Descartar cambios</button><button className="btn btn-primary btn-sm" disabled={permMutation.isPending} onClick={() => permMutation.mutate(currentMatrix)}>{permMutation.isPending ? 'Guardando...' : 'Guardar matriz'}</button></div>}
      </div>
      <div className="permission-help">
        <div className="help-inline"><strong>Niveles de permiso</strong>
          <div className="level-legend">{LEVELS.map((l) => <span key={l} className={`level-pill level-${l}`} style={{ backgroundColor: `${LEVEL_COLORS[l]}18`, color: LEVEL_COLORS[l], borderColor: LEVEL_COLORS[l] }}>{LEVEL_LABELS[l]}</span>)}</div>
        </div>
        <p>Sin acceso = el módulo no aparece en el menú. Ver = navegable pero sin editar. Editar = modificar datos propios del módulo. Administrar = cambiar configuración del módulo.</p>
      </div>
      {permView === 'role' ? (
        <div className="permission-role-view">
          <div className="permission-role-picker" role="group" aria-label="Elegir cargo">{ROLE_KEYS.map((role) => <button key={role} className={roleFocus === role ? 'active' : ''} onClick={() => setRoleFocus(role)}>{ROLE_LABELS[role]}</button>)}</div>
          <div className="permission-role-modules">{MODULE_CATALOG.map((mod) => { const level = currentMatrix[mod.key]?.[roleFocus] ?? 'none'; const enabled = level !== 'none'; return <div className="permission-role-row" key={mod.key}><div className="permission-role-module"><strong>{mod.key}</strong><small>{MODULE_LIFECYCLE_LABELS[mod.lifecycle]}</small></div><div className="permission-role-controls"><label className="central-switch"><input type="checkbox" checked={enabled} onChange={(e) => setCell(mod.key, roleFocus, e.target.checked ? (currentMatrix[mod.key]?.[roleFocus] !== 'none' ? currentMatrix[mod.key]?.[roleFocus] as PermissionLevel : 'view') : 'none')} /><span></span><strong>{enabled ? 'Con acceso' : 'Sin acceso'}</strong></label>{enabled && <select className={`level-select level-${level}`} style={{ backgroundColor: `${LEVEL_COLORS[level]}15`, color: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }} value={level} onChange={(e) => setCell(mod.key, roleFocus, e.target.value as PermissionLevel)}>{LEVELS.filter((l) => l !== 'none').map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select>}</div></div>; })}</div>
        </div>
      ) : (
      <div className="permission-matrix-wrapper">
        <table className="permission-matrix">
          <thead><tr><th className="sticky-col">Módulo</th>{ROLE_KEYS.map((role) => <th key={role} className="matrix-role-col" title={ROLE_LABELS[role]}><span>{ROLE_LABELS[role]}</span></th>)}</tr></thead>
          <tbody>{MODULE_CATALOG.map((mod) => <tr key={mod.key}><td className="sticky-col module-label"><strong>{mod.key}</strong><small>{MODULE_LIFECYCLE_LABELS[mod.lifecycle]}</small></td>{ROLE_KEYS.map((role) => { const level = currentMatrix[mod.key]?.[role] ?? 'none'; return <td key={role} className="matrix-cell"><select className={`level-select level-${level}`} style={{ backgroundColor: `${LEVEL_COLORS[level]}15`, color: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }} value={level} onChange={(e) => setCell(mod.key, role, e.target.value as PermissionLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select></td>; })}</tr>)}</tbody>
        </table>
      </div>
      )}
    </section>}

    {canManageModules && tab === 'modulos' && <section className="modules-center">
      <div className="section-toolbar">
        <div>
          <span className="page-eyebrow">OFERTA Y ACCESO</span>
          <h2>Centro de módulos</h2>
          {/* Cuál oculta y cuál no era la pregunta que llevaba a cambiar a «piloto» esperando
              que desapareciera del menú, que es justo lo que piloto no hace. */}
          <p className="page-subtitle">
            Activo, piloto y mantenimiento se ven igual: los tres aparecen en el menú.
            <strong> Para dejar algo fuera de una demostración, apágalo en «Acceso
            organización»</strong> —el interruptor de abajo de cada tarjeta—: es lo único que
            también te lo oculta a ti. «En desarrollo» lo esconde del resto del equipo pero
            Desarrollo lo sigue viendo, así que desde tu sesión parece que no pasó nada.
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-outline" type="button" disabled={featuresMutation.isPending || lifecycleMutation.isPending} onClick={activateAllForReview}>Encender todo para revisar</button>
          <button className="btn btn-primary" type="button" disabled={featuresMutation.isPending} onClick={applyAgencyCorePreset}>Usar solo operación base</button>
        </div>
      </div>
      <div className="reservation-flow-switch module-lifecycle-summary" role="group" aria-label="Resumen por ciclo de vida">
        <button className="active" type="button"><strong>{lifecycleSummary.active ?? 0}</strong><span>Activos</span></button>
        <button type="button"><strong>{lifecycleSummary.development ?? 0}</strong><span>En desarrollo</span></button>
        <button type="button"><strong>{lifecycleSummary.pilot ?? 0}</strong><span>Piloto</span></button>
        <button type="button"><strong>{lifecycleSummary.maintenance ?? 0}</strong><span>Mantenimiento</span></button>
        <button type="button"><strong>{lifecycleSummary.disabled ?? 0}</strong><span>Deshabilitados</span></button>
      </div>
      <div className="pod-governance-grid module-governance-grid">
        {MODULE_CATALOG.map((module) => {
          const lifecycle = lifecycleOf(module.key, module.lifecycle);
          const productVisible = isModuleLifecycleVisible(lifecycle);
          const orgEnabled = features?.[module.key] ?? module.defaultEnabled;
          /*
            Quién lo sigue viendo, dicho sin rodeos.

            «En desarrollo» esconde el módulo para todos **menos para Desarrollo**, que es quien
            lo está levantando. Visto desde una sesión de Desarrollo eso se lee como que el
            cambio no hizo nada: la pantalla sigue en el menú y sigue abriéndose. Para dejar algo
            fuera de una demostración hay que apagarlo en la organización o deshabilitarlo, que
            son los dos estados que tampoco perdonan a Desarrollo.
          */
          const availability = !orgEnabled
            ? { label: 'Apagado en organización', detail: 'Oculto para todos, incluido Desarrollo. Es la forma segura de dejar algo fuera de una demostración.', tone: 'paused' }
            : lifecycle === 'development'
              ? { label: 'En desarrollo', detail: 'Oculto para el resto del equipo, pero Desarrollo lo sigue viendo. Si quieres comprobar cómo queda, apágalo en la organización.', tone: 'paused' }
              : !productVisible
                ? { label: 'Deshabilitado', detail: 'Oculto para todos, incluido Desarrollo.', tone: 'paused' }
                : { label: 'Disponible por configuración', detail: 'Aparecerá sólo para los cargos que tengan permiso sobre este módulo.', tone: 'active' };
          return <article key={module.key} className="module-governance-card">
            <header>
              <div><span className={`status-dot ${availability.tone}`} /><div><h3>{module.key}</h3><small>{availability.label}</small></div></div>
              <strong>{availability.tone === 'active' ? 'Disponible' : 'Bloqueado'}</strong>
            </header>
            <div className="pod-facts">
              <span><small>Ciclo de vida</small><strong>{MODULE_LIFECYCLE_LABELS[lifecycle]}</strong></span>
              <span><small>Organización</small><strong>{orgEnabled ? 'Encendido' : 'Apagado'}</strong></span>
              <span><small>Resultado</small><strong>{availability.tone === 'active' ? 'Disponible' : 'Bloqueado'}</strong></span>
            </div>
            <div className="context-line">
              <span>Estado del producto</span>
              <select className="input" value={lifecycle} disabled={lifecycleMutation.isPending} onChange={(event) => updateLifecycle(module.key, event.target.value as ModuleLifecycleStatus)}>
                {MODULE_LIFECYCLE_STATUSES.map((status) => <option key={status} value={status}>{MODULE_LIFECYCLE_LABELS[status]}</option>)}
              </select>
            </div>
            <div className="context-line">
              <span>Acceso organización</span>
              <label className="toggle-row"><input type="checkbox" checked={orgEnabled} disabled={featuresMutation.isPending} onChange={(event) => toggleFeature(module.key, event.target.checked)} /> {orgEnabled ? 'Módulo activo' : 'Módulo apagado'}</label>
            </div>
            <p className="page-subtitle">{availability.detail}</p>
          </article>;
        })}
      </div>
    </section>}

    {tab === 'excepciones' && <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">ACCESOS POR PERSONA</span><h2>Excepciones de acceso</h2><p className="page-subtitle">Otorga acceso temporal a un módulo concreto para una persona, sin cambiar su cargo.</p></div><button className="btn btn-primary" onClick={() => { setExceptionDraft({ userId: '', userRole: '', module: '', level: 'view', reason: '', expiresAt: '' }); setExceptionOpen(true); }}>+ Nueva excepción</button></div>
      <div className="exception-summary">{activeExCount > 0 || expiredExCount > 0 ? <div className="section-metrics"><span><strong>{activeExceptions.length}</strong><small>Activas visibles</small></span><span><strong>{activeExCount}</strong><small>Activas totales</small></span><span><strong>{expiredExCount}</strong><small>Vencidas</small></span></div> : null}</div>
      <div className="filters"><input className="input" value={exceptionSearch} onChange={(e) => setExceptionSearch(e.target.value)} placeholder="Buscar persona, módulo o nivel..." /><select className="input" value={exceptionClient} onChange={(e) => setExceptionClient(e.target.value)}><option value="">Todas las personas</option>{exceptionUsers.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role] ?? u.role}</option>)}</select></div>
      {visibleExceptions.length === 0
        ? <EmptyState icon="lock" title="Sin excepciones" description={exceptions.length === 0 ? 'No hay excepciones de acceso. Crea una para otorgar acceso temporal.' : 'Ninguna excepción coincide con el filtro.'} action={exceptions.length === 0 ? <button className="btn btn-primary" onClick={() => setExceptionOpen(true)}>Crear primera excepción</button> : undefined} />
        : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Persona</th><th>Cargo</th><th>Módulo</th><th>Nivel</th><th>Vencimiento</th><th>Motivo</th><th></th></tr></thead><tbody>{visibleExceptions.map((e) => <tr key={e.id} className={e.status === 'expired' ? 'row-muted' : ''}><td><strong>{e.userName}</strong></td><td>{e.userRole ? (ROLE_LABELS[e.userRole] ?? e.userRole) : '—'}</td><td>{e.module}</td><td><span className={`level-pill level-${e.level}`} style={{ backgroundColor: `${LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73'}18`, color: LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73', borderColor: LEVEL_COLORS[e.level as PermissionLevel] ?? '#706a73' }}>{LEVEL_LABELS[e.level as PermissionLevel] ?? e.level}</span></td><td>{e.expiresAt ? new Date(e.expiresAt).toLocaleDateString('es-CL') : 'Sin vencimiento'}<br /><small><StatusBadge status={e.status} /></small></td><td>{e.reason || '—'}</td><td>{e.status === 'active' ? <button className="btn btn-outline btn-sm" onClick={() => setRevokeTarget({ userId: e.userId, module: e.module })}>Revocar</button> : null}</td></tr>)}</tbody></table></div>}
    </section>}

    {tab === 'consentimiento' && <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">CUMPLIMIENTO LEGAL</span><h2>Consentimiento y políticas</h2><p className="page-subtitle">Administra las versiones del consentimiento informado, audita las aceptaciones y configura la política de contraseñas. Cada nueva versión requiere que todos los usuarios vuelvan a aceptar.</p></div><button className="btn btn-primary btn-sm" onClick={() => { setConsentDraft({ title: `Versión ${(activeConsent?.version ?? 0) + 1}`, text: activeConsent?.text ?? '' }); setConsentPublishOpen(true); }}>Nueva versión</button></div>
      <div className="pod-governance-grid module-governance-grid" style={{marginBottom:16}}>
        <article className="module-governance-card"><header><div><span className="status-dot active" /><div><h3>Versión activa</h3><small>{activeConsent ? `v${activeConsent.version} · ${new Date(activeConsent.publishedAt).toLocaleDateString('es-CL')}` : 'Sin versión publicada'}</small></div></div><strong>{activeConsent ? `v${activeConsent.version}` : '—'}</strong></header><div className="pod-facts"><span><small>Aceptaron</small><strong>{consentUsers.filter(u => u.status === 'accepted').length}</strong></span><span><small>Pendientes</small><strong>{pendingConsent.length}</strong></span><span><small>Versiones</small><strong>{consentVersions.length}</strong></span></div></article>
      </div>
      {pendingConsent.length > 0 && <div className="permission-help" style={{marginBottom:16, borderColor:'var(--amber)', background:'var(--amber-bg)'}}><strong>{pendingConsent.length} usuario{pendingConsent.length !== 1 ? 's' : ''} con aceptación pendiente</strong><p style={{color:'var(--amber)'}}>Cuando se publica una nueva versión, los usuarios deben aceptarla al iniciar sesión. Si no la aceptan, puedes otorgar acceso manualmente desde aquí. Cada otorgamiento queda auditado.</p></div>}
      <h3>Usuarios y estado de aceptación</h3>
      <div className="table-wrapper" style={{marginBottom:20}}><table className="data-table"><thead><tr><th>Usuario</th><th>Versión aceptada</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
        {consentUsers.length === 0 ? <tr><td colSpan={5} style={{textAlign:'center',color:'var(--muted)',padding:24}}>Sin datos de consentimiento. Los usuarios aparecerán aquí cuando se publique la primera versión.</td></tr> : consentUsers.map(u => <tr key={u.userId}><td><strong>{u.userName}</strong></td><td>{u.acceptedVersion ?? '—'}</td><td>{u.acceptedAt ? new Date(u.acceptedAt).toLocaleDateString('es-CL') : '—'}</td><td><span className={`form-status-pill ${u.status === 'accepted' ? 'is-live' : u.status === 'pending' ? 'is-paused' : 'is-draft'}`}>{u.status === 'accepted' ? 'Aceptado' : u.status === 'pending' ? 'Pendiente' : 'Expirado'}</span></td><td>{u.status === 'pending' && <button className="btn btn-outline btn-sm" disabled={consentGrantMutation.isPending} onClick={() => consentGrantMutation.mutate(u.userId)}>Otorgar acceso</button>}</td></tr>)}
      </tbody></table></div>
      <h3>Historial de versiones</h3>
      {consentVersions.length === 0 ? <EmptyState icon="document" title="Sin versiones publicadas" description="Publica la primera versión del consentimiento informado para comenzar a registrar aceptaciones." action={<button className="btn btn-primary btn-sm" onClick={() => { setConsentDraft({ title: 'Versión 1 - Consentimiento inicial', text: '' }); setConsentPublishOpen(true); }}>Publicar primera versión</button>} /> : <div className="table-wrapper" style={{marginBottom:20}}><table className="data-table"><thead><tr><th>Versión</th><th>Título</th><th>Publicada</th><th>Estado</th></tr></thead><tbody>{consentVersions.map(v => <tr key={v.id}><td><strong>v{v.version}</strong></td><td>{v.title}</td><td>{new Date(v.publishedAt).toLocaleDateString('es-CL')}</td><td><span className={`form-status-pill ${v.active ? 'is-live' : 'is-draft'}`}>{v.active ? 'Activa' : 'Histórica'}</span></td></tr>)}</tbody></table></div>}
      <h3>Política de contraseñas</h3>
      <p className="page-subtitle" style={{marginBottom:12}}>Configuración que aplica a todos los usuarios. La rotación periódica reduce el riesgo de accesos no autorizados.</p>
      <div className="pod-governance-grid module-governance-grid">
        <article className="module-governance-card"><div><h3>Caducidad</h3><small>Días antes de exigir cambio</small></div><div className="pod-facts"><span><small>Días</small><strong><input className="input" type="number" min={30} max={365} value={pwdPolicy.expiryDays} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, expiryDays: v}); pwdPolicyMutation.mutate({ 'security.password.expiryDays': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>Longitud mínima</h3><small>Caracteres requeridos</small></div><div className="pod-facts"><span><small>Mínimo</small><strong><input className="input" type="number" min={6} max={64} value={pwdPolicy.minLength} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, minLength: v}); pwdPolicyMutation.mutate({ 'security.password.minLength': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>Reutilización</h3><small>Contraseñas previas bloqueadas</small></div><div className="pod-facts"><span><small>Cantidad</small><strong><input className="input" type="number" min={1} max={20} value={pwdPolicy.preventReuse} onChange={e => { const v = Number(e.target.value); setPwdPolicy({...pwdPolicy, preventReuse: v}); pwdPolicyMutation.mutate({ 'security.password.preventReuse': String(v) }); }} /></strong></span></div></article>
        <article className="module-governance-card"><div><h3>Requisitos</h3><small>Complejidad exigida</small></div><div style={{display:'flex',flexDirection:'column',gap:6}}>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireUppercase} onChange={e => { setPwdPolicy({...pwdPolicy, requireUppercase: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireUppercase': String(e.target.checked) }); }} /> Mayúscula obligatoria</label>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireNumber} onChange={e => { setPwdPolicy({...pwdPolicy, requireNumber: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireNumber': String(e.target.checked) }); }} /> Número obligatorio</label>
          <label className="toggle-row"><input type="checkbox" checked={pwdPolicy.requireSpecial} onChange={e => { setPwdPolicy({...pwdPolicy, requireSpecial: e.target.checked}); pwdPolicyMutation.mutate({ 'security.password.requireSpecial': String(e.target.checked) }); }} /> Carácter especial obligatorio</label>
        </div></article>
      </div>
    </section>}

    <Modal open={consentPublishOpen} onClose={() => setConsentPublishOpen(false)} title="Publicar nueva versión de consentimiento">
      <form className="modal-form" onSubmit={(e) => { e.preventDefault(); consentPublishMutation.mutate(consentDraft); }}>
        <div className="permission-help" style={{marginBottom:12}}><strong>Atención</strong><p>Al publicar una nueva versión, todos los usuarios deberán aceptarla al iniciar sesión. Los que no acepten aparecerán como pendientes y el administrador podrá otorgar acceso manual.</p></div>
        <label>Título de la versión<input className="input" required value={consentDraft.title} onChange={e => setConsentDraft({...consentDraft, title: e.target.value})} placeholder="v2 - Actualización de términos" /></label>
        <label>Texto del consentimiento<textarea className="input" rows={8} required value={consentDraft.text} onChange={e => setConsentDraft({...consentDraft, text: e.target.value})} placeholder="Al utilizar esta plataforma, aceptas que tus datos personales serán tratados de acuerdo a la Ley 19.628 sobre protección de la vida privada..." /></label>
        <small style={{color:'var(--muted)'}}>Este texto se presenta al usuario durante el registro y cuando se publica una nueva versión. Debe cumplir con la legislación chilena de protección de datos (Ley 19.628).</small>
        {consentPublishMutation.error && <div className="alert alert-error">{consentPublishMutation.error.message}</div>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setConsentPublishOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={consentPublishMutation.isPending}>{consentPublishMutation.isPending ? 'Publicando...' : 'Publicar versión'}</button></div>
      </form>
    </Modal>

    <Modal open={exceptionOpen} onClose={() => setExceptionOpen(false)} title="Nueva excepción de acceso">
      <form className="modal-form" onSubmit={(e) => { e.preventDefault(); excCreateMutation.mutate(exceptionDraft); }}>
        <label>Persona<select className="input" required value={exceptionDraft.userId} onChange={(e) => { const found = exceptionUsers.find((u) => u.id === e.target.value); setExceptionDraft({ ...exceptionDraft, userId: e.target.value, userRole: found?.role ?? '' }); }}><option value="">Seleccionar persona</option>{exceptionUsers.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role] ?? u.role}</option>)}</select></label>
        <label>Módulo<select className="input" required value={exceptionDraft.module} onChange={(e) => setExceptionDraft({ ...exceptionDraft, module: e.target.value })}><option value="">Seleccionar módulo</option>{exceptionModuleOptions.map((m) => <option key={m.key} value={m.key}>{m.key}</option>)}</select></label>
        <label>Nivel de acceso<select className="input" value={exceptionDraft.level} onChange={(e) => setExceptionDraft({ ...exceptionDraft, level: e.target.value as PermissionLevel })}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</select></label>
        <label>Vencimiento (opcional)<input className="input" type="datetime-local" value={exceptionDraft.expiresAt} onChange={(e) => setExceptionDraft({ ...exceptionDraft, expiresAt: e.target.value })} /><small>Al vencer, el acceso vuelve al nivel de su cargo automáticamente.</small></label>
        <label>Motivo<textarea className="input" rows={2} value={exceptionDraft.reason} onChange={(e) => setExceptionDraft({ ...exceptionDraft, reason: e.target.value })} placeholder="Reemplazo por vacaciones, proyecto especial..." /></label>
        <div className="permission-help-inline"><strong>Cada excepción queda registrada en auditoría.</strong><p>La excepción reemplaza el nivel que define el cargo para este módulo. Usa “Sin acceso” para bloquear temporalmente y una fecha de vencimiento para devolver el acceso al nivel del cargo.</p></div>
        {excCreateMutation.error && <div className="alert alert-error">{excCreateMutation.error.message}</div>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setExceptionOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={excCreateMutation.isPending}>{excCreateMutation.isPending ? 'Creando...' : 'Crear excepción'}</button></div>
      </form>
    </Modal>

    <ConfirmDialog open={!!revokeTarget} title="Revocar excepción" description="La persona volverá al nivel de acceso que su cargo define. Esta acción se registra en auditoría." confirmLabel="Revocar" pending={excRevokeMutation.isPending} onClose={() => setRevokeTarget(null)} onConfirm={() => { if (revokeTarget) { excRevokeMutation.mutate(revokeTarget, { onSuccess: () => setRevokeTarget(null) }); } }} />
  </div>;
}
