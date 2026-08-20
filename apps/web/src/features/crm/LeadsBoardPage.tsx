/**
 * @fileoverview Tablero de leads por etapa, con arrastre.
 *
 * Muestra **solo el embudo comercial**. Los estados del ciclo de reserva —reservado, asistió, no
 * asistió— viven en el mismo campo pero describen otra cosa: la visita de un comensal al local de
 * un cliente, no una venta de la agencia. Mezclarlos en un tablero haría que arrastrar una tarjeta
 * moviera un lead a un estado que su dominio no admite, y el servidor lo rechazaría con un error
 * que en pantalla se lee como que el tablero está roto.
 *
 * Las columnas vacías se muestran igual. Si desaparecieran, la forma del embudo cambiaría según
 * dónde hay gente, y dejaría de verse dónde se está atascando el trabajo —que es para lo que se
 * mira un tablero—.
 */

import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { KanbanBoard, type KanbanColumn } from '../../shared/KanbanBoard';
import { FilterBar } from '../../shared/FilterBar';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';

import { matchesSearch } from '../../shared/search';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import './leads-board.css';

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  source?: string | null;
  campaignName?: string | null;
  assignedTo?: string | null;
  clientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption { id: string; name: string }
interface ClientOption { id: string; name: string }

import { STAGES, STAGE_ACCENT, STAGE_LABEL } from './stage-labels';

const FILTER_KEYS = ['cliente', 'responsable'] as const;

/** Días sin movimiento tras los que la tarjeta se marca. Coincide con el valor del inicio. */
const COOLING_DAYS = 7;

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? '').join('');
}

export function LeadsBoardPage(): JSX.Element {
  const queryClient = useQueryClient();
  const filtros = useUrlFilters(FILTER_KEYS);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);
  const [abierto, setAbierto] = useState<Lead | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ data: Lead[] }>({
    queryKey: ['crm-leads-board'],
    queryFn: () => api.get('/crm/leads?domain=commercial&limit=100'),
  });

  const { data: usuarios } = useQuery<{ data: UserOption[] }>({
    queryKey: ['users-min'],
    queryFn: () => api.get('/users'),
  });
  const { data: clientes } = useQuery<{ data: ClientOption[] }>({
    queryKey: ['clients-min'],
    queryFn: () => api.get('/clients'),
  });

  const equipo = useMemo(() => usuarios?.data ?? [], [usuarios]);
  const cartera = useMemo(() => clientes?.data ?? [], [clientes]);
  const nombreDe = (id?: string | null) => equipo.find((u) => u.id === id)?.name;

  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/crm/leads/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] });
      // También el inicio: sus avisos se calculan sobre estos mismos estados y quedarían viejos.
      void queryClient.invalidateQueries({ queryKey: ['crm-home'] });
      setAviso({ tono: 'success', texto: 'Lead movido' });
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message || 'No se pudo mover el lead' }),
  });

  const leads = useMemo(() => {
    const todos = data?.data ?? [];
    return todos.filter((lead) => {
      if (filtros.values.cliente && lead.clientId !== filtros.values.cliente) return false;
      if (filtros.values.responsable && lead.assignedTo !== filtros.values.responsable) return false;
      return matchesSearch(filtros.search, [lead.name, lead.email, lead.phone, lead.campaignName]);
    });
  }, [data, filtros.values.cliente, filtros.values.responsable, filtros.search]);


  /*
   * El mismo documento alimenta el CSV y el PDF, así que no pueden divergir: agregar una columna
   * acá la agrega a los dos formatos. Exporta lo filtrado y no todo, que es lo que se está
   * mirando en pantalla, y el filtro queda anotado en el encabezado para que el archivo se
   * entienda semanas después.
   */
  const documento: ExportDocument<Lead> = {
    fileName: 'leads',
    title: 'Leads del embudo comercial',
    subtitle: `${leads.length} de ${(data?.data ?? []).length} leads`,
    meta: [
      { label: 'Cliente', value: cartera.find((c) => c.id === filtros.values.cliente)?.name ?? 'Todos' },
      { label: 'Responsable', value: nombreDe(filtros.values.responsable) ?? 'Todo el equipo' },
      { label: 'Búsqueda', value: filtros.search || 'Sin filtrar' },
    ],
    columns: [
      { header: 'Nombre', value: (l) => l.name, width: 22 },
      { header: 'Teléfono', value: (l) => l.phone, width: 14 },
      { header: 'Correo', value: (l) => l.email, width: 22 },
      { header: 'Etapa', value: (l) => STAGE_LABEL[l.status] ?? l.status, width: 13 },
      { header: 'Origen', value: (l) => l.campaignName || l.source, width: 15 },
      { header: 'Responsable', value: (l) => nombreDe(l.assignedTo) ?? 'Sin asignar', width: 14 },
    ],
    rows: leads,
    footer: 'Espartanos · CRM',
  };

  const columnas = useMemo<KanbanColumn[]>(
    () => STAGES.map((stage) => ({ id: stage, label: STAGE_LABEL[stage], accent: STAGE_ACCENT[stage] })),
    [],
  );

  if (isLoading) return <LoadingSpinner text="Cargando el tablero..." />;
  if (error) {
    return <QueryErrorState title="No pudimos cargar el tablero" message={(error as Error).message} onRetry={() => void refetch()} />;
  }

  const hayLeads = (data?.data ?? []).length > 0;

  return (
    <div className="page leads-board">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">EMBUDO COMERCIAL</span>
          <h1>Tablero</h1>
          <p className="page-subtitle">Arrastra una tarjeta para cambiarle la etapa.</p>
        </div>
        <ExportButtons document={documento} />
      </div>

      {aviso ? <div className={`alert alert-${aviso.tono}`}>{aviso.texto}</div> : null}

      <FilterBar
        search={filtros.search}
        onSearchChange={filtros.setSearch}
        searchPlaceholder="Buscar por nombre, correo, teléfono o campaña..."
        filters={[
          { key: 'cliente', label: 'Cliente', allLabel: 'Todos los clientes', options: cartera.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'responsable', label: 'Responsable', allLabel: 'Todo el equipo', options: equipo.map((u) => ({ value: u.id, label: u.name })) },
        ]}
        values={filtros.values}
        onFilterChange={filtros.setValue}
        onClear={filtros.hasAny ? filtros.clear : undefined}
      />

      {!hayLeads ? (
        <EmptyState
          title="Todavía no hay leads en el embudo"
          description="Cuando entre el primero —por formulario, por integración o creado a mano— aparecerá acá."
        />
      ) : (
        <KanbanBoard
          columns={columnas}
          items={leads}
          keyExtractor={(lead) => lead.id}
          columnOf={(lead) => lead.status}
          onMove={(lead, stage) => mover.mutate({ id: lead.id, status: stage })}
          emptyMessage="Ningún lead calza con este filtro."
          renderCard={(lead) => {
            const frio = Date.now() - new Date(lead.updatedAt).getTime() > COOLING_DAYS * 86_400_000;
            const responsable = nombreDe(lead.assignedTo);
            return (
              <div
                className={`leads-board-card${frio ? ' esta-frio' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setAbierto(lead)}
                // Enter y espacio además del clic: la tarjeta es el único camino a la ficha, y
                // dejarla solo para el ratón la vuelve inalcanzable por teclado.
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAbierto(lead); }
                }}
              >
                <div className="leads-board-card-head">
                  <strong>{lead.name}</strong>
                  {responsable ? <span className="leads-board-avatar" title={responsable}>{iniciales(responsable)}</span> : null}
                </div>
                {lead.phone ? <span className="leads-board-contacto">{lead.phone}</span> : null}
                <span className="leads-board-origen">
                  {lead.campaignName || lead.source || 'Sin origen'} · {new Date(lead.createdAt).toLocaleDateString('es-CL')}
                </span>
                {/* El aviso de frío va en la tarjeta y no solo en el informe: se actúa mirando el
                    tablero, no leyendo un número al final del mes. */}
                {frio ? <span className="leads-board-frio">Sin movimiento hace +{COOLING_DAYS} días</span> : null}
                {!lead.assignedTo ? <span className="leads-board-sin-duenio">Sin asignar</span> : null}
              </div>
            );
          }}
        />
      )}

      {abierto ? (
        <LeadDetailDrawer lead={abierto} nombreDe={nombreDe} etapaLabel={(s) => STAGE_LABEL[s] ?? s} onClose={() => setAbierto(null)} />
      ) : null}
    </div>
  );
}
