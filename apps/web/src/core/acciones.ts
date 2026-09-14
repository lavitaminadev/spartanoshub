import type { User } from './auth';

/**
 * Si la persona puede hacer una acción fina. Sin dato (servidor anterior) se permite: el
 * servidor sigue siendo quien decide y rechaza lo que no corresponde.
 */
export function puedeAccion(user: User | null | undefined, clave: string): boolean {
  const valor = user?.acciones?.[clave];
  return valor === undefined ? true : valor;
}
