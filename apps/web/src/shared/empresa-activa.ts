/**
 * @fileoverview Sobre qué empresa está trabajando una cuenta de portal.
 *
 * Una persona puede atender más de una empresa, y hasta ahora cada pantalla resolvía cuál era
 * por su cuenta leyendo la de su sesión. Con eso, elegir un local en el CRM dejaba las reservas
 * y los correos mostrando el otro: el equipo operaba una empresa creyendo estar en la otra, que
 * es la clase de error que no se nota hasta que está hecho.
 *
 * La elección vive en un solo lugar y todas las pantallas la leen de aquí.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '../core/api';
import { useAuth } from '../core/auth';
import { readStoredJson, storageKey, writeStoredJson } from '../core/browser-storage';

export interface EmpresaActiva {
  /** Empresa sobre la que se trabaja. Vacío si la cuenta no es de portal. */
  clientId: string;
  /** Su nombre, para mostrarlo sin repetir el mapa en cada pantalla. */
  nombre: string;
  /** Todas las que esta persona alcanza, ya resueltas por el servidor. */
  empresas: Array<{ id: string; name: string }>;
  /** Cambia la empresa activa. Ignora una que no esté entre las alcanzables. */
  elegir: (clientId: string) => void;
  /** Si hay más de una: con una sola no hay nada que elegir ni que advertir. */
  varias: boolean;
}

/**
 * La empresa activa y cómo cambiarla.
 *
 * Lo elegido se guarda por persona en el navegador, pero **no se confía en ello**: se acepta
 * solo si está entre las que el servidor devolvió. Una empresa escrita a mano en el navegador
 * no aparece en esa lista y se descarta, y cada petición vuelve a comprobarlo del lado del
 * servidor. Lo que protege no es ignorar la elección, es validarla.
 */
/*
 * Quién está escuchando el cambio de empresa.
 *
 * Cambiarla recargaba la página entera para que ninguna pantalla se quedara con datos del local
 * anterior. Funcionaba, pero parpadea y pierde lo que se estuviera escribiendo. Con un aviso a
 * los componentes montados y el descarte de lo consultado, el resultado es el mismo sin recarga.
 */
const oyentes = new Set<() => void>();
let version = 0;

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

export function useEmpresaActiva(): EmpresaActiva {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Obliga a releer lo guardado cuando otra pantalla cambia la empresa.
  useSyncExternalStore(suscribir, () => version, () => version);
  const esPortal = user?.role === 'client';

  const { data } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: esPortal,
    staleTime: 5 * 60 * 1000,
  });

  const empresas = data?.data ?? [];
  const suEmpresa = user?.clientId ?? '';
  // La misma clave que usa la barra del CRM: elegir allí y ver lo mismo acá es el punto.
  const clave = storageKey('crm-cuenta', user?.id ?? 'anon');
  const guardada = readStoredJson<string>(clave, '');
  const alcanzables = empresas.map((empresa) => empresa.id);

  const clientId = esPortal
    ? (alcanzables.includes(guardada) ? guardada : suEmpresa)
    : '';

  return {
    clientId,
    nombre: empresas.find((empresa) => empresa.id === clientId)?.name ?? user?.clientName ?? 'Tu empresa',
    empresas,
    elegir: (destino: string) => {
      if (!esPortal || !alcanzables.includes(destino)) return;
      writeStoredJson(clave, destino);
      version += 1;
      oyentes.forEach((avisar) => avisar());
      /*
       * Todo lo consultado queda obsoleto al cambiar de empresa.
       *
       * Se invalida en bloque y no consulta por consulta: cada pantalla arma su clave a su
       * manera, y olvidar una dejaría una lista del local anterior bajo el nombre del nuevo,
       * que es peor que recargar.
       */
      void qc.invalidateQueries();
    },
    varias: empresas.length > 1,
  };
}
