/**
 * @fileoverview Cómo llama cada empresa a las cosas del CRM.
 *
 * Una inmobiliaria trabaja por **proyectos**, una agencia por **clientes**, una cadena por
 * **sucursales**. Es la misma columna con tres nombres, y obligar a las tres al mismo hace que la
 * pantalla se lea como de otro negocio: quien entra tiene que traducir en la cabeza cada rótulo
 * antes de entender lo que ve.
 *
 * Es la misma idea que los rótulos de etapa y guarda igual —por empresa, sin tocar nada de lo
 * guardado—, pero son dos preguntas distintas: cómo se llama un paso del embudo y cómo se llama
 * la unidad de negocio. Quien renombra una no está renombrando la otra, así que viven separadas.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

/** Términos que se pueden renombrar, con el nombre de fábrica de cada uno. */
export const VOCABULARIO_BASE = {
  empresa: 'Empresa',
  empresas: 'Empresas',
  lead: 'Contacto',
  leads: 'Contactos',
  prospecto: 'Prospecto',
  prospectos: 'Prospectos',
  responsable: 'Responsable',
  campana: 'Campaña',
} as const;

export type ClaveDeVocabulario = keyof typeof VOCABULARIO_BASE;
export type Vocabulario = Partial<Record<ClaveDeVocabulario, string>>;

/**
 * Los términos de una empresa, ya mezclados con los de fábrica.
 *
 * @param clientId - Empresa cuyo CRM se mira. Vacío para el de la agencia.
 * @returns Una función que traduce un término. Devuelve el de fábrica mientras carga y para lo
 *   que esa empresa no haya renombrado, así que la pantalla nunca muestra un hueco.
 */
export function useVocabulario(clientId: string): {
  termino: (clave: ClaveDeVocabulario) => string;
  propios: Vocabulario;
} {
  const { data } = useQuery<{ labels: Vocabulario }>({
    queryKey: ['crm-vocabulario', clientId],
    queryFn: () => api.get(
      `/crm/stage-labels/vocabulary${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`,
    ),
    // Se consulta desde varias pantallas del CRM y cambia dos veces al año: sin esto, pasar del
    // tablero a la lista lo volvía a pedir y los rótulos parpadeaban al nombre de fábrica.
    staleTime: 5 * 60_000,
  });

  const propios = data?.labels ?? {};
  return {
    termino: (clave) => propios[clave]?.trim() || VOCABULARIO_BASE[clave],
    propios,
  };
}
