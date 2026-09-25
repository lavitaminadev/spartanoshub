/**
 * @fileoverview A qué empresas entra una persona y en cuáles administra el equipo.
 *
 * Las dos cosas van en la misma lista porque son la misma pregunta hecha dos veces sobre cada
 * empresa: si entra, y si además manda. Separadas —una lista de empresas aquí y una casilla
 * suelta «puede administrar el equipo» más abajo— la casilla no decía sobre cuál de todas
 * aplicaba, y quien la marcaba entendía que se las daba todas.
 *
 * La empresa de la cuenta aparece primero y no se puede quitar: es la que define a quién
 * pertenece. Administrarla, en cambio, sí se marca: pertenecer no es mandar.
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
 * @param puedeAsignarEmpresas - Si además puede repartir otras empresas. Quien administra la
 *   suya no lo hace: sólo decide quién manda dentro de ella, y ofrecerle el resto sería ofrecer
 *   algo que el servidor rechaza.
 */
export function EmpresasAdicionales({ usuarioId, empresaDeLaCuenta, empresas, puedeEditar, puedeAsignarEmpresas = true }: {
  usuarioId: string;
  empresaDeLaCuenta: string;
  empresas: Array<{ id: string; name: string }>;
  puedeEditar: boolean;
  puedeAsignarEmpresas?: boolean;
}) {
  const qc = useQueryClient();
  const clave = ['empresas-de-usuario', usuarioId];
  const claveManda = ['empresas-que-administra', usuarioId];

  const accesos = useQuery<{ access: AccesoEmpresa[] | 'unrestricted' }>({
    queryKey: clave,
    queryFn: () => api.get(`/users/${usuarioId}/client-access`),
  });
  const manda = useQuery<{ clientIds: string[] }>({
    queryKey: claveManda,
    queryFn: () => api.get(`/users/${usuarioId}/administra`),
  });

  const cambiarAcceso = useMutation({
    mutationFn: ({ clientId, conceder }: { clientId: string; conceder: boolean }) => conceder
      ? api.put(`/users/${usuarioId}/client-access/${clientId}`, { reason: 'Asignada desde la ficha' })
      : api.delete(`/users/${usuarioId}/client-access/${clientId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: clave }); triggerToast('Empresas actualizadas'); },
    onError: (fallo) => triggerToast((fallo as Error).message),
  });

  /*
   * Retirar el acceso retira también la administración.
   *
   * Quedarse administrando una empresa a la que ya no se entra es un permiso que no se ve en
   * ninguna pantalla y que vuelve a actuar el día que alguien reasigna esa empresa.
   */
  const cambiarMando = useMutation({
    mutationFn: ({ clientId, conceder }: { clientId: string; conceder: boolean }) => conceder
      ? api.put(`/users/${usuarioId}/administra/${clientId}`, {})
      : api.delete(`/users/${usuarioId}/administra/${clientId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claveManda });
      void qc.invalidateQueries({ queryKey: ['administran-equipo'] });
      triggerToast('Permisos de administración actualizados');
    },
    onError: (fallo) => triggerToast((fallo as Error).message),
  });

  const acceso = accesos.data?.access;
  const asignadas = new Set((Array.isArray(acceso) ? acceso : []).map((item) => item.clientId));
  const administradas = new Set(manda.data?.clientIds ?? []);
  const propia = empresas.find((empresa) => empresa.id === empresaDeLaCuenta);
  const otras = puedeAsignarEmpresas ? empresas.filter((empresa) => empresa.id !== empresaDeLaCuenta) : [];
  const guardando = cambiarAcceso.isPending || cambiarMando.isPending;

  const quitarAcceso = (clientId: string) => {
    if (administradas.has(clientId)) cambiarMando.mutate({ clientId, conceder: false });
    cambiarAcceso.mutate({ clientId, conceder: false });
  };

  const fila = (empresa: { id: string; name: string }, esPropia: boolean) => {
    const entra = esPropia || asignadas.has(empresa.id);
    return (
      <li key={empresa.id} className="empresa-de-persona">
        <span className="empresa-de-persona-nombre">
          {empresa.name}
          {esPropia && <small>Su empresa</small>}
        </span>
        <label className="empresa-de-persona-casilla">
          <input
            type="checkbox"
            checked={entra}
            disabled={esPropia || !puedeEditar || guardando}
            onChange={(evento) => (evento.target.checked
              ? cambiarAcceso.mutate({ clientId: empresa.id, conceder: true })
              : quitarAcceso(empresa.id))}
          />
          {' '}Entra
        </label>
        <label className="empresa-de-persona-casilla">
          <input
            type="checkbox"
            checked={administradas.has(empresa.id)}
            disabled={!entra || !puedeEditar || guardando}
            onChange={(evento) => cambiarMando.mutate({ clientId: empresa.id, conceder: evento.target.checked })}
          />
          {' '}Administra el equipo
        </label>
      </li>
    );
  };

  return (
    <fieldset className="form-choice-group empresas-de-persona">
      <legend>Dónde trabaja esta persona</legend>
      <p className="field-hint">
        {puedeAsignarEmpresas
          ? <>Marca <strong>Entra</strong> en cada empresa que atiende. Marca <strong>Administra
            el equipo</strong> sólo donde además pueda crear cuentas y repartir accesos: se
            concede empresa por empresa, nunca a todas de una vez.</>
          : <>Marca <strong>Administra el equipo</strong> si esta persona puede crear cuentas y
            repartir accesos dentro de tu empresa. Sólo alcanza a tu empresa.</>}
      </p>
      {accesos.isLoading || manda.isLoading ? <p className="page-subtitle">Cargando empresas…</p> : (
        <>
          <ul className="empresas-de-persona-lista">
            {propia && fila(propia, true)}
            {otras.map((empresa) => fila(empresa, false))}
          </ul>
          {puedeAsignarEmpresas && otras.length === 0 && <small>No hay otras empresas registradas.</small>}
          <small>Se guarda al marcar, sin esperar al botón.</small>
        </>
      )}
    </fieldset>
  );
}
