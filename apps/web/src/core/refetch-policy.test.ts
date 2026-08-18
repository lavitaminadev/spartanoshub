import { afterEach, describe, expect, it } from 'vitest';
import { isEditing, isInteracting, refetchWhenIdle } from './refetch-policy';

function enfocar(tag: string, type?: string): HTMLElement {
  const el = document.createElement(tag);
  if (type) (el as HTMLInputElement).type = type;
  document.body.appendChild(el);
  el.focus();
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('refresco automático', () => {
  it('no refresca mientras alguien escribe en un campo de texto', () => {
    enfocar('input', 'text');
    expect(isEditing()).toBe(true);
    expect(refetchWhenIdle(60_000)()).toBe(false);
  });

  it('tampoco en un área de texto', () => {
    enfocar('textarea');
    expect(refetchWhenIdle(60_000)()).toBe(false);
  });

  it('una casilla no bloquea: marcarla no pierde nada al refrescar', () => {
    enfocar('input', 'checkbox');
    expect(isEditing()).toBe(false);
    expect(refetchWhenIdle(60_000)()).toBe(60_000);
  });

  it('refresca cuando nadie está escribiendo', () => {
    expect(refetchWhenIdle(60_000)()).toBe(60_000);
  });

  it('la pantalla puede bloquearlo por su cuenta, como con un modal abierto', () => {
    expect(refetchWhenIdle(60_000, true)()).toBe(false);
  });

  it('vuelve a refrescar en cuanto se suelta el campo', () => {
    const campo = enfocar('input', 'text');
    expect(refetchWhenIdle(60_000)()).toBe(false);
    campo.blur();
    expect(refetchWhenIdle(60_000)()).toBe(60_000);
  });

  /**
   * Es el fallo que motivó devolver una función.
   *
   * Antes se entregaba un número calculado al renderizar, así que la decisión quedaba tomada
   * en ese instante: quien empezaba a escribir después recibía el refresco igual. La consulta
   * no se vuelve a montar por enfocar un campo, de modo que la guardia casi nunca llegaba a
   * aplicarse y el refresco interrumpía justo a quien estaba usando la pantalla.
   */
  it('decide en cada vencimiento y no al construirse', () => {
    const intervalo = refetchWhenIdle(60_000);
    expect(intervalo()).toBe(60_000);

    const campo = enfocar('input', 'text');
    expect(intervalo()).toBe(false);

    campo.blur();
    expect(intervalo()).toBe(60_000);
  });

  it('acepta una condición que se relee en cada vencimiento', () => {
    let modalAbierto = false;
    const intervalo = refetchWhenIdle(60_000, () => modalAbierto);
    expect(intervalo()).toBe(60_000);
    modalAbierto = true;
    expect(intervalo()).toBe(false);
  });
});

describe('interacciones que un redibujado interrumpiría', () => {
  it('no refresca mientras se arrastra una tarjeta', () => {
    const card = document.createElement('div');
    card.className = 'kanban-card is-dragging';
    document.body.appendChild(card);
    expect(isInteracting()).toBe(true);
    expect(refetchWhenIdle(60_000)()).toBe(false);
  });

  it('no refresca con un diálogo abierto', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    expect(isInteracting()).toBe(true);
  });

  it('refresca cuando no hay nada en curso', () => {
    expect(isInteracting()).toBe(false);
  });
});
