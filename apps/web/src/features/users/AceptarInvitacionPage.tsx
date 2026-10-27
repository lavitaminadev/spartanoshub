/**
 * @fileoverview La página a la que llega quien recibe una invitación al equipo de una empresa.
 *
 * Quien abre el enlace es el dueño de esa dirección, así que aquí sí se dice si hace falta crear
 * la cuenta. No abre sesión: tras aceptar se entra por el acceso de siempre, y la empresa activa
 * de quien ya tenía cuenta no cambia.
 */

import { useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

export function AceptarInvitacionPage(): JSX.Element {
  const { token = '' } = useParams();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const vista = useQuery<{ empresa: string; email: string; requiereDatos: boolean }>({
    queryKey: ['invitacion-equipo', token],
    queryFn: () => api.get(`/public/invitaciones-equipo/${encodeURIComponent(token)}`),
    retry: false,
  });
  const aceptar = useMutation({
    mutationFn: () => api.post<{ empresa: string; cuentaNueva: boolean }>(`/public/invitaciones-equipo/${encodeURIComponent(token)}/aceptar`, vista.data?.requiereDatos ? { name, password } : {}),
  });

  if (vista.isLoading) return <LoadingSpinner />;
  if (vista.isError || !vista.data) {
    return <main className="page"><h1>Esta invitación no es válida</h1><p>Venció o ya se usó. Pide que te envíen otra.</p></main>;
  }
  if (aceptar.data) {
    return (
      <main className="page">
        <h1>Listo, ya eres parte de {aceptar.data.empresa}</h1>
        <p>{aceptar.data.cuentaNueva ? 'Tu cuenta quedó creada.' : 'Se sumó a tu cuenta; conservas tus otras empresas y la que estabas usando no cambia.'}</p>
        <Link className="btn btn-primary" to="/login">Ir a entrar</Link>
      </main>
    );
  }
  return (
    <main className="page">
      <h1>Te invitaron al equipo de {vista.data.empresa}</h1>
      <p>Invitación para <strong>{vista.data.email}</strong>.</p>
      <form className="modal-form" onSubmit={(evento) => { evento.preventDefault(); aceptar.mutate(); }}>
        {vista.data.requiereDatos && (
          <>
            <label htmlFor="inv-nombre">Tu nombre<input id="inv-nombre" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label htmlFor="inv-clave">Elige una contraseña<input id="inv-clave" className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /><small>Mínimo 8 caracteres, con mayúscula, minúscula y número.</small></label>
          </>
        )}
        {aceptar.error && <div className="alert alert-error" role="alert">{aceptar.error.message}</div>}
        <button className="btn btn-primary" type="submit" disabled={aceptar.isPending}>{aceptar.isPending ? 'Aceptando...' : 'Aceptar la invitación'}</button>
      </form>
    </main>
  );
}
