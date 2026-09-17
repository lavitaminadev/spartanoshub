/**
 * @fileoverview Qué servicios tiene contratados la empresa que se está mirando.
 *
 * Cada empresa contrata Reservas, CRM y Encuestas por separado. Los enlaces entre módulos se
 * pintaban siempre, así que una empresa que sólo usa Reservas veía una puerta que no le abre.
 */

export interface EmpresaConServicios {
  id: string;
  capabilities?: Record<string, boolean>;
}

/**
 * @param servicio Clave del servicio, como la guarda la empresa (`surveys`, `crm`, `reservations`).
 * @param empresas Las empresas visibles para quien mira.
 * @param elegida Empresa filtrada en pantalla, si hay una.
 * @returns `true` cuando el enlace sirve de algo: con una empresa elegida manda la suya, y mirando
 *   varias basta con que alguna lo tenga. Sin dato se asume contratado, que es como se comportaba
 *   antes de existir esta comprobación.
 */
export function empresaOfrece(
  servicio: string,
  empresas: EmpresaConServicios[],
  elegida?: string,
): boolean {
  const empresa = empresas.find((item) => item.id === elegida);
  if (empresa) return empresa.capabilities?.[servicio] !== false;
  if (empresas.length === 0) return true;
  return empresas.some((item) => item.capabilities?.[servicio] !== false);
}
