import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

export interface PipelineStage {
  key: string;
  label: string;
}

/**
 * Respaldo mientras la consulta viaja, y si el servidor no responde.
 *
 * Coincide con la plantilla base del backend. No es una segunda fuente de verdad: es lo que se
 * muestra durante el primer render para que el tablero no aparezca sin columnas, y lo que
 * queda si la petición falla —una pantalla de pipeline sin etapas no sirve para nada, y un
 * respaldo desactualizado es preferible a un vacío—.
 */
const FALLBACK_STAGES: PipelineStage[] = [
  { key: 'new', label: 'Nuevo' },
  { key: 'qualified', label: 'Calificado' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'negotiation', label: 'Negociación' },
  { key: 'won', label: 'Ganado' },
  { key: 'lost', label: 'Perdido' },
];

/**
 * Etapas del pipeline comercial, en el orden en que se recorren.
 *
 * Estaban escritas a mano en cada pantalla, así que cambiar una exigía desplegar y nada
 * garantizaba que el tablero, la tabla y los informes hablaran de las mismas. Ahora salen de
 * la plantilla de proceso, que se edita desde Gobierno.
 *
 * Se cachean por largo rato: las etapas de un pipeline cambian dos veces al año, no dos veces
 * al día, y volver a pedirlas en cada pantalla sería una consulta por nada.
 */
export function usePipelineStages(): { stages: PipelineStage[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<PipelineStage[]>({
    queryKey: ['crm-pipeline-stages'],
    queryFn: () => api.get('/crm/opportunities/stages'),
    staleTime: 30 * 60_000,
  });

  return { stages: data?.length ? data : FALLBACK_STAGES, isLoading };
}

/** Etapas que cierran el trato. El resto del sistema las trata distinto. */
export const CLOSING_STAGES = ['won', 'lost'] as const;

export function isClosingStage(stage: string): boolean {
  return (CLOSING_STAGES as readonly string[]).includes(stage);
}
