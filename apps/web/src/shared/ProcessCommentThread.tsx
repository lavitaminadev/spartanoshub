import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../core/api';
import { Timeline, type TimelineEntry } from './Timeline';
import { LoadingSpinner } from './LoadingSpinner';

/** Comentario tal como lo devuelve el servidor. */
interface ProcessComment {
  id: string;
  body: string;
  authorName?: string | null;
  authorRole?: string | null;
  visibility: 'internal' | 'client';
  editedAt?: string | null;
  anonymizedAt?: string | null;
  createdAt: string;
}

/** El servidor separa los dos flujos en vez de intercalarlos. */
interface Thread {
  proceso: ProcessComment[];
  revision: ProcessComment[];
}

export interface ProcessCommentThreadProps {
  /**
   * Ruta base del hilo, sin `/comments`.
   *
   * Por ejemplo `/production/pieces/<id>`. Cada área expone la suya bajo su propio módulo,
   * que es lo que hace que apagar Audiovisual esconda sus hilos sin tocar los de Arte.
   */
  basePath: string;
  /** Permite escribir. En falso el hilo queda de solo lectura. */
  canWrite?: boolean;
  /**
   * Ofrece publicar en el flujo visible para el cliente.
   *
   * Va apagado salvo que se pida: equivocarse en esa dirección publica hacia afuera una nota
   * que era para el equipo, y eso no se puede deshacer mostrándolo distinto después.
   */
  allowClientVisibility?: boolean;
}

/**
 * Hilo de trabajo de una pieza, una sesión, una solicitud o un registro comercial.
 *
 * El dominio existía desde hace tiempo en el servidor —con visibilidad hacia el cliente,
 * autor congelado y despersonalización por retención— pero ninguna pantalla lo consumía: la
 * pestaña de comentarios se había retirado cuando el backend aún no lo tenía y no se volvió a
 * conectar. Este componente es esa conexión, y sirve a todas las áreas porque el hilo es el
 * mismo en todas.
 */
export function ProcessCommentThread({
  basePath, canWrite = true, allowClientVisibility = false,
}: ProcessCommentThreadProps): JSX.Element {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'client'>('internal');
  const [error, setError] = useState<string | null>(null);

  const key = ['process-comments', basePath];

  const { data, isLoading } = useQuery<Thread>({
    queryKey: key,
    queryFn: () => api.get(`${basePath}/comments`),
  });

  const add = useMutation({
    mutationFn: () => api.post(`${basePath}/comments`, { body: body.trim(), visibility }),
    onSuccess: () => {
      setBody('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (mutationError: Error) => setError(mutationError.message || 'No se pudo publicar el comentario'),
  });

  if (isLoading) return <LoadingSpinner />;

  const toEntry = (comment: ProcessComment): TimelineEntry => ({
    id: comment.id,
    at: comment.createdAt,
    // Un comentario despersonalizado por retención conserva su lugar en el hilo pero ya no
    // tiene autor ni texto: se marca como del sistema para no atribuirle a nadie un vacío.
    origin: comment.anonymizedAt ? 'system' : 'user',
    title: comment.visibility === 'client' ? 'Nota compartida con el cliente' : 'Nota interna',
    detail: comment.body,
    author: comment.authorName
      ? `${comment.authorName}${comment.editedAt ? ' · editado' : ''}`
      : undefined,
    accent: comment.visibility === 'client' ? '#b90749' : undefined,
  });

  const proceso = (data?.proceso ?? []).map(toEntry);
  const revision = (data?.revision ?? []).map(toEntry);

  return (
    <div className="comment-thread">
      {canWrite ? (
        <form
          className="comment-form"
          onSubmit={(event) => { event.preventDefault(); if (body.trim()) add.mutate(); }}
        >
          <textarea
            className="input"
            rows={3}
            value={body}
            placeholder="Anota lo que se decidió, para que no viva solo en una conversación."
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="comment-form-actions">
            {allowClientVisibility ? (
              <label className="comment-visibility">
                <input
                  type="checkbox"
                  checked={visibility === 'client'}
                  onChange={(event) => setVisibility(event.target.checked ? 'client' : 'internal')}
                />
                Visible para el cliente
              </label>
            ) : null}
            <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending || !body.trim()}>
              {add.isPending ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
          {error ? <p className="comment-error">{error}</p> : null}
        </form>
      ) : null}

      {/* Las dos secciones van separadas y no en una lista por fecha: intercalar una nota
          interna entre dos mensajes del cliente hace que se lean como una conversación única
          y termina con alguien respondiéndole al cliente algo que era para el equipo. */}
      <section className="comment-section">
        <h4>Proceso interno</h4>
        <Timeline entries={proceso} emptyMessage="Sin anotaciones del equipo todavía." />
      </section>

      {revision.length > 0 || allowClientVisibility ? (
        <section className="comment-section">
          <h4>Revisión con el cliente</h4>
          <Timeline entries={revision} emptyMessage="Sin mensajes con el cliente." />
        </section>
      ) : null}
    </div>
  );
}
