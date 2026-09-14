/**
 * @fileoverview El QR de una encuesta, generado en el navegador.
 *
 * Antes se pedía a `api.qrserver.com`: la dirección de cada encuesta viajaba a un servicio de
 * terceros, y si ese servicio caía o cambiaba de condiciones, el QR dejaba de salir sin que nada
 * en la aplicación lo supiera. Ahora se dibuja acá, sin salir de la página.
 *
 * El código lleva `src=qr` en la dirección, así los resultados distinguen quién respondió desde
 * la mesa y quién desde un enlace.
 */

import { useEffect, useState, type JSX } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../../shared/Modal';

export function CodigoQrDeEncuesta({ abierto, titulo, url, onCerrar }: { abierto: boolean; titulo: string; url: string; onCerrar: () => void }): JSX.Element {
  const [imagen, setImagen] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || !url) return;
    let vigente = true;
    setError('');
    // Nivel M: sigue leyéndose con una esquina manchada o un reflejo, sin volverse tan denso
    // que un teléfono viejo tarde en enfocarlo.
    QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'M' })
      .then((datos) => { if (vigente) setImagen(datos); })
      .catch(() => { if (vigente) setError('No se pudo generar el código.'); });
    return () => { vigente = false; };
  }, [abierto, url]);

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'noopener=false,width=600,height=800');
    if (!ventana) return;
    // Una hoja simple para la mesa o el mostrador: el título dice de qué es y la instrucción cabe
    // en una línea. Todo se escapa: el título lo escribe el equipo.
    const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    ventana.document.write(`<!doctype html><title>${escapar(titulo)}</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}img{width:320px;height:320px}h1{font-size:22px;margin:0 0 6px}p{color:#444;margin:0 0 18px}</style><h1>${escapar(titulo)}</h1><p>Escanea con la cámara de tu teléfono</p><img src="${imagen}" alt="">`);
    ventana.document.close();
    ventana.focus();
    ventana.onload = () => ventana.print();
  };

  return (
    <Modal open={abierto} onClose={onCerrar} title="Código QR de la encuesta">
      <div className="qr-encuesta">
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {imagen ? <img src={imagen} alt={`Código QR para responder «${titulo}»`} /> : !error ? <p>Generando…</p> : null}
        <small>Lleva a: <code>{url}</code></small>
        <div className="qr-encuesta-acciones">
          <a className={`btn btn-primary ${imagen ? '' : 'disabled'}`} href={imagen || undefined} download={`qr-${titulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'encuesta'}.png`} aria-disabled={!imagen}>Descargar PNG</a>
          <button type="button" className="btn btn-outline" disabled={!imagen} onClick={imprimir}>Imprimir</button>
        </div>
      </div>
    </Modal>
  );
}
