import { useQuery } from '@tanstack/react-query';
import { normalizarValor, type CustomFieldDefinition, type CustomFieldEntity } from '@espartanos/shared';
import { api } from '../../core/api';

export type ValoresEnEdicion = Record<string, unknown>;

export function useDefinicionesDeCampos(entidad: CustomFieldEntity, clientId?: string) {
  return useQuery<CustomFieldDefinition[]>({
    queryKey: ['crm-fields', entidad, true, clientId ?? null],
    queryFn: () => api.get(`/crm/fields?entity=${entidad}&archivados=true${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`),
    staleTime: 60_000,
  });
}

export function hayValoresInvalidos(definiciones: CustomFieldDefinition[], valores: ValoresEnEdicion): boolean {
  return definiciones.some((def) => {
    if (def.archivedAt) return false;
    const valor = valores[def.key];
    if (valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)) return false;
    return !normalizarValor(def, valor).ok;
  });
}
