/**
 * @fileoverview Confirmación de contraseña para las operaciones sensibles.
 *
 * Algunas acciones —restablecer la contraseña de otra persona, cambiarle el cargo— equivalen a
 * tomar el control de una cuenta, y el servidor exige que quien las pide haya confirmado su
 * contraseña en los últimos minutos. Esa exigencia existía desde el principio; lo que faltaba era
 * la mitad de la pantalla: la respuesta llegaba como un 403 y se mostraba «Acceso no autorizado»
 * a quien sí tenía permiso, sin decir qué faltaba ni dónde hacerlo.
 *
 * Se monta una sola vez, junto a los avisos, porque la exigencia puede venir de cualquier
 * pantalla y ninguna debería tener que saber que existe.
 */

import { useEffect, useState, type JSX } from 'react';
import { api, REAUTH_EVENT, type ReauthEventDetail } from '../core/api';
import { Modal } from './Modal';

export function ReauthPrompt(): JSX.Element | null {
  const [peticion, setPeticion] = useState<ReauthEventDetail | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const abrir = (evento: Event) => {
      setPeticion((evento as CustomEvent<ReauthEventDetail>).detail);
      setPassword('');
      setError(null);
      setListo(false);
    };
    window.addEventListener(REAUTH_EVENT, abrir);
    return () => window.removeEventListener(REAUTH_EVENT, abrir);
  }, []);

  if (!peticion) return null;

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.post('/auth/reauthenticate', { password });
      // No se reintenta la operación sola: la petición original ya se rechazó y repetirla desde
      // acá supondría conocerla. Se avisa que quedó confirmada y quien la pidió vuelve a pulsar.
      setListo(true);
    } catch (err) {
      setError((err as Error).message || 'No pudimos confirmar tu contraseña');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal open onClose={() => setPeticion(null)} title="Confirma tu contraseña">
      {listo ? (
        <div className="modal-form">
          <p>
            Listo. Vuelve a pulsar la acción que estabas haciendo
            {peticion.windowMinutes ? `; la confirmación vale por ${peticion.windowMinutes} minutos.` : '.'}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => setPeticion(null)}>Entendido</button>
          </div>
        </div>
      ) : (
        <form
          className="modal-form"
          onSubmit={(evento) => { evento.preventDefault(); void confirmar(); }}
        >
          <p>{peticion.reason}</p>
          <label>
            Tu contraseña
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPeticion(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={enviando || password.length === 0}>
              {enviando ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
