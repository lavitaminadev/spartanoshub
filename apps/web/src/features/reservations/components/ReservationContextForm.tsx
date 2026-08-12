/**
 * @fileoverview Paso 1 del asistente: cliente, tipo de servicio, objetivo y fecha.
 *
 * Es el único paso que hace su propio fetch (el catálogo de clientes): mantiene el resto del
 * wizard ajeno a react-query y facilita reemplazar o probar este paso por separado.
 */

import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../core/api';
import { SERVICE_TYPE_LABELS } from '../utils/reservation-formatters';
import type { ReservationServiceType, ReservationWizardData } from '../hooks/useReservationWizard';
import { ReservationFormSection } from './ReservationFormSection';

interface ClientOption {
  id: string;
  name: string;
}

export interface ReservationContextFormProps {
  data: ReservationWizardData;
  onChange: (patch: Partial<ReservationWizardData>) => void;
}

/** Paso 1: cliente, tipo de servicio, objetivo del trabajo y fecha en que se realiza. */
export function ReservationContextForm({ data, onChange }: ReservationContextFormProps): JSX.Element {
  const { data: clientsResponse, isLoading } = useQuery<{ data: ClientOption[] }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  const clients = clientsResponse?.data ?? [];

  return (
    <ReservationFormSection
      eyebrow="CONTEXTO"
      title="¿Para quién y para qué es esta reserva?"
      description="El cliente y la fecha son obligatorios; el resto ayuda a que el equipo llegue preparado."
    >
      <label>Cliente *
        <select
          className="input"
          required
          value={data.clientId}
          disabled={isLoading}
          onChange={(event) => {
            const clientId = event.target.value;
            const clientName = clients.find((client) => client.id === clientId)?.name ?? '';
            onChange({ clientId, clientName });
          }}
        >
          <option value="">{isLoading ? 'Cargando clientes...' : 'Selecciona un cliente'}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label>Tipo de servicio
          <select
            className="input"
            value={data.serviceType}
            onChange={(event) => onChange({ serviceType: event.target.value as ReservationServiceType })}
          >
            {(Object.entries(SERVICE_TYPE_LABELS) as Array<[ReservationServiceType, string]>).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>Fecha *
          <input
            className="input"
            type="date"
            required
            value={data.scheduledDate}
            onChange={(event) => onChange({ scheduledDate: event.target.value })}
          />
        </label>
        <label>Hora (opcional)
          <input
            className="input"
            type="time"
            value={data.scheduledTime}
            onChange={(event) => onChange({ scheduledTime: event.target.value })}
          />
        </label>
      </div>

      <label>Objetivo del trabajo
        <textarea
          className="input"
          rows={3}
          value={data.objective}
          onChange={(event) => onChange({ objective: event.target.value })}
          placeholder="Ej. Grabar el spot de lanzamiento de la nueva carta de verano."
        />
      </label>
    </ReservationFormSection>
  );
}
