/**
 * El sitio donde quedan las observaciones cuando la maqueta se publica como artefacto.
 *
 * La página publicada puede pedirle al visor una base compartida y escribir ahí, de modo que lo
 * que anota quien revisa llega sin que tenga que mandarlo. Eso sólo existe para quien abre la
 * maqueta con sesión iniciada y permiso de escritura: alguien de fuera, con el enlace y sin
 * cuenta, no tiene dónde escribir y se queda con el envío por correo.
 *
 * Por eso nada de esto es la fuente de la verdad. El navegador guarda siempre su copia —ver
 * `observaciones-de-la-maqueta.ts`— y esto es un intento por encima: si no está disponible, la
 * maqueta funciona igual y lo dice en pantalla.
 *
 * En desarrollo `window.claude` no existe, así que todo esto resuelve «no disponible» sin ruido.
 */

/** Lo justo del tiempo de ejecución del artefacto que esta maqueta usa. */
interface BaseDelArtefacto {
  collection(ruta: string): { doc(id: string): { set(datos: unknown): Promise<unknown> } };
}
interface VisorDelArtefacto {
  id(): Promise<string>;
}
interface RuntimeDelArtefacto {
  use(nombre: string): Promise<unknown>;
}

function runtime(): RuntimeDelArtefacto | null {
  const w = window as unknown as { claude?: RuntimeDelArtefacto };
  return w.claude && typeof w.claude.use === 'function' ? w.claude : null;
}

/**
 * Resuelve la base y el visor una sola vez.
 *
 * `use` tarda —hasta diez segundos si nadie responde— y memoriza su respuesta, así que se pide al
 * guardar y no al cargar la página: el panel no debe esperar a nadie para dibujarse.
 */
let pedido: Promise<{ base: BaseDelArtefacto; visor: string } | null> | null = null;

function conectar(): Promise<{ base: BaseDelArtefacto; visor: string } | null> {
  if (pedido) return pedido;
  const claude = runtime();
  if (!claude) { pedido = Promise.resolve(null); return pedido; }
  pedido = (async () => {
    try {
      const [base, usuario] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!base || !usuario) return null;
      const visor = await (usuario as VisorDelArtefacto).id();
      return { base: base as BaseDelArtefacto, visor };
    } catch {
      return null;
    }
  })();
  return pedido;
}

/** Si esta vista puede escribir en la base, para decirlo en pantalla sin prometer de más. */
export async function hayDondeGuardar(): Promise<boolean> {
  return (await conectar()) !== null;
}

/**
 * Deja una observación en la base compartida.
 *
 * El documento lleva el visor y la vista en su nombre, de modo que dos personas que comenten la
 * misma pantalla no se pisen y que volver a comentar la misma reemplace lo anterior en vez de
 * acumular versiones de la misma opinión.
 *
 * Devuelve si quedó guardada. Un `false` no es un fallo que haya que reintentar: es que esta vista
 * no tiene dónde escribir, y entonces el envío por correo es el camino.
 */
export async function guardarEnLaNube(
  clave: string,
  observacion: { estado: 'ok' | 'nota'; texto?: string; cuando: string },
): Promise<boolean> {
  const conexion = await conectar();
  if (!conexion) return false;
  const nombre = `${conexion.visor}__${clave.replace(/[^a-zA-Z0-9]+/g, '-')}`.slice(0, 120);
  try {
    await conexion.base.collection('observaciones').doc(nombre).set({
      visor: conexion.visor,
      vista: clave,
      estado: observacion.estado,
      texto: observacion.texto ?? null,
      cuando: observacion.cuando,
    });
    return true;
  } catch {
    return false;
  }
}
