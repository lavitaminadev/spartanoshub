import { useState, type JSX } from 'react';
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

  const [queryEmail, setQueryEmail] = useState('');
  const [queryRut, setQueryRut] = useState('');
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [queryError, setQueryError] = useState('');
  const [searching, setSearching] = useState(false);

  const selectedType = REQUEST_TYPES.find((t) => t.value === type);
  const requiresRut = Boolean(selectedType?.sensitive);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (website) return;
    setSending(true);
    try {
      await api.post('/service-requests', { type, requesterName: name, requesterEmail: email, requesterRut: requiresRut ? rut : rut || undefined, requesterPhone: phone || undefined, message: message || undefined, website });
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
    setSearching(true);
    try {
      const rows = await api.get<HistoryRow[]>(`/service-requests/status?email=${encodeURIComponent(queryEmail)}&rut=${encodeURIComponent(queryRut)}`);
      setHistory(rows);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'No se pudo consultar. Verifica tu correo y RUT.');
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

      <nav className="survey-tabs" aria-label="Secciones de solicitudes">
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}><span>01</span><strong>Nueva solicitud</strong><small>Envía tu petición</small></button>
        <button className={tab === 'status' ? 'active' : ''} onClick={() => setTab('status')}><span>02</span><strong>Consultar estado</strong><small>Correo y RUT</small></button>
      </nav>

      {tab === 'create' && (
        <div className="solicitudes-card">
          {created ? (
            <EmptyState icon="check" title="Solicitud enviada" description={`Recibimos tu solicitud. Podrás consultar su estado desde "Consultar estado" con tu correo y RUT.`} action={<button className="btn btn-primary" onClick={() => { setCreated(false); setType('account'); setName(''); setEmail(''); setRut(''); setPhone(''); setMessage(''); }}>Enviar otra solicitud</button>} />
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
              <div className="modal-actions"><button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button></div>
              <small className="page-subtitle">Al enviar aceptas que tus datos se utilicen para gestionar esta solicitud y responder a ella.</small>
            </form>
          )}
        </div>
      )}

      {tab === 'status' && (
        <div className="solicitudes-card">
          <form className="modal-form" onSubmit={consult}>
            <p className="page-subtitle">Ingresa el correo y el RUT con los que enviaste la solicitud para ver su estado y resolución.</p>
            <div className="form-row">
              <label>Correo<input className="input" type="email" required value={queryEmail} onChange={(event) => setQueryEmail(event.target.value)} /></label>
              <label>RUT<input className="input" required value={queryRut} onChange={(event) => setQueryRut(event.target.value)} placeholder="12.345.678-9" /></label>
            </div>
            {queryError && <div className="alert alert-error" role="alert">{queryError}</div>}
            <div className="modal-actions"><button className="btn btn-primary" type="submit" disabled={searching}>{searching ? 'Consultando…' : 'Consultar estado'}</button></div>
          </form>
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
