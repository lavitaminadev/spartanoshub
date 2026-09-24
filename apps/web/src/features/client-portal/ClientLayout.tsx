import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { NavGlyph } from '../../shared/NavGlyph';
import { BrandMark } from '../../shared/Brand';
import { NotificationBell } from '../notifications/NotificationBell';
import { PwaInstallButton } from '../../shared/PwaInstallButton';
import { AvisoVersionNueva } from '../../shared/AvisoVersionNueva';
import { useMenuCompacto } from '../../shared/useMenuCompacto';
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
  const { menuCompacto, alternar, esMovil } = useMenuCompacto();
  const empresaActiva = useEmpresaActiva();
  return (
    <div className={`app-layout${menuCompacto && !esMovil ? ' menu-compacto' : ''}`}>
      <AvisoVersionNueva />
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
              onChange={(evento) => { empresaActiva.elegir(evento.target.value); window.location.reload(); }}
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
      <div className="app-workspace client-workspace"><header className="workspace-header"><div className="workspace-heading"><span>Portal cliente</span><strong>Tu marca, en un solo lugar</strong></div></header><main className="main-content"><Outlet /></main></div>
    </div>
  );
}
