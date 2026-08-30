/**
 * @fileoverview Cómo llama cada empresa a las etapas de su embudo.
 *
 * El estado guardado en el lead no cambia —`contacted` sigue siendo `contacted` para las reglas,
 * los informes y la integración—; cambia la palabra que se muestra. Una inmobiliaria dice «Visita
 * agendada» donde una agencia dice «Propuesta enviada», y obligarlas al mismo vocabulario hace
 * que el tablero se lea como de otro negocio.
 *
 * Los rótulos de fábrica viven en `stage-labels.ts` y en `status-palette.ts`. Acá solo se
 * superponen los que esa empresa haya renombrado: así, agregar una etapa nueva no obliga a
 * repetir su nombre en la base de todas las empresas.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

export type RotulosDeEtapa = Record<string, string>;

/**
 * Rótulos propios de una empresa.
 *
 * @param clientId - Empresa cuyo CRM se mira. Vacío para el embudo de la agencia.
 * @returns Solo lo renombrado. Mientras carga devuelve un mapa vacío, así que la pantalla
 *   muestra los nombres de fábrica y no un hueco.
 */
export function useStageLabels(clientId: string): RotulosDeEtapa {
  const { data } = useQuery<{ labels: RotulosDeEtapa }>({
    queryKey: ['crm-stage-labels', clientId],
    queryFn: () => api.get(`/crm/stage-labels${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    // Se consultan en cada pantalla del CRM y cambian muy de vez en cuando: sin esto, pasar del
    // tablero a la lista volvía a pedirlos y las etapas parpadeaban del nombre propio al de fábrica.
    staleTime: 5 * 60_000,
  });
  return data?.labels ?? {};
}

/**
 * Etapas que esta empresa decidió no usar.
 *
 * No se borran de nada: el lead que estuviera en una seguiría teniéndola guardada. Lo que
 * cambia es si la columna se dibuja y si el estado se ofrece al mover una tarjeta.
 *
 * Mientras carga devuelve la lista vacía, o sea **se muestran todas**. Es lo correcto: esconder
 * columnas mientras llega la respuesta haría que el tablero cambiara de forma al cargar, y un
 * lead que estuviera en una etapa oculta desaparecería un instante antes de reaparecer.
 *
 * @param clientId - Empresa cuyo CRM se mira. Vacío para el embudo de la agencia.
 */
export function useEtapasOcultas(clientId: string): string[] {
  const { data } = useQuery<{ hidden: string[] }>({
    queryKey: ['crm-stage-hidden', clientId],
    queryFn: () => api.get(
      `/crm/stage-labels/hidden${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`,
    ),
    // Mismo motivo que los rótulos: se piden en cada pantalla del CRM y cambian muy de vez en
    // cuando, así que sin esto el tablero cambiaría de forma al ir y volver de la lista.
    staleTime: 5 * 60_000,
  });
  return data?.hidden ?? [];
}
