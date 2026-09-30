import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { triggerToast } from '../../shared/toast-events';

interface Suscriptor {
  id: string;
  clientId?: string | null;
  email: string;
  name?: string | null;
  status: 'pending' | 'subscribed' | 'unsubscribed';
  source: string;
  sourceDetail?: string | null;
  consentAt?: string | null;
  unsubscribedAt?: string | null;
  unsubscribedScope?: 'local' | 'todas' | null;
  createdAt: string;
}

interface Respuesta {
  data: Suscriptor[];
  total: number;
  resumen: Array<{ clientId: string | null; suscritos: number; bajas: number; pendientes: number }>;
}

const ESTADO: Record<Suscriptor['status'], string> = {
  subscribed: 'Suscrito',
  pending: 'Pendiente',
  unsubscribed: 'De baja',
};

/** Cómo se llama cada procedencia, en palabras de quien lee la lista. */
const ORIGEN: Record<string, string> = {
  reserva: 'Reservó',
  import: 'Importado',
  importacion: 'Importado',
  formulario: 'Formulario',
};

/**
 * Quiénes aceptaron recibir correo, por empresa.
 *
 * La lista existía desde hacía tiempo y no se veía en ninguna parte: no había pantalla, ni menú,
 * ni forma de filtrar. Con varios locales en la misma organización, una lista sin filtros no se
 * puede leer, y sin poder leerla no hay cómo decidir una campaña ni responder a quien reclama.
 *
 * La empresa no envía desde acá: descarga los suyos y escribe por su cuenta. Enviar es de la
 * agencia.
 */
export function SuscriptoresPage() {
  const { user } = useAuth();
  const esEmpresa = user?.role === 'client';
  const [empresa, setEmpresa] = useState(esEmpresa ? (user?.clientId ?? '') : '');
  const [estado, setEstado] = useState('subscribed');
  const [busqueda, setBusqueda] = useState('');
  const q = useDeferredValue(busqueda.trim());

  const { data: empresasResp } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: !esEmpresa,
  });
  const empresas = useMemo(() => empresasResp?.data ?? [], [empresasResp?.data]);
  const nombreDe = useMemo(() => {
    const mapa = new Map(empresas.map((cliente) => [cliente.id, cliente.name]));
    return (id: string | null | undefined) => (id ? mapa.get(id) ?? 'Empresa no disponible' : 'Espartanos (agencia)');
  }, [empresas]);

  const parametros = new URLSearchParams();
  if (empresa) parametros.set('empresa', empresa);
  if (estado) parametros.set('estado', estado);
  if (q) parametros.set('q', q);
  const filtro = parametros.toString();

  const { data, isLoading, error, refetch } = useQuery<Respuesta>({
    queryKey: ['suscriptores', empresa, estado, q],
    queryFn: () => api.get(`/marketing/suscriptores${filtro ? `?${filtro}` : ''}`),
    placeholderData: (anterior) => anterior,
  });

  /*
   * La descarga sale del servidor ya acotada a quien está suscrito ahora.
   *
   * Nunca la lista que se está viendo: ahí puede haber bajas, y una baja dentro de un archivo que
   * sale del sistema es una dirección a la que se le va a seguir escribiendo sin que el enlace de
   * baja sirva de nada.
   */
  const descargar = async () => {
    const destino = empresa || (esEmpresa ? user?.clientId ?? 'agencia' : 'agencia');
    const respuesta = await api
      .get<{ empresa: string; total: number; data: Array<Record<string, unknown>> }>(`/marketing/suscriptores/descargar?empresa=${encodeURIComponent(destino)}`)
      .catch(() => null);
    if (!respuesta?.data?.length) { triggerToast('No hay suscritos que descargar.', 'info'); return; }

    const columnas = ['email', 'nombre', 'aceptoEl', 'origen', 'detalle'];
    const filas = respuesta.data.map((fila) => columnas.map((columna) => `"${String(fila[columna] ?? '').replaceAll('"', '""')}"`).join(','));
    const csv = [columnas.join(','), ...filas].join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `suscriptores-${nombreDe(empresa || null).replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    triggerToast(`${respuesta.total} direcciones descargadas. Vuelve a descargarla antes de cada envío: las bajas nuevas no llegan solas a tu copia.`, 'success');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">MARKETING</span>
          <h1>Quiénes aceptaron recibir correo</h1>
          <p className="page-subtitle">
            Cada empresa tiene su propia lista y su propio permiso: alguien puede estar suscrito en un local y de baja en otro.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void descargar()}>Descargar los suscritos</button>
      </div>

      {/* Los números salen de la base entera, no de las filas que se ven: sirven para decidir. */}
      {!esEmpresa && data?.resumen?.length ? (
        <div className="suscriptores-resumen">
          {data.resumen.map((fila) => (
            <button
              type="button"
              key={fila.clientId ?? 'agencia'}
              className={`suscriptores-tarjeta ${empresa === (fila.clientId ?? 'agencia') ? 'activa' : ''}`}
              onClick={() => setEmpresa(empresa === (fila.clientId ?? 'agencia') ? '' : (fila.clientId ?? 'agencia'))}
            >
              <strong>{nombreDe(fila.clientId)}</strong>
              <span>{fila.suscritos} suscritos</span>
              <small>{fila.bajas} de baja · {fila.pendientes} sin confirmar</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="filters">
        <input className="input" type="search" aria-label="Buscar por nombre o correo" placeholder="Nombre o correo" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
        {!esEmpresa && (
          <select className="input" aria-label="Filtrar por empresa" value={empresa} onChange={(evento) => setEmpresa(evento.target.value)}>
            <option value="">Todas las empresas</option>
            <option value="agencia">Espartanos (agencia)</option>
            {empresas.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.name}</option>)}
          </select>
        )}
        <select className="input" aria-label="Filtrar por estado" value={estado} onChange={(evento) => setEstado(evento.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" disabled={!busqueda && !empresa && estado === 'subscribed'} onClick={() => { setBusqueda(''); setEmpresa(esEmpresa ? (user?.clientId ?? '') : ''); setEstado('subscribed'); }}>Limpiar</button>
        <span className="filter-result-count">{data?.total ?? 0} personas</span>
      </div>

      {error ? <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : (
        <DataTable<Suscriptor>
          storageKey="suscriptores"
          keyExtractor={(fila) => fila.id}
          data={data?.data ?? []}
          loading={isLoading}
          emptyMessage="Nadie por ahora. La lista se llena cuando alguien marca «quiero beneficios» al reservar, o importando un archivo."
          columns={[
            { key: 'email', label: 'Correo' },
            { key: 'name', label: 'Nombre', render: (fila) => fila.name || '—' },
            ...(esEmpresa ? [] : [{ key: 'clientId', label: 'Empresa', render: (fila: Suscriptor) => nombreDe(fila.clientId) }]),
            { key: 'status', label: 'Estado', render: (fila) => ESTADO[fila.status] ?? fila.status },
            {
              key: 'consentAt',
              label: 'Desde cuándo',
              sortable: true,
              render: (fila) => (fila.consentAt ? new Date(fila.consentAt).toLocaleDateString('es-CL') : '—'),
            },
            { key: 'source', label: 'De dónde salió', render: (fila) => `${ORIGEN[fila.source] ?? fila.source}${fila.sourceDetail ? ` · ${fila.sourceDetail}` : ''}` },
            {
              key: 'unsubscribedAt',
              label: 'Baja',
              render: (fila) => (fila.unsubscribedAt
                ? `${new Date(fila.unsubscribedAt).toLocaleDateString('es-CL')}${fila.unsubscribedScope === 'todas' ? ' · de todas' : ''}`
                : '—'),
            },
          ]}
        />
      )}
    </div>
  );
}
