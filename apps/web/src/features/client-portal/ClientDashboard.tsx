import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEmpresaActiva, useUsuarioEnEmpresaActiva } from '../../shared/empresa-activa';
import { api } from '../../core/api';
import { PulsoEspartano } from '../pulse/PulsoEspartano';
import { PageHero } from '../../shared/PageHero';
import { activePortalCards, isPortalPulseVisible } from './client-portal-scope';

/** Un pendiente del CRM, tal como lo calcula el mismo servicio que usa el equipo. */
interface Pendiente { key: string; count: number; level: 'critico' | 'alto' }

interface Inicio {
  /** Ausente cuando la empresa no tiene CRM contratado. No es lo mismo que estar en cero. */
  crm?: { leadsDelMes: number; pendientes: Pendiente[] };
  reservas?: { proximasDosDias: number; sinConfirmar: number };
  /**
   * Presupuesto de diseño del mes. Ausente si no se contrató la visibilidad, o si el mes todavía
   * no tiene presupuesto abierto: en ninguno de los dos casos hay nada que contar.
   */
  presupuesto?: {
    contratado: number; reservado: number; consumido: number; disponible: number; mes: string; cerrado: boolean;
    /** En qué se fueron las UD, lo más reciente primero. Sin quién lo hizo: es reparto interno. */
    movimientos: Array<{ fecha: string; tipo: string; unidades: number; pieza: string | null; motivo: string | null }>;
  };
}

/** Las UD se guardan con dos decimales, pero los enteros se leen mejor sin el «,00». */
const ud = (valor: number) => (Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace('.', ','));

/**
 * Cómo se nombra cada movimiento para quien no trabaja acá.
 *
 * Los nombres del motor —`consumption`, `release`— describen la operación; estos describen lo
 * que le pasó a su presupuesto, que es la pregunta que trae quien abre el portal.
 */
const MOVIMIENTOS: Record<string, string> = {
  budget_assigned: 'Presupuesto asignado',
  reservation: 'Reservado para una pieza',
  consumption: 'Pieza terminada',
  release: 'Devuelto al presupuesto',
  adjustment: 'Ajuste',
  extra: 'Unidades extra',
  rollover: 'Traspaso del mes anterior',
};

/**
 * Cómo se lee cada pendiente, y por qué importa.
 *
 * El nombre solo no basta: «sin contactar» dice qué son, no por qué hay que mirarlos hoy. La
 * segunda línea es la que convierte un número en una decisión.
 */
const PENDIENTES: Record<string, { titulo: string; porque: string }> = {
  sin_contactar: {
    titulo: 'sin contactar',
    porque: 'Nadie les ha llamado ni escrito. Mientras más pasa, menos responden.',
  },
  calificados_sin_visita: {
    titulo: 'listos para visitar',
    porque: 'Están calificados pero no tienen fecha agendada.',
  },
};

/**
 * El portal de una empresa cliente.
 *
 * Era un menú: dos tarjetas que decían qué servicios tiene contratados. Eso sirve la primera vez
 * y no dice nada el día treinta, cuando la pregunta ya no es «qué tengo» sino «qué hago». Ahora
 * lo primero que se ve es lo que hay que atender, y las tarjetas quedan debajo como el acceso que
 * siempre fueron.
 *
 * Cada bloque aparece solo si su servicio está contratado: el servidor omite la clave entera, así
 * que un cero acá significa «no hay nada pendiente» y nunca «no lo tienes».
 */
export function ClientDashboard() {
  // Las tarjetas son las de la empresa activa, no las de la empresa propia de la cuenta.
  const user = useUsuarioEnEmpresaActiva();
  const { clientId: empresaActiva } = useEmpresaActiva();

  const { data } = useQuery<Inicio>({
    /*
     * La persona va en la clave, no solo en la sesión.
     *
     * Vaciar la caché al entrar depende de una lectura asíncrona que puede llegar después del
     * primer dibujo: en ese hueco, una clave compartida deja que una empresa vea el resumen de
     * la anterior. Con la persona dentro, ese dato es inalcanzable aunque siga guardado.
     */
    // Y la empresa activa: cada una tiene su propio resumen.
    queryKey: ['portal-inicio', user?.id, empresaActiva],
    enabled: Boolean(user?.id),
    queryFn: () => api.get(`/portal/inicio${empresaActiva ? `?clientId=${encodeURIComponent(empresaActiva)}` : ''}`),
    // Es un resumen, no un dato transaccional: si falla, la pantalla sigue sirviendo como menú.
    retry: false,
  });

  /*
   * Lo que urge de verdad, sumado en leads y no en avisos.
   *
   * Contar avisos daría el mismo «2» con tres leads sin contactar que con treinta. Es la misma
   * decisión que toma el inicio del equipo, por el mismo motivo.
   */
  const urgentes = (data?.crm?.pendientes ?? [])
    .filter((pendiente) => pendiente.level === 'critico')
    .reduce((suma, pendiente) => suma + pendiente.count, 0);
  const reservasHoy = data?.reservas?.proximasDosDias ?? 0;

  const saludo = urgentes > 0
    ? `Tienes ${urgentes} contacto${urgentes === 1 ? '' : 's'} esperando respuesta.`
    : reservasHoy > 0
      ? `Tienes ${reservasHoy} reserva${reservasHoy === 1 ? '' : 's'} entre hoy y mañana.`
      : 'Tu panel de avances y decisiones.';

  return (
    <div className="page">
      <PageHero
        tone="portal"
        eyebrow="TU ESPACIO DE MARCA"
        title={`Bienvenido, ${user?.name ?? ''}`}
        subtitle={saludo}
        footer={<div className="portal-pulse"><span><i className="online-dot" />Cuenta activa</span><span>Actualizado hoy</span></div>}
      />
      {isPortalPulseVisible(user) ? <PulsoEspartano compact /> : null}

      {data?.crm || data?.reservas || data?.presupuesto ? (
        <div className="card-grid portal-resumen">
          {data.crm ? (
            <div className="card portal-home-card">
              <h3>{data.crm.leadsDelMes}</h3>
              <p>contactos llegaron este mes</p>
              {data.crm.pendientes.filter((pendiente) => pendiente.count > 0).map((pendiente) => (
                <p key={pendiente.key} className={`portal-pendiente es-${pendiente.level}`}>
                  <strong>{pendiente.count} {PENDIENTES[pendiente.key]?.titulo ?? pendiente.key}</strong>
                  <span>{PENDIENTES[pendiente.key]?.porque}</span>
                </p>
              ))}
              {/*
                El silencio se dice, no se deja en blanco.

                Una tarjeta sin avisos y una que no cargó se ven igual si no hay una frase. Con
                ella, quien entra sabe que miró y que no hay nada, en vez de dudar.
              */}
              {data.crm.pendientes.every((pendiente) => pendiente.count === 0) ? (
                <p className="portal-pendiente es-ok"><strong>Todo al día</strong><span>Ningún contacto está esperando.</span></p>
              ) : null}
              <Link to="/crm" className="btn btn-primary btn-sm">Abrir CRM</Link>
            </div>
          ) : null}

          {data.reservas ? (
            <div className="card portal-home-card">
              <h3>{data.reservas.proximasDosDias}</h3>
              <p>reservas entre hoy y mañana</p>
              {data.reservas.sinConfirmar > 0 ? (
                <p className="portal-pendiente es-critico">
                  <strong>{data.reservas.sinConfirmar} sin confirmar</strong>
                  {/*
                    Sin límite de fecha a propósito: una reserva sin confirmar de la semana pasada
                    sigue siendo trabajo sin hacer, y esconderla no la resuelve.
                  */}
                  <span>Esperan tu confirmación para quedar en firme.</span>
                </p>
              ) : (
                <p className="portal-pendiente es-ok"><strong>Todo confirmado</strong><span>No queda ninguna esperando.</span></p>
              )}
              <Link to="/portal/reservations" className="btn btn-primary btn-sm">Abrir reservas</Link>
            </div>
          ) : null}

          {/*
            El saldo de diseño: lo que le queda, no lo que gastó.

            La cifra grande es lo disponible porque es la que decide si puede pedir una pieza
            más. Lo reservado va aparte de lo consumido: es trabajo comprometido que todavía
            puede soltarse, y sumarlo se leería como gastado sin estarlo.
          */}
          {data.presupuesto ? (
            <div className="card portal-home-card">
              <h3>{ud(data.presupuesto.disponible)}</h3>
              <p>UD disponibles de {ud(data.presupuesto.contratado)} este mes</p>
              {data.presupuesto.reservado > 0 ? (
                <p className="portal-pendiente es-alto">
                  <strong>{ud(data.presupuesto.reservado)} reservadas</strong>
                  <span>Piezas comprometidas que aún no se cierran.</span>
                </p>
              ) : null}
              <p className="portal-pendiente es-ok">
                <strong>{ud(data.presupuesto.consumido)} consumidas</strong>
                <span>{data.presupuesto.cerrado ? 'El mes ya está cerrado.' : 'Piezas terminadas y aprobadas.'}</span>
              </p>
              {data.presupuesto.disponible <= 0 && !data.presupuesto.cerrado ? (
                <p className="portal-pendiente es-critico">
                  <strong>Sin UD disponibles</strong>
                  <span>Para pedir otra pieza este mes, habla con tu contacto en Espartanos.</span>
                </p>
              ) : null}
              {/*
                En qué se fueron, pieza por pieza.

                Plegado y no abierto: la pregunta de cada día es cuánto queda, y el detalle es lo
                que se mira cuando el número no cuadra con lo que uno esperaba.
              */}
              {data.presupuesto.movimientos.length > 0 ? (
                <details className="portal-movimientos">
                  <summary>En qué se usaron ({data.presupuesto.movimientos.length})</summary>
                  <ul>
                    {data.presupuesto.movimientos.map((movimiento, indice) => (
                      <li key={`${movimiento.fecha}-${indice}`}>
                        <span className="portal-movimiento-ud">{movimiento.unidades > 0 ? '−' : '+'}{ud(Math.abs(movimiento.unidades))} UD</span>
                        <strong>{movimiento.pieza ?? MOVIMIENTOS[movimiento.tipo] ?? movimiento.tipo}</strong>
                        <small>
                          {new Date(movimiento.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                          {movimiento.pieza ? ` · ${MOVIMIENTOS[movimiento.tipo] ?? movimiento.tipo}` : ''}
                          {movimiento.motivo ? ` · ${movimiento.motivo}` : ''}
                        </small>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        /*
         * Las tarjetas de siempre, como respaldo.
         *
         * Se muestran cuando el resumen todavía no llegó o falló. El portal nunca se queda sin
         * puerta de entrada por un resumen que no cargó.
         */
        activePortalCards(user).length === 0 ? (
          /*
           * Cuando no queda nada que abrir, decirlo.
           *
           * A quien le retiran el acceso a su empresa, o cuyo servicio quedó en pausa, le
           * aparecía el portal con el saludo y ni una tarjeta: se lee como que el sistema se
           * rompió y termina en una llamada preguntando qué pasó. Un aviso que nombra el motivo
           * y a quién acudir convierte eso en un trámite.
           */
          <div className="card portal-home-card">
            <h3>Por ahora no tienes servicios activos</h3>
            <p>
              Tu cuenta funciona, pero no hay ninguna empresa ni servicio asignado a ella. Suele ser
              porque el servicio está en pausa o porque se retiró tu acceso a la empresa.
            </p>
            {/*
              La bandeja de solicitudes ya existe y tiene el tipo «Crear cuenta o acceso».
              Mandar a escribir un correo, teniendo el formulario, deja el pedido sin registro
              ni estado: acá se ve en qué va.
            */}
            <p>Pídelo por el formulario de acceso y queda registrado, con su estado a la vista.</p>
            <Link to="/solicitudes" className="btn btn-primary btn-sm">Solicitar acceso</Link>
          </div>
        ) : (
        <div className="card-grid">
          {activePortalCards(user).map((card) => (
            <div key={card.link} className="card portal-home-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <Link to={card.link} className="btn btn-primary btn-sm">
                {card.action}
              </Link>
            </div>
          ))}
        </div>
        )
      )}
    </div>
  );
}
