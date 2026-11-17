import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

interface Consentimientos {
  suscritos: number;
  pendientes: number;
  bajas: number;
  ultimos30: number;
  desde: string | null;
}

const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

/**
 * Resumen agregado de los consentimientos obtenidos mediante reservas.
 * El backend exige que la empresa tenga habilitada esta capacidad; la vista no expone
 * destinatarios ni permite enviar campañas.
 */
export function ConsentimientosDeReservas({ clientId }: { clientId?: string }): JSX.Element | null {
  const consulta = useQuery<Consentimientos>({
    queryKey: ['consentimientos-de-reservas', clientId],
    enabled: Boolean(clientId),
    queryFn: () => api.get(`/reservations/consentimientos?clientId=${encodeURIComponent(clientId!)}`),
    retry: false,
  });

  if (!clientId || consulta.isLoading || consulta.error) return null;
  const datos = consulta.data;
  if (!datos) return null;
  /*
   * Con la lista en cero no se muestra el panel.
   *
   * Un cero acá no es un resultado: significa que ningún formulario de esta empresa pide el
   * consentimiento todavía, y un panel que dice «0 personas» invita a buscar una avería donde no
   * hay ninguna.
   */
  if (datos.suscritos + datos.pendientes + datos.bajas === 0) return null;

  return (
    <section className="consentimientos-reservas" aria-labelledby="consentimientos-titulo">
      <header>
        <span className="page-eyebrow">CAPTACIÓN POR RESERVAS</span>
        <h2 id="consentimientos-titulo">Comunicaciones autorizadas</h2>
        <p>
          Resumen agregado de los permisos recibidos mediante reservas. Los destinatarios y las campañas se administran exclusivamente en Marketing.
          {datos.desde ? ` La primera, en ${fecha(datos.desde)}.` : ''}
        </p>
      </header>
      <div className="consentimientos-cifras">
        <article>
          <strong>{datos.suscritos.toLocaleString('es-CL')}</strong>
          <span>pueden recibir correos</span>
          {datos.ultimos30 > 0 && <small>{datos.ultimos30.toLocaleString('es-CL')} en los últimos 30 días</small>}
        </article>
        {/* Aceptaron pero no confirmaron el correo: todavía no se les puede escribir, y decir que
            sí los contaría como alcanzables cuando no lo son. */}
        {datos.pendientes > 0 && <article>
          <strong>{datos.pendientes.toLocaleString('es-CL')}</strong>
          <span>sin confirmar</span>
          <small>Aceptaron, pero falta que confirmen su correo.</small>
        </article>}
        {/* Las bajas se muestran: son la prueba de que cuando alguien se va, se respeta. */}
        {datos.bajas > 0 && <article>
          <strong>{datos.bajas.toLocaleString('es-CL')}</strong>
          <span>se dieron de baja</span>
          <small>No se les escribe más.</small>
        </article>}
      </div>
    </section>
  );
}
