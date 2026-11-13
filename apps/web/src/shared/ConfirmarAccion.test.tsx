import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmarAccion } from './ConfirmarAccion';

/** Las props obligatorias, para que cada caso pase solo lo que quiere probar. */
const base = {
  titulo: 'Cancelar tu reserva',
  consecuencia: 'Pierdes tu mesa.',
  confirmar: 'Confirmar cancelación',
};

describe('ConfirmarAccion', () => {
  it('sin volver, el botón para salir dice «Cancelar»', () => {
    render(<ConfirmarAccion {...base} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  });

  it('con volver, el botón para salir usa ese texto', () => {
    render(<ConfirmarAccion {...base} volver="Regresar a la reserva" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Regresar a la reserva' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  /**
   * El caso que importa: quien se arrepiente nunca ejecuta la acción. Con un `confirm()` del
   * navegador, el botón «Cancelar» al lado de «¿Cancelar esta reserva?» invitaba a lo contrario.
   */
  it('el botón para salir llama a onCancelar y no a onConfirmar', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<ConfirmarAccion {...base} volver="Regresar a la reserva" onConfirmar={onConfirmar} onCancelar={onCancelar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Regresar a la reserva' }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('el botón que confirma llama a onConfirmar', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<ConfirmarAccion {...base} onConfirmar={onConfirmar} onCancelar={onCancelar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).not.toHaveBeenCalled();
  });
});
