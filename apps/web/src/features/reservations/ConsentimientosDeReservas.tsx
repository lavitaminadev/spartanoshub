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
 * A cuántas personas captadas por sus reservas puede escribirles esta empresa.
 *
 * Cada reserva cuyo formulario pide el consentimiento deja a esa persona en la lista de la
 * empresa, con el texto que aceptó y su IP. Eso ocurre tenga o no Marketing contratado, porque el
 * permiso lo dio la persona y no se descarta por falta de contrato. La consecuencia era que la
 * empresa captaba una lista que no podía ni mirar: el dato existía a su nombre y era invisible
 * para ella.
 *
 * Esto es lo que le corresponde ver sin contratar nada: **cuántos** y **desde cuándo**. Escribirles
 * —segmentos, campañas, plantillas— sigue siendo Marketing, y por eso acá no hay ningún botón de
 * enviar: la cifra responde «qué tengo», no «qué puedo hacer con esto».
 *
 * @param clientId - La empresa. Sin ella no se consulta: sumar las listas de varias no significa
 * nada, porque cada consentimiento se dio a un negocio concreto.
 */
export function ConsentimientosDeReservas({ clientId }: { clientId?: string }): JSX.Element | null {
  const consulta = useQuery<Consentimientos>({
    queryKey: ['consentimientos-de-reservas', clientId],
    enabled: Boolean(clientId),
    queryFn: () => api.get(`/reservations/consentimientos?clientId=${encodeURIComponent(clientId!)}`),
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
        <h2 id="consentimientos-titulo">Personas que aceptaron recibir comunicaciones</h2>
        <p>
          Las dejó una reserva, con el texto que aceptaron y la fecha.
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
