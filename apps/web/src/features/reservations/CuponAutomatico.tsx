/**
 * @fileoverview Enviar un cupón solo a quien vino, o a quien respondió la encuesta de su visita.
 *
 * El envío existía en el servidor pero no tenía pantalla: nadie podía encenderlo. Y el código se
 * escribía a mano sin comprobar que existiera, así que con un error de tipeo la persona recibía un
 * regalo que la caja después rechazaba. Aquí el cupón se elige de la lista de cupones activos de
 * la empresa, y el servidor vuelve a comprobarlo antes de cada envío.
 *
 * «Cuando responde la encuesta» sólo aparece si la empresa tiene Reservas y Encuestas: sin
 * Encuestas no hay respuesta que esperar.
 *
 * Guarda en los mismos ajustes que la pantalla de Correos, que es donde se escribe el texto.
 */

import { useEffect, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { triggerToast } from '../../shared/toast-events';

interface Ajuste { key: string; value: unknown }
interface CuponActivo { code: string; active: boolean; validUntil?: string; maxUses: number; usageCount: number }

type Momento = 'asistencia' | 'encuesta';

export function CuponAutomatico({ clientId, empresa, cupones, ofreceEncuestas }: {
  clientId: string;
  empresa: string;
  cupones: CuponActivo[];
  /** Si la empresa tiene Encuestas contratado. Sin él, sólo se ofrece enviar tras la asistencia. */
  ofreceEncuestas: boolean;
}): JSX.Element | null {
  const queryClient = useQueryClient();
  const ajustes = useQuery<Ajuste[]>({
    queryKey: ['ajustes-correo', clientId],
    queryFn: () => api.get(`/settings/correos?clientId=${encodeURIComponent(clientId)}`),
    retry: false,
  });

  const valor = (clave: string) => ajustes.data?.find((ajuste) => ajuste.key === clave)?.value;
  const [encendido, setEncendido] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [momento, setMomento] = useState<Momento>('asistencia');
  const [dias, setDias] = useState(30);

  // Se carga lo guardado una vez que llega, y cada vez que se cambia de empresa.
  useEffect(() => {
    if (!ajustes.data) return;
    setEncendido(Boolean(valor('email.coupon_enabled')));
    setCodigo(String(valor('email.coupon_code') ?? '').toUpperCase());
    setMomento(valor('email.coupon_trigger') === 'encuesta' ? 'encuesta' : 'asistencia');
    setDias(Number(valor('email.coupon_days_valid')) || 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustes.data]);

  const guardar = useMutation({
    mutationFn: () => api.put(`/settings/correos?clientId=${encodeURIComponent(clientId)}`, {
      values: {
        'email.coupon_enabled': encendido,
        'email.coupon_code': codigo,
        'email.coupon_trigger': momento === 'encuesta' && ofreceEncuestas ? 'encuesta' : 'asistencia',
        'email.coupon_days_valid': dias,
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ajustes-correo'] });
      triggerToast(encendido ? 'Cupón automático guardado' : 'Cupón automático apagado');
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo guardar', 'error'),
  });

  // Sin permiso para los correos de la empresa no hay nada que mostrar: la reja es del servidor.
  if (ajustes.isError) return null;
  if (ajustes.isLoading) return <section className="cupon-automatico"><p className="page-subtitle">Cargando…</p></section>;

  const activos = cupones.filter((cupon) => cupon.active);
  const elegido = activos.find((cupon) => cupon.code.toUpperCase() === codigo);
  // Un cupón guardado que ya no está activo se sigue mostrando, para que se vea el problema.
  const codigoHuerfano = codigo && !elegido;
  const cuando = momento === 'encuesta' && ofreceEncuestas ? 'cuando responda la encuesta de su visita' : 'al día siguiente de marcar que vino';
  const faltaCupon = encendido && !elegido;

  return (
    <section className="cupon-automatico">
      <header>
        <h2>Cupón automático</h2>
        <p>Un regalo para que vuelvan: se envía por correo a quien vino a {empresa}. La misma persona lo recibe como mucho una vez cada dos meses por local.</p>
      </header>

      <label className="cupon-automatico-interruptor">
        <input type="checkbox" checked={encendido} onChange={(event) => setEncendido(event.target.checked)} />
        <span>Enviar un cupón automáticamente</span>
      </label>

      {encendido && <>
        <label>
          Cupón que se envía
          <select className="input" value={elegido ? elegido.code.toUpperCase() : ''} onChange={(event) => setCodigo(event.target.value)}>
            <option value="">{activos.length ? 'Elige un cupón' : 'Crea primero un cupón activo'}</option>
            {activos.map((cupon) => <option key={cupon.code} value={cupon.code.toUpperCase()}>{cupon.code}</option>)}
          </select>
          {codigoHuerfano && <small className="field-error">El cupón guardado ({codigo}) ya no está activo: elige otro, o no se enviará nada.</small>}
        </label>

        <fieldset className="cupon-automatico-momento">
          <legend>¿Cuándo se envía?</legend>
          <label>
            <input type="radio" checked={momento === 'asistencia' || !ofreceEncuestas} onChange={() => setMomento('asistencia')} />
            <span><strong>Después de que venga</strong><small>Al día siguiente de marcar su asistencia. Reciben todos los que vinieron.</small></span>
          </label>
          {ofreceEncuestas && (
            <label>
              <input type="radio" checked={momento === 'encuesta'} onChange={() => setMomento('encuesta')} />
              <span><strong>Cuando responda la encuesta de su visita</strong><small>El cupón es el agradecimiento por opinar. Sólo lo reciben quienes la terminan.</small></span>
            </label>
          )}
        </fieldset>

        <label className="cupon-automatico-dias">
          Días para usarlo
          <input className="input" type="number" min={1} max={365} value={dias} onChange={(event) => setDias(Math.min(365, Math.max(1, Number(event.target.value) || 1)))} />
          {elegido?.validUntil && <small>El cupón vence el {new Date(elegido.validUntil).toLocaleDateString('es-CL')}: el correo nunca promete más allá de esa fecha.</small>}
        </label>
      </>}

      <p className="cupon-automatico-resumen">
        {!encendido
          ? 'Apagado: no se envía ningún cupón.'
          : faltaCupon
            ? 'Falta elegir el cupón: sin él no se envía nada.'
            : `Quien venga a ${empresa} recibirá el cupón ${elegido!.code} ${cuando}, con ${dias} días para usarlo.`}
      </p>

      <footer>
        <Link to="/correos">Editar el texto del correo</Link>
        <button type="button" className="btn btn-primary btn-sm" disabled={guardar.isPending || faltaCupon} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </footer>
    </section>
  );
}
