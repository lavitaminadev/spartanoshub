import { describe, expect, it } from 'vitest';
import { rutaDeEmpresasSegunCargo } from './api';

/*
 * `/clients` es del módulo Clientes, que pertenece a la agencia: una cuenta de portal lo pide y
 * recibe 403. Doce pantallas lo llamaban cada una por su cuenta —Correos, CRM, Equipo, Encuestas,
 * Reservas, el buscador—, así que corregirlas una por una dejaba siempre alguna fuera. Se traduce
 * en el cliente HTTP, donde ninguna se escapa.
 */
describe('de dónde salen las empresas de cada cargo', () => {
  it('una cuenta de empresa las pide por la ruta del portal', () => {
    expect(rutaDeEmpresasSegunCargo('/clients', 'get', true)).toBe('/portal/empresas');
    expect(rutaDeEmpresasSegunCargo('/clients?limit=100', 'get', true)).toBe('/portal/empresas');
  });

  it('el equipo de la agencia sigue con la suya', () => {
    expect(rutaDeEmpresasSegunCargo('/clients', 'get', false)).toBeNull();
    expect(rutaDeEmpresasSegunCargo('/clients?limit=100', 'get', false)).toBeNull();
  });

  it('una empresa concreta no se toca: tiene su propia comprobación', () => {
    expect(rutaDeEmpresasSegunCargo('/clients/abc/overview', 'get', true)).toBeNull();
    expect(rutaDeEmpresasSegunCargo('/clients/abc', 'get', true)).toBeNull();
  });

  it('crear o editar tampoco: el portal no crea empresas', () => {
    expect(rutaDeEmpresasSegunCargo('/clients', 'post', true)).toBeNull();
  });

  it('otra ruta que empieza igual no se confunde', () => {
    expect(rutaDeEmpresasSegunCargo('/clients-min', 'get', true)).toBeNull();
  });
});
