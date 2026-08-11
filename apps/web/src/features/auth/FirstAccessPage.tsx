import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../core/api';
import { useAuth } from '../../core/auth';
import { BrandLockup } from '../../shared/Brand';
import { PasswordField } from './PasswordField';
import { passwordRulesPassed } from './password-rules';

const TERMS = [
  { key: 'terms', title: 'Términos y condiciones de uso', detail: 'Usaré Espartanos únicamente para las tareas y responsabilidades autorizadas de mi cuenta.' },
  { key: 'dataTreatment', title: 'Tratamiento de datos personales', detail: 'Autorizo el tratamiento de mis datos para operar la plataforma y recibir comunicaciones de trabajo.' },
  { key: 'confidentiality', title: 'Confidencialidad', detail: 'Protegeré la información interna, estratégica y comercial de Espartanos y sus clientes.' },
  { key: 'properUse', title: 'Uso correcto de la plataforma', detail: 'No intentaré acceder a información, funciones o cuentas que no correspondan a mis permisos.' },
  { key: 'noDisclosure', title: 'No divulgación', detail: 'No compartiré credenciales, capturas, archivos ni información interna con personas no autorizadas.' },
] as const;

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
  const [step, setStep] = useState<FirstAccessStep>(isTermsRenewal ? 'terms' : 'welcome');
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: '' });
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState({ next: '', confirmation: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allTermsAccepted = TERMS.every((term) => accepted[term.key]);
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
      await api.post('/auth/terms/accept', { acceptedConsents: TERMS.map((term) => term.key) });
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
        acceptedConsents: TERMS.map((term) => term.key),
        profile: { name: profile.name.trim(), phone: profile.phone.trim() || undefined },
      });
      clearLocalSession();
      navigate('/login?reason=first-access-complete', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        clearLocalSession();
        navigate('/login?reason=activation-expired', { replace: true });
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
      <p>Los cinco consentimientos son obligatorios. Lee cada punto antes de marcarlo.</p>
      <div className="terms-list">
        {TERMS.map((term) => (
          <label key={term.key} className={`terms-item ${accepted[term.key] ? 'accepted' : ''}`}>
            <input type="checkbox" required checked={Boolean(accepted[term.key])} onChange={(event) => setAccepted({ ...accepted, [term.key]: event.target.checked })} />
            <span className="terms-copy"><strong>{term.title}</strong><small>{term.detail}</small><em>Obligatorio</em></span>
          </label>
        ))}
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
