/**
 * @fileoverview Panel para compartir una página pública (reserva o encuesta) con medición.
 *
 * Cada canal genera su enlace con UTM estándar —`utm_source`, `utm_medium` y, si se escribe,
 * `utm_campaign`—, que es lo que leen Google Analytics, Meta y los resultados propios. Usar el
 * mismo formato en Reservas y Encuestas hace que un canal se llame igual en todos los reportes.
 */

import { useEffect, useState, type JSX, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { triggerToast } from './toast-events';
import './PanelCompartir.css';

/** Canales habituales: fuente y medio con los valores que Google Analytics agrupa bien. */
export const CANALES: Array<{ fuente: string; medio: string; nombre: string; ayuda: string }> = [
  { fuente: 'whatsapp', medio: 'social', nombre: 'WhatsApp', ayuda: 'Mensajes y estados.' },
  { fuente: 'instagram', medio: 'social', nombre: 'Instagram', ayuda: 'Bio, historias o mensajes.' },
  { fuente: 'facebook', medio: 'social', nombre: 'Facebook', ayuda: 'Página o publicaciones.' },
  { fuente: 'google', medio: 'maps', nombre: 'Google Maps', ayuda: 'Botón de tu ficha de Google.' },
  { fuente: 'sitio-web', medio: 'referral', nombre: 'Sitio web', ayuda: 'Botón o banner en tu página.' },
  { fuente: 'correo', medio: 'email', nombre: 'Correo propio', ayuda: 'Si lo envías desde tu correo.' },
];

const QRS: Array<{ fuente: string; nombre: string }> = [
  { fuente: 'qr-local', nombre: 'QR en el local' },
  { fuente: 'qr-mesa', nombre: 'QR de mesa' },
  { fuente: 'qr-boleta', nombre: 'QR en boleta' },
  { fuente: 'qr-flyer', nombre: 'QR en flyer' },
  { fuente: 'qr-vitrina', nombre: 'QR en vitrina' },
];

/** Nombre legible de una fuente registrada, para resultados. */
export function nombreDeFuente(fuente: string | null | undefined): string {
  if (!fuente) return 'Directo';
  return CANALES.find((c) => c.fuente === fuente)?.nombre ?? QRS.find((q) => q.fuente === fuente)?.nombre ?? fuente;
}

/** Texto apto para una UTM: minúsculas, sin tildes ni espacios. */
export function limpiarUtm(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Enlace corto por canal: `<base>/<fuente>[/<campaña>]`. Al abrirse se convierte en UTM (ver
 * `EnlaceDeCanal`). Si la dirección base trae parámetros, se usa la forma larga con UTM.
 */
export function enlaceCorto(base: string, fuente: string, campana?: string): string {
  try {
    const url = new URL(base, window.location.origin);
    if (url.search || url.hash) return enlaceConUtm(base, fuente, fuente.startsWith('qr') ? 'qr' : CANALES.find((c) => c.fuente === fuente)?.medio ?? 'referral', campana);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${fuente}${campana ? `/${campana}` : ''}`;
    return url.toString();
  } catch {
    return base;
  }
}

/** Enlace con UTM. Conserva los parámetros que ya tenga la dirección base. */
export function enlaceConUtm(base: string, fuente: string, medio: string, campana?: string): string {
  try {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('utm_source', fuente);
    url.searchParams.set('utm_medium', medio);
    if (campana) url.searchParams.set('utm_campaign', campana); else url.searchParams.delete('utm_campaign');
    return url.toString();
  } catch {
    return base;
  }
}

export function PanelCompartir({ abierto, titulo, nombre, urlBase, onCerrar, pie, extra, textoAbrir = 'Abrir ↗' }: {
  abierto: boolean;
  /** Título del panel. */
  titulo: string;
  /** Nombre de lo que se comparte: va en el QR impreso y en el archivo descargado. */
  nombre: string;
  /** Dirección pública sin UTM. */
  urlBase: string;
  onCerrar: () => void;
  /** Nota al final, por ejemplo el estado de la medición. */
  pie?: ReactNode;
  /** Sección adicional propia de cada módulo (envío por correo, etc.). */
  extra?: ReactNode;
  textoAbrir?: string;
}): JSX.Element {
  const [campana, setCampana] = useState('');
  const [propio, setPropio] = useState('');
  const [qrFuente, setQrFuente] = useState('qr-local');
  const [qr, setQr] = useState('');
  const utmCampana = limpiarUtm(campana);
  const utmPropio = limpiarUtm(propio);
  // Cortos y legibles para compartir; al abrirse quedan con UTM estándar.
  const enlace = (fuente: string, _medio?: string) => enlaceCorto(urlBase, fuente, utmCampana || undefined);

  useEffect(() => {
    if (!abierto || !urlBase) return;
    let vigente = true;
    setQr('');
    // Nivel M: se lee con una esquina manchada sin volverse tan denso que un teléfono viejo tarde.
    QRCode.toDataURL(enlace(qrFuente), { width: 720, margin: 2, errorCorrectionLevel: 'M' })
      .then((datos) => { if (vigente) setQr(datos); })
      .catch(() => undefined);
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, urlBase, qrFuente, utmCampana]);

  /**
   * Canales propios de esta página, recordados en este navegador.
   *
   * Antes el campo sólo servía para copiar un enlace y se perdía al cerrar: el mismo influencer o
   * la misma radio había que volver a escribirlos cada vez, y bastaba una letra distinta para que
   * los resultados los contaran como dos canales diferentes.
   */
  const claveDeCanales = `vh.compartir.canales.${urlBase}`;
  const [propios, setPropios] = useState<string[]>([]);
  useEffect(() => {
    if (!abierto || !urlBase) return;
    try { setPropios(JSON.parse(localStorage.getItem(claveDeCanales) ?? '[]')); } catch { setPropios([]); }
  }, [abierto, urlBase, claveDeCanales]);

  const guardarPropios = (lista: string[]) => {
    setPropios(lista);
    try { localStorage.setItem(claveDeCanales, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  };

  const agregarPropio = () => {
    if (!utmPropio || propios.includes(utmPropio)) { setPropio(''); return; }
    guardarPropios([...propios, utmPropio].slice(-12));
    setPropio('');
    triggerToast(`Canal «${utmPropio}» agregado`);
  };

  const copiar = async (texto: string, aviso = 'Enlace copiado') => {
    try { await navigator.clipboard.writeText(texto); triggerToast(aviso); } catch { triggerToast('No se pudo copiar; selecciona el enlace y cópialo a mano', 'error'); }
  };

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'width=600,height=800');
    if (!ventana) return;
    const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    ventana.document.write(`<!doctype html><title>${escapar(nombre)}</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}img{width:320px;height:320px}h1{font-size:22px;margin:0 0 6px}p{color:#444;margin:0 0 18px}</style><h1>${escapar(nombre)}</h1><p>Escanea con la cámara de tu teléfono</p><img src="${qr}" alt="">`);
    ventana.document.close();
    ventana.focus();
    ventana.onload = () => ventana.print();
  };

  const archivo = `qr-${limpiarUtm(nombre) || 'enlace'}-${qrFuente}.png`;

  return (
    <Modal open={abierto} onClose={onCerrar} title={titulo}>
      <div className="compartir-panel">
        <section className="compartir-principal">
          <code>{urlBase}</code>
          <div>
            <a className="btn btn-primary" href={urlBase} target="_blank" rel="noopener noreferrer">{textoAbrir}</a>
            <button type="button" className="btn btn-outline" onClick={() => copiar(urlBase)}>Copiar enlace</button>
          </div>
          <small>Este enlace llega como «directo». Para saber de dónde viene cada visita, usa los enlaces por canal.</small>
        </section>

        <section>
          <h3>Enlaces por canal</h3>
          <label className="compartir-campana">Campaña (opcional)
            <input className="input" value={campana} maxLength={40} onChange={(e) => setCampana(e.target.value)} placeholder="Ej. dia-de-la-madre" />
            <small>Se agrega a todos los enlaces y QR de abajo{utmCampana ? ` (…/${utmCampana})` : ''}. Al abrirse se registra como campaña.</small>
          </label>
          <ul className="compartir-canales">
            {CANALES.map((canal) => (
              <li key={canal.fuente}>
                <div><strong>{canal.nombre}</strong><small>{canal.ayuda}</small></div>
                <div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(enlace(canal.fuente, canal.medio), `Enlace para ${canal.nombre} copiado`)}>Copiar</button>
                  <a className="btn btn-outline btn-sm" href={enlace(canal.fuente, canal.medio)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir enlace de ${canal.nombre}`}>↗</a>
                </div>
              </li>
            ))}
            {propios.map((canal) => (
              <li key={canal}>
                <div><strong>{canal}</strong><small>Canal tuyo.</small></div>
                <div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(enlace(canal), `Enlace «${canal}» copiado`)}>Copiar</button>
                  <a className="btn btn-outline btn-sm" href={enlace(canal)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir enlace de ${canal}`}>↗</a>
                  <button type="button" className="btn btn-outline btn-sm" aria-label={`Quitar ${canal}`} onClick={() => guardarPropios(propios.filter((otro) => otro !== canal))}>×</button>
                </div>
              </li>
            ))}
            <li className="compartir-propio">
              <label>Agregar otro canal<input className="input" value={propio} maxLength={40} onChange={(e) => setPropio(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarPropio(); } }} placeholder="Ej. influencer-camila" /></label>
              <button type="button" className="btn btn-outline btn-sm" disabled={!utmPropio} onClick={agregarPropio}>Agregar</button>
            </li>
          </ul>
        </section>

        {/*
          * Lo que ocurre sin enlace marcado.
          *
          * Sin decirlo, «directo» se lee como «no sabemos nada», y no es así: una visita que llega
          * desde Instagram o desde Google se reconoce sola. Lo que de verdad no deja rastro es
          * WhatsApp, el QR, el correo y el SMS, y ahí el enlace por canal es la única forma.
          */}
        <section className="compartir-deteccion">
          <h3>Si compartes el enlace sin marcar</h3>
          <p>Las visitas que llegan desde Instagram, Facebook, TikTok, Google, Maps o un sitio que enlace la página <strong>se reconocen solas</strong> y aparecen en los resultados marcadas como detección automática.</p>
          <p>WhatsApp, los QR, el correo y los SMS <strong>no dejan rastro</strong>: sin enlace por canal quedan como «directo». Para esos cuatro, usa los de arriba.</p>
        </section>

        <section className="compartir-qr">
          <h3>Código QR</h3>
          <div className="compartir-qr-cuerpo">
            {qr ? <img src={qr} alt={`Código QR de «${nombre}»`} /> : <p>Generando…</p>}
            <div>
              <label>Dónde lo pondrás
                <select className="input" value={qrFuente} onChange={(e) => setQrFuente(e.target.value)}>
                  {QRS.map((q) => <option key={q.fuente} value={q.fuente}>{q.nombre}</option>)}
                </select>
              </label>
              <a className={`btn btn-primary ${qr ? '' : 'disabled'}`} href={qr || undefined} download={archivo}>Descargar PNG</a>
              <button type="button" className="btn btn-outline" disabled={!qr} onClick={imprimir}>Imprimir</button>
            </div>
          </div>
        </section>

        {extra}
        {pie ? <p className="compartir-pie">{pie}</p> : null}
      </div>
    </Modal>
  );
}
