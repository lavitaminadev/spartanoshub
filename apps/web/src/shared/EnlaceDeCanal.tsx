/**
 * @fileoverview Enlaces cortos por canal: `/book/local/whatsapp` o `/survey/id/qr-mesa/dia-madre`.
 *
 * Se comparten cortos y legibles. Al abrirlos, la página se reemplaza por la misma dirección con
 * UTM estándar antes de cargar: así la reserva o la respuesta guardan su canal y Google Analytics
 * lo atribuye igual que a un enlace con UTM escrito a mano.
 */

import type { JSX } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { CANALES } from './PanelCompartir';

/** Medio UTM que corresponde a una fuente corta. */
export function medioDeFuente(fuente: string): string {
  const conocido = CANALES.find((canal) => canal.fuente === fuente);
  if (conocido) return conocido.medio;
  return fuente.startsWith('qr') ? 'qr' : 'referral';
}

const SEGMENTO = /^[a-z0-9_-]{1,40}$/;

export function RedireccionDeCanal({ base }: { base: 'book' | 'survey' }): JSX.Element {
  const { slug = '', canal = '', campana } = useParams();
  const { search } = useLocation();
  const destino = new URLSearchParams(search);
  // Sólo segmentos simples: cualquier otra cosa se ignora y abre la página sin atribución.
  if (SEGMENTO.test(canal) && !destino.has('utm_source')) {
    destino.set('utm_source', canal);
    destino.set('utm_medium', medioDeFuente(canal));
    if (campana && SEGMENTO.test(campana)) destino.set('utm_campaign', campana);
  }
  const consulta = destino.toString();
  return <Navigate replace to={`/${base}/${encodeURIComponent(slug)}${consulta ? `?${consulta}` : ''}`} />;
}
