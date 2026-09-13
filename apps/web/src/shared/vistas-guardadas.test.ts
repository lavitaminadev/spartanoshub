/**
 * Qué se garantiza: guardar un recorte con nombre no pierde los anteriores, repetir un nombre
 * reemplaza en vez de duplicar, y un almacenamiento roto nunca deja la pantalla sin lista.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { borrarVista, guardarVista, leerVistas } from './vistas-guardadas';

describe('vistas guardadas', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda y devuelve lo guardado', () => {
    guardarVista('reservas', 'Hoy sin confirmar', { status: 'pending' });
    expect(leerVistas('reservas')).toEqual([{ nombre: 'Hoy sin confirmar', filtros: { status: 'pending' } }]);
  });

  it('reemplaza en su sitio cuando el nombre se repite, sin distinguir mayúsculas', () => {
    guardarVista('reservas', 'Grupos', { status: 'a' });
    guardarVista('reservas', 'Otra', { status: 'b' });
    guardarVista('reservas', 'grupos', { status: 'c' });
    expect(leerVistas('reservas')).toEqual([
      { nombre: 'grupos', filtros: { status: 'c' } },
      { nombre: 'Otra', filtros: { status: 'b' } },
    ]);
  });

  it('no guarda una vista sin nombre', () => {
    guardarVista('reservas', '   ', { status: 'x' });
    expect(leerVistas('reservas')).toEqual([]);
  });

  it('cada lista guarda las suyas', () => {
    guardarVista('reservas', 'A', { x: 1 });
    guardarVista('crm', 'B', { y: 2 });
    expect(leerVistas('reservas').map((vista) => vista.nombre)).toEqual(['A']);
    expect(leerVistas('crm').map((vista) => vista.nombre)).toEqual(['B']);
  });

  it('descarta la más antigua al llegar al tope', () => {
    for (let i = 1; i <= 14; i += 1) guardarVista('reservas', `Vista ${i}`, { i });
    const nombres = leerVistas('reservas').map((vista) => vista.nombre);
    expect(nombres).toHaveLength(12);
    expect(nombres[0]).toBe('Vista 3');
  });

  it('borra por nombre y deja el resto', () => {
    guardarVista('reservas', 'A', { x: 1 });
    guardarVista('reservas', 'B', { x: 2 });
    expect(borrarVista('reservas', 'A').map((vista) => vista.nombre)).toEqual(['B']);
  });

  /*
   * El almacenamiento del navegador sobrevive a los cambios de formato y puede venir de una
   * versión anterior: una pantalla en blanco por un dato viejo es peor que perder unas vistas.
   */
  it('devuelve una lista vacía si lo guardado no se puede leer', () => {
    window.localStorage.setItem('vh.vistas.reservas', '{no es json');
    expect(leerVistas('reservas')).toEqual([]);
  });

  it('descarta entradas sin nombre dentro de un guardado válido', () => {
    window.localStorage.setItem('vh.vistas.reservas', JSON.stringify([{ nombre: 'Buena', filtros: {} }, { filtros: {} }, { nombre: '  ' }]));
    expect(leerVistas('reservas').map((vista) => vista.nombre)).toEqual(['Buena']);
  });

  it('no falla si el navegador no deja escribir', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('lleno'); });
    expect(() => guardarVista('reservas', 'A', { x: 1 })).not.toThrow();
  });
});
