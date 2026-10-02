import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';

interface Campana {
  id: string;
  clientId?: string | null;
  asunto: string;
  cuerpo: string;
  cupon?: string | null;
  cuponVence?: string | null;
  destino?: 'lista' | 'administradores';
  estado: 'draft' | 'sending' | 'sent';
  destinatarios: number;
  enviados: number;
  sentAt?: string | null;
  createdAt: string;
}

/** Lo que el servidor contesta al preguntar a cuántos llegaría: la cifra y a quiénes son. */
interface DestinatariosResumen {
  total: number;
  muestra: Array<{ email: string; nombre: string | null }>;
  deQuienes: string;
}

const ESTADO: Record<Campana['estado'], string> = {
  draft: 'Borrador',
  sending: 'Enviando',
  sent: 'Enviada',
};

/**
 * Escribir a la lista.
 *
 * La pantalla está construida alrededor de la única pregunta que importa antes de apretar el
 * botón: a cuántas personas les va a llegar esto. El número se pide al servidor con la misma
 * consulta que arma los destinatarios, para que lo que se ve y lo que sale sean lo mismo, y el
 * envío se confirma aparte escribiendo la cifra de nuevo: un correo enviado no vuelve.
 */
export function CampanasPage() {
  const [editando, setEditando] = useState<Campana | 'nueva' | null>(null);
  const [porEnviar, setPorEnviar] = useState<Campana | null>(null);
  const clienteDeConsultas = useQueryClient();

  const { data: empresasResp } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  const nombreDe = (id: string | null | undefined) =>
    id ? empresasResp?.data?.find((c) => c.id === id)?.name ?? 'Empresa no disponible' : 'Espartanos (agencia)';

  const { data, isLoading, error, refetch } = useQuery<Campana[]>({
    queryKey: ['campanas'],
    queryFn: () => api.get('/marketing/campanas'),
  });

  const refrescar = () => void clienteDeConsultas.invalidateQueries({ queryKey: ['campanas'] });

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/campanas/${id}`),
    onSuccess: () => { refrescar(); triggerToast('Borrador descartado.', 'info'); },
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">MARKETING</span>
          <h1>Campañas</h1>
          <p className="page-subtitle">
            Un correo escrito a mano para quienes aceptaron recibirlo. Cada envío lleva su enlace de
            baja, y quien se dio de baja no aparece en ninguna lista.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditando('nueva')}>Escribir una campaña</button>
      </div>

      {/*
        A quién se le puede escribir desde aquí, dicho antes de abrir el editor.
        Es la primera pregunta de quien entra, y la respuesta estaba repartida entre tres avisos
        dentro del formulario. Dicha arriba evita escribir una campaña entera para descubrir al
        confirmar que iba a la lista equivocada.
      */}
      <p className="alcance-aviso">
        <strong>Cada campaña va a una sola lista.</strong> La de un local llega a quienes aceptaron
        recibir <strong>de ese local</strong>; la de <strong>Espartanos (agencia)</strong>, a
        quienes aceptaron recibir de toda la red. No existe «todas las listas»: el permiso que
        alguien le dio a un local no vale para otro. Para escribirle a direcciones que no están,
        impórtalas antes en <strong>Suscriptores</strong> declarando de dónde salieron.
      </p>

      {error ? <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : (
        <DataTable<Campana>
          storageKey="campanas"
          keyExtractor={(fila) => fila.id}
          data={data ?? []}
          loading={isLoading}
          emptyMessage="Ninguna por ahora. Escribe una y verás a cuántas personas llegaría antes de enviarla."
          columns={[
            { key: 'asunto', label: 'Asunto' },
            {
              key: 'clientId',
              label: 'A quién',
              // La empresa y el grupo, en dos líneas: la empresa sola no dice si fue a su lista de
              // clientes o a quienes la administran, que son dos correos muy distintos.
              render: (fila) => <span className="campana-destino">
                <strong>{nombreDe(fila.clientId)}</strong>
                <small>{fila.destino === 'administradores' ? 'Quienes administran' : 'Lista de marketing'}</small>
              </span>,
            },
            {
              key: 'cupon',
              label: 'Cupón',
              render: (fila) => (fila.cupon ? <code>{fila.cupon}</code> : '—'),
            },
            { key: 'estado', label: 'Estado', render: (fila) => ESTADO[fila.estado] ?? fila.estado },
            {
              key: 'enviados',
              label: 'Llegó a',
              render: (fila) => {
                if (fila.estado === 'sent') return `${fila.enviados} de ${fila.destinatarios}`;
                if (fila.estado === 'sending') return <AvanceDelEnvio campanaId={fila.id} total={fila.destinatarios} />;
                return '—';
              },
            },
            {
              key: 'sentAt',
              label: 'Cuándo',
              sortable: true,
              render: (fila) => (fila.sentAt ? new Date(fila.sentAt).toLocaleDateString('es-CL') : '—'),
            },
            {
              key: 'id',
              label: 'Acciones',
              render: (fila) => (fila.estado === 'draft' ? <div className="tabla-acciones">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(fila)}>Editar</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setPorEnviar(fila)}>Enviar</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => borrar.mutate(fila.id)}>Descartar</button>
              </div> : fila.estado === 'sending'
                ? <span className="tabla-nota">Saliendo: el cron la despacha por tandas</span>
                : <span className="tabla-nota">Enviada: su texto es la constancia</span>),
            },
          ]}
        />
      )}

      {editando && (
        <EditorDeCampana
          campana={editando === 'nueva' ? null : editando}
          empresas={empresasResp?.data ?? []}
          onCerrar={() => setEditando(null)}
          onGuardada={() => { setEditando(null); refrescar(); }}
        />
      )}

      {porEnviar && (
        <ConfirmarEnvio
          campana={porEnviar}
          nombreDeLista={nombreDe(porEnviar.clientId)}
          onCerrar={() => setPorEnviar(null)}
          onEnviada={() => { setPorEnviar(null); refrescar(); }}
        />
      )}
    </div>
  );
}

/** Escribir o corregir. Sólo mientras es borrador: el servidor rechaza lo demás. */
function EditorDeCampana({ campana, empresas, onCerrar, onGuardada }: {
  campana: Campana | null;
  empresas: Array<{ id: string; name: string }>;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const [asunto, setAsunto] = useState(campana?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(campana?.cuerpo ?? '');
  const [empresa, setEmpresa] = useState(campana?.clientId ?? '');
  const [cupon, setCupon] = useState(campana?.cupon ?? '');
  const [destino, setDestino] = useState<'lista' | 'administradores'>(campana?.destino ?? 'lista');

  const guardar = useMutation({
    mutationFn: () => (campana
      ? api.patch(`/marketing/campanas/${campana.id}`, { asunto, cuerpo, cupon: cupon.trim() || null, destino })
      : api.post('/marketing/campanas', {
        asunto, cuerpo, clientId: empresa || null, cupon: cupon.trim() || null, destino,
      })),
    onSuccess: onGuardada,
  });

  /*
   * A cuántos, y a quiénes, mientras se escribe.
   *
   * Se pide con el destino y la empresa que están elegidos en el formulario, no con los de la
   * campaña guardada: la pregunta es sobre lo que se va a mandar. Un cupón mal escrito lo rechaza
   * el servidor al guardar, pero el número de destinatarios conviene verlo antes, porque es lo que
   * hace pensárselo dos veces.
   */
  const { data: aQuienes } = useQuery<DestinatariosResumen>({
    queryKey: ['campana-destinatarios', (campana?.clientId ?? empresa) || 'agencia', destino],
    queryFn: () => api.get(
      `/marketing/campanas/destinatarios?empresa=${encodeURIComponent((campana?.clientId ?? empresa) || 'agencia')}&destino=${destino}`,
    ),
  });

  /*
   * Ver el correo compuesto antes de mandarlo.
   *
   * Lo compone el servidor con la misma función que el envío, así que lo que se ve es lo que
   * sale, con el pie de baja incluido. Es el único momento en que se puede corregir: enviado no
   * se deshace, y el texto de una campaña enviada ya no se toca.
   */
  const vistaPrevia = useMutation<{ subject: string; html: string }>({
    mutationFn: () => api.post('/marketing/campanas/vista-previa', { asunto, cuerpo }),
  });

  return (
    <Modal open onClose={onCerrar} title={campana ? 'Corregir la campaña' : 'Escribir una campaña'}>
      <form className="form-grid" onSubmit={(evento) => { evento.preventDefault(); guardar.mutate(); }}>
        {!campana && (
          <label>
            A qué lista
            <select className="input" value={empresa} onChange={(evento) => setEmpresa(evento.target.value)}>
              <option value="">Espartanos (agencia)</option>
              {empresas.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.name}</option>)}
            </select>
          </label>
        )}
        {campana && <p className="form-hint">La lista no se cambia después de escrita: el texto está pensado para ésa.</p>}

        <label>
          A quiénes de esa empresa
          <select className="input" value={destino} onChange={(evento) => setDestino(evento.target.value as 'lista' | 'administradores')}>
            <option value="lista">Su lista de marketing (quienes aceptaron recibir promociones)</option>
            <option value="administradores">Quienes administran la empresa (aviso de servicio)</option>
          </select>
        </label>
        <p className="form-hint">
          {destino === 'administradores'
            ? 'Va a las cuentas activas que administran la empresa. Es aviso de servicio a quien contrató, así que no lleva enlace de baja: nadie se da de baja de que le cuenten cómo va lo que paga. Si lo que vas a mandar es publicidad, éste no es el destino.'
            : 'Va a quienes aceptaron recibir promociones de esta empresa, y sólo de ésta. No hay «todas las listas» a propósito: el permiso que alguien le dio a un local no vale para otro.'}
        </p>

        {aQuienes && <p className="envio-cifra">
          Ahora mismo llegaría a <strong>{aQuienes.total}</strong> {aQuienes.total === 1 ? 'persona' : 'personas'}
          {' · '}<span>{aQuienes.deQuienes}</span>
          {aQuienes.muestra.length > 0 && <small>
            {' '}Por ejemplo: {aQuienes.muestra.map((fila) => fila.nombre || fila.email).join(', ')}…
          </small>}
        </p>}

        <label>
          Asunto <span className="required-star">*</span>
          <input className="input" required maxLength={200} value={asunto} onChange={(evento) => setAsunto(evento.target.value)} />
        </label>
        <label>
          Texto <span className="required-star">*</span>
          <textarea className="input" required rows={10} value={cuerpo} onChange={(evento) => setCuerpo(evento.target.value)} />
        </label>
        <p className="form-hint">
          Escribe <code>{'{{nombre}}'}</code> donde quieras el nombre de quien lo recibe. A quien no lo
          tenga guardado se le manda igual, sin el hueco. El enlace para darse de baja lo pone el
          sistema en el pie: no hace falta escribirlo, y no se puede quitar.
        </p>

        <label>
          Cupón (opcional)
          <input
            className="input"
            maxLength={40}
            value={cupon}
            placeholder="Por ejemplo, VUELVE20"
            onChange={(evento) => setCupon(evento.target.value.toUpperCase())}
          />
        </label>
        <p className="form-hint">
          El código tiene que existir ya en Cupones, ser de esta misma empresa, estar activo y no
          haber vencido; si no, al guardar se te dice qué pasa. Sale en su propia fila del correo
          junto a la fecha hasta la que vale, para que se vea y se pueda copiar desde el teléfono.
          También puedes nombrarlo dentro del texto con <code>{'{{cupon}}'}</code>.
        </p>

        {vistaPrevia.data && <div className="campana-vista-previa">
          <p><span>Asunto</span><strong>{vistaPrevia.data.subject}</strong></p>
          <iframe title="Vista previa de la campaña" srcDoc={vistaPrevia.data.html} sandbox="" />
          <small>
            El nombre va con un dato de ejemplo; el correo real usa el de cada persona. El enlace
            de baja del pie es de muestra y no lleva a ninguna parte: el que sale es el de cada uno.
          </small>
        </div>}

        {/* El mensaje del servidor y no uno genérico: cuando el problema es el cupón, dice cuál. */}
        {guardar.isError && <p className="error-text">
          {(guardar.error as Error)?.message || 'No se pudo guardar. Revisa el asunto y el texto.'}
        </p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={!asunto.trim() || !cuerpo.trim() || vistaPrevia.isPending}
            onClick={() => vistaPrevia.mutate()}
          >
            {vistaPrevia.isPending ? 'Componiendo…' : 'Ver cómo queda'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!asunto.trim() || !cuerpo.trim() || guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * La confirmación del envío.
 *
 * Pide escribir el número de destinatarios a mano. Es deliberadamente incómodo: un envío no se
 * deshace, y el paso obliga a mirar la cifra en vez de confirmar por reflejo. El número lo da el
 * servidor con la misma consulta que arma los destinatarios, así que si cambió entre que se abrió
 * la pantalla y el envío, lo que se escribe ya no cuadra y hay que volver a mirar.
 */
function ConfirmarEnvio({ campana, nombreDeLista, onCerrar, onEnviada }: {
  campana: Campana;
  nombreDeLista: string;
  onCerrar: () => void;
  onEnviada: () => void;
}) {
  const [escrito, setEscrito] = useState('');

  const destino = campana.destino ?? 'lista';
  const { data: cuenta, isLoading } = useQuery<DestinatariosResumen>({
    queryKey: ['campana-destinatarios', campana.clientId ?? 'agencia', destino],
    queryFn: () => api.get(
      `/marketing/campanas/destinatarios?empresa=${encodeURIComponent(campana.clientId ?? 'agencia')}&destino=${destino}`,
    ),
  });

  const enviar = useMutation<{ destinatarios: number; enCola?: boolean }>({
    mutationFn: () => api.post(`/marketing/campanas/${campana.id}/enviar`, {}),
    onSuccess: (resultado) => {
      // Encolada, no enviada: decir «enviada» aquí sería mentir durante los minutos que tarda.
      triggerToast(
        `En cola para ${resultado.destinatarios} personas. Los correos salen en los próximos minutos; verás el avance en la lista.`,
        'success',
      );
      onEnviada();
    },
  });

  const total = cuenta?.total ?? 0;
  const cuadra = escrito.trim() === String(total) && total > 0;

  return (
    <Modal open onClose={onCerrar} title="Enviar la campaña">
      <div className="form-grid">
        <p className="envio-resumen">
          <strong>{campana.asunto}</strong>
          <span>{nombreDeLista}</span>
          <span>{cuenta?.deQuienes ?? (destino === 'administradores' ? 'Quienes administran cada empresa' : 'La lista de esta empresa')}</span>
          {campana.cupon && <span>Con el cupón <code>{campana.cupon}</code>{campana.cuponVence
            ? ` · válido hasta el ${new Date(campana.cuponVence).toLocaleDateString('es-CL')}`
            : ''}</span>}
        </p>

        {isLoading ? <p>Contando destinatarios…</p> : (
          <p className="envio-cifra">
            Le llegará a <strong>{total}</strong> {total === 1 ? 'persona' : 'personas'}.
          </p>
        )}

        {/* Unos nombres, no la lista entera: sirven para reconocerla, que es de lo que se trata. */}
        {(cuenta?.muestra?.length ?? 0) > 0 && <ul className="envio-muestra">
          {cuenta!.muestra.map((fila) => (
            <li key={fila.email}>{fila.nombre ? `${fila.nombre} · ${fila.email}` : fila.email}</li>
          ))}
          {total > cuenta!.muestra.length && <li className="tabla-nota">y {total - cuenta!.muestra.length} más</li>}
        </ul>}

        {total === 0 ? (
          <p className="form-hint">
            {destino === 'administradores'
              ? 'No hay cuentas activas que administren esta empresa.'
              : 'No hay nadie suscrito en esta lista ahora mismo. Los que están en «pendiente» o se dieron de baja no cuentan.'}
          </p>
        ) : (
          <label>
            Escribe {total} para confirmar
            <input className="input" inputMode="numeric" value={escrito} onChange={(evento) => setEscrito(evento.target.value)} placeholder={String(total)} />
          </label>
        )}

        <p className="form-hint">
          Un correo enviado no se puede recuperar. {destino === 'administradores'
            ? 'Éste no lleva enlace de baja: es aviso de servicio a quien contrató. Si lo que mandas es publicidad, cámbialo a la lista de marketing antes de enviar.'
            : 'Cada uno llevará su enlace de baja. Los correos salen por tandas en los próximos minutos, no de golpe: quien se dé de baja mientras tanto ya no recibe el suyo.'}
        </p>

        {enviar.isError && <p className="error-text">No se pudo enviar. Vuelve a mirar la campaña antes de reintentar.</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!cuadra || enviar.isPending} onClick={() => enviar.mutate()}>
            {enviar.isPending ? 'Poniendo en cola…' : `Enviar a ${total}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * El avance de una campaña que está saliendo.
 *
 * Se refresca sola cada diez segundos mientras dura. El cron despacha cada cinco minutos, así que
 * preguntar más seguido no adelanta nada; se consulta a este ritmo para que el número se mueva
 * poco después de cada pasada y no parezca que la pantalla se quedó colgada.
 */
function AvanceDelEnvio({ campanaId, total }: { campanaId: string; total: number }) {
  const { data } = useQuery<{ enviados: number; pendientes: number; fallidos: number }>({
    queryKey: ['campana-avance', campanaId],
    queryFn: () => api.get(`/marketing/campanas/${campanaId}/avance`),
    refetchInterval: 10_000,
  });

  if (!data) return <span className="tabla-nota">Contando…</span>;
  return <span className="campana-avance">
    <strong>{data.enviados}</strong> de {total}
    {data.fallidos > 0 && <small> · {data.fallidos} sin entregar</small>}
  </span>;
}
