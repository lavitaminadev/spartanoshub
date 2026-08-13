import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { BrandLockup } from '../../shared/Brand';
import { buildSessionHostWarning } from './session-host-warning';
import { readStoredText, storageKey, writeStoredText } from '../../core/browser-storage';
import { VitaIcons } from '../../shared/Icons';

const REMEMBERED_LOGIN_KEY = storageKey('remembered-login');

function getRememberedLogin(): string {
  return readStoredText(REMEMBERED_LOGIN_KEY) ?? '';
}

function getSessionHostWarning(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  return buildSessionHostWarning({
    isDevelopment: true,
    webHost: window.location.hostname,
    rawApiUrl: import.meta.env.VITE_API_URL as string | undefined,
  });
}

export function LoginPage() {
  const rememberedLogin = useMemo(getRememberedLogin, []);
  const sessionHostWarning = useMemo(getSessionHostWarning, []);
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const activationExpired = searchParams.get('reason') === 'activation-expired';
  const firstAccessComplete = searchParams.get('reason') === 'first-access-complete';
  const passwordChanged = searchParams.get('reason') === 'password-changed';
  const [email, setEmail] = useState(rememberedLogin);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(Boolean(rememberedLogin));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      writeStoredText(REMEMBERED_LOGIN_KEY, rememberLogin ? email.trim().toLowerCase() : null);
      const loggedInUser = useAuth.getState().user;
      const needsFirstAccess = loggedInUser?.mustChangePassword || loggedInUser?.mustCompleteProfile || loggedInUser?.mustAcceptTerms;
      navigate(needsFirstAccess ? '/first-access' : loggedInUser?.role === 'client' ? '/portal' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-story" aria-label="Espartanos">
        <span className="page-eyebrow">NUESTRO NEGOCIO ES HACER CRECER EL TUYO</span>
        <h2>Todo el pulso de Espartanos, en un solo lugar.</h2>
        <p>Gestión conectada de punta a punta.</p>
        <div className="login-flow"><span>CRM</span><span>Producción</span><span>Resultados</span></div>
      </section>
      <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
        <div className="login-brand"><BrandLockup /><span className="login-product">Espartanos</span></div>
        <h1 className="login-title">Bienvenido de vuelta</h1>
        <p className="login-subtitle">Ingresa a tu espacio operativo</p>
        {sessionExpired && <div className="alert alert-info login-session-warning">Tu sesión expiró. Inicia sesión de nuevo para continuar.</div>}
        {activationExpired && <div className="alert alert-info login-session-warning">Por seguridad, el tiempo para activar tu cuenta terminó. Ingresa nuevamente con tu clave temporal para continuar.</div>}
        {firstAccessComplete && <div className="alert alert-success login-session-warning">Tu cuenta quedó activada. Ingresa con tu nueva contraseña.</div>}
        {passwordChanged && <div className="alert alert-success login-session-warning">Contraseña actualizada. Vuelve a ingresar para continuar.</div>}
        {sessionHostWarning && <div className="alert alert-warning login-session-warning">{sessionHostWarning}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label htmlFor="email">Correo de acceso</label>
          <input
            id="email"
            name="username"
            className="input"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <div className="input-group">
            <input
              id="password"
              name="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button type="button" className="btn btn-icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? <VitaIcons.eyeSlash /> : <VitaIcons.eye />}
            </button>
          </div>
        </div>
        <label className="login-remember">
          <input
            type="checkbox"
            checked={rememberLogin}
            onChange={(event) => setRememberLogin(event.target.checked)}
            disabled={loading}
          />
          <span>
            <strong>Recordar mi usuario en este equipo</strong>
            <small>La contraseña la guarda tu navegador o gestor de claves, no Espartanos.</small>
          </span>
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <Link className="auth-secondary-link" to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        <Link className="btn btn-outline btn-block" to="/solicitudes">Solicitudes y consulta</Link>
      </form>
    </div>
  );
}
