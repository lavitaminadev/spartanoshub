import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { roleLabel } from '../../core/role-labels';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { useSearchParams } from 'react-router-dom';

interface UserRow {
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  phone?: string;
  clientId?: string;
  workMode?: 'presential' | 'hybrid' | 'remote';
  mustChangePassword?: boolean;
  weeklyCapacityUd?: number;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  status: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  accountType: 'internal' | 'client';
  role: string;
  clientId: string;
  newClientName: string;
  capabilities: { reservations: boolean; crm: boolean };
}

const EMPTY_FORM: UserFormState = { name: '', email: '', password: '', phone: '', accountType: 'client', role: 'client', clientId: '', newClientName: '', capabilities: { reservations: true, crm: true } };

const USER_ROLES = [
  'admin', 'commercial_director', 'creative_director', 'operations_director', 'art_director',
  'av_director', 'ai_lead', 'community_manager', 'designer', 'audiovisual', 'client',
] as const;

const WORK_MODE_LABELS: Record<string, string> = { presential: 'Presencial', hybrid: 'Híbrida', remote: 'Remota' };
const NEW_CLIENT_VALUE = '__new_client__';

interface ResetResult {
  userId: string;
  temporaryPassword: string;
  emailSent: boolean;
  mustChangePassword: boolean;
}

type Feedback = { tone: 'success' | 'error'; text: string } | null;

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(searchParams.get('create') === '1');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [accessTarget, setAccessTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [sendResetEmail, setSendResetEmail] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const deferredSearch = useDeferredValue(search.trim());
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string>('');
  const [creatingClient, setCreatingClient] = useState(false);
  // Las acciones masivas confirman antes de ejecutarse; ConfirmDialog es dueño del paso "estás seguro" en vez de window.confirm().
  const [pendingBulkAccess, setPendingBulkAccess] = useState<{ rows: UserRow[]; isActive: boolean } | null>(null);
  const [bulkAccessPending, setBulkAccessPending] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch) params.set('q', deferredSearch);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('isActive', statusFilter);
    if (clientFilter) params.set('clientId', clientFilter);
    return params.toString();
  }, [clientFilter, deferredSearch, roleFilter, statusFilter]);

  const { data, isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users', query],
    queryFn: () => api.get(`/users${query ? `?${query}` : ''}`),
  });
  const { data: clientsResp } = useQuery<{ data: ClientOption[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = useMemo<ClientOption[]>(() => (clientsResp as { data: ClientOption[] } | undefined)?.data ?? [], [clientsResp]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setCreatedPassword(null);
    setCreatingClient(false);
    setFeedback(null);
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/users', body),
    onSuccess: async () => {
      setCreatedPassword(String(form.password));
      setCreatedName(form.name);
      // Cuando la cuenta crea también su empresa, la tabla se refresca antes de que el caché
      // de clientes conozca ese id y mostraba falsamente «Empresa no disponible».
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
      ]);
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/users/${id}`, body),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setAccessTarget(null);
      if (editing?.id === variables.id) closeModal();
      setFeedback({ tone: 'success', text: 'Acceso actualizado correctamente.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const resetMutation = useMutation<ResetResult, Error>({
    mutationFn: () => api.post(`/users/${resetTarget?.id}/reset-password`, { sendEmail: sendResetEmail }),
    onSuccess: async (result) => {
      setResetResult(result);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback({ tone: 'success', text: result.emailSent ? 'Clave temporal generada y enviada por correo.' : 'Clave temporal generada. Compártela por un canal seguro.' });
    },
    onError: (mutationError) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const users = Array.isArray(data) ? data : [];
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const availableRoles = currentUser?.role === 'operations_director'
    ? USER_ROLES.filter((role) => !['admin', 'operations_director', 'dev'].includes(role))
    : [...USER_ROLES];

  const canManage = (row: UserRow) => currentUser?.role === 'admin' || currentUser?.role === 'dev' || !['admin', 'operations_director'].includes(row.role);

  const openCreateModal = () => {
    setFeedback(null);
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (row: UserRow) => {
    setFeedback(null);
    setEditing(row);
    setForm({ name: row.name, email: row.email, password: '', phone: row.phone ?? '', accountType: row.role === 'client' ? 'client' : 'internal', role: row.role, clientId: row.clientId ?? '', newClientName: '', capabilities: { reservations: true, crm: true } });
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    let clientId = form.accountType === 'client' ? form.clientId : '';
    if (form.accountType === 'client' && clientId === NEW_CLIENT_VALUE) {
      const name = form.newClientName.trim().replace(/\s+/g, ' ');
      if (name.length < 2) {
        setFeedback({ tone: 'error', text: 'Ingresa el nombre de la empresa.' });
        return;
      }
      // La empresa nueva viaja junto con la cuenta: el backend las persiste en
      // una sola transacción y no deja empresas huérfanas si falla el usuario.
      clientId = '';
    }
    const body: Record<string, unknown> = {
      name: form.name.trim().replace(/\s+/g, ' '),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      role: form.accountType === 'client' ? 'client' : form.role,
      newClientName: form.accountType === 'client' && form.clientId === NEW_CLIENT_VALUE ? form.newClientName.trim() : undefined,
      capabilities: form.accountType === 'client' && form.clientId === NEW_CLIENT_VALUE ? form.capabilities : undefined,
    };
    // Para una empresa nueva no existe aún un UUID. Enviar `clientId: ''` hace que la
    // validación de UUID rechace la solicitud antes de que la transacción pueda crearla.
    if (form.accountType === 'client' && clientId) body.clientId = clientId;
    if (form.password) body.password = form.password;
    if (editing) updateMutation.mutate({ id: editing.id, body });
    else createMutation.mutate(body);
  };

  const generatePassword = () => {
    const values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    const generated = Array.from(values, (value) => value.toString(36)).join('-').slice(0, 24);
    setForm((current) => ({ ...current, password: `Vh-${generated}` }));
  };

  const openReset = (row: UserRow) => {
    setResetTarget(row);
    setResetResult(null);
    setSendResetEmail(true);
    resetMutation.reset();
    setFeedback(null);
  };

  const toggleAccess = (row: UserRow) => {
    setFeedback(null);
    if (row.isActive) { setAccessTarget(row); return; }
    updateMutation.mutate({ id: row.id, body: { isActive: !row.isActive } });
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setClientFilter('');
  };

  const bulkAccess = (rows: UserRow[], isActive: boolean) => {
    const manageable = rows.filter((row) => canManage(row) && row.id !== currentUser?.id);
    if (!manageable.length) return;
    setPendingBulkAccess({ rows: manageable, isActive });
  };

  const confirmBulkAccess = async () => {
    if (!pendingBulkAccess) return;
    const { rows: manageable, isActive } = pendingBulkAccess;
    setBulkAccessPending(true);
    try {
      await Promise.all(manageable.map((row) => api.patch(`/users/${row.id}`, { isActive })));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback({ tone: 'success', text: `${manageable.length} acceso(s) actualizados.` });
    } catch (bulkError) {
      setFeedback({ tone: 'error', text: bulkError instanceof Error ? bulkError.message : 'No se pudo completar la acción masiva.' });
    } finally {
      setBulkAccessPending(false);
      setPendingBulkAccess(null);
    }
  };

  if (isLoading) return <LoadingSpinner text="Cargando usuarios..." />;
  if (error) return <div className="alert alert-error">Error al cargar usuarios: {error.message}</div>;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const clientRequired = form.accountType === 'client';
  const requiresNewClientName = clientRequired && form.clientId === NEW_CLIENT_VALUE;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">SEGURIDAD Y ALCANCE</span>
          <h1>Usuarios y accesos</h1>
          <p className="page-subtitle">Gestión de cuentas y permisos.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>+ Crear cuenta</button>
      </div>

      {feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}

      <div className="filters users-filter-bar">
        <input className="input" aria-label="Buscar usuarios" placeholder="Nombre, email, teléfono o rol..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" aria-label="Filtrar por rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">Todos los roles</option>
          {USER_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
        </select>
        <select className="input" aria-label="Filtrar por acceso" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Activos e inactivos</option><option value="true">Solo activos</option><option value="false">Solo inactivos</option>
        </select>
        <select className="input" aria-label="Filtrar por empresa" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
          <option value="">Todas las empresas</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters} disabled={!search && !roleFilter && !statusFilter && !clientFilter}>Limpiar</button>
        <span className="filter-result-count">{users.length} resultado{users.length === 1 ? '' : 's'}</span>
      </div>

      <DataTable<UserRow>
        storageKey="users"
        exportFileName="usuarios"
        selectable
        bulkActions={[{ label: 'Activar accesos', onClick: (rows) => bulkAccess(rows, true) }, { label: 'Desactivar accesos', tone: 'danger', onClick: (rows) => bulkAccess(rows, false) }]}
        keyExtractor={(row) => row.id}
        columns={[
          { key: 'name', label: 'Persona', sortable: true, render: (row) => <div className="user-cell"><strong>{row.name}</strong><small>{row.email}</small></div> },
          { key: 'role', label: 'Rol', sortable: true, sortValue: (row) => roleLabel(row.role), render: (row) => <span className="access-role">{roleLabel(row.role)}</span> },
          { key: 'clientId', label: 'Alcance', render: (row) => <span className="access-scope"><strong>{row.clientId ? clientMap.get(row.clientId) ?? 'Empresa no disponible' : 'Equipo interno'}</strong><small>{row.role === 'client' ? 'Portal de cliente' : WORK_MODE_LABELS[row.workMode || 'hybrid']}</small></span> },
          { key: 'phone', label: 'Teléfono', render: (row) => row.phone || '-' },
          { key: 'isActive', label: 'Acceso', render: (row) => <div className="access-state-cell"><button type="button" className={`access-toggle ${row.isActive ? 'active' : ''}`} onClick={() => toggleAccess(row)} disabled={updateMutation.isPending || row.id === currentUser?.id || !canManage(row)} aria-label={`${row.isActive ? 'Desactivar' : 'Activar'} a ${row.name}`}><i aria-hidden="true" /><span>{row.isActive ? 'Activo' : 'Inactivo'}</span></button>{row.mustChangePassword && <small>Clave temporal</small>}</div> },
          { key: 'createdAt', label: 'Creado', sortable: true, render: (row) => new Date(row.createdAt).toLocaleDateString('es-CL') },
          { key: 'id', label: 'Acciones', render: (row) => <div className="table-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(row)} disabled={!canManage(row)}>Editar</button><button type="button" className="btn btn-outline btn-sm" onClick={() => openReset(row)} disabled={!canManage(row) || row.id === currentUser?.id}>Resetear clave</button></div> },
        ]}
        data={users}
        emptyMessage="No hay usuarios para los filtros seleccionados"
      />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Editar a ${editing.name}` : createdPassword ? 'Cuenta creada' : 'Crear cuenta'}>
        {createdPassword ? (
          <div className="modal-form">
            <div className="temporary-password-result">
              <span>CLAVE TEMPORAL · 24 HORAS · SE MUESTRA UNA VEZ</span>
              <strong>{createdPassword}</strong>
              <small>Usuario: {createdName}</small>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => { navigator.clipboard.writeText(createdPassword); setFeedback({ tone: 'success', text: 'Clave copiada al portapapeles.' }); }}>Copiar clave</button>
            </div>
            <div className="alert alert-info">Comparte esta clave por un canal seguro (correo, WhatsApp, Slack). Al primer ingreso debera aceptar los terminos y crear su propia contraseña.</div>
            {feedback?.tone === 'success' && <div className="alert alert-success">{feedback.text}</div>}
            <button className="btn btn-primary btn-block" type="button" onClick={closeModal}>Cerrar</button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="account-form-intro"><strong>{editing ? 'Identidad y alcance' : 'Nueva identidad de acceso'}</strong><p>Primero define si la persona entra como equipo interno o como usuario de empresa. Los permisos finos se ajustan luego desde Administración.</p></div>
          {feedback?.tone === 'error' && <div className="alert alert-error" role="alert">{feedback.text}</div>}
          <label htmlFor="user-name">Nombre completo<input id="user-name" className="input" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={255} required /></label>
          <div className="form-row">
            <label htmlFor="user-email">Email<input id="user-email" className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label htmlFor="user-phone">Teléfono<input id="user-phone" className="input" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          </div>
          <fieldset className="form-choice-group">
            <legend>Tipo de cuenta</legend>
            <label className="toggle-row"><input type="radio" name="account-type" checked={form.accountType === 'internal'} disabled={editing?.id === currentUser?.id} onChange={() => setForm({ ...form, accountType: 'internal', role: form.role === 'client' ? 'designer' : form.role, clientId: '', newClientName: '' })} /> Equipo interno</label>
            <label className="toggle-row"><input type="radio" name="account-type" checked={form.accountType === 'client'} disabled={editing?.id === currentUser?.id} onChange={() => setForm({ ...form, accountType: 'client', role: 'client' })} /> Acceso de empresa / cliente</label>
          </fieldset>
          <div className="form-row">
            <label htmlFor="user-role">Rol<select id="user-role" className="input" value={clientRequired ? 'client' : form.role} disabled={clientRequired || editing?.id === currentUser?.id} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {availableRoles.filter((role) => role !== 'client').map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              {!availableRoles.includes(form.role as (typeof USER_ROLES)[number]) && <option value={form.role}>{roleLabel(form.role)}</option>}
            </select></label>
            <label htmlFor="user-client">Empresa<select id="user-client" className="input" value={form.clientId} disabled={!clientRequired} required={clientRequired} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
              <option value="">Selecciona una empresa</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              <option value={NEW_CLIENT_VALUE}>+ Crear empresa nueva</option>
            </select></label>
          </div>
          {requiresNewClientName && <label htmlFor="user-new-client">Nombre de la empresa nueva<input id="user-new-client" className="input" value={form.newClientName} onChange={(event) => setForm({ ...form, newClientName: event.target.value })} minLength={2} maxLength={255} required /></label>}
          {requiresNewClientName && <fieldset className="form-choice-group"><legend>Servicios contratados</legend><label className="toggle-row"><input type="checkbox" checked={form.capabilities.reservations} onChange={(event) => setForm({ ...form, capabilities: { ...form.capabilities, reservations: event.target.checked } })} /> Reservas</label><label className="toggle-row"><input type="checkbox" checked={form.capabilities.crm} onChange={(event) => setForm({ ...form, capabilities: { ...form.capabilities, crm: event.target.checked } })} /> CRM</label><small>Solo se mostrarán y autorizarán los servicios seleccionados para esta empresa.</small></fieldset>}
          <div className="alert alert-info">Pods y permisos especiales se configuran después desde Gobernanza o Administración.</div>
          <label htmlFor="user-password">{editing ? 'Nueva contraseña temporal (opcional)' : 'Contraseña temporal'}<div className="password-generator"><input id="user-password" className="input" type="text" autoComplete="new-password" minLength={8} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} /><button type="button" className="btn btn-outline btn-sm" onClick={generatePassword}>Generar segura</button></div><small>Se solicitará una clave personal en el primer ingreso.</small></label>
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={isSaving || creatingClient || (clientRequired && !form.clientId) || (requiresNewClientName && form.newClientName.trim().length < 2)}>{isSaving || creatingClient ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}</button></div>
        </form>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(accessTarget)}
        title="Desactivar acceso"
        description={`${accessTarget?.name ?? ''} ya no podrá iniciar sesión, pero su historial y asignaciones se conservarán.`}
        confirmLabel="Confirmar desactivación"
        pending={updateMutation.isPending}
        error={updateMutation.error?.message}
        onClose={() => setAccessTarget(null)}
        onConfirm={() => accessTarget && updateMutation.mutate({ id: accessTarget.id, body: { isActive: false } })}
      />
      <ConfirmDialog
        open={pendingBulkAccess !== null}
        title={pendingBulkAccess?.isActive ? 'Activar accesos' : 'Desactivar accesos'}
        description={pendingBulkAccess ? `${pendingBulkAccess.isActive ? 'Se activará el acceso de' : 'Se desactivará el acceso de'} ${pendingBulkAccess.rows.length} cuenta(s).` : ''}
        confirmLabel={pendingBulkAccess?.isActive ? 'Activar' : 'Desactivar'}
        pending={bulkAccessPending}
        onClose={() => setPendingBulkAccess(null)}
        onConfirm={() => void confirmBulkAccess()}
      />
      <Modal open={Boolean(resetTarget)} onClose={() => { setResetTarget(null); setResetResult(null); }} title={`Resetear clave de ${resetTarget?.name ?? ''}`}>
        <div className="modal-form reset-access-modal">
          {!resetResult ? <><p>Se cerrarán las sesiones activas y se generará una contraseña temporal. La persona deberá cambiarla al ingresar.</p><label className="toggle-row"><input type="checkbox" checked={sendResetEmail} onChange={(event) => setSendResetEmail(event.target.checked)} /> Enviar también al correo {resetTarget?.email}</label>{resetMutation.error && <div className="alert alert-error">{resetMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setResetTarget(null)}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>{resetMutation.isPending ? 'Generando...' : 'Generar acceso temporal'}</button></div></> : <><div className="temporary-password-result"><span>CLAVE TEMPORAL · SE MUESTRA UNA VEZ</span><strong>{resetResult.temporaryPassword}</strong><button className="btn btn-outline btn-sm" type="button" onClick={() => navigator.clipboard.writeText(resetResult.temporaryPassword)}>Copiar clave</button></div><div className={`alert alert-${resetResult.emailSent ? 'success' : 'info'}`}>{resetResult.emailSent ? 'También fue enviada por correo.' : 'El correo no fue enviado. Comparte esta clave por un canal seguro.'}</div><button className="btn btn-primary btn-block" type="button" onClick={() => { setResetTarget(null); setResetResult(null); }}>Cerrar</button></>}
        </div>
      </Modal>
    </div>
  );
}
