/**
 * @fileoverview Ficha de un lead: sus datos, sus acciones y por dónde pasó.
 *
 * El historial es la mitad del valor de esta pantalla y hasta ahora no se veía en ninguna parte:
 * el registro de recorrido guardaba cada cambio de etapa con su duración y su autor, y nadie lo
 * leía. Acá se muestra como una historia —de lo más antiguo a lo más reciente— porque lo que se
 * quiere saber es por dónde pasó y cuánto tardó, no cuál fue lo último.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

import { roleLabel } from '../../core/role-labels';
import './lead-detail.css';

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  source?: string | null;
  campaignName?: string | null;
  discardReason?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Paso {
  id: string;
  fromStage?: string | null;
  toStage: string;
  durationHours?: number | string | null;
  changedBy?: string | null;
  reason?: string | null;
  createdAt: string;
}

interface Props {
  lead: Lead;
  /** Nombre de la etapa, con el vocabulario del tablero. */
  etapaLabel: (stage: string) => string;
  /** Nombre de quien movió cada paso, resuelto por quien abre la ficha. */
  nombreDe: (id?: string | null) => string | undefined;
  onClose: () => void;
}

/** Horas a una unidad que se lee de un vistazo. */
function duracion(horas?: number | string | null): string | null {
  const valor = Number(horas);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (valor < 1) return `${Math.round(valor * 60)} min`;
  if (valor < 48) return `${Math.round(valor)} h`;
  return `${Math.round(valor / 24)} días`;
}

/** Enlace de WhatsApp: `wa.me` solo acepta dígitos, sin `+` ni espacios. */
function whatsapp(telefono?: string | null): string | undefined {
  const digitos = telefono?.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : undefined;
}

export function LeadDetailDrawer({ lead, nombreDe, etapaLabel, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState(lead.notes ?? '');

  const { data: historial, isLoading } = useQuery<Paso[]>({
    queryKey: ['crm-lead-historial', lead.id],
    queryFn: () => api.get(`/crm/leads/${lead.id}/historial`),
  });

  const guardar = useMutation({
    mutationFn: () => api.put(`/crm/leads/${lead.id}`, { notes: nota }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] });
      onClose();
    },
  });

  const enlaceWhatsapp = whatsapp(lead.phone);

  return (
    <Modal open onClose={onClose} title={lead.name}>
      <div className="lead-detail">
        <dl className="lead-detail-datos">
          <dt>Etapa</dt>
          <dd>{etapaLabel(lead.status)}</dd>

          <dt>Teléfono</dt>
          <dd>{lead.phone || '—'}</dd>

          <dt>Correo</dt>
          <dd>{lead.email || '—'}</dd>

          <dt>Origen</dt>
          <dd>{lead.campaignName || lead.source || '—'}</dd>

          <dt>Responsable</dt>
          <dd>{nombreDe(lead.assignedTo) || 'Sin asignar'}</dd>

          {lead.discardReason ? (
            <>
              <dt>Motivo de cierre</dt>
              <dd>{lead.discardReason}</dd>
            </>
          ) : null}
        </dl>

        <p className="lead-detail-fechas">
          Ingresó el {new Date(lead.createdAt).toLocaleDateString('es-CL')} ·
          {' '}último movimiento {new Date(lead.updatedAt).toLocaleDateString('es-CL')}
        </p>

        <div className="lead-detail-acciones">
          {lead.phone ? <a className="btn btn-outline btn-sm" href={`tel:${lead.phone}`}>Llamar</a> : null}
          {enlaceWhatsapp ? (
            <a className="btn btn-outline btn-sm" href={enlaceWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          ) : null}
          {lead.email ? <a className="btn btn-outline btn-sm" href={`mailto:${lead.email}`}>Correo</a> : null}
        </div>

        <label className="lead-detail-nota">
          <span>Notas</span>
          <textarea
            className="input"
            rows={3}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="Qué se conversó, qué quedó pendiente..."
          />
        </label>

        <section className="lead-detail-historial">
          <h3>Historial</h3>
          {isLoading ? (
            <LoadingSpinner text="Cargando el recorrido..." />
          ) : !historial?.length ? (
            // Un lead creado antes de que existiera el registro no tiene pasos, y eso no es un
            // error: decirlo evita que se lea como que el historial está roto.
            <p className="lead-detail-vacio">
              Todavía no hay movimientos registrados. Aparecerán al cambiarle la etapa.
            </p>
          ) : (
            <ol className="lead-detail-pasos">
              {historial.map((paso) => {
                const permanencia = duracion(paso.durationHours);
                return (
                  <li key={paso.id}>
                    <time>{new Date(paso.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</time>
                    <div>
                      <strong>
                        {paso.fromStage
                          ? `${etapaLabel(paso.fromStage)} → ${etapaLabel(paso.toStage)}`
                          : `Ingresó como ${etapaLabel(paso.toStage)}`}
                      </strong>
                      <span>
                        {/* Sin autor significa que lo movió el sistema, no que se desconozca. */}
                        {paso.changedBy ? nombreDe(paso.changedBy) ?? roleLabel('dev') : 'Automático'}
                        {permanencia ? ` · estuvo ${permanencia} en la etapa anterior` : ''}
                      </span>
                      {paso.reason ? <em>{paso.reason}</em> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="lead-detail-pie">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardar.isPending || nota === (lead.notes ?? '')}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? 'Guardando...' : 'Guardar notas'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
