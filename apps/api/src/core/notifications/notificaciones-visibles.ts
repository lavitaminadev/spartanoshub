import type { ClientCapabilityKey } from '../../modules/clients/client-capabilities';
import type { AccountAccessService } from '../client-scope/account-access.service';
import type { ClientCapabilityService } from '../client-scope/client-capability.service';
import type { AuthUser } from '../../shared/types/request';
import type { Notification } from './notification.entity';

/** El servicio del que nace cada aviso, por su tipo. Sin servicio, el aviso es de la agencia. */
export function servicioDelAviso(tipo: string): ClientCapabilityKey | null {
  if (tipo.startsWith('reservation_') || tipo.startsWith('waitlist')) return 'reservations';
  if (tipo.startsWith('lead_') || tipo.startsWith('crm_') || tipo === 'idle_lead') return 'crm';
  if (tipo.startsWith('survey')) return 'surveys';
  return null;
}

/**
 * De los avisos de una persona, los que hoy le corresponde ver.
 *
 * Un aviso guarda la empresa de la que habla. Si esa persona ya no alcanza la empresa, o la
 * empresa ya no tiene el servicio del que nació el aviso, el aviso no se muestra: seguiría
 * nombrando a un huésped o a un lead de algo que ya no le corresponde. No se borra: si el
 * acceso o el servicio vuelven, el aviso vuelve con ellos.
 */
export async function avisosVisibles(
  avisos: Notification[],
  organizationId: string,
  user: AuthUser,
  accesos?: AccountAccessService,
  servicios?: ClientCapabilityService,
): Promise<Notification[]> {
  const conEmpresa = avisos.filter((aviso) => typeof (aviso.data as { clientId?: unknown } | null)?.clientId === 'string');
  if (!conEmpresa.length || (!accesos && !servicios)) return avisos;

  const alcanzables = accesos ? await accesos.allowedClientIds(organizationId, user) : undefined;
  const decidido = new Map<string, boolean>();
  const visible = async (clientId: string, servicio: ClientCapabilityKey | null) => {
    const clave = `${clientId}:${servicio ?? '-'}`;
    if (!decidido.has(clave)) {
      const alcanza = !alcanzables || alcanzables.includes(clientId);
      const conServicio = !servicio || !servicios || await servicios.tiene(organizationId, clientId, servicio);
      decidido.set(clave, alcanza && conServicio);
    }
    return decidido.get(clave)!;
  };

  const resultado: Notification[] = [];
  for (const aviso of avisos) {
    const clientId = (aviso.data as { clientId?: unknown } | null)?.clientId;
    if (typeof clientId !== 'string' || await visible(clientId, servicioDelAviso(aviso.type))) resultado.push(aviso);
  }
  return resultado;
}
