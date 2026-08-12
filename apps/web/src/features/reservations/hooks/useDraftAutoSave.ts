/**
 * @fileoverview Guardado automático de borradores en `localStorage`, genérico para cualquier
 * asistente de varios pasos que deba sobrevivir a un cierre accidental de pestaña.
 *
 * Cada `intervalMs` (30s por defecto) revisa si `data` cambió desde el último guardado y, si
 * cambió, lo persiste. El intervalo se crea una sola vez por `key`/`enabled` -no se reinicia en
 * cada tecla- y lee el valor más reciente de `data` a través de una ref, de modo que escribir
 * sin pausa 40 segundos siga guardando cada 30s en vez de esperar a que la persona se detenga.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { readStoredJson, storageKey, writeStoredJson, writeStoredText } from '../../../core/browser-storage';

export interface UseDraftAutoSaveOptions<T> {
  /** Identificador único del borrador, ej. `reservation-wizard:create:new`. */
  key: string;
  /** Datos vigentes del formulario; se serializan tal cual al guardar. */
  data: T;
  /** Apaga el guardado automático, ej. mientras se está enviando el formulario. Por defecto `true`. */
  enabled?: boolean;
  /** Frecuencia de guardado, en milisegundos. Por defecto 30000 (30s). */
  intervalMs?: number;
}

export interface UseDraftAutoSaveResult<T> {
  /** `true` si ya había un borrador guardado en el momento en que se montó el hook. */
  hasStoredDraft: boolean;
  /** Momento del último guardado efectivo (con cambios reales), o `null` si no hubo ninguno todavía. */
  lastSavedAt: Date | null;
  /** Lee el borrador guardado, o `null` si no existe o quedó corrupto. */
  loadDraft: () => T | null;
  /** Borra el borrador guardado. No toca `data` en memoria: quien llama decide qué hacer con el formulario. */
  discardDraft: () => void;
}

/**
 * Persiste `data` cada `intervalMs` mientras haya cambios reales desde el último guardado.
 *
 * @example
 * const draft = useDraftAutoSave({ key: 'reservation-wizard:create:new', data });
 * useEffect(() => {
 *   const stored = draft.loadDraft();
 *   if (stored) setData(stored);
 * }, []);
 */
export function useDraftAutoSave<T>({ key, data, enabled = true, intervalMs = 30_000 }: UseDraftAutoSaveOptions<T>): UseDraftAutoSaveResult<T> {
  const fullKey = storageKey('draft', key);
  const [hasStoredDraft] = useState(() => readStoredJson<T | null>(fullKey, null) !== null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const lastSerializedRef = useRef<string>(JSON.stringify(data));

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      const current = dataRef.current;
      const serialized = JSON.stringify(current);
      if (serialized === lastSerializedRef.current) return;
      lastSerializedRef.current = serialized;
      writeStoredJson(fullKey, current);
      setLastSavedAt(new Date());
    }, intervalMs);
    return () => window.clearInterval(timer);
    // Deliberadamente sin `data` en las dependencias: el timer se crea una vez por
    // `enabled`/`fullKey`/`intervalMs` y lee `dataRef` en cada tick, no en cada tecla.
  }, [enabled, fullKey, intervalMs]);

  const loadDraft = useCallback((): T | null => readStoredJson<T | null>(fullKey, null), [fullKey]);
  const discardDraft = useCallback((): void => writeStoredText(fullKey, null), [fullKey]);

  return { hasStoredDraft, lastSavedAt, loadDraft, discardDraft };
}
