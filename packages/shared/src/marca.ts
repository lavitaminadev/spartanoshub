/**
 * Identidad de marca visible, en un solo lugar.
 *
 * Es la que aparece en los correos que recibe el cliente y en los textos de la interfaz. Vive
 * acá para que cambiar el nombre sea una edición y no una búsqueda y reemplazo con riesgo de
 * dejar mitades sin tocar, que es como quedó la vez anterior.
 *
 * Cubre solo lo que llega al cliente. Los identificadores técnicos —el ámbito de los paquetes,
 * el nombre de la base, las rutas del servidor— no pasan por acá: viven en su propia
 * configuración porque cambiarlos implica migrar datos y no solo texto.
 */
export const BRAND = {
  /** Nombre corto, para asuntos de correo y encabezados. */
  name: 'Espartanos',
  /** Nombre completo, para firmas y documentos. */
  legalName: 'Cuartel Espartano',
  /** Cómo firma el equipo al final de un correo. */
  teamSignature: 'Equipo Espartanos',
} as const;
