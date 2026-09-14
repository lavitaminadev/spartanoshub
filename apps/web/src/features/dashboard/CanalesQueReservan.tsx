/**
 * @fileoverview Qué canal trae visitas y cuál las convierte en reservas.
 *
 * La torta de fuentes dice cuántas reservas llegan por cada canal, pero no si un canal atrae mucha
 * gente que después no reserva. Aquí se ponen juntas visitas y reservas, y se señalan dos cosas
 * que sirven para decidir: el canal que mejor convierte y el que trae visitas sin reservas.
 *
 * Las conclusiones sólo se muestran con suficientes visitas: con cinco visitas un 40% no dice nada.
 */

import type { JSX } from 'react';
import { nombreDeFuente } from '../../shared/PanelCompartir';

export interface CanalDeReservas {
  source: string;
  visitas: number;
  reservas: number;
  asistieron: number;
  conversion: number | null;
  detectado: boolean;
}

/** Visitas mínimas para sacar conclusiones de un canal. */
const MINIMO_DE_VISITAS = 20;

function nombre(source: string): string {
  return source === 'directo' ? 'Directo (sin canal)' : nombreDeFuente(source);
}

export function CanalesQueReservan({ canales }: { canales: CanalDeReservas[] }): JSX.Element {
  // «Directo» no es un canal elegido: no compite por mejor ni se marca como flojo.
  const conDatos = canales.filter((canal) => canal.source !== 'directo' && canal.visitas >= MINIMO_DE_VISITAS && canal.conversion !== null);
  const totalVisitas = canales.reduce((suma, canal) => suma + canal.visitas, 0);
  const totalReservas = canales.reduce((suma, canal) => suma + canal.reservas, 0);
  const promedio = totalVisitas > 0 ? (totalReservas / totalVisitas) * 100 : null;
  const mejor = [...conDatos].sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0];
  // Un canal flojo es el que trae visitas y convierte a menos de la mitad del promedio.
  const flojo = promedio !== null
    ? [...conDatos].filter((canal) => canal !== mejor && canal.source !== 'directo' && (canal.conversion ?? 0) < promedio / 2).sort((a, b) => b.visitas - a.visitas)[0]
    : undefined;
  const directo = canales.find((canal) => canal.source === 'directo');
  const shareDirecto = totalVisitas > 0 && directo ? Math.round((directo.visitas / totalVisitas) * 100) : 0;
  const maximo = Math.max(1, ...canales.map((canal) => canal.visitas));

  return (
    <div className="dashboard-chart-card viz-full canales-reservan">
      <h3>Canales que más reservan</h3>
      <p className="viz-note">Visitas a la página de reservas y reservas hechas por cada canal. Marca «detectado» cuando el canal se reconoció solo, sin enlace por canal.</p>

      {canales.length === 0 ? <p className="viz-note">Todavía no hay visitas en este rango.</p> : <>
        {(mejor || flojo || shareDirecto >= 40) && (
          <ul className="canales-reservan-hallazgos">
            {mejor && <li className="is-bien"><strong>{nombre(mejor.source)}</strong> es el que mejor convierte: {mejor.conversion}% de sus visitas reserva{promedio !== null ? ` (promedio ${Math.round(promedio * 10) / 10}%)` : ''}.</li>}
            {flojo && <li className="is-alerta"><strong>{nombre(flojo.source)}</strong> trae {flojo.visitas} visitas pero sólo {flojo.conversion}% reserva. Revisa qué promete ese enlace o dónde está puesto.</li>}
            {shareDirecto >= 40 && <li className="is-info">{shareDirecto}% de las visitas llega sin canal. Usa los enlaces por canal y QR de «Compartir» para saber de dónde vienen.</li>}
          </ul>
        )}
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Canal</th><th>Visitas</th><th>Reservas</th><th>Conversión</th><th>Asistieron</th></tr></thead>
            <tbody>
              {canales.map((canal) => (
                <tr key={canal.source}>
                  <td data-label="Canal">
                    <span className="canales-reservan-nombre">{nombre(canal.source)}{canal.detectado && <small className="canales-reservan-detectado" title="Reconocido por la app o el sitio de origen, sin enlace por canal">detectado</small>}</span>
                    <span className="canales-reservan-barra" aria-hidden="true"><span style={{ width: `${(canal.visitas / maximo) * 100}%` }} /></span>
                  </td>
                  <td data-label="Visitas">{canal.visitas}</td>
                  <td data-label="Reservas">{canal.reservas}</td>
                  <td data-label="Conversión">{canal.conversion === null ? '—' : `${canal.conversion}%`}{canal.visitas > 0 && canal.visitas < MINIMO_DE_VISITAS ? <small className="canales-reservan-poco" title={`Menos de ${MINIMO_DE_VISITAS} visitas: todavía no es concluyente`}> · pocas visitas</small> : null}</td>
                  <td data-label="Asistieron">{canal.asistieron}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
