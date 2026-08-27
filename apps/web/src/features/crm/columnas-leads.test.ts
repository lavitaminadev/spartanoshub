import { beforeEach, describe, expect, it } from 'vitest';
import { COLUMNAS_POR_DEFECTO, guardarColumnas, leerColumnas } from './columnas-leads';

describe('columnas elegidas de la lista de prospectos', () => {
  beforeEach(() => window.localStorage.clear());

  it('la primera vez muestra el conjunto de fábrica', () => {
    expect(leerColumnas('commercial')).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it('recuerda lo elegido', () => {
    guardarColumnas('commercial', ['phone', 'status']);
    expect(leerColumnas('commercial')).toEqual(['phone', 'status']);
  });

  it('cada embudo recuerda lo suyo', () => {
    guardarColumnas('commercial', ['phone']);
    expect(leerColumnas('audience')).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it('descarta claves que ya no existen', () => {
    // La lista de columnas cambia con el producto; lo guardado en el navegador no.
    window.localStorage.setItem('crm.leads.columnas.commercial', JSON.stringify(['phone', 'columna_borrada']));
    expect(leerColumnas('commercial')).toEqual(['phone']);
  });

  it('vuelve al valor de fábrica si no queda ninguna válida', () => {
    // Una tabla con solo el nombre se lee como una pantalla rota, no como una elección.
    window.localStorage.setItem('crm.leads.columnas.commercial', JSON.stringify(['inventada']));
    expect(leerColumnas('commercial')).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it('un valor corrupto no rompe la pantalla', () => {
    window.localStorage.setItem('crm.leads.columnas.commercial', 'no es json');
    expect(leerColumnas('commercial')).toEqual(COLUMNAS_POR_DEFECTO);
  });
});
