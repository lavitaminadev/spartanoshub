import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { PasswordField } from './PasswordField';
import { passwordRulesPassed, type PasswordPolicy } from './password-rules';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const clearLocalSession = useAuth((state) => state.clearLocalSession);
  const [form, setForm] = useState({ current: '', next: '', confirmation: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: serverPolicy } = useQuery<Record<string, string>>({
    queryKey: ['password-policy'],
    queryFn: () => api.get('/settings?prefix=security.password'),
  });
  const policy: Partial<PasswordPolicy> | undefined = serverPolicy ? {
    minLength: Number(serverPolicy['security.password.minLength']) || 8,
    requireUppercase: serverPolicy['security.password.requireUppercase'] !== 'false',
    requireLowercase: true,
    requireNumber: serverPolicy['security.password.requireNumber'] !== 'false',
    requireSpecial: serverPolicy['security.password.requireSpecial'] === 'true',
  } : undefined;

  const securePassword = useMemo(() => passwordRulesPassed(form.next, policy), [form.next, policy]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!securePassword) {
      setFeedback('La nueva contraseña aún no cumple todos los requisitos.');
      return;
    }
    if (form.next !== form.confirmation) {
      setFeedback('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await api.put('/auth/password', { currentPassword: form.current, newPassword: form.next });
      clearLocalSession();
      navigate('/login?reason=password-changed', { replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return <main className="auth-page"><section className="login-card password-card first-access-card">
    <span className="page-eyebrow">SEGURIDAD DE LA CUENTA</span>
    <h1>Cambia tu contraseña</h1>
    <p>Esta sección es solo para cuentas activas. Al guardar, cerraremos las demás sesiones por seguridad.</p>
    <form onSubmit={submit}>
      <PasswordField id="current-password" label="Contraseña actual" autoComplete="current-password" value={form.current} onChange={(current) => setForm({ ...form, current })} />
      <PasswordField id="new-password" label="Nueva contraseña" autoComplete="new-password" value={form.next} onChange={(next) => setForm({ ...form, next })} showRules policy={policy} />
      <PasswordField id="confirm-password" label="Confirmar nueva contraseña" autoComplete="new-password" value={form.confirmation} onChange={(confirmation) => setForm({ ...form, confirmation })} />
      {feedback && <div className="alert alert-error" role="alert">{feedback}</div>}
      <div className="first-access-actions">
        <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving || !securePassword || form.next !== form.confirmation}>{saving ? 'Guardando...' : 'Guardar nueva contraseña'}</button>
      </div>
    </form>
  </section></main>;
}
