import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { triggerToast } from '../../shared/toast-events';
import { ImportarSuscriptores } from './ImportarSuscriptores';
import { Modal } from '../../shared/Modal';

interface Suscriptor {
  id: string;
  clientId?: string | null;
  email: string;
  name?: string | null;
  status: 'pending' | 'subscribed' | 'unsubscribed';
  source: string;
  sourceDetail?: string | null;
  consentAt?: string | null;
  consentText?: string | null;
  consentIp?: string | null;
  adultDeclaredAt?: string | null;
  birthDate?: string | null;
  lastSentAt?: string | null;
  unsubscribedFrom?: string | null;
  unsubscribedAt?: string | null;
  unsubscribedScope?: 'local' | 'todas' | null;
  createdAt: string;
}

interface Respuesta {
  data: Suscriptor[];
  total: number;
  resumen: Array<{ clientId: string | null; suscritos: number; bajas: number; pendientes: number }>;
  /** Las procedencias que existen; el selector no ofrece las que no hay. */
  origenes?: string[];
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
  // Se suscribió por su cuenta, desde el QR o el enlace del local, sin reservar.
  captacion: 'Se suscribió',
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
  const [origen, setOrigen] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ficha, setFicha] = useState<Suscriptor | null>(null);
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
  if (origen) parametros.set('origen', origen);
  if (q) parametros.set('q', q);
  const filtro = parametros.toString();

  const { data, isLoading, error, refetch } = useQuery<Respuesta>({
    queryKey: ['suscriptores', empresa, estado, origen, q],
    queryFn: () => api.get(`/marketing/suscriptores${filtro ? `?${filtro}` : ''}`),
    placeholderData: (anterior) => anterior,
  });

  /*
   * Las procedencias se recuerdan entre consultas.
   *
   * Vienen en la misma respuesta que la lista, así que al filtrar por una el servidor devuelve
   * sólo esa y el selector se quedaría con una única opción: la que acabas de elegir, sin forma
   * de volver. Se conserva el último juego completo, que es el de «de cualquier parte».
   */
  const [origenes, setOrigenes] = useState<string[]>([]);
  useEffect(() => {
    if (!origen && data?.origenes) setOrigenes(data.origenes);
  }, [origen, data?.origenes]);

  /*
   * La descarga sale del servidor ya acotada a quien está suscrito ahora.
   *
   * Nunca la lista que se está viendo: ahí puede haber bajas, y una baja dentro de un archivo que
   * sale del sistema es una dirección a la que se le va a seguir escribiendo sin que el enlace de
   * baja sirva de nada.
   */
  /**
   * @param formato - `csv` para abrir en una planilla; `json` para pasárselo a otro sistema.
   *
   * No hay PDF ni Excel binario. Un PDF de direcciones de correo no se puede pegar en ninguna
   * parte: hay que transcribirlo, y transcribir correos a mano termina en direcciones mal
   * escritas a las que se les escribe igual. El `.xlsx` necesitaría una biblioteca entera en el
   * navegador para producir lo que el CSV ya abre con doble clic en Excel.
   */
  const descargar = async (formato: 'csv' | 'json' = 'csv') => {
    const destino = empresa || (esEmpresa ? user?.clientId ?? 'agencia' : 'agencia');
    const respuesta = await api
      .get<{ empresa: string; total: number; data: Array<Record<string, unknown>> }>(`/marketing/suscriptores/descargar?empresa=${encodeURIComponent(destino)}`)
      .catch(() => null);
    if (!respuesta?.data?.length) { triggerToast('No hay suscritos que descargar.', 'info'); return; }

    const columnas = ['email', 'nombre', 'aceptoEl', 'origen', 'detalle'];
    const nombre = `suscriptores-${nombreDe(empresa || null).replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

    let contenido: string;
    let tipo: string;
    if (formato === 'json') {
      // Sólo las columnas que exporta el CSV, y no la fila entera: lo que el servidor devuelva de
      // más no tiene por qué salir del sistema sin que nadie lo haya decidido.
      contenido = JSON.stringify(respuesta.data.map((fila) => Object.fromEntries(columnas.map((columna) => [columna, fila[columna] ?? null]))), null, 2);
      tipo = 'application/json;charset=utf-8';
    } else {
      const filas = respuesta.data.map((fila) => columnas.map((columna) => `"${String(fila[columna] ?? '').replaceAll('"', '""')}"`).join(','));
      // La marca de orden al principio: sin ella Excel abre los acentos rotos y alguien «corrige»
      // a mano nombres que estaban bien.
      contenido = `﻿${[columnas.join(','), ...filas].join('\n')}`;
      tipo = 'text/csv;charset=utf-8';
    }

    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    enlace.download = `${nombre}.${formato}`;
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
        <div className="page-header-actions">
          {/* Importar es de la agencia: es quien responde por el respaldo de cada dirección. */}
          {!esEmpresa && <ImportarSuscriptores empresas={empresas} />}
          {/*
            * Dos botones y no un desplegable con dos opciones.
            *
            * El CSV es lo que busca casi todo el mundo —se abre con doble clic en Excel— y
            * esconderlo tras un menú le agrega un paso a lo habitual para acomodar lo raro.
            */}
          <button type="button" className="btn btn-outline" onClick={() => void descargar('csv')}>Descargar los suscritos</button>
          <button type="button" className="btn btn-outline btn-sm" title="Para pasárselo a otro sistema" onClick={() => void descargar('json')}>JSON</button>
        </div>
      </div>

      {/*
        Qué puedes hacer desde donde estás, dicho antes de que lo descubras a tropezones.
        Lo que se puede sacar de esta pantalla cambia mucho según quién mire y qué empresa esté
        elegida, y eso no se veía en ninguna parte: había que probar los botones. Se dice en una
        línea, arriba, y cambia con el filtro.
      */}
      <p className="alcance-aviso">
        {esEmpresa ? <>
          <strong>Estás viendo tu lista.</strong> Son quienes aceptaron recibir correo <strong>de tu
          local</strong>. Puedes descargarlos para escribirles por tu cuenta; enviar desde aquí lo
          hace la agencia, porque quien aprieta el botón responde de que cada dirección tenga
          respaldo.
        </> : empresa === 'agencia' ? <>
          <strong>Lista de la agencia.</strong> Son quienes aceptaron recibir de <strong>toda la
          red</strong> —la casilla «beneficios de los demás locales»—, no la suma de las listas de
          cada empresa. Es la única con permiso para hablar en nombre de Espartanos.
        </> : empresa ? <>
          <strong>Lista de una empresa.</strong> Su permiso vale sólo para ella: no se puede usar
          para escribirle en nombre de otro local ni de la red. Para eso está la lista de la
          agencia.
        </> : <>
          <strong>Estás viendo todas las listas juntas.</strong> Sirve para buscar a una persona y
          ver dónde está. Para escribir hay que elegir una empresa: <strong>no existe mandar a
          todas de una vez</strong>, porque quien aceptó en un local no se lo dio a los demás.
        </>}
      </p>

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
        {/* Sólo las procedencias que existen: las trae el servidor con la misma consulta. */}
        {origenes.length > 0 && (
          <select className="input" aria-label="Filtrar por procedencia" value={origen} onChange={(evento) => setOrigen(evento.target.value)}>
            <option value="">De cualquier parte</option>
            {origenes.map((valor) => <option key={valor} value={valor}>{ORIGEN[valor] ?? valor}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-outline btn-sm" disabled={!busqueda && !empresa && !origen && estado === 'subscribed'} onClick={() => { setBusqueda(''); setEmpresa(esEmpresa ? (user?.clientId ?? '') : ''); setEstado('subscribed'); setOrigen(''); }}>Limpiar</button>
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
            {
              key: 'id',
              label: 'Prueba',
              render: (fila) => <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFicha(fila)}>Ver ficha</button>,
            },
          ]}
        />
      )}

      {ficha && <FichaDelSuscriptor suscriptor={ficha} empresa={nombreDe(ficha.clientId)} onCerrar={() => setFicha(null)} />}

      {!esEmpresa && <ConsultarExclusion />}
    </div>
  );
}

/**
 * Todo lo que respalda una dirección, en un sitio.
 *
 * La tabla contesta «quién está en la lista»; esto contesta «y con qué derecho». Se guardaba todo
 * —el texto exacto que leyó, la dirección desde la que aceptó, si declaró ser mayor de edad— y no
 * se mostraba en ninguna parte, así que el día que alguien reclamara la prueba estaba en la base
 * de datos y fuera de alcance de quien tiene que responder.
 *
 * El texto va entero y sin resumir: lo que hay que poder mostrar es exactamente lo que se leyó.
 */
function FichaDelSuscriptor({ suscriptor, empresa, onCerrar }: {
  suscriptor: Suscriptor;
  empresa: string;
  onCerrar: () => void;
}) {
  const fecha = (valor?: string | null) => (valor ? new Date(valor).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  return (
    <Modal open onClose={onCerrar} title={suscriptor.email}>
      <dl className="ficha-suscriptor">
        <div><dt>Empresa</dt><dd>{empresa}</dd></div>
        <div><dt>Nombre</dt><dd>{suscriptor.name || '—'}</dd></div>
        <div><dt>Estado</dt><dd>{ESTADO[suscriptor.status] ?? suscriptor.status}</dd></div>
        <div><dt>De dónde salió</dt><dd>{ORIGEN[suscriptor.source] ?? suscriptor.source}{suscriptor.sourceDetail ? ` · ${suscriptor.sourceDetail}` : ''}</dd></div>
        <div><dt>Dijo que sí</dt><dd>{fecha(suscriptor.consentAt)}</dd></div>
        {/* La IP convierte «dijo que sí» en algo comprobable. Vacía en las importaciones, donde el
            respaldo es el archivo declarado y no una petición. */}
        <div><dt>Desde qué dirección</dt><dd>{suscriptor.consentIp || 'No consta (no vino por web)'}</dd></div>
        <div><dt>Declaró ser mayor de edad</dt><dd>{fecha(suscriptor.adultDeclaredAt)}</dd></div>
        <div><dt>Fecha de nacimiento declarada</dt><dd>{suscriptor.birthDate ? new Date(suscriptor.birthDate).toLocaleDateString('es-CL') : '—'}</dd></div>
        <div><dt>Último correo enviado</dt><dd>{fecha(suscriptor.lastSentAt)}</dd></div>
        {suscriptor.unsubscribedAt && <div>
          <dt>Se dio de baja</dt>
          <dd>
            {fecha(suscriptor.unsubscribedAt)}
            {suscriptor.unsubscribedScope === 'todas' ? ' · de todos los locales' : ' · sólo de esta empresa'}
            {suscriptor.unsubscribedFrom ? ` · desde el correo «${suscriptor.unsubscribedFrom}»` : ''}
          </dd>
        </div>}
      </dl>

      <div className="ficha-suscriptor-texto">
        <strong>El texto que aceptó</strong>
        {suscriptor.consentText
          ? <p>{suscriptor.consentText}</p>
          : <p className="form-hint">
              No consta ningún texto. Pasa con las direcciones importadas sin declarar qué aceptaron:
              esa dirección no se puede defender ante «¿de dónde sacaron mi correo?», y por eso queda
              en «pendiente» y no recibe campañas.
            </p>}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}

/**
 * Preguntar si a una dirección se le prohibió escribir.
 *
 * La lista de exclusión guarda huellas y no correos, para poder cumplir la prohibición del
 * artículo 28 B sin conservar la dirección de quien pidió que la borraran. Eso la hace imposible
 * de listar —y está bien— pero también la hacía imposible de consultar, y la pregunta que llega por
 * teléfono es siempre la misma: «sigo recibiendo correos, ¿qué dice el sistema de mí?».
 */
function ConsultarExclusion() {
  const [correo, setCorreo] = useState('');
  const [preguntado, setPreguntado] = useState('');

  const { data, isFetching } = useQuery<{
    total: number;
    deTodas: number;
    consulta: { alcance: 'local' | 'todas' | null; empresas: Array<{ clientId: string | null; alcance: string; origen: string | null; cuando: string }> } | null;
  }>({
    queryKey: ['exclusiones', preguntado],
    queryFn: () => api.get(`/marketing/suscriptores/exclusiones${preguntado ? `?correo=${encodeURIComponent(preguntado)}` : ''}`),
  });

  return (
    <section className="exclusiones">
      <div className="exclusiones-intro">
        <span className="page-eyebrow">PIDIERON NO RECIBIR MÁS</span>
        <p>
          Hay <strong>{data?.total ?? 0}</strong> peticiones anotadas
          {data?.deTodas ? <> · <strong>{data.deTodas}</strong> de todos los locales</> : null}.
          No se pueden listar: se guarda una huella y no el correo, para poder cumplir la petición
          sin quedarse con la dirección de quien pidió que la borráramos. Sí se puede preguntar por
          una dirección concreta.
        </p>
      </div>
      <form
        className="filters"
        onSubmit={(evento) => { evento.preventDefault(); setPreguntado(correo.trim().toLowerCase()); }}
      >
        <input
          className="input"
          type="email"
          aria-label="Correo a consultar"
          placeholder="correo@ejemplo.cl"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
        />
        <button type="submit" className="btn btn-outline btn-sm" disabled={!correo.includes('@') || isFetching}>
          {isFetching ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      <AnotarPeticionExterna />

      {preguntado && data?.consulta && (data.consulta.alcance === null
        ? <p className="exclusiones-respuesta">
            <strong>No consta</strong> ninguna petición de esta dirección. Si dice que sigue
            recibiendo correos, búscala arriba en la lista: puede estar suscrita y no haber pedido
            la baja nunca.
          </p>
        : <div className="exclusiones-respuesta">
            <strong>{data.consulta.alcance === 'todas' ? 'Pidió no recibir de ningún local.' : 'Pidió no recibir de una empresa.'}</strong>
            <ul>
              {data.consulta.empresas.map((fila) => (
                <li key={`${fila.clientId ?? 'todas'}-${fila.cuando}`}>
                  {fila.clientId ? 'Una empresa en concreto' : 'Todos los locales'}
                  {' · '}{new Date(fila.cuando).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                  {fila.origen ? ` · desde el correo «${fila.origen}»` : ''}
                </li>
              ))}
            </ul>
          </div>)}
    </section>
  );
}

/**
 * Anotar una petición de baja que llegó por fuera del enlace del correo.
 *
 * El caso que la hizo falta es el del SERNAC. En su sistema «No Molestar» el consumidor registra la
 * empresa y los canales, y el envío **queda prohibido desde ese registro** —Decreto 62 de 2019,
 * art. 5—; el aviso por correo llega el día hábil siguiente. No hay plazo de gracia que correr.
 *
 * Por eso se puede anotar una fecha anterior a hoy: la que decide si un envío fue lícito es la de
 * la petición, y cuando se pidió por dos vías rige la primera.
 *
 * Funciona aunque la dirección no esté en ninguna lista, y es a propósito: la petición vale igual
 * y evita que entre después por una reserva.
 */
function AnotarPeticionExterna() {
  const clienteDeConsultas = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState('');
  const [origen, setOrigen] = useState('');
  const [fecha, setFecha] = useState('');

  const anotar = useMutation<{ fichasDeBaja: number; email: string }>({
    mutationFn: () => api.post('/marketing/suscriptores/exclusiones', { email: correo.trim(), alcance: 'todas', origen: origen.trim(), fecha: fecha || undefined }),
    onSuccess: (resultado) => {
      triggerToast(
        resultado.fichasDeBaja > 0
          ? `Anotado. ${resultado.fichasDeBaja} ficha(s) de baja; no recibirá más correos comerciales.`
          : 'Anotado. No estaba en ninguna lista, y con esto tampoco va a entrar por una reserva.',
        'success',
      );
      setCorreo(''); setOrigen(''); setFecha(''); setAbierto(false);
      void clienteDeConsultas.invalidateQueries({ queryKey: ['exclusiones'] });
      void clienteDeConsultas.invalidateQueries({ queryKey: ['suscriptores'] });
    },
  });

  if (!abierto) {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAbierto(true)}>
        Anotar una petición recibida por fuera
      </button>
    );
  }

  return (
    <form
      className="exclusiones-anotar"
      onSubmit={(evento) => { evento.preventDefault(); anotar.mutate(); }}
    >
      <p className="form-hint">
        Para un aviso del SERNAC («No Molestar»), una llamada o un correo a soporte. Anótalo en
        cuanto llegue: el envío queda prohibido <strong>desde que la persona lo pidió</strong>, no
        desde que nos enteramos, y no hay plazo de gracia. Se aplica a todos los locales, que es lo
        que pide quien lo pide por estas vías.
      </p>
      <label>
        Correo
        <input className="input" type="email" required value={correo} onChange={(evento) => setCorreo(evento.target.value)} placeholder="correo@ejemplo.cl" />
      </label>
      <label>
        De dónde vino <span className="required-star">*</span>
        <input className="input" required maxLength={120} value={origen} onChange={(evento) => setOrigen(evento.target.value)} placeholder="Aviso SERNAC 12-03-2026" />
      </label>
      {/* El origen es lo único que explica por qué esta dirección quedó excluida sin que nadie
          hiciera clic en ningún enlace. Un campo vacío no es una respuesta ante un reclamo. */}
      <p className="form-hint">Queda guardado tal como lo escribas: es lo que se muestra si alguien pregunta por qué.</p>
      <label>
        Cuándo lo pidió (si no fue hoy)
        <input
          className="input"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
        />
      </label>
      {/* La fecha que decide si un correo nuestro fue lícito es la de la petición, no la de hoy: un
          aviso del SERNAC sale el día hábil siguiente a la solicitud, y si además lo pidió por
          teléfono rige la primera de las dos. En blanco se toma hoy, que es el caso normal. */}
      <p className="form-hint">
        La que trae el aviso, o el día de la llamada. En blanco se toma hoy.
      </p>
      {anotar.isError && <p className="error-text">{(anotar.error as Error)?.message || 'No se pudo anotar.'}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!correo.includes('@') || !origen.trim() || anotar.isPending}>
          {anotar.isPending ? 'Anotando…' : 'Anotar la petición'}
        </button>
      </div>
    </form>
  );
}
