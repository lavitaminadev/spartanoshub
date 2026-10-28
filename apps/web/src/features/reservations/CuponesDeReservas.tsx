/**
 * @fileoverview La pestaña de cupones de Reservas, con su propio estado y sus propios modales.
 *
 * Es el mismo trabajo que antes vivía dentro de `ReservationsPage`: crear un cupón, acotar la
 * lista, anotar un canje y mirar los usos de uno. Nada de la lógica cambió al mudarse; lo que
 * cambia es que ese estado —diez variables y dos mutaciones— ya no se mezcla con el de la agenda
 * ni con el de las solicitudes de grupo.
 *
 * Lo que necesita de la pantalla madre entra por props: la empresa que se está mirando, sus
 * formularios y el código de cupón que llega desde la ficha de una reserva.
 */

import { Fragment, useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { triggerToast } from '../../shared/toast-events';
import { LimitePorPersona, limiteValido, type ClaveDePersona } from './LimitePorPersona';
import { CuponAutomatico } from './CuponAutomatico';
import { CanjeEnElLocal } from './CanjeEnElLocal';
import { MetricasDelCupon } from './MetricasDelCupon';
import { browserDateBoundaryUtc } from './local-time';
import type { ReservationForm } from './types';

/** Un cupón tal como lo devuelve `/reservations/coupons`. */
export interface Cupon {
  id: string;
  code: string;
  discountType: string;
  value: number;
  maxUses: number;
  usageCount: number;
  validFrom?: string;
  validUntil?: string;
  formIds?: string[];
  active: boolean;
  createdAt: string;
  uso?: { enviados: number; usados: number; volvieronDelCorreo: number };
}

interface Empresa { id: string; name: string }

interface CuponesDeReservasProps {
  /** Empresa elegida en el selector de arriba, o vacío cuando se miran todas. */
  clientFilter: string;
  /** La empresa sobre la que se trabaja de verdad: la elegida, o la propia de la cuenta. */
  empresaEnUso: string;
  /** Empresas del alcance, para nombrar a quién pertenece el cupón. */
  clients: Empresa[];
  /** Si la empresa tiene Encuestas contratado: decide qué ofrece el cupón automático. */
  ofreceEncuestas: boolean;
  /** `manage` sobre Reservas: quien define la oferta, no sólo quien la registra. */
  puedeCrearCupones: boolean;
  /** Una cuenta de empresa siempre trabaja sobre la suya, así que no necesita elegirla. */
  esCuentaDeEmpresa: boolean;
  /** Local elegido en el filtro de arriba: acota qué cupones aplican. */
  formIdFiltro: string;
  /** Formularios de reserva de la empresa, para decir dónde vale el cupón. */
  formularios: ReservationForm[];
  /** Código que llega desde la ficha de una reserva; se abre su panel de métricas. */
  codigoPorVer?: string | null;
  /** Avisa que ese código ya se atendió, para no volver a abrirlo. */
  onCodigoVisto?: () => void;
}

export function CuponesDeReservas({
  clientFilter, empresaEnUso, clients, ofreceEncuestas, puedeCrearCupones, esCuentaDeEmpresa,
  formIdFiltro, formularios, codigoPorVer, onCodigoVisto,
}: CuponesDeReservasProps) {
  const qc = useQueryClient();
  const [couponCreateOpen, setCouponCreateOpen] = useState(false);
  const [canjeAbierto, setCanjeAbierto] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '', validDaysOfWeek: [] as number[], validFromTime: '', validUntilTime: '', maxUsesPerPerson: 0, personKeys: ['phone', 'email'] as ClaveDePersona[] });
  /*
   * El cupón se busca en el servidor, no sobre lo ya traído.
   *
   * Filtrar en el navegador deja fuera lo que no vino: con la lista recortada, el cupón que se
   * busca y no está en pantalla parecía no existir. `useDeferredValue` evita una consulta por
   * cada tecla sin que el campo se sienta lento.
   */
  const [couponSearch, setCouponSearch] = useState('');
  const couponBuscado = useDeferredValue(couponSearch.trim());
  const [couponEstado, setCouponEstado] = useState<'' | 'vigente' | 'vencido' | 'inactivo'>('');
  /*
   * El período acota el uso que se cuenta al lado de cada cupón, no la lista de cupones.
   *
   * Ese recuento cruza dos veces la tabla de reservas entera, así que sin fechas su costo crecía
   * con el total de reservas del local y no con el número de cupones. Un cupón sigue apareciendo
   * aunque no se haya usado en el tramo: lo que cambia es cuántos usos se le cuentan.
   */
  const [couponPeriodo, setCouponPeriodo] = useState({ desde: '', hasta: '' });
  const [cuponMirado, setCuponMirado] = useState<{ id: string; code: string } | null>(null);
  const [confirmCoupon, setConfirmCoupon] = useState<{ id: string; active: boolean } | null>(null);

  const { data: couponsData = [], isSuccess: listaCargada } = useQuery<Cupon[]>({ queryKey: ['coupons', clientFilter, couponBuscado, couponEstado, couponPeriodo.desde, couponPeriodo.hasta], queryFn: () => api.get(`/reservations/coupons?${new URLSearchParams({ ...(clientFilter ? { clientId: clientFilter } : {}), ...(couponBuscado ? { codigo: couponBuscado } : {}), ...(couponEstado ? { estado: couponEstado } : {}), ...(couponPeriodo.desde ? { desde: couponPeriodo.desde } : {}), ...(couponPeriodo.hasta ? { hasta: couponPeriodo.hasta } : {}) })}`) });
  const coupons = Array.isArray(couponsData) ? couponsData : [];

  /*
   * El cupón que pidió la ficha de una reserva.
   *
   * La ficha conoce el código; el panel de métricas pide el identificador, así que se busca en la
   * lista ya cargada. Si el cupón fuera de otra empresa no estaría ahí, y entonces la pestaña se
   * abre sin panel en vez de uno vacío que parezca un fallo.
   */
  useEffect(() => {
    // Se espera a que la lista llegue: resolverlo contra una lista todavía vacía descartaría el
    // código pedido y abriría la pestaña sin panel aunque el cupón sí exista.
    if (!codigoPorVer || !listaCargada) return;
    const hallado = coupons.find((cupon) => cupon.code === codigoPorVer);
    setCuponMirado(hallado ? { id: hallado.id, code: hallado.code } : null);
    onCodigoVisto?.();
  }, [codigoPorVer, listaCargada, coupons, onCodigoVisto]);

  const couponCreate = useMutation({
    mutationFn: () => {
      /*
       * El cupón es de la empresa que se está mirando.
       *
       * Esta pantalla nunca mandaba la empresa: para el equipo interno cada cupón quedaba sin
       * dueño, y un cupón sin dueño se aceptaba en todos los locales de todos los clientes. Las
       * cuentas de empresa no lo notaban porque el servidor les pone la suya.
       */
      const body: Record<string, unknown> = { code: couponForm.code.trim(), discountType: couponForm.discountType, value: couponForm.value, maxUses: couponForm.maxUses, ...(empresaEnUso ? { clientId: empresaEnUso } : {}), ...(couponForm.maxUsesPerPerson > 0 ? { maxUsesPerPerson: couponForm.maxUsesPerPerson, personKeys: couponForm.personKeys } : {}) };
      if (couponForm.validFrom) body.validFrom = browserDateBoundaryUtc(couponForm.validFrom);
      if (couponForm.validUntil) body.validUntil = browserDateBoundaryUtc(couponForm.validUntil, true);
      if (couponForm.formIds.trim()) body.formIds = couponForm.formIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (couponForm.validDaysOfWeek.length > 0) body.validDaysOfWeek = couponForm.validDaysOfWeek;
      if (couponForm.validFromTime) body.validFromTime = couponForm.validFromTime;
      if (couponForm.validUntilTime) body.validUntilTime = couponForm.validUntilTime;
      return api.post('/reservations/coupons', body);
    },
    onSuccess: () => { setCouponForm({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '', validDaysOfWeek: [], validFromTime: '', validUntilTime: '', maxUsesPerPerson: 0, personKeys: ['phone', 'email'] }); setCouponCreateOpen(false); qc.invalidateQueries({ queryKey: ['coupons'] }); triggerToast('Cupón creado'); },
  });
  const couponToggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/reservations/coupons/${id}`, { active }),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['coupons'] }); triggerToast(vars.active ? 'Cupón activado' : 'Cupón desactivado'); },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo cambiar el cupón', 'error'),
  });

  /*
   * El código y el estado ya vinieron filtrados del servidor; acá sólo queda el local.
   *
   * Ése sí es cosa de la pantalla: `formIds` viaja en cada cupón y la reserva elegida vive en
   * el filtro de arriba, así que no hace falta pedirlo otra vez para acotarlo.
   */
  const filteredCoupons = coupons.filter((coupon) => (
    !formIdFiltro || !coupon.formIds?.length || coupon.formIds.includes(formIdFiltro)
  ));

  return <Fragment>
    <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">CUPONES</span><h1>Gestión de cupones</h1></div><div className="reservation-flow-actions">
        {/* Anotar un canje va primero: es lo que se hace a diario, con alguien esperando en la
            caja, mientras que crear un cupón ocurre de vez en cuando y sin apuro. */}
        <button className="btn btn-primary btn-sm" type="button" onClick={() => setCanjeAbierto(true)}>Anotar cupón usado</button>
        <CanjeEnElLocal abierto={canjeAbierto} alCerrar={() => setCanjeAbierto(false)} />
        {/*
          * Crear un cupón pide `manage`; anotar uno usado, `edit`.
          *
          * Son decisiones distintas: crear define una oferta y compromete descuentos a futuro,
          * anotar registra algo que ya pasó con la persona delante. Un usuario normal de la
          * empresa canjea en la caja y no crea.
          *
          * Se esconde en vez de deshabilitarse: un botón apagado sin explicación invita a
          * preguntar qué falta, y acá la respuesta no es algo que esa persona pueda cambiar.
          */}
        {/*
          Sin empresa elegida el botón lleva al selector, en vez de no hacer nada.
          Apagado era un callejón: hay que subir a otro control que está fuera de la vista, y un
          botón que no responde se lee como que la pantalla está rota. Así el clic sigue siendo
          un paso hacia donde hay que ir.
        */}
        {puedeCrearCupones ? (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (clientFilter || esCuentaDeEmpresa) { setCouponCreateOpen(true); return; }
              const selector = document.getElementById('selector-de-empresa');
              selector?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (selector as HTMLSelectElement | null)?.focus();
            }}
          >+ Nuevo cupón</button>
        ) : null}
      </div></div>
      {!clientFilter && !esCuentaDeEmpresa && <p className="page-subtitle">Para crear un cupón, elige primero la empresa arriba: cada cupón vale sólo en los locales de su empresa.</p>}
      {empresaEnUso && (
        <CuponAutomatico
          clientId={empresaEnUso}
          empresa={clients.find((empresa) => empresa.id === empresaEnUso)?.name || 'tu empresa'}
          cupones={coupons}
          ofreceEncuestas={ofreceEncuestas}
        />
      )}
      <div className="reservation-filters">
        <input className="input" type="search" aria-label="Buscar cupón" placeholder="Buscar por código" value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} />
        {/*
          «Vigente» es lo canjeable hoy, no lo encendido: el servidor exige además que esté
          dentro de fechas y que le queden usos. Un cupón agotado que figurara como vigente
          haría que alguien se lo prometiera a un cliente.
        */}
        <select className="input" aria-label="Filtrar cupones por estado" value={couponEstado} onChange={(event) => setCouponEstado(event.target.value as typeof couponEstado)}>
          <option value="">Todos los cupones</option>
          <option value="vigente">Sólo los canjeables hoy</option>
          <option value="vencido">Sólo los que ya no sirven</option>
          <option value="inactivo">Sólo los apagados</option>
        </select>
        {/* Acotan el uso contado al lado de cada cupón, por cuándo se hizo la reserva. */}
        <label className="filter-date">Usos desde<input className="input" type="date" aria-label="Usos del cupón desde" value={couponPeriodo.desde} max={couponPeriodo.hasta || undefined} onChange={(event) => setCouponPeriodo((actual) => ({ ...actual, desde: event.target.value }))} /></label>
        <label className="filter-date">Hasta<input className="input" type="date" aria-label="Usos del cupón hasta" value={couponPeriodo.hasta} min={couponPeriodo.desde || undefined} onChange={(event) => setCouponPeriodo((actual) => ({ ...actual, hasta: event.target.value }))} /></label>
        {couponPeriodo.desde || couponPeriodo.hasta ? (
          <button type="button" className="btn btn-link" onClick={() => setCouponPeriodo({ desde: '', hasta: '' })}>Quitar fechas</button>
        ) : null}
      </div>
      {filteredCoupons.length === 0 ? <div className="reservation-empty"><strong>Sin cupones todavía</strong><p>Crea tu primer cupón promocional.</p></div> : <Fragment><div className="coupon-stats"><div className="reservation-metric-grid reservation-metric-grid-four"><div><span>Total cupones</span><strong>{coupons.length}</strong></div><div><span>Activos</span><strong>{coupons.filter((c) => c.active).length}</strong></div><div><span>Usos totales</span><strong>{coupons.reduce((sum, c) => sum + c.usageCount, 0)}</strong></div><div><span>Volvieron del correo</span><strong>{(() => { const env = coupons.reduce((s2, c) => s2 + (c.uso?.enviados ?? 0), 0); const vol = coupons.reduce((s2, c) => s2 + (c.uso?.volvieronDelCorreo ?? 0), 0); return env === 0 ? 'Ninguno enviado' : `${vol} de ${env}`; })()}</strong></div><div><span>Tasa de uso</span><strong>{(() => { const activeCoupons = coupons.filter((c) => c.active).length; if (activeCoupons === 0) return 'Sin cupones activos'; const usedActiveCoupons = coupons.filter((c) => c.active && c.usageCount > 0).length; return `${Math.round((usedActiveCoupons / activeCoupons) * 100)}% activos usados`; })()}</strong></div></div></div><div className="crm-table-container"><table className="data-table"><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Por correo</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredCoupons.map((coupon) => <tr key={coupon.id}><td data-label="Código"><strong>{coupon.code}</strong><small>Creado {new Date(coupon.createdAt).toLocaleDateString('es-CL')}</small></td><td data-label="Descuento">{coupon.discountType === 'percentage' ? `${coupon.value}%` : `$${coupon.value.toLocaleString('es-CL')}`}</td><td data-label="Usos">{coupon.usageCount}/{coupon.maxUses || '∞'}</td><td data-label="Por correo">{coupon.uso?.enviados ? <span className="cupon-correo"><strong>{coupon.uso.volvieronDelCorreo}</strong> de {coupon.uso.enviados}<small>{coupon.uso.enviados > 0 ? `${Math.round((coupon.uso.volvieronDelCorreo / coupon.uso.enviados) * 100)}% volvió` : ''}</small></span> : <small className="tabla-nota">No se ha enviado</small>}</td><td data-label="Vigencia">{coupon.validFrom ? `${new Date(coupon.validFrom).toLocaleDateString('es-CL')} - ${coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('es-CL') : '∞'}` : 'Sin fecha'}</td><td data-label="Estado"><span className={`crm-stage is-${coupon.active ? 'attended' : 'cancelled_business'}`}>{coupon.active ? 'Activo' : 'Inactivo'}</span></td><td data-label="Acciones"><div className="actions-cell"><button className="btn btn-outline btn-sm" onClick={() => coupon.active ? setConfirmCoupon({ id: coupon.id, active: false }) : couponToggle.mutate({ id: coupon.id, active: true })} disabled={couponToggle.isPending}>{coupon.active ? 'Desactivar' : 'Activar'}</button><button className="btn btn-outline btn-sm" onClick={() => setCuponMirado({ id: coupon.id, code: coupon.code })}>Ver usos</button></div></td></tr>)}</tbody></table></div></Fragment>}
      {cuponMirado && <MetricasDelCupon couponId={cuponMirado.id} codigo={cuponMirado.code} alCerrar={() => setCuponMirado(null)} />}
    </section>

    <Modal open={couponCreateOpen} onClose={() => setCouponCreateOpen(false)} title="Nuevo cupón"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); couponCreate.mutate(); }}><label>Código<input className="input" required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value })} placeholder="Ej. BIENVENIDA20" /></label><div className="form-row"><label>Tipo<select className="input" value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })}><option value="percentage">Porcentaje</option><option value="fixed">Fijo</option></select></label><label>Valor<input className="input" type="number" min="0" value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: Number(event.target.value) })} /></label></div><label>Usos máximos (0 = ilimitado)<input className="input" type="number" min="0" value={couponForm.maxUses} onChange={(event) => setCouponForm({ ...couponForm, maxUses: Number(event.target.value) })} /></label><div className="form-row"><label>Válido desde<input className="input" type="date" value={couponForm.validFrom} onChange={(event) => setCouponForm({ ...couponForm, validFrom: event.target.value })} /></label><label>Válido hasta<input className="input" type="date" value={couponForm.validUntil} onChange={(event) => setCouponForm({ ...couponForm, validUntil: event.target.value })} /></label></div><label>Formularios donde aplica<small>Sin marcar ninguno, el cupón vale para todos.</small><div className="coupon-form-picker">{formularios.length === 0 ? <em>Aún no hay formularios de reserva.</em> : formularios.map((form) => { const selected = couponForm.formIds.split(',').map((id) => id.trim()).filter(Boolean); const checked = selected.includes(form.id); return <label key={form.id} className="coupon-form-option"><input type="checkbox" checked={checked} onChange={(event) => { const next = event.target.checked ? [...selected, form.id] : selected.filter((id) => id !== form.id); setCouponForm({ ...couponForm, formIds: next.join(',') }); }} /><span>{form.name}</span></label>; })}</div></label><div className="form-row"><label>Válido desde la hora<small>De la reserva, no de cuándo se pide. Vacío = cualquier hora.</small><input className="input" type="time" value={couponForm.validFromTime} onChange={(event) => setCouponForm({ ...couponForm, validFromTime: event.target.value })} /></label><label>Válido hasta la hora<input className="input" type="time" value={couponForm.validUntilTime} onChange={(event) => setCouponForm({ ...couponForm, validUntilTime: event.target.value })} /></label></div><label>Días de la semana válidos (opcional, ninguno = todos)<div className="day-checkboxes">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((label, index) => { const jsDay = [1,2,3,4,5,6,0][index]; return <label key={index} className="day-checkbox"><input type="checkbox" checked={couponForm.validDaysOfWeek.includes(jsDay)} onChange={(event) => setCouponForm({ ...couponForm, validDaysOfWeek: event.target.checked ? [...couponForm.validDaysOfWeek, jsDay] : couponForm.validDaysOfWeek.filter((d) => d !== jsDay) })} />{label}</label>; })}</div></label><LimitePorPersona valor={{ maxUsesPerPerson: couponForm.maxUsesPerPerson, personKeys: couponForm.personKeys }} onChange={(limite) => setCouponForm({ ...couponForm, ...limite })} empresa={clients.find((empresa) => empresa.id === clientFilter)?.name || 'esta empresa'} algunLocalPideDocumento={formularios.some((form) => form.fieldSchema?.some((campo) => campo.type === 'document' || campo.type === 'rut'))} />{couponCreate.error && <div className="alert alert-error">{couponCreate.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setCouponCreateOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={couponCreate.isPending || !limiteValido(couponForm)}>{couponCreate.isPending ? 'Guardando...' : 'Crear cupón'}</button></div></form></Modal>

    <ConfirmDialog open={Boolean(confirmCoupon)} title="Desactivar cupón" description="¿Desactivar este cupón? Las reservas existentes no se verán afectadas." confirmLabel="Desactivar" pending={couponToggle.isPending} onClose={() => setConfirmCoupon(null)} onConfirm={() => { if (confirmCoupon) couponToggle.mutate(confirmCoupon); setConfirmCoupon(null); }} />
  </Fragment>;
}
