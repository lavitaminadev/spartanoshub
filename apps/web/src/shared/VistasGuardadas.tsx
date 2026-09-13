/**
 * @fileoverview La barra de vistas guardadas, compartida por las listas que la usan.
 *
 * Las vistas viven en el servidor: se pueden compartir con el equipo y siguen ahí al cambiar de
 * computador. Las que alguien ya tenía guardadas en su navegador se suben solas la primera vez,
 * como privadas, así que nadie pierde las suyas con el cambio.
 *
 * Si el servidor no responde, la barra sigue funcionando con el navegador, como antes: guardar un
 * filtro no puede depender de que la red esté bien.
 *
 * El componente no sabe nada de reservas ni de prospectos: recibe los filtros actuales y devuelve
 * los que hay que aplicar.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../core/api';
import { borrarVista, guardarVista, leerVistas } from './vistas-guardadas';
import './vistas-guardadas.css';

interface VistaDelServidor {
  id: string;
  name: string;
  filters: Record<string, string>;
  shared: boolean;
  propia: boolean;
}

const MARCA_SUBIDAS = 'vh.vistas.subidas';

export function VistasGuardadas<T extends Record<string, unknown>>({ ambito, filtrosActuales, hayFiltros, onAplicar }: {
  /** Identifica la lista. Cada una guarda las suyas. */
  ambito: string;
  filtrosActuales: T;
  /** Sin filtros puestos no hay nada que guardar, y el botón lo dice en vez de guardar vacío. */
  hayFiltros: boolean;
  onAplicar: (filtros: T) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const clave = ['saved-views', ambito];
  const [nombrando, setNombrando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [compartir, setCompartir] = useState(false);
  const subiendo = useRef(false);

  const servidor = useQuery<VistaDelServidor[]>({
    queryKey: clave,
    queryFn: () => api.get(`/saved-views?scope=${encodeURIComponent(ambito)}`),
    retry: false,
  });
  // Sin servidor, la barra sigue con lo guardado en el navegador.
  const sinServidor = servidor.isError;
  const [locales, setLocales] = useState(() => leerVistas<T>(ambito));

  /*
   * Subir una vez las vistas que ya estaban en el navegador.
   *
   * Se marca por lista después de subirlas todas: si la red corta a mitad, la próxima apertura
   * vuelve a intentarlo, y como guardar con el mismo nombre reemplaza, repetir no las duplica.
   */
  useEffect(() => {
    if (!servidor.isSuccess || subiendo.current) return;
    let subidas: string[] = [];
    try { subidas = JSON.parse(window.localStorage.getItem(MARCA_SUBIDAS) || '[]'); } catch { subidas = []; }
    if (subidas.includes(ambito)) return;
    const pendientes = leerVistas<T>(ambito);
    if (pendientes.length === 0) {
      try { window.localStorage.setItem(MARCA_SUBIDAS, JSON.stringify([...subidas, ambito])); } catch { /* bloqueado */ }
      return;
    }
    subiendo.current = true;
    void Promise.all(pendientes.map((vista) => api.post('/saved-views', { scope: ambito, name: vista.nombre, filters: vista.filtros, shared: false })))
      .then(() => {
        try { window.localStorage.setItem(MARCA_SUBIDAS, JSON.stringify([...subidas, ambito])); } catch { /* bloqueado */ }
        void queryClient.invalidateQueries({ queryKey: clave });
      })
      .finally(() => { subiendo.current = false; });
    // `clave` se deriva de `ambito`; incluirla repetiría el efecto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servidor.isSuccess, ambito, queryClient]);

  const guardar = useMutation({
    mutationFn: () => api.post<VistaDelServidor>('/saved-views', { scope: ambito, name: nombre.trim(), filters: filtrosActuales, shared: compartir }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: clave }); cerrarNombre(); },
  });
  const quitar = useMutation({
    mutationFn: (id: string) => api.delete(`/saved-views/${encodeURIComponent(id)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: clave }),
  });
  const alternarCompartida = useMutation({
    mutationFn: (vista: VistaDelServidor) => api.patch(`/saved-views/${encodeURIComponent(vista.id)}`, { shared: !vista.shared }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: clave }),
  });

  const cerrarNombre = () => { setNombrando(false); setNombre(''); setCompartir(false); };

  const enviarNombre = () => {
    if (!nombre.trim()) return;
    if (sinServidor) {
      setLocales(guardarVista(ambito, nombre, filtrosActuales));
      cerrarNombre();
      return;
    }
    guardar.mutate();
  };

  const vistas = sinServidor
    ? locales.map((vista) => ({ id: vista.nombre, name: vista.nombre, filters: vista.filtros as Record<string, string>, shared: false, propia: true }))
    : servidor.data ?? [];

  return (
    <div className="vistas-guardadas">
      {vistas.map((vista) => (
        <span className={`vista-chip ${vista.shared ? 'es-compartida' : ''}`} key={vista.id}>
          <button type="button" onClick={() => onAplicar(vista.filters as unknown as T)} title={vista.shared && !vista.propia ? 'Compartida por el equipo' : undefined}>
            {vista.shared ? <span className="vista-chip-equipo" aria-label="Compartida con el equipo">●</span> : null}
            {vista.name}
          </button>
          {vista.propia && !sinServidor ? (
            <button
              type="button"
              className="vista-chip-accion"
              aria-label={vista.shared ? `Dejar de compartir ${vista.name}` : `Compartir ${vista.name} con el equipo`}
              title={vista.shared ? 'Dejar de compartir' : 'Compartir con el equipo'}
              disabled={alternarCompartida.isPending}
              onClick={() => alternarCompartida.mutate(vista as VistaDelServidor)}
            >
              {vista.shared ? '⇄' : '↗'}
            </button>
          ) : null}
          {vista.propia ? (
            <button
              type="button"
              className="vista-chip-quitar"
              aria-label={`Quitar la vista ${vista.name}`}
              onClick={() => (sinServidor ? setLocales(borrarVista(ambito, vista.name)) : quitar.mutate(vista.id))}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {nombrando ? (
        <form className="vista-nombrar" onSubmit={(event) => { event.preventDefault(); enviarNombre(); }}>
          <input
            className="input"
            autoFocus
            maxLength={60}
            value={nombre}
            aria-label="Nombre de la vista"
            placeholder="Ej. Hoy sin confirmar"
            onChange={(event) => setNombre(event.target.value)}
          />
          {!sinServidor ? (
            <label className="vista-compartir">
              <input type="checkbox" checked={compartir} onChange={(event) => setCompartir(event.target.checked)} />
              Compartir con el equipo
            </label>
          ) : null}
          <button className="btn btn-primary btn-xs" disabled={!nombre.trim() || guardar.isPending}>Guardar</button>
          <button type="button" className="btn btn-outline btn-xs" onClick={cerrarNombre}>Cancelar</button>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-xs"
          disabled={!hayFiltros}
          title={hayFiltros ? 'Guardar estos filtros con un nombre' : 'Pon algún filtro para poder guardarlo'}
          onClick={() => setNombrando(true)}
        >
          + Guardar esta vista
        </button>
      )}
      {guardar.error ? <small className="error-text" role="alert">{(guardar.error as Error).message}</small> : null}
    </div>
  );
}
