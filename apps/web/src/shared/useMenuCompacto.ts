import { useCallback, useEffect, useState } from 'react';

/** Dónde se recuerda que el menú quedó en íconos. */
const CLAVE = 'vh.menu.compacto';

/** Punto bajo el cual la lateral pasa a ser un cajón y contraerla no aplica. */
const CONSULTA_MOVIL = '(max-width: 768px)';

/**
 * El menú contraído a íconos, compartido por los dos marcos.
 *
 * Vivía dentro del marco interno, así que una cuenta de empresa no tenía cómo contraerlo:
 * ganaba espacio en el CRM y lo perdía al volver a su portal, con el mismo menú y sin el botón.
 * Al ser un solo estado, la preferencia además sobrevive al cambio de pantalla.
 */
export function useMenuCompacto(): { menuCompacto: boolean; alternar: () => void; esMovil: boolean } {
  const [menuCompacto, setMenuCompacto] = useState(() => {
    try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
  });
  const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA_MOVIL).matches);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(CONSULTA_MOVIL);
    const alCambiar = (evento: MediaQueryListEvent) => setEsMovil(evento.matches);
    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, []);

  const alternar = useCallback(() => setMenuCompacto((actual) => {
    try { localStorage.setItem(CLAVE, actual ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return !actual;
  }), []);

  return { menuCompacto, alternar, esMovil };
}
