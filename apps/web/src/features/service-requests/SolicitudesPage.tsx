import { useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { PageHero } from '../../shared/PageHero';
import { EmptyState } from '../../shared/EmptyState';
import { triggerToast } from '../../shared/toast-events';

const REQUEST_TYPES: Array<{ value: string; label: string; sensitive?: boolean }> = [
  { value: 'account', label: 'Crear cuenta o acceso a la plataforma' },
  { value: 'company', label: 'Alta de empresa o cliente' },
  { value: 'rectification', label: 'Rectificación o actualización de mis datos', sensitive: true },
  { value: 'anonymization', label: 'Anonimización o supresión de mis datos', sensitive: true },
  { value: 'portability', label: 'Portabilidad / exportación de mis datos', sensitive: true },
  { value: 'removal', label: 'Baja o desvinculación', sensitive: true },
  { value: 'support', label: 'Soporte o incidencia' },
];

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibida',
  in_review: 'En revisión',
  resolved: 'Resuelta',
  rejected: 'Rechazada',
  more_info: 'Se requiere más información',
};

interface HistoryRow {
  id: string;
  type: string;
  status: string;
  message?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export function SolicitudesPage(): JSX.Element {
  const [tab, setTab] = useState<'create' | 'status'>('create');
  const [type, setType] = useState('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);

  /**
   * Aviso de privacidad vigente. Llega del servidor y no se escribe en esta página: el texto
   * es un documento con versión, y la solicitud registra cuál aceptó cada persona.
   */
  const [aviso, setAviso] = useState<{ title: string; text: string; version: number; provisional: boolean } | null>(null);

  /** Código de seguimiento devuelto al enviar. Es lo único con que se consulta después. */
  const [tracking, setTracking] = useState('');
  const [queryRef, setQueryRef] = useState('');
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [queryError, setQueryError] = useState('');
  const [searching, setSearching] = useState(false);

  const selectedType = REQUEST_TYPES.find((t) => t.value === type);
  const requiresRut = Boolean(selectedType?.sensitive);

  useEffect(() => {
    let vigente = true;
    api.get<{ title: string; text: string; version: number; provisional: boolean }>('/service-requests/privacy')
      .then((data) => { if (vigente) setAviso(data); })
      .catch(() => { if (vigente) setAviso(null); });
    return () => { vigente = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (website) return;
    setSending(true);
    try {
      const respuesta = await api.post<{ id: string }>('/service-requests', { type, requesterName: name, requesterEmail: email, requesterRut: requiresRut ? rut : rut || undefined, requesterPhone: phone || undefined, message: message || undefined, privacyAccepted, website });
      setTracking(respuesta?.id ?? '');
      setCreated(true);
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.', 'error');
    } finally {
      setSending(false);
    }
  };

  const consult = async (event: React.FormEvent) => {
    event.preventDefault();
    setQueryError('');
    if (!queryRef.trim()) {
      setQueryError('Ingresa el código de seguimiento que recibiste al enviar tu solicitud');
      return;
    }
    setSearching(true);
    try {
      const rows = await api.get<HistoryRow[]>(`/service-requests/status?ref=${encodeURIComponent(queryRef.trim())}`);
      setHistory(rows);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'No encontramos una solicitud con ese código.');
      setHistory(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="page solicitudes-page">
      <PageHero
        eyebrow="ATENCIÓN"
        title="Solicitudes"
        subtitle="Envía una solicitud a la administración o consulta el estado de las que ya enviaste. Tus datos se tratan según la normativa vigente de protección de datos."
        actions={<Link className="btn btn-outline" to="/login">Volver al inicio de sesión</Link>}
      />

      <nav className="solicitudes-tabs" role="group" aria-label="Secciones de solicitudes">
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>Nueva solicitud</button>
        <button className={tab === 'status' ? 'active' : ''} onClick={() => setTab('status')}>Consultar estado</button>
      </nav>

      {tab === 'create' && (
        <div className="solicitudes-card">
          {created ? (
            /*
             * El código es la única forma de consultar después, así que se muestra grande, se
             * puede copiar de un clic y se advierte que hay que guardarlo. Si el titular cierra
             * esta pantalla sin anotarlo, pierde el seguimiento de su propia solicitud.
             */
            <div className="solicitud-enviada">
              <EmptyState icon="check" title="Solicitud enviada" description="Guarda este código: es lo único con lo que podrás consultar el estado de tu solicitud." />
              <div className="tracking-code">
                <span className="tracking-label">Código de seguimiento</span>
                <code>{tracking}</code>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => { navigator.clipboard?.writeText(tracking); triggerToast('Código copiado', 'success'); }}
                >
                  Copiar código
                </button>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" type="button" onClick={() => { setQueryRef(tracking); setTab('status'); }}>Consultar su estado</button>
                <button className="btn btn-primary" type="button" onClick={() => { setCreated(false); setTracking(''); setType('account'); setName(''); setEmail(''); setRut(''); setPhone(''); setMessage(''); }}>Enviar otra solicitud</button>
              </div>
            </div>
          ) : (
            <form className="modal-form" onSubmit={submit}>
              <p className="page-subtitle">Indica el tipo de solicitud y tus datos de contacto. Para rectificación, anonimización, portabilidad o baja es obligatorio el RUT.</p>
              <label>Tipo de solicitud<select className="input" value={type} onChange={(event) => setType(event.target.value)}>{REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
              <label>Nombre completo<input className="input" required minLength={2} maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <div className="form-row">
                <label>Correo<input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label>RUT{requiresRut ? ' *' : ' (opcional)'}<input className="input" required={requiresRut} value={rut} onChange={(event) => setRut(event.target.value)} placeholder="12.345.678-9" /></label>
              </div>
              <label>Teléfono (opcional)<input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <label>Detalle de la solicitud<textarea className="input" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Cuéntanos qué necesitas…" /></label>
              <input className="input honeypot" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} aria-hidden="true" />
              <div className="privacy-block">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPrivacyOpen((open) => !open); setPrivacyRead(true); }}>{privacyOpen ? 'Ocultar aviso de privacidad' : 'Leer aviso de privacidad'}</button>
                {privacyOpen && (
                  <div className="privacy-notice">
                    <p><strong>{aviso?.title ?? 'Tratamiento de datos personales'}</strong></p>
                    {aviso
                      ? <p className="privacy-text">{aviso.text}</p>
                      : <p>No fue posible cargar el aviso de privacidad. Vuelve a intentarlo antes de enviar tu solicitud.</p>}
                    {aviso && !aviso.provisional && <small className="privacy-version">Versión {aviso.version}</small>}
                    {aviso?.provisional && (
                      <small className="privacy-version is-provisional">
                        Texto provisional. La agencia aún no publica su aviso definitivo.
                      </small>
                    )}
                  </div>
                )}
                <label className={`toggle-row privacy-check ${privacyRead ? '' : 'is-locked'}`}><input type="checkbox" checked={privacyAccepted} disabled={!privacyRead} onChange={(event) => setPrivacyAccepted(event.target.checked)} /> He leído y acepto el aviso de privacidad y el tratamiento de mis datos para esta solicitud</label>
                {!privacyRead && <small className="privacy-hint">Abre el aviso de privacidad para poder aceptarlo.</small>}
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" type="button" onClick={() => setTab('status')}>Consultar estado de una solicitud</button>
                <button className="btn btn-primary" type="submit" disabled={sending || !privacyAccepted}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'status' && (
        <div className="solicitudes-card">
          <form className="modal-form" onSubmit={consult}>
            <p className="page-subtitle">Ingresa el <strong>código de seguimiento</strong> que recibiste al enviar tu solicitud para ver su estado y resolución.</p>
            <div className="form-row">
              <label>Código de seguimiento<input className="input" value={queryRef} onChange={(event) => setQueryRef(event.target.value)} placeholder="0000aaaa-0000-0000-0000-000000000000" autoComplete="off" /></label>
            </div>
            {queryError && <div className="alert alert-error" role="alert">{queryError}</div>}
            <div className="modal-actions"><button className="btn btn-primary" type="submit" disabled={searching}>{searching ? 'Consultando…' : 'Consultar estado'}</button></div>
          </form>
          <div className="solicitudes-crosslink"><span>¿Aún no envías tu solicitud?</span><button className="btn btn-outline btn-sm" onClick={() => setTab('create')}>Enviar una solicitud</button></div>
          {history && (
            <div className="solicitudes-history">
              {history.length === 0 ? <EmptyState icon="inbox" title="Sin solicitudes" description="No encontramos solicitudes para ese correo y RUT." /> : history.map((row) => (
                <article className="solicitud-row" key={row.id}>
                  <header>
                    <span className={`solicitud-status is-${row.status}`}>{STATUS_LABELS[row.status] ?? row.status}</span>
                    <strong>{REQUEST_TYPES.find((t) => t.value === row.type)?.label ?? row.type}</strong>
                    <small>{new Date(row.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                  </header>
                  {row.message ? <p>{row.message}</p> : null}
                  {row.resolutionNote ? <div className="solicitud-resolution"><strong>Resolución</strong><p>{row.resolutionNote}</p>{row.resolvedAt ? <small>{new Date(row.resolvedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</small> : null}</div> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
