/**
 * La identidad de marca visible, ahora en `@espartanos/shared`.
 *
 * Se reexporta desde aquí para que los sitios que ya la importaban por esta ruta sigan
 * funcionando. Vive en el paquete compartido porque los correos que la usan también se generan
 * desde la web, para poder verlos antes de enviarlos.
 */
export { BRAND } from '@espartanos/shared';
