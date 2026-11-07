/**
 * @fileoverview Sobre qué empresa está trabajando una cuenta, de portal o del equipo.
 *
 * Una persona puede atender más de una empresa, y hasta ahora cada pantalla resolvía cuál era
 * por su cuenta leyendo la de su sesión. Con eso, elegir un local en el CRM dejaba las reservas
 * y los correos mostrando el otro: el equipo operaba una empresa creyendo estar en la otra, que
 * es la clase de error que no se nota hasta que está hecho.
 *
 * La elección vive en un solo lugar y todas las pantallas la leen de aquí.
 *
 * Vale para las dos clases de cuenta, con **una** diferencia declarada en `admiteTodas`: para el
 * equipo interno «ninguna empresa en concreto» significa «todas las que alcanzo» y es la vista por
 * omisión, porque comparar cuentas es su trabajo; en el portal no existe, y una cuenta con varios
 * locales tiene que elegir antes de que se le muestre cualquier pantalla.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '../core/api';
import { useAuth } from '../core/auth';
import { readStoredJson, storageKey, writeStoredJson } from '../core/browser-storage';
import { isModuleInPhaseScope } from '../core/phase-scope';

export interface EmpresaActiva {
  /**
   * Empresa sobre la que se trabaja.
   *
   * Vacío significa dos cosas distintas según quién pregunta, y la diferencia es el producto:
   * para una cuenta de portal es «todavía no eligió» y ninguna pantalla debe operar —`debeElegir`
   * lo dice—; para el equipo interno es **«todas las que alcanzo»**, que es una respuesta válida
   * y la de por omisión, porque comparar cuentas es parte de su trabajo.
   */
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
   * Si el vacío es una opción legítima que la pantalla debe ofrecer.
   *
   * Verdadero para el equipo interno, falso en el portal. Lo lee el selector para poner —o no—
   * la opción «Todas las empresas»: ofrecérsela a un restaurante sería ofrecerle los datos de
   * los demás.
   */
  admiteTodas: boolean;
  /**
   * Todavía no se sabe qué empresas alcanza.
   *
   * Lo usan las rejas de ruta para esperar en vez de decidir con la empresa de la sesión: quien
   * tiene dos locales y recarga estando en el segundo veía «Sin acceso» un instante si el primero
   * no tenía ese servicio.
   */
  cargando: boolean;
  /** Alcanza varias empresas y todavía no eligió ninguna: ninguna pantalla debe operar hasta que elija. */
  debeElegir: boolean;
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
export function empresaVigente({ guardada, suEmpresa, alcanzables, listaLista, admiteTodas = false }: {
  guardada: string;
  suEmpresa: string;
  alcanzables: string[];
  listaLista: boolean;
  /** Para el equipo interno: el vacío es «todas» y no un estado a resolver. */
  admiteTodas?: boolean;
}): string {
  // Sin lista todavía se prefiere lo guardado: es la última decisión explícita de esa persona, y
  // el servidor vuelve a comprobar la empresa en cada petición, así que esto elige qué se pide,
  // nunca qué se concede.
  if (!listaLista) return guardada || suEmpresa;
  if (alcanzables.includes(guardada)) return guardada;
  /*
   * Lo guardado ya no sirve. Para el equipo interno eso cae en «todas», que es una vista real y
   * no un hueco: incluye el caso de venir del CRM, cuya opción «Espartanos» se guarda en la misma
   * clave y no es el id de ninguna empresa.
   */
  if (admiteTodas) return '';
  // Con varias y ninguna elegida no se adivina: la pantalla pide elegir.
  return alcanzables.length > 1 ? '' : suEmpresa;
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

  /*
   * La cartera del equipo interno, que hasta ahora este hook no pedía.
   *
   * El servidor devuelve sólo las cuentas que la persona alcanza —pod, asignación directa o ser
   * su community manager—, así que la lista ya viene acotada y no hay que filtrarla acá.
   *
   * Se pide sólo si alcanza el módulo Clientes. Pedirla sin comprobarlo devolvía 403 a quien no
   * lo tiene —una diseñadora, por ejemplo— y dejaba un error en la consola del navegador nada
   * más entrar, por una lista que de todos modos no se iba a usar. Sin lista, `varias` es falso
   * y el selector no aparece: se comporta como antes de existir este modo.
   */
  const alcanzaCartera = isModuleInPhaseScope('clients', user?.moduleLifecycle, user?.role)
    && (user?.permissions ? (user.permissions.clients ?? 'none') !== 'none' : user?.features ? user.features.clients !== false : true);
  const { data: cartera } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    // La misma clave que el inicio y las demás pantallas internas: montadas juntas resuelven con
    // una sola llamada y no pueden mostrar carteras distintas.
    queryKey: ['clients-min'],
    queryFn: () => api.get('/clients'),
    enabled: !esPortal && alcanzaCartera,
    staleTime: 5 * 60 * 1000,
  });

  const empresas = (esPortal ? data?.data : cartera?.data) ?? [];
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
  const listaLista = esPortal ? Boolean(data) : !alcanzaCartera || Boolean(cartera);
  const clientId = empresaVigente({ guardada, suEmpresa, alcanzables, listaLista, admiteTodas: !esPortal });

  return {
    clientId,
    /*
     * Cómo se nombra lo que se está mirando.
     *
     * Sin empresa concreta el equipo interno está viendo su cartera entera, y eso tiene nombre:
     * decir «Tu empresa» ahí sería nombrar una que no se está mirando.
     */
    nombre: empresas.find((empresa) => empresa.id === clientId)?.name
      ?? (esPortal ? user?.clientName ?? 'Tu empresa' : 'Todas las empresas'),
    empresas,
    elegir: (destino: string) => {
      /*
       * El vacío se acepta del equipo interno, y de nadie más.
       *
       * Es su «todas las empresas». En el portal no existe: dejar elegirlo pondría la cuenta de
       * un restaurante en una vista sin empresa, que es justo lo que `debeElegir` impide.
       */
      if (destino === '' ? esPortal : !alcanzables.includes(destino)) return;
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
    // Sólo el portal obliga a elegir: para el equipo interno «todas» ya es una respuesta.
    debeElegir: esPortal && listaLista && empresas.length > 1 && !clientId,
    admiteTodas: !esPortal,
  };
}

/** Servicios que se venden por empresa. Sin la clave cuentan como encendidos, igual que en el servidor. */
const SERVICIOS_POR_EMPRESA = ['crm', 'reservations', 'surveys', 'marketing'] as const;

/** Módulos que se contratan por empresa y nacen apagados: sin la clave cuentan como apagados. */
const MODULOS_POR_EMPRESA = [
  'production', 'audiovisual', 'content', 'approvals', 'meetings', 'documents', 'briefs',
  'billing', 'contracts', 'intake', 'reports', 'commercialPipeline',
] as const;

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
  // Los módulos por empresa nacen apagados: aquí la ausencia de la clave significa «no contratado».
  const porModulo = Object.fromEntries(MODULOS_POR_EMPRESA.map((servicio) => [servicio, activa.capabilities?.[servicio] === true]));
  return { ...user, capabilities: { ...(user.capabilities ?? {}), ...propias, ...porModulo } };
}

/**
 * El nombre de la empresa para poner en una confirmación, o `undefined` si no hace falta.
 *
 * Solo aparece cuando la cuenta atiende varias: con una sola no hay otra sobre la que equivocarse.
 */
export function useEmpresaParaConfirmar(): string | undefined {
  const { varias, nombre, clientId } = useEmpresaActiva();
  // Sin empresa concreta no hay nada que confirmar: «vas a hacer esto en Todas las empresas» no
  // es una advertencia, es una frase sin sentido. Quien está en esa vista elige la empresa en el
  // formulario mismo.
  return varias && clientId ? nombre : undefined;
}
