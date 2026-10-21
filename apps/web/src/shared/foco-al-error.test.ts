import { describe, expect, it } from 'vitest';
import { enfocarPrimerError } from './foco-al-error';

function formulario(html: string): HTMLElement {
  const raiz = document.createElement('form');
  raiz.innerHTML = html;
  document.body.append(raiz);
  return raiz;
}

describe('enfocarPrimerError', () => {
  it('enfoca el primer campo inválido en orden de aparición', () => {
    const raiz = formulario('<input id="a"><input id="b" aria-invalid="true"><input id="c" aria-invalid="true">');
    expect(enfocarPrimerError(raiz)).toBe(true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('ignora los campos marcados como válidos', () => {
    const raiz = formulario('<input id="a" aria-invalid="false"><input id="b" aria-invalid="true">');
    enfocarPrimerError(raiz);
    expect(document.activeElement?.id).toBe('b');
  });

  it('encuentra el control dentro de un bloque con error aunque no declare aria-invalid', () => {
    const raiz = formulario('<input id="a"><section class="has-error"><button type="button" id="b">Cumpleaños</button></section>');
    enfocarPrimerError(raiz);
    expect(document.activeElement?.id).toBe('b');
  });

  it('devuelve false sin errores y no mueve el foco', () => {
    const raiz = formulario('<input id="a">');
    (raiz.querySelector('#a') as HTMLElement).focus();
    expect(enfocarPrimerError(raiz)).toBe(false);
    expect(document.activeElement?.id).toBe('a');
    expect(enfocarPrimerError(null)).toBe(false);
  });
});
