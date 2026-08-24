import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AccessDenied } from './AccessDenied';

/**
 * Un cargo sin acceso debe entender por qué, no toparse con una pantalla que parece rota.
 *
 * Antes ambos bloqueos —módulo apagado y cargo sin permiso— devolvían al inicio en silencio.
 * Escribir `/admin` con el cargo equivocado dejaba a la persona en el tablero sin una palabra,
 * y eso se reporta como falla del sistema en vez de resolverse pidiendo el permiso.
 */
describe('pantalla de acceso denegado', () => {
  const dibujar = (props: Parameters<typeof AccessDenied>[0]) =>
    render(<MemoryRouter><AccessDenied {...props} /></MemoryRouter>);

  it('no revela el cargo con el que entró la persona', () => {
    dibujar({ path: '/admin', userRole: 'designer', reason: 'role' });
    expect(screen.queryByText('Diseño')).toBeNull();
  });

  it('no enumera los cargos que sí abren la pantalla', () => {
    dibujar({ path: '/admin', userRole: 'designer', allowedRoles: ['admin', 'dev'], reason: 'role' });
    expect(screen.queryByText(/Administración, Desarrollo/)).toBeNull();
  });

  it('no muestra la ruta que se intentó abrir', () => {
    dibujar({ path: '/governance', userRole: 'designer', reason: 'role' });
    expect(screen.queryByText('/governance')).toBeNull();
  });

  /** Las dos salidas son distintas: una se pide como permiso, la otra se enciende. */
  it('distingue el módulo apagado del cargo sin permiso', () => {
    const { unmount } = dibujar({ path: '/x', userRole: 'designer', reason: 'module' });
    expect(screen.getByText(/no está disponible en tu servicio/i)).toBeTruthy();
    unmount();

    dibujar({ path: '/x', userRole: 'designer', reason: 'role' });
    expect(screen.getByText(/no tiene permiso/i)).toBeTruthy();
  });

  it('ofrece siempre una salida al inicio', () => {
    dibujar({ path: '/admin', userRole: 'designer', reason: 'role' });
    expect(screen.getByRole('link', { name: /volver al inicio/i }).getAttribute('href')).toBe('/dashboard');
  });

  /** Ningún rol recibido debe quedar expuesto, ni siquiera uno desconocido. */
  it('no expone roles conocidos ni desconocidos', () => {
    dibujar({ path: '/x', userRole: 'designer', allowedRoles: ['admin', 'inventado'], reason: 'role' });
    expect(screen.queryByText('Administración')).toBeNull();
    expect(screen.queryByText(/inventado/)).toBeNull();
  });
});
