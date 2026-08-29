/**
 * Cómo se lee y se limpia una lista de correos antes de guardarla.
 *
 * Un archivo exportado de Google Forms no viene con la forma que necesita la base: las columnas
 * se llaman como la pregunta que se hizo, los correos traen espacios y mayúsculas, y la casilla
 * de «acepto recibir novedades» es un texto en español que hay que interpretar.
 *
 * Vive aparte del servicio para poder probar la interpretación sin base de datos, que es donde
 * están los errores que importan: una fila mal leída se convierte en un correo a alguien que no
 * lo pidió, y eso no se deshace.
 */

/** Una fila ya interpretada, lista para decidir si entra. */
export interface FilaImportada {
  email: string;
  name?: string;
  /** Si la fila trae una respuesta afirmativa a la pregunta de consentimiento. */
  acepta: boolean;
  /** La respuesta tal cual, para guardarla como prueba de qué dijo. */
  respuestaCruda?: string;
}

/** Lo que pasó con el archivo entero. */
export interface ResumenDeImportacion {
  filas: FilaImportada[];
  /** Filas descartadas y por qué, para poder decírselo a quien subió el archivo. */
  descartadas: Array<{ linea: number; motivo: string }>;
}

/**
 * Nombres de columna que se reconocen para cada dato.
 *
 * Se acepta español e inglés porque Google Forms nombra la columna con la pregunta literal, y
 * nadie va a renombrar el archivo antes de subirlo. Lo que no se reconoce se ignora: importar
 * columnas desconocidas es cómo acaban datos personales que nadie pidió en una lista de envío.
 */
const COLUMNAS = {
  email: ['email', 'correo', 'correo electrónico', 'correo electronico', 'e-mail', 'mail', 'dirección de correo electrónico'],
  name: ['nombre', 'name', 'nombre completo', 'full name', 'apellido y nombre'],
  consent: ['acepta', 'acepto', 'consentimiento', 'promociones', 'novedades', 'newsletter', 'suscripción', 'suscripcion', 'marketing'],
} as const;

/**
 * Respuestas que cuentan como un sí.
 *
 * Deliberadamente cortas y explícitas. Cualquier otra cosa —vacío, «tal vez», un texto largo— se
 * trata como un no: **el consentimiento tiene que ser inequívoco**, y ante la duda la persona
 * queda en la lista sin poder recibir campañas, que es reversible. Lo contrario no lo es.
 */
const AFIRMATIVAS = new Set([
  'si', 'sí', 'yes', 'true', '1', 'acepto', 'de acuerdo', 'x', 'ok',
  'sí, acepto', 'si, acepto', 'acepto recibir novedades',
]);

/** Un correo con forma de correo. No valida que exista; eso lo dirá el primer envío. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Quita acentos y espacios para comparar nombres de columna sin depender de cómo se escribieron. */
function clave(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Índice de la primera columna cuyo encabezado coincide, o `-1`. */
function columnaDe(encabezados: string[], candidatos: readonly string[]): number {
  const normalizados = encabezados.map(clave);
  const buscados = candidatos.map(clave);
  // Coincidencia exacta primero: «nombre» debe ganar a «nombre de la empresa» si están las dos.
  const exacta = normalizados.findIndex((cabecera) => buscados.includes(cabecera));
  if (exacta >= 0) return exacta;
  return normalizados.findIndex((cabecera) => buscados.some((buscado) => cabecera.includes(buscado)));
}

/**
 * Parte una línea de CSV respetando las comillas.
 *
 * Hace falta porque las respuestas de un formulario llevan comas dentro —«Sí, acepto»— y partir
 * por comas a secas rompe la fila y desplaza todas las columnas siguientes.
 */
export function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      // Dos comillas seguidas dentro de un campo entrecomillado son una comilla literal.
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i += 1; continue; }
      entreComillas = !entreComillas;
      continue;
    }
    if ((caracter === ',' || caracter === ';') && !entreComillas) { campos.push(actual); actual = ''; continue; }
    actual += caracter;
  }
  campos.push(actual);
  return campos.map((campo) => campo.trim());
}

/**
 * Interpreta un CSV de correos.
 *
 * @param contenido - El archivo entero como texto.
 * @param maximo - Tope de filas. Un archivo enorme no puede tumbar el servidor ni convertirse en
 *   un envío masivo por accidente.
 * @returns Las filas utilizables y el detalle de lo descartado.
 */
export function interpretarCsv(contenido: string, maximo = 5000): ResumenDeImportacion {
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim().length > 0);
  if (lineas.length < 2) {
    return { filas: [], descartadas: [{ linea: 1, motivo: 'El archivo no tiene encabezado y datos' }] };
  }

  const encabezados = partirLinea(lineas[0]);
  const iEmail = columnaDe(encabezados, COLUMNAS.email);
  if (iEmail < 0) {
    return {
      filas: [],
      descartadas: [{ linea: 1, motivo: 'No se encontró una columna de correo' }],
    };
  }
  const iNombre = columnaDe(encabezados, COLUMNAS.name);
  const iConsent = columnaDe(encabezados, COLUMNAS.consent);

  const filas: FilaImportada[] = [];
  const descartadas: ResumenDeImportacion['descartadas'] = [];
  const vistos = new Set<string>();

  for (let n = 1; n < lineas.length && filas.length < maximo; n += 1) {
    const campos = partirLinea(lineas[n]);
    const email = (campos[iEmail] ?? '').trim().toLowerCase();

    if (!email) { descartadas.push({ linea: n + 1, motivo: 'Sin correo' }); continue; }
    if (!CORREO.test(email)) { descartadas.push({ linea: n + 1, motivo: 'El correo no tiene forma de correo' }); continue; }
    // Un archivo con la misma dirección dos veces produciría dos envíos a la misma persona.
    if (vistos.has(email)) { descartadas.push({ linea: n + 1, motivo: 'Repetido en el archivo' }); continue; }
    vistos.add(email);

    const respuestaCruda = iConsent >= 0 ? (campos[iConsent] ?? '').trim() : undefined;

    filas.push({
      email,
      name: iNombre >= 0 ? (campos[iNombre] ?? '').trim() || undefined : undefined,
      /*
       * Sin columna de consentimiento, **nadie acepta**.
       *
       * Es la decisión que evita el peor error posible: dar por consentido lo que no consta. Esas
       * filas entran igual, en estado pendiente, y se les puede pedir permiso una vez.
       */
      acepta: respuestaCruda !== undefined && AFIRMATIVAS.has(clave(respuestaCruda)),
      respuestaCruda,
    });
  }

  return { filas, descartadas };
}
