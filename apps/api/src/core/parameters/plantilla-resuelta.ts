/**
 * Lee una plantilla de correo con su respaldo de fábrica.
 *
 * Cada envío resolvía su texto a su manera, y seis lo tenían escrito en el código: no aparecían en
 * Correos y nadie podía cambiarlos. Esta función es la forma común de leerlos.
 *
 * **Si el texto guardado perdió una variable obligatoria, se usa el de fábrica.** Un correo de
 * acceso sin el enlace, o uno de contraseña sin la clave, llega igual y deja a la persona afuera.
 * Es preferible un texto genérico que funciona a uno personalizado que no.
 */

interface LectorDeParametros {
  get(clave: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<unknown>;
}

export interface PlantillaResuelta {
  encendido: boolean;
  asunto: string;
  cuerpo: string;
}

export async function leerPlantilla(
  parametros: LectorDeParametros,
  prefijo: string,
  alcance: { clientId?: string | null; organizationId?: string | null },
  respaldo: { asunto: string; cuerpo: string },
  opciones: {
    /** Variables sin las cuales el correo no sirve, como `enlace` o `clave`. */
    obligatorias?: string[];
    /** Qué hacer si el interruptor todavía no existe en la base. `null` = no tiene interruptor. */
    encendidoPorDefecto?: boolean | null;
  } = {},
): Promise<PlantillaResuelta> {
  const { clientId = null, organizationId = null } = alcance;
  const conInterruptor = opciones.encendidoPorDefecto !== null;
  const [asunto, cuerpo, interruptor] = await Promise.all([
    parametros.get(`${prefijo}_subject`, clientId, null, organizationId),
    parametros.get(`${prefijo}_body`, clientId, null, organizationId),
    conInterruptor ? parametros.get(`${prefijo}_enabled`, clientId, null, organizationId) : Promise.resolve(true),
  ]);

  const texto = { asunto: String(asunto ?? '') || respaldo.asunto, cuerpo: String(cuerpo ?? '') || respaldo.cuerpo };
  const completo = (opciones.obligatorias ?? []).every((variable) => new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`).test(`${texto.asunto} ${texto.cuerpo}`));

  return {
    encendido: interruptor === null || interruptor === undefined ? (opciones.encendidoPorDefecto ?? true) : Boolean(interruptor),
    ...(completo ? texto : respaldo),
  };
}
