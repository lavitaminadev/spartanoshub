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
  /**
   * Todavía no se sabe qué empresas alcanza.
   *
   * Lo usan las rejas de ruta para esperar en vez de decidir con la empresa de la sesión: quien
   * tiene dos locales y recarga estando en el segundo veía «Sin acceso» un instante si el primero
   * no tenía ese servicio.
   */
  cargando: boolean;
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

/**
 * Qué empresa vale, con o sin la lista resuelta.
 *
 * Aparte para poder probarla: es la regla que decide sobre qué empresa opera cada pantalla, y
 * equivocarse un instante basta para pedir —o escribir— en el local que no era.
 *
 * @param guardada - Lo elegido la vez anterior, leído del navegador.
 * @param suEmpresa - La empresa escrita en su cuenta, que no se le quita.
 * @param alcanzables - Las que el servidor le concede. Vacío mientras la lista viaja.
 * @param listaLista - Si `alcanzables` ya es la respuesta del servidor y no un vacío provisorio.
 */
export function empresaVigente({ guardada, suEmpresa, alcanzables, listaLista }: {
  guardada: string;
  suEmpresa: string;
  alcanzables: string[];
  listaLista: boolean;
}): string {
  // Sin lista todavía se prefiere lo guardado: es la última decisión explícita de esa persona, y
  // el servidor vuelve a comprobar la empresa en cada petición, así que esto elige qué se pide,
  // nunca qué se concede.
  if (!listaLista) return guardada || suEmpresa;
  return alcanzables.includes(guardada) ? guardada : suEmpresa;
}

export function useEmpresaActiva(): EmpresaActiva {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Obliga a releer lo guardado cuando otra pantalla cambia la empresa.
  useSyncExternalStore(suscribir, () => version, () => version);
  const esPortal = user?.role === 'client';

  /*
   * La lista sale del portal y no de `/clients`.
   *
   * `/clients` pertenece al módulo Clientes, que es de la agencia: una cuenta de portal lo pide y
   * recibe un 403. La lista llegaba vacía, esto lo leía como «tiene una sola empresa» y caía a la
   * de su sesión, así que quien atendía dos locales nunca veía el segundo ni el selector.
   *
   * El cliente HTTP traduce `/clients` a esta misma ruta para las cuentas de portal, así que el
   * resto de las pantallas no tuvo que cambiar; acá se pide directa porque es su propia lista.
   */
  const { data } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['portal-empresas'],
    queryFn: () => api.get('/portal/empresas'),
    enabled: esPortal,
    staleTime: 5 * 60 * 1000,
  });

  const empresas = data?.data ?? [];
  const suEmpresa = user?.clientId ?? '';
  // La misma clave que usa la barra del CRM: elegir allí y ver lo mismo acá es el punto.
  const clave = storageKey('crm-cuenta', user?.id ?? 'anon');
  const guardada = readStoredJson<string>(clave, '');
  const alcanzables = empresas.map((empresa) => empresa.id);

  /*
   * Mientras la lista viaja, vale lo elegido la vez anterior.
   *
   * Antes se caía a la empresa de la sesión hasta que la lista llegaba, y recién entonces
   * cambiaba a la guardada. Con red real ese hueco dura lo que tarde la respuesta, y en él cada
   * pantalla ya pidió sus datos con la empresa equivocada: quien dejó abierto el segundo local lo
   * veía abrir en el primero y saltar solo. Se prefiere lo guardado, que es la última decisión
   * explícita de esa persona; si al llegar la lista resulta que ya no la alcanza, se descarta.
   *
   * No relaja ninguna reja: el servidor comprueba la empresa en cada petición y responde 404 si
   * no le corresponde. Esto decide qué se pide, nunca qué se concede.
   */
  const listaLista = !esPortal || Boolean(data);
  const clientId = esPortal ? empresaVigente({ guardada, suEmpresa, alcanzables, listaLista }) : '';

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
       * Los permisos se vuelven a pedir: se conceden empresa por empresa.
       *
       * Quien administra el equipo en un local y no en el otro tiene distinto menú en cada uno, y
       * los permisos viven en la sesión y no en la caché de consultas, así que invalidarla no los
       * alcanza. Sin esto, cambiar de empresa dejaba el menú de la anterior hasta recargar.
       */
      void useAuth.getState().refreshProfile();
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
    cargando: !listaLista,
  };
}

/** Servicios que se venden por empresa. Sin la clave cuentan como encendidos, igual que en el servidor. */
const SERVICIOS_POR_EMPRESA = ['crm', 'reservations', 'surveys'] as const;

/**
 * La persona con los servicios de la empresa que está mirando, no los de la suya.
 *
 * La sesión trae los servicios de la empresa de la cuenta. Quien atiende dos locales —uno con
 * CRM y otro sin— veía el CRM en el menú también al pasar al segundo, y al abrirlo el servidor
 * lo rechazaba. El menú, el inicio y las rutas del portal leen de aquí para mostrar solo lo que
 * esa empresa tiene activo. Fuera del portal devuelve la sesión tal cual.
 */
export function useUsuarioEnEmpresaActiva() {
  const { user } = useAuth();
  const { clientId } = useEmpresaActiva();
  const { data } = useQuery<{ data: Array<{ id: string; name: string; capabilities?: Partial<Record<string, boolean>> | null }> }>({
    queryKey: ['portal-empresas'],
    queryFn: () => api.get('/portal/empresas'),
    enabled: user?.role === 'client',
    staleTime: 5 * 60 * 1000,
  });
  const activa = data?.data?.find((empresa) => empresa.id === clientId);
  if (!user || user.role !== 'client' || !activa) return user;
  const propias = Object.fromEntries(SERVICIOS_POR_EMPRESA.map((servicio) => [servicio, activa.capabilities?.[servicio] !== false]));
  return { ...user, capabilities: { ...(user.capabilities ?? {}), ...propias } };
}
