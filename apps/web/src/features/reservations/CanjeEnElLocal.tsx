/**
 * @fileoverview Anotar un cupón que alguien usó en el local, sin haber reservado.
 *
 * Es el caso que no tenía dónde registrarse. La persona llega con el código en el teléfono, se le
 * aplica el descuento, y hasta ahora eso no dejaba rastro: el contador del cupón decía menos usos
 * de los reales y no había con qué justificar el descuento ante quien paga la cuenta.
 *
 * **Primero se busca el código, después se canjea.** Quien atiende tiene el código, no el
 * identificador del cupón, y necesita ver qué está entregando antes de darlo por hecho. Buscar y
 * canjear en un solo gesto convertiría un error de tipeo en un uso consumido.
 *
 * **Lo que impide el canje se separa de lo que sólo avisa.** Un cupón vencido o sin usos no se
 * canjea y punto. Que hoy no sea uno de sus días, o que estemos fuera de su horario, se muestra y
 * se deja decidir a quien está en el mostrador: tiene delante a la persona y ve lo que el sistema
 * no. Negar un canje por una franja horaria con el cliente ya sentado crea un problema peor.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';

interface CuponEncontrado {
  id: string;
  code: string;
  discountType: string;
  value: number;
  usos: number;
  maxUsos: number;
  validUntil: string | null;
  canjeable: boolean;
  impedimento: string | null;
  avisos: string[];
}

/** Lo que se le pide a quien anota. Todo opcional salvo el código: ver abajo. */
interface DatosDelCanje {
  monto: string;
  descuento: string;
  persona: string;
  nota: string;
}

const SIN_DATOS: DatosDelCanje = { monto: '', descuento: '', persona: '', nota: '' };

export function CanjeEnElLocal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }): JSX.Element {
  const [codigo, setCodigo] = useState('');
  const [cupon, setCupon] = useState<CuponEncontrado | null>(null);
  const [datos, setDatos] = useState<DatosDelCanje>(SIN_DATOS);
  const queryClient = useQueryClient();

  const limpiar = () => { setCodigo(''); setCupon(null); setDatos(SIN_DATOS); };

  const buscar = useMutation({
    mutationFn: (texto: string) => api.get<CuponEncontrado>(`/reservations/coupons/buscar?codigo=${encodeURIComponent(texto)}`),
    onSuccess: (encontrado) => setCupon(encontrado),
    onError: (error: Error) => { setCupon(null); triggerToast(error.message || 'No se encontró el cupón', 'error'); },
  });

  const canjear = useMutation({
    mutationFn: () => api.post(`/reservations/coupons/${cupon!.id}/canjes`, {
      // Vacío es «no se anotó», que es distinto de cero: cero diría que la persona consumió nada.
      ...(datos.monto.trim() ? { monto: Number(datos.monto) } : {}),
      ...(datos.descuento.trim() ? { descuento: Number(datos.descuento) } : {}),
      ...(datos.persona.trim() ? { persona: datos.persona.trim() } : {}),
      ...(datos.nota.trim() ? { nota: datos.nota.trim() } : {}),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
      triggerToast(`Canje anotado: ${cupon?.code}`, 'success');
      limpiar();
      alCerrar();
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo anotar el canje', 'error'),
  });

  return (
    <Modal open={abierto} title="Anotar un cupón usado en el local" onClose={() => { limpiar(); alCerrar(); }}>
      <form
        className="modal-form canje-local"
        onSubmit={(evento) => { evento.preventDefault(); if (!cupon) buscar.mutate(codigo); }}
      >
        <label>
          Código del cupón
          <input
            className="input"
            autoFocus
            placeholder="El que trae la persona"
            value={codigo}
            // Mayúsculas al escribir: así se guardan, y ver el código tal como quedará evita que
            // alguien crea que no se encontró por haberlo escrito distinto.
            onChange={(evento) => { setCodigo(evento.target.value.toUpperCase()); setCupon(null); }}
          />
          <small>Se busca primero para ver qué se está entregando, y recién después se anota.</small>
        </label>

        {!cupon ? (
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => { limpiar(); alCerrar(); }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!codigo.trim() || buscar.isPending}>
              {buscar.isPending ? 'Buscando…' : 'Buscar cupón'}
            </button>
          </div>
        ) : (
          <>
            <div className={`canje-ficha ${cupon.canjeable ? '' : 'no-canjeable'}`}>
              <strong>{cupon.code}</strong>
              <span>
                {cupon.discountType === 'percentage' ? `${cupon.value}% de descuento` : `$${cupon.value.toLocaleString('es-CL')} de descuento`}
              </span>
              <small>
                {cupon.maxUsos > 0 ? `${cupon.usos} de ${cupon.maxUsos} usos` : `${cupon.usos} usos, sin tope`}
                {cupon.validUntil ? ` · vence el ${new Date(cupon.validUntil).toLocaleDateString('es-CL')}` : ''}
              </small>
            </div>

            {cupon.impedimento ? (
              <p className="form-hint form-hint-aviso">{cupon.impedimento}</p>
            ) : null}
            {/* Los avisos no bloquean: quien atiende decide, y queda anotado que lo decidió. */}
            {cupon.avisos.map((aviso) => <p key={aviso} className="form-hint">{aviso}</p>)}

            {cupon.canjeable ? (
              <>
                <div className="form-row">
                  <label>Monto consumido<small>Opcional. En pesos.</small>
                    <input className="input" inputMode="numeric" placeholder="Sin anotar" value={datos.monto}
                      onChange={(evento) => setDatos({ ...datos, monto: evento.target.value.replace(/\D/g, '') })} />
                  </label>
                  <label>Descuento entregado<small>Opcional. Lo que costó el cupón.</small>
                    <input className="input" inputMode="numeric" placeholder="Sin anotar" value={datos.descuento}
                      onChange={(evento) => setDatos({ ...datos, descuento: evento.target.value.replace(/\D/g, '') })} />
                  </label>
                </div>
                <label>Quién lo usó<small>Teléfono, correo o documento. Sirve para ver si alguien lo repite.</small>
                  <input className="input" placeholder="Opcional" value={datos.persona}
                    onChange={(evento) => setDatos({ ...datos, persona: evento.target.value })} />
                </label>
                <label>Nota<small>Opcional. Por ejemplo, si se hizo una excepción.</small>
                  <input className="input" maxLength={300} placeholder="Opcional" value={datos.nota}
                    onChange={(evento) => setDatos({ ...datos, nota: evento.target.value })} />
                </label>
              </>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={limpiar}>Buscar otro</button>
              <button type="button" className="btn btn-primary" disabled={!cupon.canjeable || canjear.isPending}
                onClick={() => canjear.mutate()}>
                {canjear.isPending ? 'Anotando…' : 'Anotar el canje'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
