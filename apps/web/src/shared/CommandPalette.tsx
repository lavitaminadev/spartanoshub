import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../core/api';
import { useAuth } from '../core/auth';
import { getNavigation, isPathEnabled } from '../core/navigation.registry';
import { publicReservationUrl } from '../core/public-url';
import { COMMAND_PALETTE_EVENT } from './command-events';

interface SearchItem { id: string; group: string; title: string; description: string; path?: string; action?: () => void }
interface ClientResult { id: string; name: string; industry?: string; status: string }
interface LeadResult { id: string; name: string; company?: string; email?: string; status: string }
interface DocumentResult { id: string; name: string; type: string; status: string; clientId?: string }
interface FormResult { id: string; name: string; publicSlug: string; publicUrl?: string; status: string }
interface MeetingResult { id: string; title?: string; subject?: string; scheduledAt?: string; date?: string }
interface UserResult { id: string; name: string; email: string; role: string; isActive: boolean }
interface ReservationResult { id: string; referenceCode: string; guestName: string; guestEmail?: string; guestPhone?: string; status: string }

export function CommandPalette() {
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [taskMode, setTaskMode] = useState(false);
  const [taskForm, setTaskForm] = useState({ meetingId: '', description: '' });
  const navigation = useMemo(
    () => getNavigation(user?.role, user?.features, user?.permissions, user?.moduleLifecycle),
    [user?.role, user?.features, user?.permissions, user?.moduleLifecycle],
  );
  /**
   * Indica si una ruta concreta se puede abrir.
   *
   * Se valida la ruta exacta, no un prefijo: comparar por prefijo hace que `/crm` dé verdadero
   * mientras exista cualquier ruta bajo `/crm` —por ejemplo la audiencia de campañas— y eso
   * ofrecería el CRM comercial aunque esté fuera de alcance. Un resultado que termina en 404 es
   * peor que no ofrecer el resultado.
   */
  const canOpen = useCallback(
    (path: string) => isPathEnabled(path, user?.features, user?.permissions, user?.moduleLifecycle, user?.role),
    [user?.features, user?.permissions, user?.moduleLifecycle, user?.role],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((current) => !current); }
      if (event.key === 'Escape') { setOpen(false); setTaskMode(false); }
    };
    const handleOpen = () => setOpen(true);
    window.addEventListener('keydown', handleKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, handleOpen);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener(COMMAND_PALETTE_EVENT, handleOpen); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, taskMode]);

  const clientsQuery = useQuery<{ data: ClientResult[] }>({ queryKey: ['command-clients'], queryFn: () => api.get('/clients'), enabled: open && canOpen('/clients'), retry: false });
  const leadsQuery = useQuery<{ data: LeadResult[] }>({ queryKey: ['command-leads'], queryFn: () => api.get('/crm/leads'), enabled: open && canOpen('/crm/leads'), retry: false });
  const documentsQuery = useQuery<{ data: DocumentResult[] }>({ queryKey: ['command-documents'], queryFn: () => api.get('/documents'), enabled: open && canOpen('/documents'), retry: false });
  const formsQuery = useQuery<FormResult[]>({ queryKey: ['command-forms'], queryFn: () => api.get('/reservations/forms'), enabled: open && canOpen('/reservations'), retry: false });
  const reservationsQuery = useQuery<{ data: ReservationResult[] }>({ queryKey: ['command-reservations'], queryFn: () => api.get('/reservations?page=1&pageSize=50'), enabled: open && canOpen('/reservations'), retry: false });
  const usersQuery = useQuery<UserResult[]>({ queryKey: ['command-users'], queryFn: () => api.get('/users'), enabled: open && canOpen('/users'), retry: false });
  const meetingsQuery = useQuery<MeetingResult[]>({ queryKey: ['command-meetings'], queryFn: () => api.get('/meetings'), enabled: open && taskMode && canOpen('/meetings'), retry: false });
  const taskMutation = useMutation({ mutationFn: () => api.post(`/meetings/${taskForm.meetingId}/action-items`, { description: taskForm.description.trim() }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['meetings'] }); setTaskForm({ meetingId: '', description: '' }); setTaskMode(false); setOpen(false); } });

  const items = useMemo<SearchItem[]>(() => {
    const actions: SearchItem[] = navigation.map((item) => ({ id: `nav-${item.path}`, group: 'Navegación', title: item.label, description: `Abrir ${item.label}`, path: item.path }));
    if (canOpen('/clients')) actions.unshift({ id: 'action-new-client', group: 'Acciones rápidas', title: 'Crear empresa o cliente', description: 'Abrir nueva ficha comercial', path: '/clients?create=1' });
    if (canOpen('/users')) actions.unshift({ id: 'action-new-user', group: 'Acciones rápidas', title: 'Crear usuario', description: 'Asignar rol, empresa y acceso', path: '/users?create=1' });
    if (canOpen('/documents')) actions.unshift({ id: 'action-new-document', group: 'Acciones rápidas', title: 'Crear documento', description: 'Registrar o subir archivo a Drive', path: '/documents?create=1' });
    if (canOpen('/production')) actions.unshift({ id: 'action-new-piece', group: 'Acciones rápidas', title: 'Crear pieza de producción', description: 'Abrir encargo con fecha y dependencias', path: '/production?create=1' });
    if (canOpen('/crm/leads')) actions.unshift(
      { id: 'action-new-lead', group: 'Acciones rápidas', title: 'Crear lead', description: 'Abrir registro comercial', path: '/crm/leads?create=1' },
    );
    if (canOpen('/reservations')) actions.unshift({ id: 'action-new-form', group: 'Acciones rápidas', title: 'Nuevo formulario de reserva', description: 'Abrir el flujo de captación de reservas', path: '/reservations?create=1' });
    if (canOpen('/meetings')) actions.unshift({ id: 'action-new-task', group: 'Acciones rápidas', title: 'Crear tarea de reunión', description: 'Registrar una acción sin abandonar la pantalla', action: () => setTaskMode(true) });
    const records: SearchItem[] = [
      ...(clientsQuery.data?.data || []).map((client) => ({ id: `client-${client.id}`, group: 'Clientes', title: client.name, description: `${client.industry || 'Sin industria'} · ${client.status}`, path: `/clients/${client.id}` })),
      ...(leadsQuery.data?.data || []).map((lead) => ({ id: `lead-${lead.id}`, group: 'Leads', title: lead.name, description: `${lead.company || lead.email || 'Sin empresa'} · ${lead.status}`, path: `/crm/leads?focus=${lead.id}` })),
      ...(documentsQuery.data?.data || []).map((document) => ({ id: `document-${document.id}`, group: 'Documentos', title: document.name, description: `${document.type} · ${document.status}`, path: `/documents?q=${encodeURIComponent(document.name)}` })),
      ...(formsQuery.data || []).map((form) => ({ id: `form-${form.id}`, group: 'Captación', title: form.name, description: `${form.status} · ${publicReservationUrl(form.publicSlug, form.publicUrl)}`, path: `/reservations/forms/${form.id}` })),
      ...(reservationsQuery.data?.data ?? []).map((reservation) => ({ id: `reservation-${reservation.id}`, group: 'Reservas recibidas', title: reservation.guestName, description: `#${reservation.referenceCode} · ${reservation.guestEmail || reservation.guestPhone || reservation.status}`, path: `/reservations?tab=bookings&search=${encodeURIComponent(reservation.referenceCode)}` })),
      ...(usersQuery.data || []).map((account) => ({ id: `user-${account.id}`, group: 'Usuarios', title: account.name, description: `${account.email} · ${account.role} · ${account.isActive ? 'activo' : 'inactivo'}`, path: `/users?q=${encodeURIComponent(account.email)}` })),
    ];
    const needle = query.trim().toLocaleLowerCase('es');
    return [...actions, ...records].filter((item) => !needle || `${item.title} ${item.description} ${item.group}`.toLocaleLowerCase('es').includes(needle)).slice(0, 40);
  }, [clientsQuery.data, documentsQuery.data, formsQuery.data, canOpen, leadsQuery.data, navigation, query, reservationsQuery.data, usersQuery.data]);

  const execute = (item: SearchItem | undefined) => {
    if (!item) return;
    if (item.action) { item.action(); return; }
    if (item.path) navigate(item.path);
    setOpen(false); setQuery('');
  };

  if (!open) return null;
  return <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
    <header><span>VK</span>{taskMode ? <div><strong>Nueva tarea de reunión</strong><small>Se guardará en el acta seleccionada</small></div> : <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, items.length - 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === 'Enter') { event.preventDefault(); execute(items[activeIndex]); } }} placeholder="Buscar clientes, leads, documentos, reservas o una acción..." aria-label="Buscar en Espartanos" />}<kbd>ESC</kbd></header>
    {taskMode ? <form className="command-task" onSubmit={(event) => { event.preventDefault(); taskMutation.mutate(); }}><label>Reunión<select className="input" required value={taskForm.meetingId} onChange={(event) => setTaskForm({ ...taskForm, meetingId: event.target.value })}><option value="">Selecciona un acta</option>{meetingsQuery.data?.map((meeting) => <option value={meeting.id} key={meeting.id}>{meeting.title || meeting.subject || 'Reunión'}{meeting.scheduledAt || meeting.date ? ` · ${new Date(meeting.scheduledAt || meeting.date!).toLocaleDateString('es-CL')}` : ''}</option>)}</select></label><label>Tarea<input className="input" autoFocus required minLength={2} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Ej. Enviar propuesta el viernes" /></label>{taskMutation.error && <div className="alert alert-error">{taskMutation.error.message}</div>}<div><button type="button" className="btn btn-outline" onClick={() => setTaskMode(false)}>Volver</button><button className="btn btn-primary" disabled={taskMutation.isPending}>{taskMutation.isPending ? 'Guardando...' : 'Crear tarea'}</button></div></form> : <div className="command-results">{items.map((item, index) => <button className={index === activeIndex ? 'active' : ''} key={item.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => execute(item)}><span>{item.group.slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.description}</small></div><em>{item.group}</em></button>)}{items.length === 0 && <div className="command-empty"><strong>Sin resultados</strong><span>Prueba con otro nombre, correo o módulo.</span></div>}</div>}
    {!taskMode && <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span>Ctrl K desde cualquier pantalla</span></footer>}
  </section></div>;
}
