import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { PIECE_TYPE_LABELS as TIPOS_DEL_MAESTRO } from './production-labels';

export interface PieceTypeOption {
  id?: string;
  key: string;
  label: string;
  area?: 'design' | 'audiovisual';
  udAmount?: number | null;
  isPrint?: boolean;
}

/**
 * Tipos de pieza vigentes de la organización.
 *
 * Los tipos dejaron de ser una lista fija en el código: se proponen y se aprueban desde la
 * aplicación, así que la pantalla tiene que preguntarlos en vez de traerlos compilados.
 *
 * El mapa `PIECE_TYPE_LABELS` sigue existiendo como red: si la consulta todavía no respondió o
 * falló, un tipo del Documento Maestro igual se muestra con su nombre en vez de `post_simple`.
 * Lo que no cubre —ni puede— son los tipos creados después de compilar, que es justamente el
 * motivo de consultar.
 *
 * @param area - Limita al catálogo de un área. Sin área devuelve todo lo activo.
 */
export function usePieceTypes(area?: 'design' | 'audiovisual') {
  const query = useQuery({
    queryKey: ['piece-types', area ?? 'all'],
    queryFn: () => api.get<PieceTypeOption[]>(`/production/piece-types${area ? `?area=${area}` : ''}`),
    // El catálogo cambia cuando alguien aprueba un tipo, que no es algo que pase mientras se
    // mira una pantalla: no hace falta refrescarlo a cada rato.
    staleTime: 5 * 60_000,
  });

  const options: PieceTypeOption[] = query.data?.length
    ? query.data
    : Object.entries(TIPOS_DEL_MAESTRO).map(([key, label]) => ({ key, label }));

  /**
   * Nombre visible de un tipo.
   *
   * Ante un tipo desconocido devuelve su clave en vez de vacío: ver `reel_editado` en pantalla es
   * feo pero permite entender qué pasó; una celda vacía parece que la pieza no tiene tipo.
   */
  const labelFor = (key?: string | null): string => {
    if (!key) return '';
    return options.find((option) => option.key === key)?.label ?? TIPOS_DEL_MAESTRO[key] ?? key;
  };

  return { options, labelFor, isLoading: query.isLoading, error: query.error };
}
