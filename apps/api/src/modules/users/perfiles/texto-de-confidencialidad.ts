/**
 * El texto que acepta quien concede acceso a datos de categoría especial.
 *
 * Subir `VERSION` cuando cambie el texto: cada aceptación queda ligada a la versión que se leyó,
 * y reescribir el texto sin cambiar la versión haría que una aceptación antigua pareciera haber
 * leído otra cosa.
 */
export const VERSION_DEL_TEXTO_DE_CONFIDENCIALIDAD = 1;

export const TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD = `Confidencialidad de datos protegidos (v${VERSION_DEL_TEXTO_DE_CONFIDENCIALIDAD})`;

export const TEXTO_DE_CONFIDENCIALIDAD =
  'Voy a dar acceso a datos personales de terceros que incluyen información de categoría especial, '
  + 'como alergias o restricciones alimentarias, que son datos de salud. '
  + 'Declaro que esa persona los necesita para su trabajo, que conoce su deber de confidencialidad '
  + 'y que sólo los usará para atender al titular. Sé que el acceso queda registrado y que '
  + 'puedo retirarlo en cualquier momento.';
