import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PLAZO_AVISO_VULNERACION_HORAS } from '@espartanos/shared';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';

interface VulneracionRow {
  id: string;
  descripcion: string;
  detectedAt: string;
  datosAfectados: string;
  titularesAfectados: number | null;
  empresas: Array<{ id: string; name: string | null }>;
  medidas: string | null;
  avisoLocalAt: string | null;
  avisoAgenciaAt: string | null;
  /** Calculado por el servidor desde la detección: depende de la hora de hoy. */
  plazo: { vence: string; horasRestantes: number; estado: 'avisado' | 'a tiempo' | 'por vencer' | 'vencido' };
}

interface ClienteOpcion { id: string; name: string }

const VACIO = { descripcion: '', detectedAt: '', datosAfectados: '', titularesAfectados: '', medidas: '', avisoLocalAt: '', avisoAgenciaAt: '', clientIds: [] as string[] };

const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const aIso = (local: string) => new Date(local).toISOString();
const formato = (iso: string) => new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

function textoDelPlazo(plazo: VulneracionRow['plazo']): string {
  const horas = Math.abs(Math.round(plazo.horasRestantes));
  if (plazo.estado === 'avisado') return 'Local avisado';
  if (plazo.estado === 'vencido') return `Aviso vencido hace ${horas} h`;
  return `Quedan ${horas} h para avisar al local`;
}

export function VulneracionesPanel(): JSX.Element {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<VulneracionRow | 'nueva' | null>(null);
  const [borrador, setBorrador] = useState(VACIO);

  const { data: filas = [], isLoading, error, refetch, isFetching } = useQuery<VulneracionRow[]>({
    queryKey: ['vulneraciones'],
    queryFn: () => api.get('/vulneraciones'),
  });
  const { data: clientes = [] } = useQuery<ClienteOpcion[]>({
    queryKey: ['vulneraciones-clientes'],
    queryFn: async () => {
      const respuesta = await api.get<ClienteOpcion[] | { data: ClienteOpcion[] }>('/clients?limit=100');
      return Array.isArray(respuesta) ? respuesta : respuesta.data ?? [];
    },
  });

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        descripcion: borrador.descripcion,
        detectedAt: aIso(borrador.detectedAt),
        datosAfectados: borrador.datosAfectados,
        titularesAfectados: borrador.titularesAfectados === '' ? undefined : Number(borrador.titularesAfectados),
        clientIds: borrador.clientIds,
        medidas: borrador.medidas || undefined,
        avisoLocalAt: borrador.avisoLocalAt ? aIso(borrador.avisoLocalAt) : undefined,
        avisoAgenciaAt: borrador.avisoAgenciaAt ? aIso(borrador.avisoAgenciaAt) : undefined,
      };
      return editando && editando !== 'nueva' ? api.patch(`/vulneraciones/${editando.id}`, cuerpo) : api.post('/vulneraciones', cuerpo);
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['vulneraciones'] }); setEditando(null); triggerToast('Vulneración registrada'); },
    onError: (err: Error) => triggerToast(err.message, 'error'),
  });

  const abrir = (fila: VulneracionRow | 'nueva') => {
    setEditando(fila);
    setBorrador(fila === 'nueva' ? VACIO : {
      descripcion: fila.descripcion, detectedAt: aLocal(fila.detectedAt), datosAfectados: fila.datosAfectados,
      titularesAfectados: fila.titularesAfectados === null ? '' : String(fila.titularesAfectados), medidas: fila.medidas ?? '',
      avisoLocalAt: aLocal(fila.avisoLocalAt), avisoAgenciaAt: aLocal(fila.avisoAgenciaAt), clientIds: fila.empresas.map((empresa) => empresa.id),
    });
  };

  const alternarEmpresa = (id: string) => setBorrador((actual) => ({
    ...actual,
    clientIds: actual.clientIds.includes(id) ? actual.clientIds.filter((c) => c !== id) : [...actual.clientIds, id],
  }));

  return (
    <section>
      <div className="section-toolbar">
        <div>
          <span className="page-eyebrow">VULNERACIONES</span>
          <h2>Registro de vulneraciones</h2>
          <p className="page-subtitle">Libro de registro: nada se detecta solo. Anota cada vulneración con la hora en que se supo; el plazo de {PLAZO_AVISO_VULNERACION_HORAS} horas para avisar al local corre desde ahí y la alerta diaria avisa antes de que venza.</p>
        </div>
        <div>
          <button className="btn btn-outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Actualizando...' : 'Actualizar'}</button>
          <button className="btn btn-primary" onClick={() => abrir('nueva')}>Registrar vulneración</button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner text="Cargando registro..." /> :
        error ? <QueryErrorState title="No pudimos cargar el registro" message={error.message} error={error} onRetry={() => refetch()} retrying={isFetching} /> :
        filas.length === 0 ? <EmptyState icon="inbox" title="Sin vulneraciones registradas" description="Si ocurre una, anótala aquí apenas se detecte." /> :
        <div className="admin-solicitudes">
          {filas.map((fila) => (
            <article className="admin-solicitud-card" key={fila.id}>
              <header>
                <span className={`solicitud-plazo es-${fila.plazo.estado.replace(/ /g, '-')}`}>{textoDelPlazo(fila.plazo)}</span>
                <small>Detectada el {formato(fila.detectedAt)}</small>
              </header>
              <p>{fila.descripcion}</p>
              <div className="admin-solicitud-facts">
                <span><small>Datos</small><strong>{fila.datosAfectados}</strong></span>
                <span><small>Personas</small><strong>{fila.titularesAfectados ?? 'Se desconoce'}</strong></span>
                <span><small>Empresas</small><strong>{fila.empresas.length ? fila.empresas.map((empresa) => empresa.name ?? 'Empresa').join(', ') : '—'}</strong></span>
                <span><small>Aviso al local</small><strong>{fila.avisoLocalAt ? formato(fila.avisoLocalAt) : `Pendiente · vence ${formato(fila.plazo.vence)}`}</strong></span>
                <span><small>Aviso a la Agencia</small><strong>{fila.avisoAgenciaAt ? formato(fila.avisoAgenciaAt) : 'Pendiente'}</strong></span>
              </div>
              {fila.medidas ? <div className="solicitud-resolution"><strong>Qué se hizo</strong><p>{fila.medidas}</p></div> : null}
              <footer className="solicitud-actions"><button className="btn btn-outline btn-sm" onClick={() => abrir(fila)}>Editar</button></footer>
            </article>
          ))}
        </div>}

      <Modal open={editando !== null} onClose={() => setEditando(null)} title={editando === 'nueva' ? 'Registrar vulneración' : 'Editar vulneración'}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); guardar.mutate(); }}>
          <label>Qué pasó<textarea className="input" rows={3} required minLength={5} value={borrador.descripcion} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} /></label>
          <label>Cuándo se detectó<input className="input" type="datetime-local" required value={borrador.detectedAt} onChange={(e) => setBorrador({ ...borrador, detectedAt: e.target.value })} /></label>
          <label>Qué datos<textarea className="input" rows={2} required minLength={2} value={borrador.datosAfectados} onChange={(e) => setBorrador({ ...borrador, datosAfectados: e.target.value })} /></label>
          <label>Cuántas personas (vacío si se desconoce)<input className="input" type="number" min="0" value={borrador.titularesAfectados} onChange={(e) => setBorrador({ ...borrador, titularesAfectados: e.target.value })} /></label>
          <fieldset>
            <legend>Empresas afectadas</legend>
            {clientes.map((cliente) => (
              <label key={cliente.id}><input type="checkbox" checked={borrador.clientIds.includes(cliente.id)} onChange={() => alternarEmpresa(cliente.id)} /> {cliente.name}</label>
            ))}
          </fieldset>
          <label>Qué se hizo<textarea className="input" rows={3} value={borrador.medidas} onChange={(e) => setBorrador({ ...borrador, medidas: e.target.value })} /></label>
          <div className="form-row">
            <label>Se avisó al local el<input className="input" type="datetime-local" value={borrador.avisoLocalAt} onChange={(e) => setBorrador({ ...borrador, avisoLocalAt: e.target.value })} /></label>
            <label>Se comunicó a la Agencia el<input className="input" type="datetime-local" value={borrador.avisoAgenciaAt} onChange={(e) => setBorrador({ ...borrador, avisoAgenciaAt: e.target.value })} /></label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
