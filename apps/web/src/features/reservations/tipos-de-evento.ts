/**
 * @fileoverview Tipos de evento que ofrece cada sucursal en la solicitud de grupo.
 *
 * El local los nombra como quiera («Despedida de soltera», «After office»). Cada uno pertenece a
 * una categoría fija, que es lo que guarda el servidor y usan los reportes: así un nombre nuevo no
 * rompe la agrupación ni requiere cambiar la base de datos.
 */

export type CategoriaDeEvento = 'cumpleanos' | 'aniversario' | 'empresa' | 'otro';

export interface TipoDeEvento {
  nombre: string;
  categoria: CategoriaDeEvento;
}

export const CATEGORIAS_DE_EVENTO: Array<{ valor: CategoriaDeEvento; nombre: string }> = [
  { valor: 'cumpleanos', nombre: 'Cumpleaños' },
  { valor: 'aniversario', nombre: 'Aniversario o celebración' },
  { valor: 'empresa', nombre: 'Empresa' },
  { valor: 'otro', nombre: 'Otro' },
];

export const TIPOS_POR_DEFECTO: TipoDeEvento[] = [
  { nombre: 'Cumpleaños', categoria: 'cumpleanos' },
  { nombre: 'Aniversario / celebración', categoria: 'aniversario' },
  { nombre: 'Comida o evento de empresa', categoria: 'empresa' },
  { nombre: 'Otro grupo', categoria: 'otro' },
];

/**
 * Lee la lista guardada; si falta o está dañada, usa la de siempre.
 *
 * @param conVacios El editor conserva las filas recién agregadas sin nombre; la página las omite.
 */
export function leerTiposDeEvento(valor: unknown, conVacios = false): TipoDeEvento[] {
  if (typeof valor !== 'string' || !valor.trim()) return TIPOS_POR_DEFECTO;
  try {
    const lista = JSON.parse(valor) as unknown;
    if (!Array.isArray(lista)) return TIPOS_POR_DEFECTO;
    const validos = lista
      .filter((item): item is TipoDeEvento => Boolean(item) && typeof (item as TipoDeEvento).nombre === 'string' && CATEGORIAS_DE_EVENTO.some((c) => c.valor === (item as TipoDeEvento).categoria))
      // En el editor no se recorta mientras se escribe: si no, el espacio entre palabras desaparece.
      .map((item) => ({ nombre: (conVacios ? item.nombre : item.nombre.trim()).slice(0, 60), categoria: item.categoria }))
      .filter((item) => conVacios || item.nombre);
    return validos.length ? validos.slice(0, 12) : TIPOS_POR_DEFECTO;
  } catch {
    return TIPOS_POR_DEFECTO;
  }
}
