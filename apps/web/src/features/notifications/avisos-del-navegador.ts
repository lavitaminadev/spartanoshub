/**
 * @fileoverview Que una notificación se note aunque nadie esté mirando la campana.
 *
 * El servidor ya creaba avisos —reserva nueva, cancelada, solicitud de grupo, encuesta baja—,
 * pero lo único que cambiaba era un número en una campana al pie del menú, que además se ve poco
 * con el menú plegado. Quien atendía con la pestaña de fondo no se enteraba de nada.
 *
 * Tres señales, de menos a más invasiva: el contador en el título de la pestaña, siempre; y un
 * aviso del sistema operativo, sólo si la persona lo pidió en este navegador y sólo cuando la
 * pestaña no está a la vista —con la pestaña delante, la campana ya alcanza—.
 */

import { useEffect, useRef, useState } from 'react';

const PREFERENCIA = 'espartanos.avisos-del-navegador';
const TITULO_BASE = typeof document !== 'undefined' ? document.title.replace(/^\(\d+\+?\)\s*/, '') : '';

export interface AvisoNuevo { id: string; title: string; message: string }

/** Si este navegador puede mostrar avisos y en qué estado quedó el permiso. */
export function estadoDelPermiso(): 'no-disponible' | NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'no-disponible';
  return Notification.permission;
}

function preferido(): boolean {
  try { return window.localStorage.getItem(PREFERENCIA) === 'si'; } catch { return false; }
}

/**
 * @param sinLeer Contador de la campana.
 * @param traerRecientes Cómo pedir los avisos al servidor cuando el contador sube.
 */
export function useAvisosDelNavegador(sinLeer: number, traerRecientes: () => Promise<AvisoNuevo[]>) {
  const [permiso, setPermiso] = useState(estadoDelPermiso);
  const [activo, setActivo] = useState(preferido);
  const anterior = useRef<number | null>(null);
  const mostrados = useRef(new Set<string>());

  // El contador en la pestaña: se ve desde la barra del navegador y desde otra aplicación.
  useEffect(() => {
    document.title = sinLeer > 0 ? `(${sinLeer > 99 ? '99+' : sinLeer}) ${TITULO_BASE}` : TITULO_BASE;
  }, [sinLeer]);
  useEffect(() => () => { document.title = TITULO_BASE; }, []);

  useEffect(() => {
    const previo = anterior.current;
    anterior.current = sinLeer;
    // La primera lectura sólo fija el punto de partida: lo que ya estaba sin leer no es nuevo.
    if (previo === null || sinLeer <= previo) return;
    if (!activo || permiso !== 'granted' || document.visibilityState === 'visible') return;
    void traerRecientes().then((avisos) => {
      for (const aviso of avisos.slice(0, sinLeer - previo)) {
        if (mostrados.current.has(aviso.id)) continue;
        mostrados.current.add(aviso.id);
        const notificacion = new Notification(aviso.title, { body: aviso.message, tag: aviso.id, icon: '/icon-192x192.png' });
        notificacion.onclick = () => { window.focus(); notificacion.close(); };
      }
    }).catch(() => undefined);
  }, [sinLeer, activo, permiso, traerRecientes]);

  const activar = async () => {
    if (estadoDelPermiso() === 'no-disponible') return;
    const resultado = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPermiso(resultado);
    const si = resultado === 'granted';
    setActivo(si);
    try { window.localStorage.setItem(PREFERENCIA, si ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  };

  const desactivar = () => {
    setActivo(false);
    try { window.localStorage.setItem(PREFERENCIA, 'no'); } catch { /* sin almacenamiento */ }
  };

  return { permiso, activo: activo && permiso === 'granted', activar, desactivar };
}
