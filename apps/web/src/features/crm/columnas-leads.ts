/**
 * Qué columnas se ven en la lista de prospectos, y cómo se recuerda esa elección.
 *
 * Once columnas no caben en una pantalla: los nombres largos se parten en tres líneas y la
 * tabla deja de leerse de un vistazo. Antes que decidir por todos cuáles sobran —que depende
 * de si estás llamando, cotizando o repartiendo trabajo— se deja elegir, y se recuerda.
 *
 * Vive aparte del panel para poder probarlo: lo que hay que garantizar es que la elección
 * guardada nunca deje la tabla sin la columna que identifica a la persona.
 */

/** Columnas que se pueden ocultar. El prospecto no está: sin él la fila no identifica a nadie. */
export const COLUMNAS_OPCIONALES = [
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo' },
  { key: 'company', label: 'Empresa' },
  { key: 'source', label: 'Origen' },
  { key: 'status', label: 'Etapa' },
  { key: 'tags', label: 'Etiqueta' },
  { key: 'fit', label: 'Calidad' },
  { key: 'owner', label: 'Responsable' },
  { key: 'created', label: 'Ingreso' },
] as const;

export type ColumnaOpcional = (typeof COLUMNAS_OPCIONALES)[number]['key'];

/**
 * Lo que se ve la primera vez.
 *
 * Etiqueta y Empresa quedan fuera: casi siempre vienen vacías —el origen ya dice de dónde viene
 * el lead— y ocupan el ancho que necesitan el nombre y el correo.
 */
export const COLUMNAS_POR_DEFECTO: ColumnaOpcional[] = [
  'phone', 'email', 'source', 'status', 'fit', 'owner', 'created',
];

const CLAVE_GUARDADA = 'crm.leads.columnas';

/**
 * Lee la elección guardada.
 *
 * Cualquier valor corrupto o desconocido se descarta en silencio y se vuelve al valor de
 * fábrica: una tabla sin columnas por un dato viejo se ve como una pantalla rota, y el
 * almacenamiento del navegador sobrevive a los cambios de esta lista.
 *
 * @param dominio Embudo que se está mirando; cada uno recuerda lo suyo.
 */
export function leerColumnas(dominio: string): ColumnaOpcional[] {
  try {
    const guardado = window.localStorage.getItem(`${CLAVE_GUARDADA}.${dominio}`);
    if (!guardado) return COLUMNAS_POR_DEFECTO;
    const claves = JSON.parse(guardado);
    if (!Array.isArray(claves)) return COLUMNAS_POR_DEFECTO;
    const validas = claves.filter((clave): clave is ColumnaOpcional => (
      COLUMNAS_OPCIONALES.some((columna) => columna.key === clave)
    ));
    return validas.length ? validas : COLUMNAS_POR_DEFECTO;
  } catch {
    return COLUMNAS_POR_DEFECTO;
  }
}

/** Guarda la elección. Si el navegador no deja escribir, la sesión sigue funcionando. */
export function guardarColumnas(dominio: string, claves: ColumnaOpcional[]): void {
  try {
    window.localStorage.setItem(`${CLAVE_GUARDADA}.${dominio}`, JSON.stringify(claves));
  } catch {
    // Modo privado o almacenamiento lleno: la elección dura lo que la pantalla.
  }
}
