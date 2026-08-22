/**
 * @fileoverview «Hay una versión nueva», con un botón para tomarla.
 *
 * La actualización entra sola cuando la pestaña está de fondo. Con la pestaña delante no: hacerlo
 * en mitad de una escritura pierde lo escrito, y quien está rellenando la ficha de un lead vería
 * su trabajo desaparecer sin explicación.
 *
 * Así que se avisa y se deja decidir. Sin este aviso, la alternativa real no era «recargar
 * después»: era convivir con una mitad vieja contra un servidor nuevo, que es el estado en que la
 * pantalla ofrece cosas que la API rechaza y todo parece averiado.
 */

import { useEffect, useState, type JSX } from 'react';
import { VERSION_NUEVA_EVENT } from '../core/actualizacion-app';

export function AvisoVersionNueva(): JSX.Element | null {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);

  useEffect(() => {
    const avisar = () => setHayVersionNueva(true);
    window.addEventListener(VERSION_NUEVA_EVENT, avisar);
    return () => window.removeEventListener(VERSION_NUEVA_EVENT, avisar);
  }, []);

  if (!hayVersionNueva) return null;

  return (
    <div className="aviso-version" role="status">
      <span>Hay una versión nueva del sistema.</span>
      <button type="button" className="btn btn-accent btn-sm" onClick={() => window.location.reload()}>
        Recargar ahora
      </button>
      {/*
        Descartar no cancela la actualización: la pospone. Entra sola en cuanto la pestaña pase a
        segundo plano, que es cuando ya no hay nada que perder.
      */}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setHayVersionNueva(false)}>
        Ahora no
      </button>
    </div>
  );
}
