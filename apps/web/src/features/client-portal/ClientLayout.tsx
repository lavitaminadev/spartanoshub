import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { NavGlyph } from '../../shared/NavGlyph';
import { BrandMark } from '../../shared/Brand';
import { NotificationBell } from '../notifications/NotificationBell';
import { PwaInstallButton } from '../../shared/PwaInstallButton';
import { AvisoVersionNueva } from '../../shared/AvisoVersionNueva';
import { useMenuCompacto } from '../../shared/useMenuCompacto';
import { CommandPalette } from '../../shared/CommandPalette';
import { openCommandPalette } from '../../shared/command-events';
import { VitaIcons } from '../../shared/Icons';
import { NotificationCenter } from '../../shared/NotificationCenter';
import { ReauthPrompt } from '../../shared/ReauthPrompt';
import { ContextHelpDrawer } from '../../shared/help/ContextHelpDrawer';
import { useEmpresaActiva } from '../../shared/empresa-activa';
import { CLIENT_NAV, isClientNavItemVisible } from './client-portal-scope';

/**
 * Navegación del portal del cliente.
 *
 * El portal tiene su propio menú porque no comparte layout con la aplicación interna, pero el
 * alcance de fase y el switch por organización se aplican igual: `module` declara de qué módulo
 * depende cada entrada, y las que quedan fuera del alcance vigente o apagadas por dev no se
 * muestran. Sin `module`, la entrada es siempre visible porque pertenece al núcleo del producto.
 *
 * La operación inicial expone únicamente los servicios contratables que hoy están validados de
 * punta a punta: CRM y Reservas. Los demás módulos siguen en el código, pero no pertenecen al
 * portal hasta que se liberen expresamente como producto.
 */
export function ClientLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { menuCompacto, alternar, esMovil } = useMenuCompacto();
  const empresaActiva = useEmpresaActiva();
  return (
    <div className={`app-layout${menuCompacto && !esMovil ? ' menu-compacto' : ''}`}>
      {/*
        Lo que vive en el marco y no en una pantalla.

        Estaban en el marco interno, y el portal usaba otro: al pasar las cuentas de empresa a
        este marco se quedaron sin buscador, sin el centro de notificaciones y sin la ayuda. No
        son adornos —el buscador es la forma rápida de llegar a cualquier sitio, y la ayuda
        explica la pantalla en la que se está—, así que viven donde siempre debieron: en los dos.
      */}
      <ReauthPrompt />
      <AvisoVersionNueva />
      <NotificationCenter />
      <CommandPalette />
      <button className="sidebar-toggle" onClick={() => setOpen(!open)} aria-label="Abrir navegación" aria-expanded={open}>☰</button>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark decorative />
          <div><h2>Mi cuenta</h2><span>Espartanos</span></div>
          {/* El mismo botón que el marco interno: contraer el menú no es cosa de un solo cargo. */}
          {!esMovil && <button type="button" className="menu-compacto-boton" onClick={alternar} aria-pressed={menuCompacto} aria-label={menuCompacto ? 'Expandir menú' : 'Contraer menú a íconos'} title={menuCompacto ? 'Expandir menú' : 'Contraer menú'}>{menuCompacto ? '»' : '«'}</button>}
        </div>
        {/*
          Sobre qué empresa se está trabajando, a la vista y en todas las pantallas.

          Quien atiende dos locales necesita verlo sin buscarlo: marcar asistencia o cambiar un
          horario en el local equivocado creyendo estar en el otro no se nota hasta que está
          hecho. Con una sola empresa no aparece: no hay nada que confundir.
        */}
        {empresaActiva.varias && !menuCompacto && (
          <label className="sidebar-empresa">
            <span>Trabajando en</span>
            <select
              className="input"
              aria-label="Empresa sobre la que se trabaja"
              value={empresaActiva.clientId}
              onChange={(evento) => empresaActiva.elegir(evento.target.value)}
            >
              {empresaActiva.empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.name}</option>)}
            </select>
          </label>
        )}

        <nav className="sidebar-nav">
          {CLIENT_NAV.filter((item) => isClientNavItemVisible(item, user)).map((item) => {
            const active = location.pathname === item.path || (item.path !== '/portal' && location.pathname.startsWith(`${item.path}/`));
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setOpen(false)}>
                <NavGlyph label={item.label} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-actions"><NotificationBell /></div>
          <PwaInstallButton />
          <div className="user-info"><div className="user-name">{user?.name}</div><div className="user-role">Cliente</div></div>
          <Link className="sidebar-account-link" to="/change-password" onClick={() => setOpen(false)}>Cambiar mi contraseña</Link>
          <button className="btn btn-outline btn-sm" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar navegacion" />}
      <div className="app-workspace client-workspace">
        <header className="workspace-header">
          <div className="workspace-heading"><span>Portal cliente</span><strong>Tu marca, en un solo lugar</strong></div>
          {/*
            El buscador, visible y no solo por atajo.

            El atajo por sí solo lo usa quien ya sabe que existe. El campo es lo que lo enseña,
            y es la forma rápida de llegar a cualquier pantalla sin recorrer el menú.
          */}
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
        </header>
        <main className="main-content"><Outlet /></main>
        <ContextHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
}
