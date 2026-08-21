/**
 * @fileoverview Administración del CRM: clientes, equipo y las conexiones que traen leads.
 *
 * No crea nada nuevo: reúne lo que ya existía repartido —la lista de clientes, la de usuarios y
 * los orígenes de entrada— en la pantalla donde se administra el CRM. Antes había que salir del
 * módulo para revisar por qué no entraban leads.
 *
 * Lo que sí aporta es el diagnóstico de las conexiones: cuántos leads trajo cada una, cuándo fue
 * el último, y el último error. Un contador en cero **sin error** significa que nadie llamó; en
 * cero **con error** significa que llamaron mal. Sin esa distinción, ambas se ven idénticas.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { useCrmScope } from './crm-scope';
import './crm-admin.css';

interface Cliente { id: string; name: string }
interface Usuario { id: string; name: string; email: string; role: string; isActive?: boolean }
interface Origen {
  id: string;
  name: string;
  source: string;
  isActive: boolean;
  tokenHint: string;
  receivedCount: number;
  lastReceivedAt?: string | null;
  lastError?: string | null;
  url: string;
}

/** Fecha corta, o el aviso de que nunca ocurrió. */
function cuando(fecha?: string | null): string {
  return fecha ? new Date(fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'sin uso aún';
}

interface Campania {
  id: string;
  name: string;
  source: string;
  investment: number;
  status: string;
  leads: number;
  costPerLead: number | null;
}

export function CrmAdminPage(): JSX.Element {
  const queryClient = useQueryClient();
  // La empresa cuyas campañas se administran; la elige la barra del CRM.
  const scope = useCrmScope();
  const [llaveNueva, setLlaveNueva] = useState<string | null>(null);
  const [campaniaAbierta, setCampaniaAbierta] = useState(false);
  const [formCampania, setFormCampania] = useState({ name: '', source: 'Meta Ads', investment: '0', status: 'active' });

  const campanias = useQuery<Campania[]>({
    queryKey: ['crm-campaigns', scope.clientId],
    queryFn: () => api.get(`/crm/campaigns${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`),
  });

  const refrescarCampanias = () => queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });

  const crearCampania = useMutation({
    mutationFn: () => api.post('/crm/campaigns', {
      name: formCampania.name.trim(),
      source: formCampania.source.trim() || undefined,
      investment: Number(formCampania.investment) || 0,
      status: formCampania.status,
      // La cuenta sale del contexto y no de un campo: administrar campañas de otra empresa
      // desde el panel de esta sería justo la mezcla que el selector vino a evitar.
      clientId: scope.clientId || null,
    }),
    onSuccess: async () => {
      setCampaniaAbierta(false);
      setFormCampania({ name: '', source: 'Meta Ads', investment: '0', status: 'active' });
      await refrescarCampanias();
    },
  });

  const borrarCampania = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/campaigns/${id}`),
    onSuccess: () => refrescarCampanias(),
  });

  const clientes = useQuery<{ data: Cliente[] }>({ queryKey: ['clients-min'], queryFn: () => api.get('/clients') });
  const usuarios = useQuery<{ data: Usuario[] }>({ queryKey: ['users-min'], queryFn: () => api.get('/users') });
  const origenes = useQuery<Origen[]>({
    queryKey: ['lead-ingest-sources'],
    queryFn: () => api.get('/crm/ingest-sources'),
    // Solo Desarrollo administra los orígenes; para el resto el listado responde 403 y no vale
    // la pena reintentar una respuesta que no va a cambiar.
    retry: false,
  });

  const alternar = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.post(`/crm/ingest-sources/${id}/active`, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lead-ingest-sources'] }),
  });

  const rotar = useMutation({
    mutationFn: (id: string) => api.post(`/crm/ingest-sources/${id}/rotate`, {}),
    onSuccess: (respuesta: { token?: string }) => {
      // Se muestra una sola vez: no se guarda en claro, así que no hay dónde volver a buscarla.
      setLlaveNueva(respuesta?.token ?? null);
      void queryClient.invalidateQueries({ queryKey: ['lead-ingest-sources'] });
    },
  });

  if (clientes.isLoading || usuarios.isLoading) return <LoadingSpinner text="Cargando la administración..." />;

  const listaClientes = clientes.data?.data ?? [];
  const listaUsuarios = usuarios.data?.data ?? [];
  const listaOrigenes = origenes.data ?? [];

  return (
    <div className="page crm-admin">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">CONFIGURACIÓN</span>
          <h1>Administración</h1>
        </div>
      </div>

      {llaveNueva ? (
        <div className="alert alert-success crm-admin-llave">
          <strong>Llave nueva. Cópiala ahora: no se puede volver a ver.</strong>
          <code>{llaveNueva}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setLlaveNueva(null)}>Ya la copié</button>
        </div>
      ) : null}

      <div className="crm-admin-dos">
        <section className="crm-admin-panel">
          <header>
            <h2>Clientes</h2>
            <Link className="btn btn-outline btn-sm" to="/clients">Administrar</Link>
          </header>
          {listaClientes.length ? (
            <ul className="crm-admin-lista">
              {listaClientes.map((cliente) => <li key={cliente.id}><strong>{cliente.name}</strong></li>)}
            </ul>
          ) : (
            <p className="crm-admin-vacio">Todavía no hay clientes.</p>
          )}
        </section>

        <section className="crm-admin-panel">
          <header>
            <h2>Equipo <span className="crm-admin-cuenta">{listaUsuarios.length}</span></h2>
            <Link className="btn btn-outline btn-sm" to="/users">Administrar</Link>
          </header>
          {listaUsuarios.length ? (
            <ul className="crm-admin-lista">
              {listaUsuarios.map((usuario) => (
                <li key={usuario.id}>
                  <strong>{usuario.name}</strong>
                  <span>{usuario.email} · {usuario.role}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="crm-admin-vacio">Todavía no hay usuarios.</p>
          )}
        </section>
      </div>

      {/*
        Inversión por campaña.

        Sin esta tabla el panel no puede calcular el costo por lead: los leads dicen de qué
        campaña vinieron, pero nadie anota cuánto costó. El nombre debe coincidir con el que
        traen los leads, y se avisa acá porque es el error que deja la cifra en nada.
      */}
      <section className="crm-admin-panel">
        <header>
          <h2>Campañas e inversión <span className="crm-admin-cuenta">{campanias.data?.length ?? 0}</span></h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCampaniaAbierta(true)}>
            + Nueva campaña
          </button>
        </header>
        <p className="crm-admin-explica">
          El nombre tiene que escribirse igual que el que traen los leads —{scope.esAgencia ? 'los de Espartanos' : `los de ${scope.empresa}`}—;
          si no coincide, la campaña aparece con cero leads y su inversión no se reparte entre nadie.
        </p>
        {campanias.data?.length ? (
          <ul className="crm-admin-lista">
            {campanias.data.map((campania) => (
              <li key={campania.id}>
                <div>
                  <strong>{campania.name}</strong>
                  <small>
                    {campania.source} · ${Math.round(campania.investment).toLocaleString('es-CL')} ·{' '}
                    {campania.leads} lead{campania.leads === 1 ? '' : 's'} ·{' '}
                    {campania.costPerLead === null
                      ? 'sin costo por lead aún'
                      : `$${campania.costPerLead.toLocaleString('es-CL')} por lead`}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={borrarCampania.isPending}
                  onClick={() => borrarCampania.mutate(campania.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-admin-vacio">Todavía no hay campañas registradas.</p>
        )}
      </section>

      {campaniaAbierta ? (
        <Modal open onClose={() => setCampaniaAbierta(false)} title="Nueva campaña">
          <div className="modal-form">
            <label>
              Nombre
              <input
                className="input"
                value={formCampania.name}
                onChange={(event) => setFormCampania({ ...formCampania, name: event.target.value })}
                placeholder="Tal como llega en los leads"
              />
            </label>
            <label>
              Fuente
              <input
                className="input"
                value={formCampania.source}
                onChange={(event) => setFormCampania({ ...formCampania, source: event.target.value })}
              />
            </label>
            <label>
              Inversión (CLP)
              <input
                className="input"
                type="number"
                min={0}
                value={formCampania.investment}
                onChange={(event) => setFormCampania({ ...formCampania, investment: event.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                className="input"
                value={formCampania.status}
                onChange={(event) => setFormCampania({ ...formCampania, status: event.target.value })}
              >
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="finished">Finalizada</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCampaniaAbierta(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={crearCampania.isPending || formCampania.name.trim().length < 2}
                onClick={() => crearCampania.mutate()}
              >
                {crearCampania.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <section className="crm-admin-panel">
        <header>
          <h2>Conexión de campañas</h2>
        </header>
        <p className="crm-admin-explica">
          Cada origen tiene su propia llave. Entrega a cada portal o automatización solo la suya:
          si una se filtra, se apaga ese origen y los demás siguen recibiendo.
        </p>

        {origenes.isError ? (
          <p className="crm-admin-vacio">Solo Desarrollo administra las conexiones de entrada.</p>
        ) : !listaOrigenes.length ? (
          <EmptyState
            title="Todavía no hay conexiones"
            description="Crea una por cada origen que deba entregar leads: portal, formulario, automatización."
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Llave</th>
                  <th>Recibidos</th>
                  <th>Último</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaOrigenes.map((origen) => (
                  <tr key={origen.id}>
                    <td data-label="Origen">
                      <strong>{origen.name}</strong>
                      <small>{origen.source}</small>
                    </td>
                    <td data-label="Llave"><code>{origen.tokenHint}</code></td>
                    <td data-label="Recibidos">{origen.receivedCount}</td>
                    <td data-label="Último">
                      {cuando(origen.lastReceivedAt)}
                      {/* El último error se muestra junto al contador porque juntos explican el
                          cero: sin error significa que nadie llamó, con error que llamaron mal. */}
                      {origen.lastError ? <em className="crm-admin-error">{origen.lastError}</em> : null}
                    </td>
                    <td data-label="Estado">{origen.isActive ? 'Activo' : 'Apagado'}</td>
                    <td data-label="Acciones">
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={alternar.isPending}
                          onClick={() => alternar.mutate({ id: origen.id, isActive: !origen.isActive })}
                        >
                          {origen.isActive ? 'Apagar' : 'Encender'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={rotar.isPending}
                          onClick={() => rotar.mutate(origen.id)}
                        >
                          Rotar llave
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
