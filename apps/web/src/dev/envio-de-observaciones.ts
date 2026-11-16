/**
 * El envío de lo que anotó quien revisa la maqueta.
 *
 * La maqueta se publica como una página sin servidor propio, así que no tiene dónde dejar un
 * mensaje: entregarlo exige salir hacia algún sitio. Lo hace contra un servicio de formularios,
 * que recibe el texto y lo reenvía por correo a la dirección que lo dio de alta.
 *
 * La clave de acceso va escrita acá a propósito. No es un secreto —el propio servicio la publica
 * como pensada para el código del cliente— y su valor es justamente que la dirección de destino no
 * aparece en la página: la sabe el servicio, no quien abre el enlace.
 *
 * Nada de esto reemplaza la copia del navegador. Si el envío falla —sin red, bloqueado por una
 * extensión, agotado el cupo del mes—, lo anotado sigue donde estaba y se puede descargar.
 */

const CLAVE_DE_ACCESO = '3b341e40-0403-42b8-a2f3-5ab889ffd991';
const DIRECCION = 'https://api.web3forms.com/submit';

export interface ResultadoDelEnvio {
  ok: boolean;
  mensaje: string;
}

/**
 * Manda el informe y dice si llegó.
 *
 * `nombre` es obligatorio porque un comentario sin autor no se puede responder ni contrastar; el
 * correo es opcional y sirve sólo para poder contestarle.
 */
export async function enviarObservaciones(
  nombre: string,
  correo: string,
  asunto: string,
  cuerpo: string,
): Promise<ResultadoDelEnvio> {
  const datos = new FormData();
  datos.append('access_key', CLAVE_DE_ACCESO);
  datos.append('subject', asunto);
  datos.append('from_name', `Revisión de la maqueta · ${nombre}`);
  datos.append('name', nombre);
  if (correo.trim()) datos.append('email', correo.trim());
  datos.append('message', cuerpo);

  try {
    const respuesta = await fetch(DIRECCION, { method: 'POST', body: datos });
    const contenido = (await respuesta.json()) as { success?: boolean; message?: string };
    if (respuesta.ok && contenido.success) {
      return { ok: true, mensaje: 'Enviado. Gracias: ya está en el correo del equipo.' };
    }
    return { ok: false, mensaje: contenido.message ?? 'El envío no fue aceptado.' };
  } catch {
    return { ok: false, mensaje: 'No se pudo enviar. Revisa la conexión, o descarga el archivo y mándalo a mano.' };
  }
}
