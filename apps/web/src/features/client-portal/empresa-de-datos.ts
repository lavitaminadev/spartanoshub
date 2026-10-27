import { useAuth } from '../../core/auth';
import { useEmpresaActiva } from '../../shared/empresa-activa';

/**
 * La empresa sobre la que una pantalla del portal pide datos.
 *
 * `clientId` entra en la clave de caché y en la petición: cada empresa tiene su propia lista.
 * `disponible` es falso cuando la empresa activa no es la de la cuenta. Aprobaciones, parrilla e
 * informes se resuelven en el servidor con la empresa de la sesión, así que pedirlos estando en
 * otro local devolvería los de la empresa propia bajo el nombre de la otra; en ese caso la
 * pantalla no consulta y lo dice.
 */
export function useEmpresaDeDatos() {
  const { user } = useAuth();
  const { clientId, nombre } = useEmpresaActiva();
  return {
    userId: user?.id,
    clientId,
    nombre,
    disponible: Boolean(clientId) && clientId === user?.clientId,
  };
}
