import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ConfirmDialog } from '../../shared/ConfirmDialog';

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/**
 * Traduce el agente del navegador a algo que una persona reconozca.
 *
 * Se queda corto a propósito: sirve para distinguir «el computador» de «el teléfono», que es la
 * pregunta real. Una detección exhaustiva daría una falsa sensación de precisión sobre un dato
 * que el cliente puede escribir como quiera.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido';
  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Navegador';
  const system = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'sistema desconocido';
  return `${browser} en ${system}`;
}

function formatMoment(value: string | null): string {
  if (!value) return 'sin actividad registrada';
  return new Date(value).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Dónde está abierta tu cuenta, y cómo cerrarla en otro lado.
 *
 * Es una pantalla personal: solo muestra las sesiones propias y no admite mirar las de nadie
 * más. Cerrar una surte efecto de inmediato, también sobre el token que ese dispositivo ya
 * tenía en la mano.
 */
export function SessionsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [closeAllOpen, setCloseAllOpen] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<Session[]>({
    queryKey: ['my-sessions'],
    queryFn: () => api.get('/auth/sessions'),
  });

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    setFeedback(message);
  };

  const closeOne = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => void refresh('Sesión cerrada.'),
    onError: (err: Error) => setFeedback(`Error: ${err.message}`),
  });

  const closeOthers = useMutation({
    mutationFn: () => api.delete<{ closed: number }>('/auth/sessions'),
    onSuccess: (result) => {
      setCloseAllOpen(false);
      void refresh(result.closed === 0
        ? 'No había otras sesiones abiertas.'
        : `Se cerraron ${result.closed} sesión(es). Esta sigue abierta.`);
    },
    onError: (err: Error) => { setCloseAllOpen(false); setFeedback(`Error: ${err.message}`); },
  });

  if (isLoading) return <LoadingSpinner text="Cargando tus sesiones..." />;
  if (error) return <QueryErrorState title="No pudimos cargar tus sesiones" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  const sessions = data ?? [];
  const others = sessions.filter((session) => !session.current).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Mis sesiones</h1>
          <p className="page-subtitle">Dónde está abierta tu cuenta ahora mismo.</p>
        </div>
        {others > 0 && (
          <button className="btn btn-outline" onClick={() => setCloseAllOpen(true)}>
            Cerrar las otras {others}
          </button>
        )}
      </div>

      {feedback && (
        <div className={`alert ${feedback.startsWith('Error:') ? 'alert-error' : 'alert-success'}`} role="alert">{feedback}</div>
      )}

      <div className="session-list">
        {sessions.map((session) => (
          <article className={`session-card ${session.current ? 'is-current' : ''}`} key={session.id}>
            <div>
              <strong>{describeDevice(session.userAgent)}</strong>
              {session.current && <span className="session-badge">Esta sesión</span>}
              <dl>
                <div><dt>Última actividad</dt><dd>{formatMoment(session.lastSeenAt)}</dd></div>
                <div><dt>Iniciada</dt><dd>{formatMoment(session.createdAt)}</dd></div>
                <div><dt>Dirección</dt><dd>{session.ipAddress ?? 'no registrada'}</dd></div>
              </dl>
            </div>
            {!session.current && (
              <button
                className="btn btn-sm btn-outline"
                disabled={closeOne.isPending}
                onClick={() => closeOne.mutate(session.id)}
              >
                Cerrar
              </button>
            )}
          </article>
        ))}
      </div>

      <p className="session-note">
        Si no reconoces una sesión, ciérrala y cambia tu contraseña. Cambiar la contraseña cierra
        todas las sesiones, incluida esta.
      </p>

      <ConfirmDialog
        open={closeAllOpen}
        title="Cerrar las otras sesiones"
        description="Los demás dispositivos tendrán que iniciar sesión de nuevo. Esta sesión sigue abierta."
        confirmLabel="Cerrar las otras"
        pending={closeOthers.isPending}
        onConfirm={() => closeOthers.mutate()}
        onClose={() => setCloseAllOpen(false)}
      />
    </div>
  );
}
