/**
 * @fileoverview Las otras empresas que atiende una persona, dentro de su propia ficha.
 *
 * Asignarlas vive en la pantalla de permisos, que es donde se reparte el acceso. Pero quien va
 * a dar de alta a alguien que atiende dos locales abre la ficha, no los permisos: encontraba
 * una lista de empresas con una sola opción posible y concluía que el sistema no lo permitía.
 *
 * Es la misma asignación y el mismo servidor, ofrecida donde se la busca.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { triggerToast } from '../../shared/toast-events';

interface AccesoEmpresa { clientId: string; source: 'pod' | 'assignment' | 'community-manager' | 'own' }

/**
 * @param usuarioId - Persona que se está editando. Sin ella todavía no hay a quién asignar.
 * @param empresaDeLaCuenta - La que define a quién pertenece: se muestra fija, no se quita acá.
 * @param empresas - Todas las empresas de la organización.
 * @param puedeEditar - Si quien mira puede cambiar asignaciones.
 */
export function EmpresasAdicionales({ usuarioId, empresaDeLaCuenta, empresas, puedeEditar }: {
  usuarioId: string;
  empresaDeLaCuenta: string;
  empresas: Array<{ id: string; name: string }>;
  puedeEditar: boolean;
}) {
  const qc = useQueryClient();
  const clave = ['empresas-de-usuario', usuarioId];
  const accesos = useQuery<{ access: AccesoEmpresa[] | 'unrestricted' }>({
    queryKey: clave,
    queryFn: () => api.get(`/users/${usuarioId}/client-access`),
  });

  const cambiar = useMutation({
    mutationFn: ({ clientId, conceder }: { clientId: string; conceder: boolean }) => conceder
      ? api.put(`/users/${usuarioId}/client-access/${clientId}`, { reason: 'Asignada desde la ficha' })
      : api.delete(`/users/${usuarioId}/client-access/${clientId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: clave }); triggerToast('Empresas actualizadas'); },
    onError: (fallo) => triggerToast((fallo as Error).message),
  });

  const acceso = accesos.data?.access;
  const asignadas = new Set((Array.isArray(acceso) ? acceso : []).map((item) => item.clientId));
  // La empresa de la cuenta ya aparece arriba, en su propia lista: repetirla invita a desmarcarla.
  const otras = empresas.filter((empresa) => empresa.id !== empresaDeLaCuenta);

  return (
    <fieldset className="form-choice-group">
      <legend>Otras empresas que atiende</legend>
      {accesos.isLoading ? <p className="page-subtitle">Cargando empresas…</p> : otras.length === 0 ? (
        <p className="page-subtitle">No hay otras empresas registradas.</p>
      ) : (
        <>
          {otras.map((empresa) => (
            <label key={empresa.id} className="toggle-row">
              <input
                type="checkbox"
                checked={asignadas.has(empresa.id)}
                disabled={!puedeEditar || cambiar.isPending}
                onChange={(evento) => cambiar.mutate({ clientId: empresa.id, conceder: evento.target.checked })}
              />
              {' '}{empresa.name}
            </label>
          ))}
          <small>Entra a su empresa y además a las marcadas. Se guarda al marcar, sin esperar al botón.</small>
        </>
      )}
    </fieldset>
  );
}
