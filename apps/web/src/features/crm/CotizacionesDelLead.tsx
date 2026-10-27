import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { lineaDeCotizaciones } from './cotizaciones-del-lead';

/**
 * Una línea con el historial de cotizaciones de un prospecto del embudo comercial.
 *
 * No pinta nada mientras carga, si no hay cotizaciones o si la persona no tiene el área de
 * cotizaciones: la ficha no debe mostrar un error por un dato accesorio.
 */
export function CotizacionesDelLead({ leadId }: { leadId: string }) {
  const { data } = useQuery<{ veces: number; ultimaEn: string | null }>({
    queryKey: ['catalog-quotes-lead', leadId],
    queryFn: () => api.get(`/catalog/quotes/lead/${leadId}/resumen`),
    retry: false,
  });
  const linea = data ? lineaDeCotizaciones(data.veces, data.ultimaEn) : null;
  return linea ? <p className="lead-cotizaciones">{linea}</p> : null;
}
