/**
 * @fileoverview Filtros con nombre, para no volver a armarlos cada vez.
 *
 * Una lista larga se usa siempre a través de los mismos tres o cuatro recortes —«las de hoy sin
 * confirmar», «los grupos de este mes»—, y hasta ahora había que rearmarlos a mano en cada
 * visita: los filtros vivían en el estado de la pantalla y se perdían al recargar.
 *
 * Se guardan en el navegador de cada persona, no en el servidor. Eso significa que **no se
 * comparten con el equipo** y que se pierden al cambiar de computador o al limpiar el sitio: son
 * una comodidad, no un dato del negocio. Compartirlas obligaría a una tabla, permisos y decidir
 * quién puede borrar la vista de otro, que es una función distinta y más cara.
 *
 * Cada lista guarda las suyas bajo su propio `ambito`, así que renombrar o quitar un filtro de
 * una pantalla no toca las de las demás.
 */

const PREFIJO = 'vh.vistas';
const MAXIMO = 12;

export interface VistaGuardada<T> {
  /** Lo que escribió la persona. Es también su identidad: guardar con un nombre repetido reemplaza. */
  nombre: string;
  /** El recorte tal cual lo entiende la pantalla que lo guardó. */
  filtros: T;
}

function clave(ambito: string): string {
  return `${PREFIJO}.${ambito}`;
}

/**
 * Lee las vistas de una lista.
 *
 * Cualquier contenido ilegible se descarta en silencio y se devuelve una lista vacía: una
 * pantalla rota por un dato viejo del navegador es peor que perder unos filtros guardados.
 */
export function leerVistas<T>(ambito: string): Array<VistaGuardada<T>> {
  try {
    const crudo = window.localStorage.getItem(clave(ambito));
    if (!crudo) return [];
    const valor = JSON.parse(crudo) as unknown;
    if (!Array.isArray(valor)) return [];
    return valor.filter((item): item is VistaGuardada<T> => (
      Boolean(item) && typeof (item as VistaGuardada<T>).nombre === 'string' && (item as VistaGuardada<T>).nombre.trim().length > 0
    ));
  } catch {
    return [];
  }
}

/**
 * Guarda un recorte con nombre y devuelve la lista resultante.
 *
 * Repetir un nombre reemplaza al anterior en su sitio, en vez de dejar dos entradas iguales que
 * sólo se distinguen abriéndolas. Al llegar al tope se descarta la más antigua: sin límite, el
 * desplegable termina siendo tan difícil de recorrer como rearmar el filtro a mano.
 */
export function guardarVista<T>(ambito: string, nombre: string, filtros: T): Array<VistaGuardada<T>> {
  const limpio = nombre.trim().slice(0, 60);
  if (!limpio) return leerVistas<T>(ambito);
  const actuales = leerVistas<T>(ambito);
  const indice = actuales.findIndex((vista) => vista.nombre.toLowerCase() === limpio.toLowerCase());
  const siguiente = indice >= 0
    ? actuales.map((vista, i) => (i === indice ? { nombre: limpio, filtros } : vista))
    : [...actuales, { nombre: limpio, filtros }].slice(-MAXIMO);
  escribir(ambito, siguiente);
  return siguiente;
}

/** Borra una vista por su nombre y devuelve la lista resultante. */
export function borrarVista<T>(ambito: string, nombre: string): Array<VistaGuardada<T>> {
  const siguiente = leerVistas<T>(ambito).filter((vista) => vista.nombre !== nombre);
  escribir(ambito, siguiente);
  return siguiente;
}

function escribir<T>(ambito: string, vistas: Array<VistaGuardada<T>>): void {
  try {
    window.localStorage.setItem(clave(ambito), JSON.stringify(vistas));
  } catch {
    /* El navegador puede tener el almacenamiento lleno o bloqueado: no es motivo para fallar. */
  }
}
