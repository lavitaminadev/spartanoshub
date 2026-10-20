import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { estaProtegido } from '@espartanos/shared';
import { api } from '../core/api';

/** Lo que dice la pantalla donde el servidor no mandó el dato. */
export const TEXTO_PROTEGIDO = 'Protegido';

/** Lo que el servidor avisa de una fila recortada: qué campos faltan y si quien mira puede pedirlos. */
export interface AvisoDeDatosProtegidos { campos: string[]; sePuedePedir: boolean }

/** El valor si llegó, y `undefined` si en su lugar vino la marca de protegido. */
export function valorLlegado<T>(valor: T): Exclude<T, '__protegido__'> | undefined {
  return estaProtegido(valor) ? undefined : (valor as Exclude<T, '__protegido__'>);
}

/**
 * Pide al servidor los datos protegidos de un registro.
 *
 * Con `bajo_registro` el servidor anota quién los pidió antes de responder; con `oculto` responde
 * 403 y la pantalla no ofrece el botón. Los datos valen sólo para la `ruta` que se pidió.
 */
export function useRevelarProtegidos(ruta: string) {
  const [revelados, setRevelados] = useState<{ ruta: string; datos: Record<string, unknown> } | null>(null);
  const peticion = useMutation({
    mutationFn: () => api.get<{ datos: Record<string, unknown> }>(ruta),
    onSuccess: (respuesta) => setRevelados({ ruta, datos: respuesta.datos }),
  });
  return {
    datos: revelados?.ruta === ruta ? revelados.datos : null,
    ver: () => peticion.mutate(),
    pendiente: peticion.isPending,
    error: peticion.error,
  };
}
