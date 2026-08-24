import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../core/api';
import { useAuth } from '../../core/auth';
import { BrandLockup } from '../../shared/Brand';
import { PasswordField } from './PasswordField';
import { passwordRulesPassed } from './password-rules';
import { clearProgress, loadProgress, saveProgress } from './first-access-progress';

const BASE_TERMS = [
  { key: 'terms', title: 'Términos y condiciones de uso', detail: 'Usaré Espartanos únicamente para las tareas y responsabilidades autorizadas de mi cuenta.' },
  { key: 'confidentiality', title: 'Confidencialidad', detail: 'Protegeré la información interna, estratégica y comercial de Espartanos y sus clientes.' },
  { key: 'properUse', title: 'Uso correcto de la plataforma', detail: 'No intentaré acceder a información, funciones o cuentas que no correspondan a mis permisos.' },
  { key: 'noDisclosure', title: 'No divulgación', detail: 'No compartiré credenciales, capturas, archivos ni información interna con personas no autorizadas.' },
] as const;

type CurrentTerms = { version: string; title: string; text: string };

type FirstAccessStep = 'welcome' | 'profile' | 'terms' | 'password';

function StepProgress({ current }: { current: number }) {
  return (
    <div className="first-access-progress" aria-label={`Paso ${current} de 3`}>
      {[1, 2, 3].map((step) => <span key={step} className={step <= current ? 'active' : ''}>{step}</span>)}
    </div>
  );
}

export function FirstAccessPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const clearLocalSession = useAuth((state) => state.clearLocalSession);
  const isTermsRenewal = Boolean(user?.mustAcceptTerms) && !user?.mustChangePassword && !user?.mustCompleteProfile;
  const [currentTerms, setCurrentTerms] = useState<CurrentTerms | null>(null);
  const [termsLoadError, setTermsLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setTermsLoadError(false);
    api.get<CurrentTerms>('/auth/terms/current')
      .then((result) => { if (active) setCurrentTerms(result); })
      .catch(() => { if (active) setTermsLoadError(true); });
    return () => { active = false; };
  }, []);
  const termsVersion = currentTerms?.version ?? 'pending';
  const terms = useMemo(() => [
    BASE_TERMS[0],
    {
      key: 'dataTreatment' as const,
      title: currentTerms?.title ?? 'Aviso de privacidad y tratamiento de datos',
      detail: currentTerms?.text ?? 'Cargando el aviso vigente…',
    },
    ...BASE_TERMS.slice(1),
  ], [currentTerms]);
  // Avance guardado de esta pestana. Se lee una sola vez al montar: releerlo en cada render
  // pisaria lo que la persona esta escribiendo justo ahora.
  const guardado = useMemo(() => loadProgress(user?.id, termsVersion), [user?.id, termsVersion]);
  const [step, setStep] = useState<FirstAccessStep>(
    (guardado?.step as FirstAccessStep) ?? (isTermsRenewal ? 'terms' : 'welcome'),
  );
  const [profile, setProfile] = useState({ name: guardado?.name ?? user?.name ?? '', phone: guardado?.phone ?? '' });
  const [accepted, setAccepted] = useState<Record<string, boolean>>(guardado?.accepted ?? {});
  const [readTerms, setReadTerms] = useState<Record<string, boolean>>(guardado?.readTerms ?? {});
  const [password, setPassword] = useState({ next: '', confirmation: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!currentTerms) return;
    const restored = loadProgress(user?.id, currentTerms.version);
    if (!restored) return;
    setStep((restored.step as FirstAccessStep) ?? (isTermsRenewal ? 'terms' : 'welcome'));
    setProfile({ name: restored.name ?? user?.name ?? '', phone: restored.phone ?? '' });
    setReadTerms(restored.readTerms ?? {});
    setAccepted(restored.accepted ?? {});
  }, [currentTerms, isTermsRenewal, user?.id, user?.name]);
  // Se guarda en cada cambio y no al avanzar de paso: lo que se pierde al recargar es justo lo
  // que se acaba de escribir, y guardar solo en las transiciones dejaria fuera ese caso.
  useEffect(() => {
    if (!currentTerms) return;
    saveProgress(user?.id, {
      step,
      name: profile.name,
      phone: profile.phone,
      readTerms,
      accepted,
      termsVersion,
    });
  }, [user?.id, step, profile.name, profile.phone, readTerms, accepted, termsVersion, currentTerms]);

  const allTermsAccepted = Boolean(currentTerms) && terms.every((term) => accepted[term.key]);
  const securePassword = useMemo(() => passwordRulesPassed(password.next), [password.next]);

  const leave = async () => {
    await useAuth.getState().logout();
    navigate('/login', { replace: true });
  };

  const acceptTerms = async () => {
    if (!allTermsAccepted) {
      setFeedback('Debes aceptar todas las condiciones obligatorias para continuar.');
      return;
    }
    if (!isTermsRenewal) {
      setFeedback(null);
      setStep('password');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await api.post('/auth/terms/accept', { acceptedConsents: terms.map((term) => term.key), termsVersion });
      await refreshProfile();
      navigate(user?.role === 'client' ? '/portal' : '/dashboard', { replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo registrar la aceptación.');
    } finally {
      setSaving(false);
    }
  };

  const completeFirstAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!securePassword) {
      setFeedback('La nueva contraseña aún no cumple todos los requisitos.');
      return;
    }
    if (password.next !== password.confirmation) {
      setFeedback('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await api.post('/auth/onboarding', {
        newPassword: password.next,
        acceptedConsents: terms.map((term) => term.key),
        termsVersion,
        profile: { name: profile.name.trim(), phone: profile.phone.trim() || undefined },
      });
      clearProgress(user?.id);
      clearLocalSession();
      navigate('/login?reason=first-access-complete', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        clearProgress(user?.id);
        clearLocalSession();
        navigate('/login?reason=activation-expired', { replace: true });
        return;
      }
      // Las condiciones cambiaron mientras esta pantalla estaba abierta. Su texto viene compilado
      // en el paquete, así que mostrar el aviso no basta: sin recargar se vuelve a enviar la
      // misma versión y el rechazo se repite. Se limpian las aceptaciones para que nadie confirme
      // sin haber leído lo que quedó vigente, y no se toca la contraseña escrita.
      if (error instanceof ApiError && error.status === 409) {
        setAccepted({});
        setFeedback(`${error.message} Se recargará la página para mostrarte el texto vigente.`);
        setTimeout(() => window.location.reload(), 2500);
        return;
      }
      setFeedback(error instanceof Error ? error.message : 'No se pudo completar el primer acceso.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'welcome') {
    return <main className="auth-page first-access-page"><section className="login-card first-access-card welcome-card">
      <BrandLockup />
      <span className="page-eyebrow">PRIMER ACCESO</span>
      <h1>Tu espacio está listo, {user?.name?.split(' ')[0] || 'bienvenido'}.</h1>
      <p>Antes de comenzar, confirma tus datos, revisa las condiciones y crea tu contraseña personal.</p>
      <div className="onboarding-features">
        <div><b>01</b><strong>Tus datos</strong><small>Solo pedimos lo necesario para identificarte.</small></div>
        <div><b>02</b><strong>Condiciones claras</strong><small>Cada aceptación queda registrada con fecha y versión.</small></div>
        <div><b>03</b><strong>Tu contraseña</strong><small>La clave temporal deja de funcionar al finalizar.</small></div>
      </div>
      <button className="btn btn-primary btn-block first-access-primary" onClick={() => setStep('profile')}>Configurar mi cuenta</button>
      <button type="button" className="auth-secondary-link" onClick={leave}>Salir y hacerlo después</button>
    </section></main>;
  }

  if (step === 'profile') {
    return <main className="auth-page first-access-page"><section className="login-card first-access-card">
      <StepProgress current={1} />
      <span className="page-eyebrow">PASO 1 DE 3</span>
      <h1>Confirma tus datos</h1>
      <p>Tu cargo, modalidad y permisos los administra Espartanos. Aquí solo completas tus datos personales.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (profile.name.trim().length < 3) {
          setFeedback('Escribe tu nombre completo para continuar.');
          return;
        }
        setFeedback(null);
        setStep('terms');
      }}>
        <div className="form-group">
          <label htmlFor="first-access-name">Nombre completo <span className="required-mark">Obligatorio</span></label>
          <input id="first-access-name" className="input" autoComplete="name" required minLength={3} autoFocus value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="first-access-phone">Teléfono <span className="optional-mark">Opcional</span></label>
          <input id="first-access-phone" className="input" type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+56 9 1234 5678" />
          <small className="form-hint">Se utiliza únicamente para coordinación interna.</small>
        </div>
        {feedback && <div className="alert alert-error" role="alert">{feedback}</div>}
        <div className="first-access-actions">
          <button type="button" className="btn btn-outline" onClick={() => setStep('welcome')}>Volver</button>
          <button className="btn btn-primary" type="submit">Continuar</button>
        </div>
      </form>
    </section></main>;
  }

  if (step === 'terms') {
    return <main className="auth-page first-access-page"><section className="login-card first-access-card terms-card">
      {!isTermsRenewal && <StepProgress current={2} />}
      <span className="page-eyebrow">{isTermsRenewal ? 'CONDICIONES ACTUALIZADAS' : 'PASO 2 DE 3'}</span>
      <h1>Revisa y acepta las condiciones</h1>
      <p>Revisa las condiciones de uso y el aviso de privacidad vigentes. No incluyen autorización para publicidad.</p>
      {termsLoadError && <div className="alert alert-error" role="alert">No fue posible cargar el texto vigente. Recarga la página antes de continuar.</div>}
      <div className="terms-list">
        {terms.map((term) => {
          const opened = Boolean(readTerms[term.key]);
          return (
            <div key={term.key} className={`terms-item terms-collapsible ${accepted[term.key] ? 'accepted' : ''} ${opened ? 'is-open' : ''}`}>
              <div className="terms-collapsible-head">
                <span className="terms-copy"><strong>{term.title}</strong>{opened ? <small>{term.detail}</small> : <em>Obligatorio</em>}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setReadTerms({ ...readTerms, [term.key]: !opened })}>{opened ? 'Ocultar' : 'Leer contenido'}</button>
              </div>
              {opened && (
                <div className="terms-collapsible-body">
                  <p>{term.detail}</p>
                  <label className={`toggle-row terms-accept ${readTerms[term.key] ? '' : 'is-locked'}`}><input type="checkbox" checked={Boolean(accepted[term.key])} disabled={!opened || !currentTerms} onChange={(event) => setAccepted({ ...accepted, [term.key]: event.target.checked })} /> {term.key === 'dataTreatment' ? 'He leído y fui informado sobre este tratamiento' : 'He leído y acepto este punto'}</label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {feedback && <div className="alert alert-error" role="alert">{feedback}</div>}
      <div className="first-access-actions">
        {!isTermsRenewal && <button type="button" className="btn btn-outline" onClick={() => setStep('profile')}>Volver</button>}
        <button className="btn btn-primary" disabled={!allTermsAccepted || saving} onClick={acceptTerms}>{saving ? 'Registrando...' : isTermsRenewal ? 'Aceptar y continuar' : 'Aceptar y crear contraseña'}</button>
      </div>
    </section></main>;
  }

  return <main className="auth-page first-access-page"><section className="login-card first-access-card">
    <StepProgress current={3} />
    <span className="page-eyebrow">PASO 3 DE 3</span>
    <h1>Crea tu contraseña personal</h1>
    <p>Ya ingresaste con la clave temporal, por eso no necesitas escribirla nuevamente.</p>
    <form onSubmit={completeFirstAccess}>
      {/* Se advierte antes de escribir, no después del rechazo. La pantalla no conoce la clave
          temporal —no se guarda en ninguna parte— así que no puede compararla; lo único que puede
          hacer es decirlo a tiempo. Sin este aviso, la persona escribe la que acaba de recibir,
          que es la única que recuerda, y queda dando vueltas sin entender por qué la rechazan. */}
      <p className="auth-hint">Elige una contraseña <strong>distinta</strong> de la temporal que recibiste.</p>
      <PasswordField id="first-access-password" label="Nueva contraseña" autoComplete="new-password" value={password.next} onChange={(next) => setPassword({ ...password, next })} showRules />
      <PasswordField id="first-access-confirmation" label="Confirmar contraseña" autoComplete="new-password" value={password.confirmation} onChange={(confirmation) => setPassword({ ...password, confirmation })} />
      {feedback && <div className="alert alert-error" role="alert">{feedback}</div>}
      <div className="first-access-actions">
        <button type="button" className="btn btn-outline" onClick={() => setStep('terms')}>Volver</button>
        <button className="btn btn-primary" disabled={saving || !securePassword || password.next !== password.confirmation}>{saving ? 'Activando cuenta...' : 'Activar mi cuenta'}</button>
      </div>
    </form>
  </section></main>;
}
