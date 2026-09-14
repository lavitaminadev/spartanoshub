/**
 * @fileoverview Compartir una encuesta publicada: el panel común más el envío por correo.
 */

import type { JSX } from 'react';
import type { Survey } from '@espartanos/shared';
import { PanelCompartir, nombreDeFuente } from '../../shared/PanelCompartir';
import { publicSurveyUrl } from '../../core/public-url';

/** Nombre legible del canal de una respuesta. */
export function nombreDeOrigen(origen: string | null | undefined): string {
  if (origen === 'reserva') return 'Correo post-reserva';
  if (!origen || origen === 'link') return 'Directo';
  if (origen === 'qr') return 'QR en el local';
  return nombreDeFuente(origen);
}

export function CompartirEncuesta({ survey, onCerrar, puedeEnviarCorreo, onEnviarCorreo }: {
  survey: Survey | null;
  onCerrar: () => void;
  puedeEnviarCorreo: boolean;
  onEnviarCorreo: (survey: Survey) => void;
}): JSX.Element {
  const tieneCorreo = Boolean(survey?.distribution?.includes('email'));
  return (
    <PanelCompartir
      abierto={Boolean(survey)}
      titulo="Compartir encuesta"
      nombre={survey?.title ?? ''}
      urlBase={survey ? publicSurveyUrl(survey.id, survey.publicUrl) : ''}
      textoAbrir="Abrir encuesta ↗"
      onCerrar={onCerrar}
      extra={survey && tieneCorreo && puedeEnviarCorreo ? (
        <section className="compartir-correo">
          <div><h3>Correo</h3><small>{survey.recipients?.length ? `${survey.recipients.length} destinatario${survey.recipients.length === 1 ? '' : 's'} cargados.` : 'Agrega destinatarios editando la encuesta.'}</small></div>
          <button type="button" className="btn btn-outline" disabled={!survey.recipients?.length} onClick={() => onEnviarCorreo(survey)}>Enviar por correo</button>
        </section>
      ) : null}
      pie={survey?.ga4MeasurementId
        ? `Google Analytics ${survey.ga4MeasurementId} recibe las visitas y respuestas con su canal.`
        : 'Sin Google Analytics: el canal igual se cuenta en los resultados. Puedes agregar un ID de medición al editar la encuesta.'}
    />
  );
}
