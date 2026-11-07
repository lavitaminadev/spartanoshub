import { useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { getFeatureForPath } from '../core/navigation.registry';

/**
 * Dice que el módulo que se está mirando está en mantenimiento, y que por eso no se puede tocar.
 *
 * El estado existía desde el principio y no significaba nada: `maintenance` contaba como fase
 * visible y se comportaba igual que `active`. Ahora el servidor recorta el nivel a lectura, con
 * lo cual la pantalla se abre, los datos están a la vista y cualquier intento de escribir se
 * rechaza. Sin este aviso, eso se vive como una pantalla rota: los botones fallan sin decir por
 * qué, que es exactamente lo que se quería evitar al no apagar el módulo entero.
 */
export function AvisoDeMantenimiento() {
  const { pathname } = useLocation();
  const user = useAuth((estado) => estado.user);
  const modulo = getFeatureForPath(pathname);
  if (!modulo || user?.moduleLifecycle?.[modulo] !== 'maintenance') return null;

  return (
    <div className="aviso-de-mantenimiento" role="status">
      <strong>En mantenimiento</strong>
      <span>Puedes mirar lo que hay; los cambios están detenidos mientras se corrige. Nada de lo que veas se pierde.</span>
    </div>
  );
}
