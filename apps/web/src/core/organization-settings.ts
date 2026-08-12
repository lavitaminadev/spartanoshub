/**
 * @fileoverview Ajustes de la organización, indexados por clave.
 *
 * `GET /settings` devuelve un arreglo con el catálogo completo y su valor efectivo. Las
 * pantallas que consultan un ajuste puntual lo quieren por clave, así que la conversión vive
 * acá y no repetida en cada una.
 *
 * Antes cada pantalla pedía `/settings?prefix=...` y tipaba la respuesta como un mapa. El
 * endpoint no declara ese parámetro —lo ignora y devuelve todo—, de modo que el mapa nunca
 * tenía las claves buscadas y cada valor caía en su respaldo por omisión: la política de
 * contraseñas se mostraba con los números de fábrica aunque la organización tuviera otros.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

interface OrganizationSettingRow {
  key: string;
  value: string | number | boolean | null;
}

/** Ajustes efectivos de la organización, como `{ 'security.password.minLength': '10' }`. */
export function useOrganizationSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['organization-settings-map'],
    queryFn: async () => {
      const rows = await api.get<OrganizationSettingRow[] | { data?: OrganizationSettingRow[] }>('/settings');
      const list = Array.isArray(rows) ? rows : rows?.data ?? [];
      return Object.fromEntries(
        list
          .filter((row) => row?.key !== undefined && row?.value !== null && row?.value !== undefined)
          .map((row) => [row.key, String(row.value)]),
      );
    },
  });
}
