import { isForbiddenError } from '../core/api';
import { ForbiddenState } from './ForbiddenState';

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  /** Error de la query: si es un 403 se muestra `ForbiddenState` en lugar del error genérico. */
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}

export function QueryErrorState({ title = 'No pudimos cargar esta vista', message = 'La información sigue segura. Revisa la conexión e intenta nuevamente.', error, onRetry, retrying = false }: QueryErrorStateProps) {
  if (isForbiddenError(error)) return <ForbiddenState />;
  return <div className="query-error-state" role="alert"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{message}</p>{onRetry && <button className="btn btn-primary btn-sm" onClick={onRetry} disabled={retrying}>{retrying ? 'Reintentando...' : 'Volver a intentar'}</button>}</div></div>;
}
