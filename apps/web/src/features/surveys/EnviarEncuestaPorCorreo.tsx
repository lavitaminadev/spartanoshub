import { useState, type JSX } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Survey } from '@espartanos/shared';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';

/**
 * Enviar una encuesta por correo: a quiénes, y poder agregar a alguien ahí mismo.
 *
 * Antes era un aviso que sólo decía «se enviará a 3 destinatarios» y un botón. No se podía ver
 * quiénes eran —y son personas a las que les va a llegar un correo ahora— ni agregar una
 * dirección: había que cerrar, entrar a editar la encuesta, escribirla entre comas, guardar y
 * volver. Para mandarle la encuesta a un garzón nuevo eso eran cinco pantallas.
 *
 * Quien se agrega aquí **queda guardado en la encuesta**, no sólo en este envío: si hiciera falta
 * repetirlo, la lista ya está completa, y se evita tener dos sitios donde viven los destinatarios.
 */
export function EnviarEncuestaPorCorreo({ survey, onCerrar }: {
  survey: Survey | null;
  onCerrar: () => void;
}): JSX.Element {
  const clienteDeConsultas = useQueryClient();
  const [nuevo, setNuevo] = useState('');

  const destinatarios = survey?.recipients ?? [];
  /*
   * Las que no tienen forma de correo, señaladas antes de mandar.
   *
   * El servidor las descarta y lo dice al terminar —«1 sin forma de correo»— pero sin decir cuál,
   * así que la fila mala se quedaba en la lista para siempre. Verla antes es lo único que permite
   * arreglarla.
   */
  const invalido = (correo: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const malas = destinatarios.filter(invalido);

  const agregar = useMutation({
    mutationFn: (correo: string) => api.patch(`/surveys/${encodeURIComponent(survey!.id)}`, {
      recipients: [...destinatarios, correo],
    }),
    onSuccess: async () => {
      setNuevo('');
      await clienteDeConsultas.invalidateQueries({ queryKey: ['surveys'] });
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo agregar', 'error'),
  });

  const quitar = useMutation({
    mutationFn: (correo: string) => api.patch(`/surveys/${encodeURIComponent(survey!.id)}`, {
      recipients: destinatarios.filter((uno) => uno !== correo),
    }),
    onSuccess: async () => { await clienteDeConsultas.invalidateQueries({ queryKey: ['surveys'] }); },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo quitar', 'error'),
  });

  const enviar = useMutation({
    mutationFn: () => api.post<{ enviados: number; fallidos: number; invalidos: number }>(
      `/surveys/${encodeURIComponent(survey!.id)}/send-email`, {},
    ),
    onSuccess: (resultado) => {
      onCerrar();
      triggerToast(
        `Enviada a ${resultado.enviados} persona${resultado.enviados === 1 ? '' : 's'}`
        + `${resultado.fallidos ? ` · ${resultado.fallidos} no ${resultado.fallidos === 1 ? 'salió' : 'salieron'}` : ''}`
        + `${resultado.invalidos ? ` · ${resultado.invalidos} sin forma de correo` : ''}`,
        'success',
      );
    },
  });

  const limpio = nuevo.trim().toLowerCase();
  const repetido = destinatarios.some((uno) => uno.toLowerCase() === limpio);
  const puedeAgregar = limpio.includes('@') && !repetido && !agregar.isPending;

  return (
    <Modal open={Boolean(survey)} onClose={onCerrar} title="Enviar la encuesta por correo">
      <div className="form-grid">
        <p className="envio-resumen">
          <strong>{survey?.title}</strong>
          <span>Un correo a cada persona. No se puede deshacer.</span>
        </p>

        {destinatarios.length === 0
          ? <p className="form-hint">
              Todavía no hay destinatarios. Agrega el primero abajo: no hace falta que tengan cuenta
              en el sistema.
            </p>
          : <>
            <p className="envio-cifra">
              Le llegará a <strong>{destinatarios.length}</strong> {destinatarios.length === 1 ? 'persona' : 'personas'}.
            </p>
            {/* La lista entera y no una muestra: son pocas, y aquí la pregunta es «¿quién?», no «¿cuántos?». */}
            <ul className="destinatarios-encuesta">
              {destinatarios.map((correo) => (
                <li key={correo} className={invalido(correo) ? 'es-invalido' : undefined}>
                  <span>{correo}{invalido(correo) ? ' · no tiene forma de correo' : ''}</span>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={quitar.isPending} onClick={() => quitar.mutate(correo)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </>}

        <label>
          Agregar a alguien
          <div className="destinatarios-agregar">
            <input
              className="input"
              type="email"
              value={nuevo}
              placeholder="garzon@local.cl"
              onChange={(evento) => setNuevo(evento.target.value)}
              onKeyDown={(evento) => { if (evento.key === 'Enter' && puedeAgregar) { evento.preventDefault(); agregar.mutate(limpio); } }}
            />
            <button type="button" className="btn btn-outline btn-sm" disabled={!puedeAgregar} onClick={() => agregar.mutate(limpio)}>
              {agregar.isPending ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        </label>
        {repetido && <p className="form-hint">Esa dirección ya está en la lista.</p>}
        {malas.length > 0 && <p className="form-hint">
          {malas.length === 1
            ? 'Una dirección no tiene forma de correo y se va a descartar: quítala o corrígela para que la lista diga la verdad.'
            : `${malas.length} direcciones no tienen forma de correo y se van a descartar: quítalas o corrígelas para que la lista diga la verdad.`}
        </p>}
        <p className="form-hint">
          Queda guardada en la encuesta, así que si hay que repetir el envío la lista ya está
          completa. Mándala sólo a quien aceptó recibir comunicaciones, o a tu propio equipo.
        </p>

        {enviar.isError && <p className="error-text">{(enviar.error as Error)?.message || 'No se pudo enviar.'}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={destinatarios.length === 0 || enviar.isPending}
            onClick={() => enviar.mutate()}
          >
            {enviar.isPending ? 'Enviando…' : `Enviar a ${destinatarios.length - malas.length}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
