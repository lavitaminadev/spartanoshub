import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface Envio {
  id: string;
  destinatario: string;
  asunto: string;
  resultado: 'enviado' | 'rechazado' | 'fallido' | 'omitido';
  motivo?: string | null;
  createdAt: string;
}

const RESULTADO: Record<Envio['resultado'], string> = {
  enviado: 'Enviado',
  rechazado: 'Rechazado',
  fallido: 'Falló',
  omitido: 'No se intentó',
};

/**
 * Qué correos salió a enviar la plataforma, a quién y con qué resultado.
 *
 * El servidor de correo no guarda copia en «Enviados» y cPanel borra su historial a los diez días,
 * así que no había forma de responder «¿le llegó?». Muestra destinatario, asunto y resultado;
 * nunca el contenido, que es donde van los teléfonos y correos de los clientes finales. Guarda 90
 * días. «Enviado» significa que el servidor de correo lo aceptó, no que esté en la bandeja.
 */
export function RegistroDeCorreosPage() {
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState('');
  const q = useDeferredValue(busqueda.trim());
  const consulta = new URLSearchParams();
  if (q) consulta.set('q', q);
  if (resultado) consulta.set('resultado', resultado);
  const filtro = consulta.toString();

  const { data, isLoading, error, refetch } = useQuery<Envio[]>({
    queryKey: ['registro-de-correos', q, resultado],
    queryFn: () => api.get(`/registro-de-correos${filtro ? `?${filtro}` : ''}`),
    // La lista anterior queda a la vista mientras llega la nueva: el buscador no pierde el foco.
    placeholderData: (anterior) => anterior,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">DESARROLLO</span>
          <h1>Correos enviados</h1>
          <p className="page-subtitle">Lo que envió la plataforma en los últimos 90 días: a quién, con qué asunto y si el servidor de correo lo aceptó. No se guarda el contenido del mensaje.</p>
        </div>
      </div>
      <div className="filters">
        <input className="input" type="search" aria-label="Buscar por destinatario o asunto" placeholder="Destinatario o asunto" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
        <select className="input" aria-label="Filtrar por resultado" value={resultado} onChange={(evento) => setResultado(evento.target.value)}>
          <option value="">Todos los resultados</option>
          {Object.entries(RESULTADO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" disabled={!busqueda && !resultado} onClick={() => { setBusqueda(''); setResultado(''); }}>Limpiar</button>
        <span className="filter-result-count">{data?.length ?? 0} correo{data?.length === 1 ? '' : 's'}</span>
      </div>
      {error ? <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : (
        <DataTable<Envio>
          storageKey="registro-de-correos"
          keyExtractor={(envio) => envio.id}
          data={data ?? []}
          loading={isLoading}
          emptyMessage="Todavía no hay correos anotados. Se anotan desde esta versión en adelante."
          columns={[
            { key: 'createdAt', label: 'Cuándo', sortable: true, render: (envio) => new Date(envio.createdAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' }) },
            { key: 'destinatario', label: 'A quién' },
            { key: 'asunto', label: 'Asunto' },
            { key: 'resultado', label: 'Resultado', render: (envio) => RESULTADO[envio.resultado] ?? envio.resultado },
            { key: 'motivo', label: 'Por qué no salió', render: (envio) => envio.motivo || '—' },
          ]}
        />
      )}
    </div>
  );
}
