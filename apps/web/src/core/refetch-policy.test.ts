import { afterEach, describe, expect, it } from 'vitest';
import { isEditing, refetchWhenIdle } from './refetch-policy';

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
    expect(refetchWhenIdle(60_000)).toBe(false);
  });

  it('tampoco en un área de texto', () => {
    enfocar('textarea');
    expect(refetchWhenIdle(60_000)).toBe(false);
  });

  it('una casilla no bloquea: marcarla no pierde nada al refrescar', () => {
    enfocar('input', 'checkbox');
    expect(isEditing()).toBe(false);
    expect(refetchWhenIdle(60_000)).toBe(60_000);
  });

  it('refresca cuando nadie está escribiendo', () => {
    expect(refetchWhenIdle(60_000)).toBe(60_000);
  });

  it('la pantalla puede bloquearlo por su cuenta, como con un modal abierto', () => {
    expect(refetchWhenIdle(60_000, true)).toBe(false);
  });

  it('vuelve a refrescar en cuanto se suelta el campo', () => {
    const campo = enfocar('input', 'text');
    expect(refetchWhenIdle(60_000)).toBe(false);
    campo.blur();
    expect(refetchWhenIdle(60_000)).toBe(60_000);
  });
});
