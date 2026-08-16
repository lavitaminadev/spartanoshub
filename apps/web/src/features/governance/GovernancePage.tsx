import { useEffect, useMemo, useState } from 'react';
import { refetchWhenIdle } from '../../core/refetch-policy';
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
import { ROLE_LABELS } from '../../core/role-labels';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { AuditPanel } from './AuditPanel';
import { Tooltip } from '../../shared/Tooltip';
import { PageHero } from '../../shared/PageHero';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface WorkflowStep { key: string; label: string; responsibleRole?: string; slaHours?: number; required: boolean }
interface Workflow { id: string; code: string; name: string; description?: string; steps: WorkflowStep[]; isActive: boolean; version: number }
interface UserOption { id: string; name: string; role: string; workMode?: string }
interface ClientOption { id: string; name: string; status: string }
interface Pod { id: string; name: string; description?: string; leaderId?: string; status: string; monthlyCapacityUd: number; members: UserOption[]; clients: ClientOption[] }
interface OrganizationSetting { key: string; value: string | number | boolean | null; source: 'organization' | 'master_default' }
type OrganizationFeatures = Record<OrganizationModuleKey, boolean>;
type Feedback = { tone: 'success' | 'error'; text: string } | null;

function newStep(index: number): WorkflowStep { return { key: `etapa_${index + 1}`, label: `Nueva etapa ${index + 1}`, required: true }; }

function formatWorkflowRole(role?: string): string {
  if (!role) return 'Responsable por asignar';
  return ROLE_LABELS[role] ?? role;
}

export function GovernancePage() {
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user);
  const canManageModules = user?.role === 'dev';
  const [tab, setTab] = useState<'workflows' | 'pods' | 'modules' | 'audit'>('workflows');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<Workflow | null>(null);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [podOpen, setPodOpen] = useState(false);
  const [podDraft, setPodDraft] = useState({ name: '', description: '', leaderId: '', monthlyCapacityUd: 80, memberIds: [] as string[], clientIds: [] as string[] });
  const [archivePodId, setArchivePodId] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<'all' | ModuleLifecycleStatus>('all');

  const workflowsQuery = useQuery<Workflow[]>({ queryKey: ['workflows'], queryFn: () => api.get('/workflows'), refetchInterval: refetchWhenIdle(60_000) });
  const podsQuery = useQuery<Pod[]>({ queryKey: ['pods'], queryFn: () => api.get('/pods') });
  const usersQuery = useQuery<UserOption[]>({ queryKey: ['governance-users'], queryFn: () => api.get('/users?isActive=true') });
  const clientsQuery = useQuery<{ data: ClientOption[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const featuresQuery = useQuery<{ features: OrganizationFeatures }>({ queryKey: ['organization-features'], queryFn: () => api.get('/organizations/features') });
  const settingsQuery = useQuery<OrganizationSetting[]>({ queryKey: ['organization-settings'], queryFn: () => api.get('/settings') });
  const clients = (clientsQuery.data as { data?: ClientOption[] } | undefined)?.data ?? [];

  useEffect(() => {
    if (!canManageModules && tab === 'modules') setTab('workflows');
  }, [canManageModules, tab]);

  const workflowMutation = useMutation({
    mutationFn: (workflow: Workflow) => api.put(`/workflows/${workflow.id}`, { name: workflow.name, description: workflow.description, isActive: workflow.isActive, steps: workflow.steps }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['workflows'] }); setEditingWorkflow(null); setWorkflowDraft(null); setFeedback({ tone: 'success', text: 'Flujo actualizado. Las nuevas operaciones usarán esta versión.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const resetWorkflowMutation = useMutation({
    mutationFn: (code: string) => api.post(`/workflows/${code}/reset`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['workflows'] }); setFeedback({ tone: 'success', text: 'Flujo restaurado según el Documento Maestro.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const podMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: podDraft.name.trim(), description: podDraft.description.trim() || undefined, leaderId: podDraft.leaderId || undefined, monthlyCapacityUd: podDraft.monthlyCapacityUd };
      const pod = editingPod ? await api.put<Pod>(`/pods/${editingPod.id}`, payload) : await api.post<Pod>('/pods', payload);
      await api.put(`/pods/${pod.id}/members`, { userIds: podDraft.memberIds });
      await api.put(`/pods/${pod.id}/clients`, { clientIds: podDraft.clientIds });
      return pod;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pods'] }),
        queryClient.invalidateQueries({ queryKey: ['operations'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
      ]);
      setPodOpen(false);
      setEditingPod(null);
      setFeedback({ tone: 'success', text: 'Pod guardado con sus integrantes y cuentas.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const archivePodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pods/${id}`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['pods'] }); setFeedback({ tone: 'success', text: 'Pod archivado sin perder su historial.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const featuresMutation = useMutation({
    mutationFn: (features: Partial<OrganizationFeatures>) => api.put('/organizations/features', { features }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-features'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
      ]);
      setFeedback({ tone: 'success', text: 'Acceso por módulo actualizado para esta organización.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const lifecycleMutation = useMutation({
    mutationFn: (values: Record<string, string>) => api.put('/settings', { values }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
      ]);
      setFeedback({ tone: 'success', text: 'Ciclo de vida de módulos actualizado para esta organización.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const users = (usersQuery.data ?? []).filter((user) => user.role !== 'client');
  const openWorkflow = (workflow: Workflow) => { const copy = structuredClone(workflow); setEditingWorkflow(workflow); setWorkflowDraft(copy); setFeedback(null); };
  const moveStep = (index: number, direction: -1 | 1) => setWorkflowDraft((current) => {
    if (!current) return current;
    const target = index + direction;
    if (target < 0 || target >= current.steps.length) return current;
    const steps = [...current.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    return { ...current, steps };
  });
  const updateStep = (index: number, patch: Partial<WorkflowStep>) => setWorkflowDraft((current) => current ? { ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) } : current);
  const openPod = (pod?: Pod) => {
    setEditingPod(pod ?? null);
    setPodDraft(pod
      ? { name: pod.name, description: pod.description ?? '', leaderId: pod.leaderId ?? '', monthlyCapacityUd: Number(pod.monthlyCapacityUd), memberIds: pod.members.map((item) => item.id), clientIds: pod.clients.map((item) => item.id) }
      : { name: '', description: '', leaderId: '', monthlyCapacityUd: 80, memberIds: [], clientIds: [] });
    setPodOpen(true);
    setFeedback(null);
  };
  const toggle = (key: 'memberIds' | 'clientIds', id: string) => setPodDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));
  const organizationFeatures = featuresQuery.data?.features;
  const lifecycleSettings = new Map(
    (settingsQuery.data ?? [])
      .filter((setting) => setting.key.startsWith('modules.lifecycle.'))
      .map((setting) => [setting.key, setting.value]),
  );
  const moduleSummary = ORGANIZATION_MODULE_CATALOG.reduce((summary, module) => {
    const lifecycle = (lifecycleSettings.get(moduleLifecycleSettingKey(module.key)) as ModuleLifecycleStatus | undefined) ?? module.lifecycle;
    summary[lifecycle] = (summary[lifecycle] ?? 0) + 1;
    return summary;
  }, {} as Record<ModuleLifecycleStatus, number>);
  const visibleModules = ORGANIZATION_MODULE_CATALOG.filter((module) => {
    if (moduleFilter === 'all') return true;
    const lifecycle = (lifecycleSettings.get(moduleLifecycleSettingKey(module.key)) as ModuleLifecycleStatus | undefined) ?? module.lifecycle;
    return lifecycle === moduleFilter;
  });
  const toggleFeature = (key: OrganizationModuleKey, enabled: boolean) => {
    featuresMutation.mutate({ [key]: enabled } as Partial<OrganizationFeatures>);
  };
  const applyAgencyCorePreset = () => {
    featuresMutation.mutate(buildAgencyCoreOrganizationFeatures());
  };
  const updateLifecycle = (key: OrganizationModuleKey, lifecycle: ModuleLifecycleStatus) => {
    lifecycleMutation.mutate({ [moduleLifecycleSettingKey(key)]: lifecycle });
  };
  const workflowOverview = useMemo(() => {
    const workflows = workflowsQuery.data ?? [];
    const totalStages = workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0);
    const stagesWithOwner = workflows.reduce((sum, workflow) => sum + workflow.steps.filter((step) => step.responsibleRole).length, 0);
    const slaValues = workflows.flatMap((workflow) => workflow.steps.map((step) => step.slaHours).filter((value): value is number => Boolean(value)));

    return {
      totalStages,
      coverage: totalStages ? Math.round(stagesWithOwner / totalStages * 100) : 0,
      averageSla: slaValues.length ? Math.round(slaValues.reduce((sum, value) => sum + value, 0) / slaValues.length) : 0,
    };
  }, [workflowsQuery.data]);

  if (workflowsQuery.isLoading || podsQuery.isLoading || usersQuery.isLoading || clientsQuery.isLoading || featuresQuery.isLoading || settingsQuery.isLoading) {
    return <LoadingSpinner text="Preparando gobernanza operativa..." />;
  }
  const loadError = workflowsQuery.error || podsQuery.error || usersQuery.error || clientsQuery.error || featuresQuery.error || settingsQuery.error;
  if (loadError) return <QueryErrorState title="No pudimos abrir la gobernanza" message={loadError.message} />;

  return <div className="page governance-page">
    <PageHero
      eyebrow="CONTROL ADMINISTRATIVO"
      title="La operación se adapta sin perder estructura."
      subtitle="Reglas y estructura del equipo."
      aside={<div className="page-hero-stats"><span><small>Flujos</small><strong>{workflowsQuery.data?.length ?? 0}</strong></span><span><small>Pods activos</small><strong>{podsQuery.data?.filter((pod) => pod.status === 'active').length ?? 0}</strong></span><span><small>Módulos activos</small><strong>{moduleSummary.active ?? 0}</strong></span></div>}
    />
    <nav className="governance-tabs"><button className={tab === 'workflows' ? 'active' : ''} onClick={() => setTab('workflows')}><span>01</span><strong>Flujos operativos</strong><small>Etapas, responsables y SLA</small></button><button className={tab === 'pods' ? 'active' : ''} onClick={() => setTab('pods')}><span>02</span><strong>Pods y capacidad</strong><small>Equipo y cartera de cuentas</small></button>{canManageModules && <button className={tab === 'modules' ? 'active' : ''} onClick={() => setTab('modules')}><span>03</span><strong>Centro de módulos</strong><small>Ciclo de vida y acceso por organización</small></button>}<button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><span>04</span><strong>Auditoría</strong><small>Cambios, actores y evidencia</small></button></nav>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}

    {tab === 'workflows' && <section className="workflow-management"><div className="workflow-command-bar"><article><span>Flujos activos</span><strong>{workflowsQuery.data?.filter((workflow) => workflow.isActive).length ?? 0}</strong><small>Publicados y visibles para la operación.</small></article><article><span>Etapas documentadas</span><strong>{workflowOverview.totalStages}</strong><small>{workflowOverview.coverage}% con responsable definido.</small></article><article><span>SLA promedio</span><strong>{workflowOverview.averageSla || '-'}</strong><small>{workflowOverview.averageSla ? 'Horas por etapa con compromiso declarado.' : 'Faltan SLA por definir.'}</small></article></div><div className="workflow-grid">{workflowsQuery.data?.map((workflow) => { const nextStep = workflow.steps.find((step) => !step.responsibleRole || !step.slaHours) ?? workflow.steps[0]; return <article className="workflow-card workflow-card-rich" key={workflow.id}><header><div><span>{workflow.code.replaceAll('_', ' ')}</span><h2>{workflow.name}</h2></div><i>v{workflow.version}</i></header><p>{workflow.description}</p><div className="workflow-release-bar"><span>Versión publicada <strong>v{workflow.version}</strong></span><span>{workflow.isActive ? 'Activa en producto' : 'Guardada sin activar'}</span><span>{workflow.steps.length} etapas</span></div><div className="workflow-strip" aria-label={`Secuencia de ${workflow.name}`}>{workflow.steps.map((step, index) => <span key={`${step.key}-${index}`} className={step.responsibleRole ? 'is-configured' : 'is-pending'}><b>{String(index + 1).padStart(2, '0')}</b>{step.label}</span>)}</div><div className="workflow-next-action"><span>Siguiente acción</span><strong>{nextStep?.label ?? 'Sin etapas'}</strong><small>{nextStep ? `${formatWorkflowRole(nextStep.responsibleRole)}${nextStep.slaHours ? ` · SLA ${nextStep.slaHours} h` : ' · falta definir SLA'}` : 'Completa la definición del flujo.'}</small></div><ol className="workflow-admin-list">{workflow.steps.slice(0, 4).map((step, index) => <li key={`${step.key}-${index}`}><strong>{step.label}</strong><span>{formatWorkflowRole(step.responsibleRole)}</span><small>{step.slaHours ? `${step.slaHours} h SLA` : 'Sin SLA'}</small></li>)}</ol>{workflow.steps.length > 4 && <div className="workflow-more">+ {workflow.steps.length - 4} etapas adicionales</div>}<footer><button className="btn btn-primary btn-sm" onClick={() => openWorkflow(workflow)}>Configurar flujo</button><button className="btn btn-outline btn-sm" onClick={() => resetWorkflowMutation.mutate(workflow.code)} disabled={resetWorkflowMutation.isPending}>Restaurar base</button></footer></article>; })}</div></section>}

    {tab === 'pods' && <section><div className="section-toolbar"><div><span className="page-eyebrow">ESTRUCTURA DE CUENTAS</span><h2>Pods operativos</h2></div><button className="btn btn-primary" onClick={() => openPod()}>+ Crear pod</button></div>{!podsQuery.data?.length ? <div className="governance-empty"><strong>Aún no hay pods</strong><p>Crea el primero, define su capacidad y asigna equipo y clientes.</p><button className="btn btn-primary" onClick={() => openPod()}>Crear primer pod</button></div> : <div className="pod-governance-grid">{podsQuery.data.map((pod) => { const demand = pod.clients.reduce((sum, client) => sum + Number((client as ClientOption & { defaultUdBudget?: number }).defaultUdBudget ?? 0), 0); const usage = Math.min(100, Math.round(demand / Math.max(Number(pod.monthlyCapacityUd), 1) * 100)); return <article key={pod.id}><header><div><span className={`status-dot ${pod.status}`} /><div><h3>{pod.name}</h3><small>{pod.description || 'Sin descripción'}</small></div></div><strong>{usage}%</strong></header><div className="pod-capacity"><i style={{ width: `${usage}%` }} /></div><div className="pod-facts"><span><small>Capacidad</small><strong>{Number(pod.monthlyCapacityUd)} UD</strong></span><span><small>Integrantes</small><strong>{pod.members.length}</strong></span><span><small>Cuentas</small><strong>{pod.clients.length}</strong></span></div><div className="pod-people">{pod.members.slice(0, 5).map((member) => <Tooltip key={member.id} label={member.name}><span>{member.name.slice(0, 2).toUpperCase()}</span></Tooltip>)}{pod.members.length > 5 && <span>+{pod.members.length - 5}</span>}</div><footer><button className="btn btn-outline btn-sm" onClick={() => openPod(pod)}>Editar estructura</button><button className="btn btn-outline btn-sm" onClick={() => setArchivePodId(pod.id)}>Archivar</button></footer></article>; })}</div>}</section>}

    {canManageModules && tab === 'modules' && <section className="modules-center"><div className="section-toolbar"><div><span className="page-eyebrow">OFERTA Y ACCESO</span><h2>Centro de módulos</h2><p className="page-subtitle">Ciclo de vida para decidir visibilidad del producto y switch para encenderlo o apagarlo por organización.</p></div><button className="btn btn-primary" type="button" disabled={featuresMutation.isPending} onClick={applyAgencyCorePreset}>Usar solo operación base</button></div><div className="reservation-flow-switch module-lifecycle-summary" role="group" aria-label="Filtrar por ciclo de vida"><button className={moduleFilter === 'all' ? 'active' : ''} type="button" onClick={() => setModuleFilter('all')}><strong>{ORGANIZATION_MODULE_CATALOG.length}</strong><span>Todos</span></button><button className={moduleFilter === 'active' ? 'active' : ''} type="button" onClick={() => setModuleFilter('active')}><strong>{moduleSummary.active ?? 0}</strong><span>Activos</span></button><button className={moduleFilter === 'development' ? 'active' : ''} type="button" onClick={() => setModuleFilter('development')}><strong>{moduleSummary.development ?? 0}</strong><span>En desarrollo</span></button><button className={moduleFilter === 'pilot' ? 'active' : ''} type="button" onClick={() => setModuleFilter('pilot')}><strong>{moduleSummary.pilot ?? 0}</strong><span>Piloto</span></button><button className={moduleFilter === 'maintenance' ? 'active' : ''} type="button" onClick={() => setModuleFilter('maintenance')}><strong>{moduleSummary.maintenance ?? 0}</strong><span>Mantenimiento</span></button><button className={moduleFilter === 'disabled' ? 'active' : ''} type="button" onClick={() => setModuleFilter('disabled')}><strong>{moduleSummary.disabled ?? 0}</strong><span>Deshabilitados</span></button></div><div className="pod-governance-grid module-governance-grid">{visibleModules.map((module) => { const lifecycle = (lifecycleSettings.get(moduleLifecycleSettingKey(module.key)) as ModuleLifecycleStatus | undefined) ?? module.lifecycle; const orgEnabled = organizationFeatures?.[module.key] ?? false; const productVisible = isModuleLifecycleVisible(lifecycle); return <article key={module.key} className="module-governance-card"><header><div><span className={`status-dot ${productVisible ? 'active' : 'paused'}`} /><div><h3>{module.key}</h3><small>{lifecycle === 'maintenance' ? 'En mantenimiento' : productVisible ? 'Visible en producto' : 'Oculto por ciclo de vida'}</small></div></div><strong>{lifecycle}</strong></header>{lifecycle === 'maintenance' && <div className="module-maintenance-note">En mantenimiento — el equipo puede estar ajustándolo.</div>}<div className="pod-facts"><span><small>Ciclo de vida</small><strong>{MODULE_LIFECYCLE_LABELS[lifecycle]}</strong></span><span><small>Por defecto</small><strong>{module.defaultEnabled ? 'Encendido' : 'Apagado'}</strong></span><span><small>Organización</small><strong>{orgEnabled ? 'Activo' : 'Apagado'}</strong></span></div><div className="context-line"><span>Estado del producto</span><select className="input" value={lifecycle} disabled={lifecycleMutation.isPending} onChange={(event) => updateLifecycle(module.key, event.target.value as ModuleLifecycleStatus)}>{MODULE_LIFECYCLE_STATUSES.map((status) => <option key={status} value={status}>{MODULE_LIFECYCLE_LABELS[status]}</option>)}</select></div><div className="context-line"><span>Acceso en esta organización</span><label className="central-switch"><input type="checkbox" checked={orgEnabled} disabled={featuresMutation.isPending} onChange={(event) => toggleFeature(module.key, event.target.checked)} /><span></span><strong>{orgEnabled ? 'Módulo activo' : 'Módulo apagado'}</strong></label></div><p className="page-subtitle">{productVisible ? 'Puede mostrarse si el rol y la organización lo permiten.' : 'Aunque la organización lo encienda, seguirá oculto mientras el lifecycle no cambie.'}</p></article>; })}</div></section>}

    {tab === 'audit' && <AuditPanel />}

    <Modal open={Boolean(editingWorkflow && workflowDraft)} onClose={() => { setEditingWorkflow(null); setWorkflowDraft(null); }} title={`Configurar ${editingWorkflow?.name ?? 'flujo'}`}>
      {workflowDraft && <form className="modal-form workflow-editor" onSubmit={(event) => { event.preventDefault(); workflowMutation.mutate(workflowDraft); }}><div className="workflow-editor-intro"><strong>Versión {workflowDraft.version + 1}</strong><p>Define etapas, responsables y SLA.</p></div><label>Nombre del flujo<input className="input" required value={workflowDraft.name} onChange={(event) => setWorkflowDraft({ ...workflowDraft, name: event.target.value })} /></label><label>Descripción<textarea className="input" rows={2} value={workflowDraft.description ?? ''} onChange={(event) => setWorkflowDraft({ ...workflowDraft, description: event.target.value })} /></label><div className="workflow-step-editor">{workflowDraft.steps.map((step, index) => <article key={`${step.key}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div className="workflow-step-fields"><input className="input" aria-label={`Nombre etapa ${index + 1}`} value={step.label} onChange={(event) => setWorkflowDraft({ ...workflowDraft, steps: workflowDraft.steps.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value, key: event.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || item.key } : item) })} /><select className="input" value={step.responsibleRole ?? ''} onChange={(event) => updateStep(index, { responsibleRole: event.target.value || undefined })}><option value="">Responsable por asignar</option>{Object.entries(ROLE_LABELS).filter(([role]) => role !== 'client').map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><input className="input" type="number" min={1} max={8760} placeholder="SLA horas" value={step.slaHours ?? ''} onChange={(event) => updateStep(index, { slaHours: event.target.value ? Number(event.target.value) : undefined })} /></div><div className="workflow-step-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label="Subir etapa">↑</button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === workflowDraft.steps.length - 1} aria-label="Bajar etapa">↓</button><button type="button" className="danger" onClick={() => setWorkflowDraft({ ...workflowDraft, steps: workflowDraft.steps.filter((_, itemIndex) => itemIndex !== index) })} disabled={workflowDraft.steps.length === 1} aria-label="Quitar etapa">×</button></div></article>)}</div><button className="btn btn-outline" type="button" onClick={() => setWorkflowDraft({ ...workflowDraft, steps: [...workflowDraft.steps, newStep(workflowDraft.steps.length)] })}>+ Agregar etapa</button><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => { setEditingWorkflow(null); setWorkflowDraft(null); }}>Cancelar</button><button className="btn btn-primary" disabled={workflowMutation.isPending}>{workflowMutation.isPending ? 'Guardando...' : 'Publicar nueva versión'}</button></div></form>}
    </Modal>

    <Modal open={podOpen} onClose={() => setPodOpen(false)} title={editingPod ? `Editar ${editingPod.name}` : 'Crear pod operativo'}>
      <form className="modal-form pod-editor" onSubmit={(event) => { event.preventDefault(); podMutation.mutate(); }}><div className="form-row"><label>Nombre<input className="input" required minLength={2} value={podDraft.name} onChange={(event) => setPodDraft({ ...podDraft, name: event.target.value })} /></label><label>Capacidad mensual UD<input className="input" type="number" min={1} required value={podDraft.monthlyCapacityUd} onChange={(event) => setPodDraft({ ...podDraft, monthlyCapacityUd: Number(event.target.value) })} /></label></div><label>Propósito del pod<textarea className="input" rows={2} value={podDraft.description} onChange={(event) => setPodDraft({ ...podDraft, description: event.target.value })} /></label><label>Líder de cuenta<select className="input" value={podDraft.leaderId} onChange={(event) => setPodDraft({ ...podDraft, leaderId: event.target.value })}><option value="">Seleccionar líder</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {ROLE_LABELS[user.role] ?? user.role}</option>)}</select></label><div className="pod-assignment-grid"><fieldset><legend>Integrantes <span>{podDraft.memberIds.length}</span></legend><div className="check-list">{users.map((user) => <label key={user.id}><input type="checkbox" checked={podDraft.memberIds.includes(user.id)} onChange={() => toggle('memberIds', user.id)} /><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role] ?? user.role}</small></span></label>)}</div></fieldset><fieldset><legend>Cuentas <span>{podDraft.clientIds.length}</span></legend><div className="check-list">{clients.map((client) => <label key={client.id}><input type="checkbox" checked={podDraft.clientIds.includes(client.id)} onChange={() => toggle('clientIds', client.id)} /><span><strong>{client.name}</strong><small>{client.status}</small></span></label>)}</div></fieldset></div>{podMutation.error && <div className="alert alert-error">{podMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setPodOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={podMutation.isPending}>{podMutation.isPending ? 'Guardando estructura...' : 'Guardar pod'}</button></div></form>
    </Modal>

    <ConfirmDialog
      open={Boolean(archivePodId)}
      title="Archivar pod"
      description="El pod se archivará sin perder su historial. Los integrantes y cuentas dejarán de estar asignados a esta estructura."
      confirmLabel="Archivar"
      pending={archivePodMutation.isPending}
      onClose={() => setArchivePodId(null)}
      onConfirm={() => { if (archivePodId) { archivePodMutation.mutate(archivePodId, { onSuccess: () => setArchivePodId(null) }); } }}
    />
  </div>;
}
