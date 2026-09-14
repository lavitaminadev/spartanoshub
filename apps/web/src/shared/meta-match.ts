export interface MetaMatchData {
  fbclid?: string;
  fbp?: string;
  fbc?: string;
}

function getCookie(name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

const CLAVE_CLIC = 'vh.meta.fbclid';
/** Meta considera válido el clic de un anuncio hasta 7 días para atribuir la conversión. */
const VIGENCIA_CLIC_MS = 7 * 24 * 3_600_000;

/**
 * Recuerda el fbclid y la hora en que llegó.
 *
 * Antes se leía sólo de la dirección al enviar: si la persona abría el anuncio, salía y volvía
 * por otro camino, la reserva llegaba sin clic. Y el `_fbc` armado a mano usaba la hora de envío,
 * no la del clic, que es la que Meta espera. Sólo se usa si la persona acepta la medición.
 */
function clicRecordado(fbclidEnUrl: string | undefined): { fbclid: string; hora: number } | undefined {
  try {
    if (fbclidEnUrl) {
      const previo = JSON.parse(localStorage.getItem(CLAVE_CLIC) || 'null') as { fbclid?: string; hora?: number } | null;
      const guardado = previo?.fbclid === fbclidEnUrl && previo.hora ? { fbclid: fbclidEnUrl, hora: previo.hora } : { fbclid: fbclidEnUrl, hora: Date.now() };
      localStorage.setItem(CLAVE_CLIC, JSON.stringify(guardado));
      return guardado;
    }
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CLIC) || 'null') as { fbclid?: string; hora?: number } | null;
    if (guardado?.fbclid && guardado.hora && Date.now() - guardado.hora < VIGENCIA_CLIC_MS) return { fbclid: guardado.fbclid, hora: guardado.hora };
  } catch { /* sin almacenamiento: queda lo que trae la dirección */ }
  return fbclidEnUrl ? { fbclid: fbclidEnUrl, hora: Date.now() } : undefined;
}

export function readMetaMatchData(): MetaMatchData {
  const params = new URLSearchParams(window.location.search);
  const clic = clicRecordado(params.get('fbclid') || undefined);
  const fbp = getCookie('_fbp') || undefined;
  const fbcCookie = getCookie('_fbc');
  const fbc = fbcCookie || (clic ? `fb.1.${clic.hora}.${clic.fbclid}` : undefined);
  return { fbclid: clic?.fbclid, fbp, fbc };
}
