/**
 * @fileoverview Datos legales de una empresa, vistos desde la ficha del cliente del equipo.
 *
 * Los maneja la empresa en su portal. Aquí sólo se ve si están completos y, cuando la empresa lo
 * pide, se abren para completarlos; el cambio queda en auditoría con quién lo hizo.
 */

import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { ClientLegalData, datosLegalesCompletos, rutaDatosLegales } from '../client-portal/ClientLegalData';

export function DatosLegalesDeCliente({ clientId, capacidades }: { clientId: string; capacidades?: { reservations?: boolean; surveys?: boolean } }): JSX.Element {
  const [abierto, setAbierto] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['company-legal', clientId],
    queryFn: () => api.get<Parameters<typeof datosLegalesCompletos>[0]>(rutaDatosLegales(capacidades ?? { reservations: true }, clientId)),
  });
  const { completos, total } = datosLegalesCompletos(data ?? undefined);
  const listo = completos === total;

  return (
    <div className="datos-legales-cliente">
      <div>
        <strong>Datos legales</strong>
        {isLoading ? <small>Revisando…</small> : error ? <small>No se pudieron leer.</small> : (
          <small className={listo ? 'is-completo' : 'is-incompleto'}>
            {listo ? 'Completos: la empresa los mantiene desde su portal.' : `Faltan ${total - completos} de ${total} (razón social, RUT, correo o política). Los completa la empresa en su portal.`}
          </small>
        )}
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAbierto(true)}>{listo ? 'Ver' : 'Completar por la empresa'}</button>
      <Modal open={abierto} onClose={() => setAbierto(false)} title="Datos legales de la empresa">
        {abierto && <ClientLegalData clientId={clientId} capacidades={capacidades ?? { reservations: true }} embebido />}
      </Modal>
    </div>
  );
}
