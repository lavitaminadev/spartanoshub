import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { triggerToast } from '../../shared/toast-events';

interface Casilla {
  id: string;
  email: string;
  name?: string | null;
  cargo?: string | null;
  tipos?: string[] | null;
  createdAt: string;
}

interface TipoDeAviso { clave: string; etiqueta: string }

/**
 * Las casillas del equipo de un local que reciben avisos, y qué avisos recibe cada una.
 *
 * Existe porque quien atiende no tiene por qué tener cuenta: un garzón, una cajera o la barra
 * reciben un correo y hacen su trabajo. Antes las direcciones iban en un campo de texto separado
 * por comas dentro de **este formulario**, y de ahí salían tres problemas que esta pantalla
 * resuelve: eran del formulario y no del local —dos formularios, dos listas que mantener—, todos
 * recibían todo (incluido el teléfono de quien pedía un evento), y no quedaba constancia de quién
 * había agregado el correo de un trabajador ni cuándo.
 *
 * El campo antiguo sigue arriba y sigue funcionando: sus direcciones reciben todos los avisos hasta
 * que se pasen aquí. Nada deja de llegar por no hacer nada.
 *
 * @param empresa El local. Vacío en el portal, donde el servidor usa la empresa de la cuenta.
 */
export function CasillasDelEquipo({ empresa }: { empresa?: string | null }) {
  const clienteDeConsultas = useQueryClient();
  const sufijo = empresa ? `?empresa=${encodeURIComponent(empresa)}` : '';

  const { data: tipos } = useQuery<{ data: TipoDeAviso[] }>({
    queryKey: ['avisos-tipos'],
    queryFn: () => api.get('/avisos/destinatarios/tipos'),
  });

  const { data, isLoading, error } = useQuery<{ data: Casilla[] }>({
    queryKey: ['avisos-destinatarios', empresa ?? 'propia'],
    queryFn: () => api.get(`/avisos/destinatarios${sufijo}`),
  });

  const refrescar = () => void clienteDeConsultas.invalidateQueries({ queryKey: ['avisos-destinatarios', empresa ?? 'propia'] });

  const guardar = useMutation({
    mutationFn: (casilla: { email: string; name?: string; cargo?: string; tipos: string[] }) =>
      api.post(`/avisos/destinatarios${sufijo}`, casilla),
    onSuccess: () => { refrescar(); triggerToast('Casilla guardada.', 'success'); },
  });

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/avisos/destinatarios/${id}${sufijo}`),
    onSuccess: () => { refrescar(); triggerToast('Casilla quitada: deja de recibir avisos.', 'info'); },
  });

  const [nueva, setNueva] = useState({ email: '', name: '', cargo: '', tipos: ['reservas'] as string[] });

  const alternar = (casilla: Casilla, clave: string) => {
    const actuales = casilla.tipos ?? [];
    const siguientes = actuales.includes(clave) ? actuales.filter((tipo) => tipo !== clave) : [...actuales, clave];
    guardar.mutate({ email: casilla.email, name: casilla.name ?? undefined, cargo: casilla.cargo ?? undefined, tipos: siguientes });
  };

  const alternarNueva = (clave: string) => setNueva((previa) => ({
    ...previa,
    tipos: previa.tipos.includes(clave) ? previa.tipos.filter((tipo) => tipo !== clave) : [...previa.tipos, clave],
  }));

  const lista = data?.data ?? [];

  return (
    <div className="casillas-equipo">
      <div className="casillas-equipo-intro">
        <strong>Quién del equipo recibe cada aviso</strong>
        <small>
          Sirve para quien no tiene cuenta en el sistema: garzones, cajera, barra. Son del local, no
          de este formulario, así que valen para todos sus formularios. Marca sólo lo que a cada uno
          le hace falta: el aviso de un evento lleva el teléfono y lo que contó quien lo pidió.
        </small>
      </div>

      {error ? <p className="error-text">No se pudieron cargar las casillas del equipo.</p> : null}
      {isLoading ? <p className="tabla-nota">Cargando…</p> : null}

      {lista.length > 0 && <table className="casillas-equipo-tabla">
        <thead>
          <tr>
            <th>Casilla</th>
            {(tipos?.data ?? []).map((tipo) => <th key={tipo.clave} className="vertical">{tipo.etiqueta}</th>)}
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {lista.map((casilla) => (
            <tr key={casilla.id}>
              <td>
                <strong>{casilla.email}</strong>
                {casilla.name || casilla.cargo ? <small>{[casilla.name, casilla.cargo].filter(Boolean).join(' · ')}</small> : null}
              </td>
              {(tipos?.data ?? []).map((tipo) => (
                <td key={tipo.clave} className="centrada">
                  <input
                    type="checkbox"
                    aria-label={`${tipo.etiqueta} a ${casilla.email}`}
                    checked={(casilla.tipos ?? []).includes(tipo.clave)}
                    onChange={() => alternar(casilla, tipo.clave)}
                  />
                </td>
              ))}
              <td>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => borrar.mutate(casilla.id)}>Quitar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>}

      {/* Quitar todas las marcas es válido y no borra la fila: es lo que se hace con quien está de
          vacaciones, y volver a activarlo no obliga a pedirle otra vez la dirección. */}
      <div className="casillas-equipo-nueva">
        <input
          className="input"
          type="email"
          value={nueva.email}
          placeholder="garzon@local.cl"
          onChange={(evento) => setNueva({ ...nueva, email: evento.target.value })}
        />
        <input
          className="input"
          value={nueva.name}
          placeholder="Nombre (opcional)"
          onChange={(evento) => setNueva({ ...nueva, name: evento.target.value })}
        />
        <input
          className="input"
          value={nueva.cargo}
          placeholder="Cargo: garzón, cajera…"
          onChange={(evento) => setNueva({ ...nueva, cargo: evento.target.value })}
        />
        <div className="casillas-equipo-tipos">
          {(tipos?.data ?? []).map((tipo) => (
            <label key={tipo.clave}>
              <input type="checkbox" checked={nueva.tipos.includes(tipo.clave)} onChange={() => alternarNueva(tipo.clave)} />
              {tipo.etiqueta}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!nueva.email.includes('@') || guardar.isPending}
          onClick={() => guardar.mutate({ ...nueva, name: nueva.name || undefined, cargo: nueva.cargo || undefined }, {
            onSuccess: () => setNueva({ email: '', name: '', cargo: '', tipos: ['reservas'] }),
          })}
        >
          {guardar.isPending ? 'Guardando…' : 'Agregar al equipo'}
        </button>
      </div>
      {guardar.isError && <p className="error-text">{(guardar.error as Error)?.message || 'No se pudo guardar la casilla.'}</p>}
    </div>
  );
}
