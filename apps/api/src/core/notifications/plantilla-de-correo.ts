/**
 * El armazón de los correos, ahora en `@espartanos/shared`.
 *
 * Se reexporta desde aquí para no tocar los once sitios que lo importaban por esta ruta. Está en
 * el paquete compartido para que la web pueda dibujar el mismo HTML que sale enviado: una vista
 * previa que imite el correo en vez de generarlo deja de parecerse en cuanto cambia una.
 */
export {
  escaparHtml,
  rellenar,
  armazonDeCorreo,
  componerCorreo,
  textoDesdeHtml,
} from '@espartanos/shared';
export type {
  VariablesDePlantilla,
  AccionDeCorreo,
  TarjetaDeCorreo,
  DetalleDeCorreo,
  MarcaDelCorreo,
} from '@espartanos/shared';
