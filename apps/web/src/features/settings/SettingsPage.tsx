import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { CloudinaryConfigModal } from './CloudinaryConfigModal';
import { ImageUpload } from '../../shared/ImageUpload';
import { MediaLibraryModal } from '../../shared/MediaLibraryModal';
import { PageHero } from '../../shared/PageHero';

type SettingsTab = 'general' | 'security' | 'shortcuts';
type Feedback = { tone: 'success' | 'error'; text: string } | null;

interface OrganizationSummary {
  id: string;
  name: string;
  logoUrl?: string;
  welcomeMessage?: string;
}

const TABS: Array<{ id: SettingsTab; number: string; label: string; description: string }> = [
  { id: 'general', number: '01', label: 'Cuenta y agencia', description: 'Perfil, logo y bienvenida' },
  { id: 'security', number: '02', label: 'Seguridad personal', description: 'Contraseña propia' },
  { id: 'shortcuts', number: '03', label: 'Accesos rápidos', description: 'Áreas donde se configura' },
];

export function SettingsPage() {
  const { user, logout, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [orgName, setOrgName] = useState('');
  const [orgLogo, setOrgLogo] = useState('');
  const [orgWelcome, setOrgWelcome] = useState('');
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

  const canManageAgencyIdentity = user?.role === 'admin' || user?.role === 'dev';

  const organizationsQuery = useQuery<OrganizationSummary[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations'),
    enabled: activeTab === 'general' && canManageAgencyIdentity,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    setProfile({ name: user?.name ?? '', email: user?.email ?? '' });
  }, [user?.email, user?.name]);

  useEffect(() => {
    const currentOrg = organizationsQuery.data?.find((organization) => organization.id === user?.organizationId)
      ?? organizationsQuery.data?.[0];
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setOrgLogo(currentOrg.logoUrl || '');
      setOrgWelcome(currentOrg.welcomeMessage || '');
    }
  }, [organizationsQuery.data, user?.organizationId]);

  const profileMutation = useMutation({
    mutationFn: () => api.put('/auth/profile', { name: profile.name.trim(), email: profile.email.trim() }),
    onSuccess: async () => {
      await refreshProfile();
      setFeedback({ tone: 'success', text: 'Tu perfil quedó actualizado.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const organizationMutation = useMutation({
    mutationFn: () => api.put('/organizations/profile', { name: orgName.trim(), logoUrl: orgLogo || undefined, welcomeMessage: orgWelcome || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setFeedback({ tone: 'success', text: 'La identidad de la agencia quedó actualizada.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.put('/auth/password', {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    }),
    onSuccess: async () => {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setFeedback({ tone: 'success', text: 'Tu contraseña fue actualizada correctamente.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  return (
    <div className="page settings-central">
      <PageHero
        eyebrow="CONFIGURACIÓN"
        title="Ajustes rápidos de cuenta y agencia."
        subtitle="Las reglas operativas viven en cada área. Lo técnico y la matriz completa quedan en el panel dev."
        aside={<div className="settings-hero-mark" aria-hidden="true"><span>ESP</span><small>ajustes</small></div>}
      />

      <nav className="settings-tabs" aria-label="Secciones de configuración">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => { setActiveTab(tab.id); setFeedback(null); }}>
            <span>{tab.number}</span><strong>{tab.label}</strong><small>{tab.description}</small>
          </button>
        ))}
      </nav>

      {feedback && <div className={`settings-feedback alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}

      {activeTab === 'general' && (
        <div className="settings-identity-grid">
          <section className="settings-form-card">
            <header><span>Tu cuenta</span><h2>Perfil personal</h2><p>Esta información identifica tus acciones en comentarios, aprobaciones y auditorías.</p></header>
            <form onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}>
              <label>Nombre completo<input className="input" required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
              <label>Correo de acceso<input className="input" required type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              <div className="settings-form-note"><span>Cargo</span><strong>{user?.role.replaceAll('_', ' ')}</strong><small>Los permisos del cargo se revisan en Accesos y seguridad.</small></div>
              <button className="btn btn-primary" type="submit" disabled={profileMutation.isPending || !profile.name.trim() || !profile.email.trim()}>
                {profileMutation.isPending ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>
          </section>

          {canManageAgencyIdentity && (
            <section className="settings-form-card organization-card">
              <header><span>Agencia</span><h2>Identidad visible</h2><p>Nombre, logo y mensaje de bienvenida para el espacio de trabajo.</p></header>
              <form onSubmit={(event) => { event.preventDefault(); organizationMutation.mutate(); }}>
                <ImageUpload
                  label="Logo de la agencia"
                  value={orgLogo}
                  onChange={(url) => setOrgLogo(url)}
                  placeholder="https://..."
                  maxSizeMB={2}
                  helperText="Aparece en el onboarding de nuevos usuarios. PNG o JPG, máximo 2 MB."
                />
                <label>Nombre de la agencia<input className="input" required value={orgName} onChange={(event) => setOrgName(event.target.value)} /></label>
                <label>Mensaje de bienvenida<textarea className="input" rows={3} value={orgWelcome} onChange={(event) => setOrgWelcome(event.target.value)} placeholder="Bienvenido a Espartanos. Nos alegra que seas parte del equipo." /><small>Se muestra en la pantalla de primer ingreso de nuevos usuarios.</small></label>
                <div className="organization-preview"><span>Vista previa onboarding</span><div>{orgLogo ? <img src={orgLogo} alt="Logo" style={{ maxWidth: 80, maxHeight: 40, marginBottom: 8 }} /> : <b>{orgName?.charAt(0) || 'E'}</b>}<p><strong>{orgName || 'Espartanos'}</strong><small>{orgWelcome || 'Bienvenido al espacio operativo Espartanos.'}</small></p></div></div>
                <button className="btn btn-primary" type="submit" disabled={organizationMutation.isPending || !orgName.trim()}>
                  {organizationMutation.isPending ? 'Actualizando...' : 'Actualizar agencia'}
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="settings-security-grid">
          <section className="settings-form-card">
            <header><span>Cuenta</span><h2>Cambiar contraseña</h2><p>Actualiza tu contraseña de acceso a Espartanos.</p></header>
            <form onSubmit={(event) => { event.preventDefault(); if (passwordData.newPassword !== passwordData.confirmPassword) { setFeedback({ tone: 'error', text: 'Las contraseñas nuevas no coinciden.' }); return; } passwordMutation.mutate(); }}>
              <label>Contraseña actual
                <input className="input" type="password" required value={passwordData.currentPassword} onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })} />
              </label>
              <label>Nueva contraseña
                <input className="input" type="password" required value={passwordData.newPassword} onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })} />
                <small>Mínimo 8 caracteres, con mayúscula, minúscula y número.</small>
              </label>
              <label>Confirmar nueva contraseña
                <input className="input" type="password" required value={passwordData.confirmPassword} onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })} />
              </label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={passwordMutation.isPending || !passwordData.currentPassword.trim() || !passwordData.newPassword.trim() || !passwordData.confirmPassword.trim()}>
                  {passwordMutation.isPending ? 'Actualizando...' : 'Cambiar contraseña'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div className="settings-access-grid">
          <Link to="/clients" className="settings-access-card"><span>01</span><div><strong>Empresas</strong><p>Reservas, CRM, Meta y configuración propia de cada cliente.</p></div><b>Abrir →</b></Link>
          <Link to="/admin" className="settings-access-card"><span>02</span><div><strong>Accesos y seguridad</strong><p>Usuarios, permisos puntuales, bloqueos y auditoría básica.</p></div><b>Administrar →</b></Link>
          <Link to="/governance" className="settings-access-card"><span>03</span><div><strong>Operación y cuentas</strong><p>Pods, flujos, estructura de cuentas y control operativo.</p></div><b>Revisar →</b></Link>
          <Link to="/integrations" className="settings-access-card"><span>04</span><div><strong>Integraciones</strong><p>Meta Pixel, CAPI y conexiones externas permitidas.</p></div><b>Ver →</b></Link>
          {user?.role === 'dev' && <Link to="/admin" className="settings-access-card"><span>05</span><div><strong>Panel dev</strong><p>Matriz de permisos, módulos, ciclo de vida y flags técnicos.</p></div><b>Abrir →</b></Link>}
          <button type="button" className="settings-access-card" onClick={() => setCloudinaryOpen(true)}><span>06</span><div><strong>Cloudinary global</strong><p>Logos e imágenes de formularios.</p></div><b>Configurar →</b></button>
          <button type="button" className="settings-access-card" onClick={() => setMediaLibraryOpen(true)}><span>07</span><div><strong>Biblioteca de imágenes</strong><p>Explora y administra imágenes.</p></div><b>Abrir →</b></button>
          <section className="settings-session-card"><span>SESIÓN ACTUAL</span><strong>{user?.email}</strong><p>Revoca el acceso del navegador.</p><button className="btn btn-outline" type="button" onClick={logout}>Cerrar sesión de forma segura</button></section>
        </div>
      )}

      <CloudinaryConfigModal open={cloudinaryOpen} onClose={() => setCloudinaryOpen(false)} />
      <MediaLibraryModal open={mediaLibraryOpen} onClose={() => setMediaLibraryOpen(false)} onSelect={(url) => { navigator.clipboard?.writeText(url); setMediaLibraryOpen(false); }} />
    </div>
  );
}
