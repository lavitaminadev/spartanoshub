/**
 * @fileoverview Textos de correo propios de una reserva, cuando los de su empresa no sirven.
 *
 * Una cena corriente y un evento con montaje comparten empresa y no comparten lo que hay que
 * escribirle a quien reserva. Hasta ahora el texto era el mismo para todas las reservas de una
 * misma empresa, porque la configuración sólo llegaba hasta ese nivel.
 *
 * **Lo que esta reserva no escriba sigue heredando.** No es una copia del texto de la empresa: es
 * una excepción encima. Si mañana se corrige la plantilla general, las reservas que no la hayan
 * tocado reciben la corrección; copiar el texto entero para cambiar una línea las dejaría atrás
 * sin que nadie se entere.
 *
 * **No lo ve una cuenta de empresa.** El texto que sale con su marca lo redacta la agencia: una
 * plantilla a medio editar —sin el enlace para gestionar la reserva, con una variable borrada—
 * llega igual a todos sus clientes. La empresa decide si el correo sale, no qué dice.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { triggerToast } from '../../shared/toast-events';

interface AjusteDeCorreo {
  key: string;
  label: string;
  value: unknown;
  /** `form` cuando esta reserva lo escribió; `client` u `organization` cuando lo hereda. */
  source: 'form' | 'client' | 'organization' | 'master_default';
}

/**
 * Los correos que esta pantalla deja afinar.
 *
 * Sólo los que le llegan a quien reservó. Los avisos al equipo se configuran arriba, con sus
 * casillas, y mezclarlos aquí haría pensar que el texto que lee el cliente y el que lee el local
 * son la misma cosa.
 */
const CORREOS = [
  { prefijo: 'email.reservation_confirmation', titulo: 'Confirmación' },
  { prefijo: 'email.reservation_pending', titulo: 'Reserva por confirmar' },
  { prefijo: 'email.reservation_change', titulo: 'Cambio de hora' },
  { prefijo: 'email.reservation_cancellation', titulo: 'Cancelación' },
  { prefijo: 'email.reservation_reminder', titulo: 'Recordatorio' },
  { prefijo: 'email.post_visit_survey', titulo: 'Encuesta después de la visita' },
] as const;

export function CorreosDeLaReserva({ formId, clientId, soloInterruptores = false }: {
  formId: string;
  clientId: string;
  /**
   * Deja encender y apagar, y esconde la edición del texto.
   *
   * Es lo que ve una cuenta de empresa. Apagar un correo para **esta** reserva es una decisión
   * sobre su operación —un evento privado no quiere recordatorio automático— y no tiene nada que
   * ver con reescribir lo que sale con su marca, que es lo que se le reserva a la agencia.
   */
  soloInterruptores?: boolean;
}): JSX.Element | null {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<{ asunto: string; cuerpo: string }>({ asunto: '', cuerpo: '' });
  const queryClient = useQueryClient();

  const clave = ['correos-de-la-reserva', clientId, formId];
  const { data: ajustes = [] } = useQuery<AjusteDeCorreo[]>({
    queryKey: clave,
    queryFn: () => api.get(`/settings/correos?clientId=${encodeURIComponent(clientId)}&formId=${encodeURIComponent(formId)}`),
  });

  const guardar = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.put(`/settings/correos?clientId=${encodeURIComponent(clientId)}`, { values, formId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clave });
      setAbierto(null);
      triggerToast('Guardado para esta reserva');
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo guardar', 'error'),
  });

  const buscar = (key: string) => ajustes.find((ajuste) => ajuste.key === key);
  // Sin plantillas que mostrar no se dibuja un panel vacío que prometa algo que no hay: pasa
  // cuando la cuenta no alcanza a editar ninguno de esos módulos.
  if (!ajustes.length) return null;

  return (
    <div className="correos-de-la-reserva">
      <div className="correo-rol">
        <strong>5. {soloInterruptores ? "Qué correos envía esta reserva" : "Textos propios de esta reserva"}</strong>
        <small>
          {soloInterruptores
            ? "Apaga los que no correspondan a esta reserva. Lo que no toques sigue lo que decidió tu empresa."
            : "Lo que no escribas aquí usa el texto de la empresa, y sigue recibiendo sus correcciones. Un evento puede decir algo distinto de una cena corriente."}
        </small>
      </div>

      <ul className="correos-reserva-lista">
        {CORREOS.map(({ prefijo, titulo }) => {
          const asunto = buscar(`${prefijo}_subject`);
          const cuerpo = buscar(`${prefijo}_body`);
          const interruptor = buscar(`${prefijo}_enabled`);
          if (!interruptor && (!asunto || !cuerpo)) return null;
          const propio = asunto?.source === 'form' || cuerpo?.source === 'form' || interruptor?.source === 'form';
          const editando = abierto === prefijo;
          const encendido = interruptor ? interruptor.value !== false && interruptor.value !== 'false' : true;

          return (
            <li key={prefijo} className={propio ? 'es-propio' : ''}>
              <div className="correo-reserva-cabecera">
                <strong>{titulo}</strong>
                {/*
                  * Apagarlo es una decisión de esta reserva, no del texto.
                  *
                  * Un evento privado puede no querer recordatorio automático aunque el resto de
                  * las reservas de esa empresa sí. Se guarda como excepción, igual que el texto:
                  * la empresa sigue mandando en las que no lo hayan tocado.
                  */}
                {interruptor ? (
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={encendido}
                      disabled={guardar.isPending}
                      onChange={(evento) => guardar.mutate({ [`${prefijo}_enabled`]: evento.target.checked })}
                    />
                    {encendido ? 'Se envía' : 'No se envía'}
                  </label>
                ) : null}
                <span>{propio ? 'Propio de esta reserva' : 'Hereda de la empresa'}</span>
                {editando || soloInterruptores || !asunto || !cuerpo ? null : (
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => {
                    setAbierto(prefijo);
                    setBorrador({ asunto: String(asunto?.value ?? ''), cuerpo: String(cuerpo?.value ?? '') });
                  }}>{propio ? 'Editar' : 'Escribir uno propio'}</button>
                )}
                {/*
                  * Volver a heredar se guarda como nulo y no copiando el texto de la empresa:
                  * una copia deja de seguir sus cambios y nadie se entera de que ya no hereda.
                  */}
                {propio && !editando && !soloInterruptores ? (
                  <button type="button" className="btn btn-outline btn-xs" disabled={guardar.isPending}
                    onClick={() => guardar.mutate({ [`${prefijo}_subject`]: null, [`${prefijo}_body`]: null })}>
                    Volver a heredar
                  </button>
                ) : null}
              </div>

              {editando ? (
                <div className="correo-reserva-editor">
                  <label>Asunto
                    <input className="input" value={borrador.asunto}
                      onChange={(evento) => setBorrador({ ...borrador, asunto: evento.target.value })} />
                  </label>
                  <label>Cuerpo
                    <textarea className="input" rows={5} value={borrador.cuerpo}
                      onChange={(evento) => setBorrador({ ...borrador, cuerpo: evento.target.value })} />
                  </label>
                  <small>
                    Las variables entre llaves se reemplazan al enviar. Conserva las que trae el
                    texto de la empresa: borrar una deja ese dato fuera del correo.
                  </small>
                  <div className="correo-reserva-acciones">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setAbierto(null)}>Cancelar</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={guardar.isPending}
                      onClick={() => guardar.mutate({ [`${prefijo}_subject`]: borrador.asunto, [`${prefijo}_body`]: borrador.cuerpo })}>
                      Guardar para esta reserva
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
