import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';

export interface VersionRow {
  id: string; number: string; version: number; status: string; amount: number; currency: string;
  sentAt: string | null; acceptedAt: string | null; createdAt: string; actual: boolean;
}

const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });

/** Lo que pasó con una versión, en una frase: enviada, aceptada o aún en borrador. */
export function hitoDeVersion(version: Pick<VersionRow, 'status' | 'sentAt' | 'acceptedAt' | 'createdAt'>): string {
  if (version.acceptedAt) return `aceptada el ${fecha(version.acceptedAt)}`;
  if (version.sentAt) return `enviada el ${fecha(version.sentAt)}`;
  return `creada el ${fecha(version.createdAt)}, sin enviar`;
}

/** Las versiones de una cotización, de la primera a la última. */
export function VersionesDeCotizacion({ quoteId }: { quoteId: string }) {
  const { data = [], isLoading, error } = useQuery<VersionRow[]>({
    queryKey: ['catalog-quote-versions', quoteId],
    queryFn: () => api.get(`/catalog/quotes/${quoteId}/versiones`),
  });
  if (isLoading) return <p>Cargando versiones…</p>;
  if (error) return <div className="alert alert-error">No fue posible cargar las versiones.</div>;
  return <ol className="quote-versions">
    {data.map((v) => <li key={v.id} aria-current={v.actual ? 'true' : undefined}>
      <strong>v{v.version}</strong> {hitoDeVersion(v)} <StatusBadge status={v.status} /> <small>{v.number}</small>
    </li>)}
  </ol>;
}
