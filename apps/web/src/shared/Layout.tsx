/**
 * @fileoverview Layout de la aplicación con sidebar responsivo y navegación
 * basada en roles.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { roleLabel } from '../core/role-labels';
import { getNavigation, getNavigationSections } from '../core/navigation.registry';
import { NavGlyph } from './NavGlyph';
import { openCommandPalette } from './command-events';
import { ToastContainer } from './Toast';
import { NotificationCenter } from './NotificationCenter';
import { BrandMark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { PwaInstallButton } from './PwaInstallButton';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { ContextHelpDrawer } from './help/ContextHelpDrawer';
import { useFocusTrap } from './useFocusTrap';
import { VitaIcons } from './Icons';

/**
 * Breakpoint en el que el sidebar pasa de fijo (desktop) a drawer superpuesto
 * (móvil). Debe coincidir con el `max-width: 768px` de `styles/direction.css`,
 * que es lo que efectivamente decide el layout visual.
 */
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

/**
 * Secciones del menú lateral.
 *
 * Vive en `NAVIGATION_SECTIONS` de `core/navigation.registry.ts`: el orden reproduce el
 * flujo del prototipo (Cliente → Brief → Solicitud → Trabajo → Aprobación → Entrega) y cada
 * rol ve solo sus grupos, porque los vacíos se descartan. Mantenerlo acá obligaría a que
 * una ruta nueva se agregara en dos lugares y se olvidara.
 */
/**
 * Shell de layout principal renderizado para usuarios autenticados.
 *
 * Responsabilidades:
 * - Renderizar el sidebar responsivo.
 * - Filtrar la navegación según el rol del usuario.
 * - Proveer un outlet para las rutas anidadas.
 */
export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => { const updateConnection = () => setOnline(navigator.onLine); window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection); }; }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);
    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  // El sidebar es un drawer solo en móvil: ahí necesita comportarse como el
  // Modal (foco atrapado, Escape cierra, scroll del body bloqueado). En
  // desktop es fijo y siempre visible, así que este trap nunca debe activarse
  // aunque `sidebarOpen` quede en true de una sesión móvil previa.
  const sidebarTrapActive = sidebarOpen && isMobile;
  useFocusTrap(sidebarRef, sidebarTrapActive);
  useEffect(() => {
    if (!sidebarTrapActive) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarTrapActive]);

  // Calcula la navegación una vez por cambio de rol para evitar filtrar en cada render.
  //
  // El menú se arma con el cargo y los permisos de quien mira, sin intermediarios: lo que se
  // dibuja y lo que se autoriza describen a la misma persona.
  const navItems = useMemo(
    () => getNavigation(user?.role, user?.features, user?.permissions, user?.moduleLifecycle),
    [user?.role, user?.features, user?.permissions, user?.moduleLifecycle],
  );
  // Las secciones viven en el registro junto al orden del sidebar: mantenerlas acá hacía
  // que una ruta no listada desapareciera del menú sin aviso.
  const groupedNavItems = useMemo(
    () => getNavigationSections(user?.role, user?.features, user?.permissions, user?.moduleLifecycle),
    [user?.role, user?.features, user?.permissions, user?.moduleLifecycle],
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const currentItem = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  return (
    <div className="app-layout">
      <ToastContainer />
      <NotificationCenter />
      <CommandPalette />
      {!online && <div className="offline-banner" role="alert"><strong>Sin conexión</strong><span>Puedes revisar la pantalla actual, pero los cambios no se enviarán hasta recuperar internet.</span></div>}
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Abrir navegación" aria-expanded={sidebarOpen}>
        <VitaIcons.menu />
      </button>
      <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark decorative />
          <div><h2>Espartanos</h2><span>{roleLabel(user?.role)}</span></div>
        </div>

        <nav className="sidebar-nav">
          {groupedNavItems.map((group) => (
            <section className="sidebar-nav-section" key={group.label} aria-label={group.label}>
              {/* Un encabezado que repite el nombre de su único ítem no agrupa nada: solo hace
                  leer la misma palabra dos veces. El `aria-label` de la sección lo conserva
                  para quien navega con lector de pantalla. */}
              {!(group.items.length === 1 && group.items[0].label === group.label)
                && <span className="sidebar-nav-section-title">{group.label}</span>}
              {group.items.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <NavGlyph label={item.label} />
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-actions">
            <NotificationBell />
          </div>
          <PwaInstallButton />
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <Link className="sidebar-account-link" to="/sesiones" onClick={closeSidebar}>Mis sesiones</Link>
          <Link className="sidebar-account-link" to="/change-password" onClick={closeSidebar}>Cambiar mi contraseña</Link>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={closeSidebar} aria-label="Cerrar navegación" />}
      <div className="app-workspace">
        <header className="workspace-header">
          <div className="workspace-heading" aria-label="Vista actual">
            <span>Espacio de trabajo</span>
            <strong>{currentItem?.label ?? 'Espartanos'}</strong>
          </div>
          <div className="workspace-header-actions">
            <button
              type="button"
              className="workspace-command workspace-search"
              onClick={openCommandPalette}
              aria-label="Buscar o ejecutar una acción"
            >
              <span aria-hidden="true"><VitaIcons.search /></span>
              <span>Buscar o ejecutar</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="workspace-command"
              style={{ minWidth: 0, padding: '7px 9px' }}
              onClick={() => setHelpOpen(true)}
              aria-label="Abrir ayuda"
              title="Ayuda"
            >
              <span aria-hidden="true">?</span>
            </button>
            <div className="workspace-user" aria-label={`Sesión de ${user?.name ?? 'usuario'}`}>
              <span className="online-dot" aria-hidden="true" />
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--nav-active-bg)',
                  color: 'var(--nav-active-text)',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {(user?.name ?? 'U').trim().charAt(0).toUpperCase()}
              </span>
              <span>{user?.name}</span>
            </div>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
        <ContextHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
}
