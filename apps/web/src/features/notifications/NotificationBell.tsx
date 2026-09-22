import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { refetchWhenIdle } from '../../core/refetch-policy';
import { useAvisosDelNavegador } from './avisos-del-navegador';

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

/**
 * A dónde lleva un aviso de Reservas: a lo que avisa, no a la portada del módulo.
 *
 * Tocar «Nueva reserva recibida» dejaba en la lista general, y había que buscar a la persona a
 * mano. El servidor manda en cada aviso el id de la reserva, la solicitud o el local.
 */
function destinoDeReservas(notification: NotificationRecord, base: string): string {
  const datos = notification.data ?? {};
  const texto = (clave: string) => (typeof datos[clave] === 'string' ? String(datos[clave]) : '');
  const reserva = texto('reservationId'); const solicitud = texto('requestId'); const local = texto('formId');
  if (reserva) return `${base}?tab=bookings&reserva=${encodeURIComponent(reserva)}`;
  if (notification.type === 'reservation_group_request') return `${base}?tab=groups${solicitud ? `&solicitud=${encodeURIComponent(solicitud)}` : ''}`;
  if (notification.type === 'reservation_waitlist') return `${base}/waitlist`;
  if (local) return `${base}/locals/${encodeURIComponent(local)}`;
  return base;
}

function notificationRoute(notification: NotificationRecord, clientView: boolean): string | null {
  if (clientView) {
    if (notification.type.startsWith('reservation_')) return destinoDeReservas(notification, '/portal/reservations');
    if (notification.type.startsWith('approval.') || notification.type.startsWith('piece.')) return '/portal/approvals';
    return null;
  }
  if (notification.type.startsWith('piece.')) return '/production';
  if (notification.type.startsWith('lead.')) return '/crm/leads';
  if (notification.type.startsWith('reservation_')) return destinoDeReservas(notification, '/reservations');
  if (notification.type.startsWith('approval.')) return '/approvals';
  if (notification.type.startsWith('survey_')) return '/surveys';
  return null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export function NotificationBell({ enCabecera = false }: { enCabecera?: boolean } = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const countQuery = useQuery<{ unread: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const notificationsQuery = useQuery<NotificationRecord[]>({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get('/notifications'),
    enabled: Boolean(user && open),
    // El contador de arriba puede refrescarse siempre: es un número y no estorba a nadie. La
    // lista sí, porque se refresca con el panel abierto y reordenarla mueve bajo el cursor lo
    // que la persona estaba a punto de tocar.
    refetchInterval: open ? refetchWhenIdle(30_000) : false,
  });

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: refreshNotifications,
  });

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: refreshNotifications,
  });

  const borrarLeidas = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: refreshNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: refreshNotifications,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.read) await markRead.mutateAsync(notification.id);
    const route = notificationRoute(notification, user?.role === 'client');
    setOpen(false);
    if (route) navigate(route);
  };

  const notifications = notificationsQuery.data ?? [];
  const unread = countQuery.data?.unread ?? 0;
  const avisos = useAvisosDelNavegador(unread, () => api.get<NotificationRecord[]>('/notifications').then((lista) => (Array.isArray(lista) ? lista : []).filter((item) => !item.read)));

  return (
    <div className={`notification-center${enCabecera ? ' en-cabecera' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <section className="notification-popover" role="dialog" aria-label="Centro de notificaciones">
          <header>
            <div>
              <span>ACTIVIDAD</span>
              <h3>Notificaciones</h3>
            </div>
            {notifications.some((n) => n.read) && (
              <button type="button" onClick={() => borrarLeidas.mutate()} disabled={borrarLeidas.isPending}>
                {borrarLeidas.isPending ? 'Borrando...' : 'Borrar leidas'}
              </button>
            )}
            {unread > 0 && (
              <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                {markAllRead.isPending ? 'Marcando...' : 'Marcar todas leidas'}
              </button>
            )}
          </header>

          {/* Pedir el aviso del sistema es decisión de cada persona en cada navegador, nunca sola. */}
          {avisos.permiso !== 'no-disponible' && <div className="notification-permiso">
            {avisos.activo
              ? <><span>Te avisamos aunque la pestaña esté de fondo.</span><button type="button" onClick={avisos.desactivar}>Dejar de avisar</button></>
              : avisos.permiso === 'denied'
                ? <span>Este navegador bloqueó los avisos. Se activan desde el candado de la barra de direcciones.</span>
                : <><span>¿Avisarte cuando llegue algo, aunque estés en otra pestaña?</span><button type="button" onClick={() => { void avisos.activar(); }}>Activar avisos</button></>}
          </div>}

          <div className="notification-list">
            {notificationsQuery.isLoading && <p className="notification-state">Cargando actividad...</p>}
            {notificationsQuery.error && (
              <div className="notification-state notification-state-error">
                <p>No fue posible cargar las alertas.</p>
                <button type="button" onClick={() => notificationsQuery.refetch()}>Reintentar</button>
              </div>
            )}
            {!notificationsQuery.isLoading && !notificationsQuery.error && notifications.length === 0 && (
              <div className="notification-empty">
                <span aria-hidden="true">0</span>
                <strong>Todo al dia</strong>
                <p>No tienes alertas pendientes.</p>
              </div>
            )}
            {notifications.map((notification) => {
              const route = notificationRoute(notification, user?.role === 'client');
              return (
                <div className={`notification-row ${notification.read ? '' : 'unread'}`} key={notification.id}>
                  <button
                    type="button"
                    className="notification-item"
                    onClick={() => openNotification(notification)}
                    disabled={markRead.isPending}
                  >
                    <i aria-hidden="true" />
                    <span>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <small>{formatDate(notification.createdAt)}{route ? ' · Abrir' : ''}</small>
                    </span>
                  </button>
                  {/* Aparte del cuerpo y no dentro: un botón no puede contener otro botón. */}
                  <button
                    type="button"
                    className="notification-remove"
                    aria-label={`Borrar ${notification.title}`}
                    title="Borrar"
                    onClick={() => borrar.mutate(notification.id)}
                    disabled={borrar.isPending}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
