/**
 * @fileoverview Reconoce a qué campo corresponde cada columna de un archivo importado.
 *
 * El mapeo es por **nombre de columna y no por posición**, así que el orden del archivo da igual:
 * una planilla con el teléfono en la primera columna y otra con él en la última se importan las
 * dos sin tocar nada.
 *
 * Lo que no reconoce queda sin asignar y a la vista, para que se corrija a mano. Adivinar mal en
 * silencio es peor que no adivinar: mete correos en el campo de notas y nadie lo nota hasta que
 * intenta escribirle a alguien.
 */

export type TargetField = 'name' | 'email' | 'phone' | 'company' | 'notes';

/**
 * Reduce un encabezado a su forma comparable.
 *
 * Quita acentos, mayúsculas y todo lo que no sea letra o número. Así `Teléfono`, `TELEFONO`,
 * `telefono_movil` y `Teléfono / Móvil` llegan a la misma cadena, que es la diferencia entre
 * reconocer una planilla exportada de otro sistema o pedirle a alguien que mapee ocho columnas
 * a mano.
 */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Nombres que se reconocen para cada campo, ya normalizados al compararse.
 *
 * El orden importa: se evalúan de arriba abajo y gana el primero que coincide. `email` va antes
 * que `name` porque «nombre de correo» contiene ambas palabras y pertenece al correo.
 */
const ALIASES: Array<[TargetField, string[]]> = [
  ['email', ['email', 'correo', 'mail', 'correoelectronico', 'emailaddress', 'e']],
  ['phone', ['telefono', 'phone', 'celular', 'movil', 'fono', 'whatsapp', 'contacto', 'numero', 'mobile', 'phonenumber']],
  ['company', ['empresa', 'company', 'negocio', 'organizacion', 'razonsocial', 'compania']],
  ['notes', ['notas', 'notes', 'comentario', 'comentarios', 'observaciones', 'mensaje', 'detalle', 'descripcion']],
  ['name', ['nombre', 'name', 'nombrecompleto', 'fullname', 'cliente', 'persona', 'prospecto', 'lead']],
];

/**
 * Campo al que corresponde una columna, o cadena vacía si no se reconoce.
 *
 * Primero busca coincidencia exacta y después por contenido. El orden entre ambas evita que
 * `nombre` caiga en `phone` por contener «nombre de contacto»: una columna llamada exactamente
 * `nombre` es el nombre, sin ambigüedad.
 */
export function guessField(header: string): TargetField | '' {
  const normalizado = normalizeHeader(header);
  if (!normalizado) return '';

  const exacto = ALIASES.find(([, alias]) => alias.includes(normalizado));
  if (exacto) return exacto[0];

  const parcial = ALIASES.find(([, alias]) => alias.some((a) => a.length > 3 && normalizado.includes(a)));
  return parcial ? parcial[0] : '';
}

/**
 * Adivina el mapeo de todas las columnas a la vez.
 *
 * Ningún campo se asigna dos veces: si dos columnas se parecen al mismo —«Teléfono» y «Teléfono
 * secundario»— gana la primera y la segunda queda libre para asignarse a mano. Sin esta regla, la
 * segunda pisaba a la primera y se importaba el dato equivocado sin aviso.
 */
export function guessMapping(headers: string[]): Record<string, TargetField | ''> {
  const usados = new Set<TargetField>();
  const resultado: Record<string, TargetField | ''> = {};

  for (const header of headers) {
    const campo = guessField(header);
    if (campo && !usados.has(campo)) {
      usados.add(campo);
      resultado[header] = campo;
    } else {
      resultado[header] = '';
    }
  }
  return resultado;
}
