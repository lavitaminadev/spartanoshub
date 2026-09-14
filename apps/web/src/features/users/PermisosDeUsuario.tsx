/**
 * @fileoverview Qué puede hacer una persona, módulo por módulo, y qué empresas alcanza.
 *
 * El cargo define lo de todos; aquí se ajusta a una persona concreta sin tocar a las demás.
 * Cada fila muestra lo que da el cargo y, si hay un ajuste, lo marca como tal: volver a «Según
 * su cargo» borra el ajuste en vez de copiar el nivel, así un cambio futuro del cargo le llega.
 *
 * Sólo Administración y Desarrollo cambian permisos (lo exige el servidor); Dirección de
 * operaciones los ve en lectura.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';
import './permisos-de-usuario.css';

type Nivel = 'none' | 'view' | 'edit' | 'manage';
interface PermisoEfectivo { module: string; level: Nivel; source: 'role' | 'override'; moduleDisabled: boolean; productHidden: boolean }
interface AccesoEmpresa { clientId: string; source: 'pod' | 'assignment' | 'community-manager' }

const NIVELES: Array<{ valor: Nivel; texto: string }> = [
  { valor: 'none', texto: 'Sin acceso' },
  { valor: 'view', texto: 'Ver' },
  { valor: 'edit', texto: 'Editar' },
  { valor: 'manage', texto: 'Administrar' },
];
const TEXTO_NIVEL = Object.fromEntries(NIVELES.map((nivel) => [nivel.valor, nivel.texto])) as Record<Nivel, string>;

/** Los módulos que se operan hoy, con nombre legible y qué significa cada nivel en ellos. */
const MODULOS: Array<{ clave: string; nombre: string; ayuda: string }> = [
  { clave: 'crm', nombre: 'CRM', ayuda: 'Ver: consulta leads. Editar: mueve etapas y registra gestiones. Administrar: además campos, etapas y campañas.' },
  { clave: 'reservations', nombre: 'Reservas', ayuda: 'Ver: agenda y reservas. Editar: marca asistencia, bloquea y cambia horarios. Administrar: además crea y publica locales.' },
  { clave: 'surveys', nombre: 'Encuestas', ayuda: 'Ver: resultados. Editar: crea, publica y envía. Administrar: además elimina.' },
  { clave: 'clients', nombre: 'Empresas', ayuda: 'Ver: fichas. Editar: datos de la empresa. Administrar: servicios contratados y altas.' },
  { clave: 'users', nombre: 'Usuarios', ayuda: 'Administrar: crea cuentas y activa o desactiva accesos.' },
  { clave: 'integrations', nombre: 'Integraciones', ayuda: 'Conexiones con Meta, Google y otras herramientas.' },
  { clave: 'reports', nombre: 'Informes', ayuda: 'Informes y exportaciones.' },
  { clave: 'dashboard', nombre: 'Inicio', ayuda: 'Tablero principal.' },
];

const ORIGEN_EMPRESA: Record<AccesoEmpresa['source'], string> = {
  pod: 'por su equipo (pod)',
  'community-manager': 'como community manager de la cuenta',
  assignment: 'asignada a mano',
};

export function PermisosDeUsuario({ usuario, empresas, puedeEditar, onCerrar }: {
  usuario: { id: string; name: string; role: string };
  empresas: Array<{ id: string; name: string }>;
  puedeEditar: boolean;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const clave = ['permisos-de-usuario', usuario.id];
  const permisos = useQuery<{ modules: PermisoEfectivo[] }>({ queryKey: clave, queryFn: () => api.get(`/users/${usuario.id}/permissions`) });
  const delCargo = useQuery<{ permissions: Record<string, Nivel> }>({
    queryKey: ['permisos-del-cargo', usuario.role],
    queryFn: () => api.get(`/roles/${encodeURIComponent(usuario.role)}/permissions`),
    enabled: puedeEditar,
  });
  const accesos = useQuery<{ access: AccesoEmpresa[] | 'unrestricted' }>({
    queryKey: ['empresas-de-usuario', usuario.id],
    queryFn: () => api.get(`/users/${usuario.id}/client-access`),
    enabled: usuario.role !== 'client',
  });

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: clave });
    void qc.invalidateQueries({ queryKey: ['empresas-de-usuario', usuario.id] });
    void qc.invalidateQueries({ queryKey: ['access-exceptions'] });
  };
  const fallo = (error: Error) => triggerToast(error.message || 'No se pudo guardar el cambio', 'error');

  const cambiarNivel = useMutation({
    mutationFn: ({ modulo, nivel }: { modulo: string; nivel: Nivel | 'cargo' }) => nivel === 'cargo'
      ? api.delete(`/users/${usuario.id}/permissions/${modulo}`)
      : api.put(`/users/${usuario.id}/permissions/${modulo}`, { level: nivel, reason: 'Ajuste desde Usuarios' }),
    onSuccess: () => { refrescar(); triggerToast('Permiso actualizado. Se aplica en su próxima acción.'); },
    onError: fallo,
  });
  const cambiarEmpresa = useMutation({
    mutationFn: ({ clientId, conceder }: { clientId: string; conceder: boolean }) => conceder
      ? api.put(`/users/${usuario.id}/client-access/${clientId}`, { reason: 'Asignada desde Usuarios' })
      : api.delete(`/users/${usuario.id}/client-access/${clientId}`),
    onSuccess: () => { refrescar(); triggerToast('Empresas actualizadas'); },
    onError: fallo,
  });

  const porModulo = new Map((permisos.data?.modules ?? []).map((item) => [item.module, item]));
  const acceso = accesos.data?.access;
  const accesoPorEmpresa = new Map((Array.isArray(acceso) ? acceso : []).map((item) => [item.clientId, item]));
  const ocupado = cambiarNivel.isPending || cambiarEmpresa.isPending;

  return <Modal open onClose={onCerrar} title={`Permisos de ${usuario.name}`}>
    <div className="permisos-usuario">
      <section>
        <h3>Qué puede hacer</h3>
        <p className="page-subtitle">Parte de lo que da su cargo. Un ajuste aquí vale sólo para esta persona.</p>
        {permisos.isLoading ? <p>Cargando permisos…</p> : permisos.error ? <p className="error-text">{(permisos.error as Error).message}</p> : (
          <div className="permisos-usuario-lista">
            {MODULOS.map((modulo) => {
              const efectivo = porModulo.get(modulo.clave);
              if (!efectivo) return null;
              const bloqueado = efectivo.moduleDisabled || efectivo.productHidden;
              const nivelDelCargo = delCargo.data?.permissions?.[modulo.clave];
              return <div key={modulo.clave} className={`permisos-usuario-fila ${efectivo.source === 'override' ? 'es-ajuste' : ''}`}>
                <div>
                  <strong>{modulo.nombre}</strong>
                  <small>{bloqueado ? 'Módulo no disponible en esta organización o etapa.' : modulo.ayuda}</small>
                </div>
                {puedeEditar && !bloqueado ? (
                  <select
                    className="input"
                    aria-label={`Nivel en ${modulo.nombre}`}
                    disabled={ocupado}
                    value={efectivo.source === 'override' ? efectivo.level : 'cargo'}
                    onChange={(evento) => cambiarNivel.mutate({ modulo: modulo.clave, nivel: evento.target.value as Nivel | 'cargo' })}
                  >
                    <option value="cargo">Según su cargo{nivelDelCargo ? ` (${TEXTO_NIVEL[nivelDelCargo]})` : ''}</option>
                    {NIVELES.map((nivel) => <option key={nivel.valor} value={nivel.valor}>{nivel.texto}</option>)}
                  </select>
                ) : <span className={`level-pill level-${efectivo.level}`}>{TEXTO_NIVEL[efectivo.level]}</span>}
                {efectivo.source === 'override' && <em className="permisos-usuario-marca">Ajustado para esta persona</em>}
              </div>;
            })}
          </div>
        )}
      </section>

      {usuario.role !== 'client' && <section>
        <h3>Qué empresas alcanza</h3>
        {accesos.isLoading ? <p>Cargando empresas…</p> : acceso === 'unrestricted' ? (
          <p className="page-subtitle">Su cargo ve todas las empresas de la organización.</p>
        ) : (
          <>
            <p className="page-subtitle">Ve sólo las empresas marcadas. Las que vienen por su equipo se cambian desde el pod.</p>
            <div className="permisos-usuario-empresas">
              {empresas.map((empresa) => {
                const actual = accesoPorEmpresa.get(empresa.id);
                const heredada = actual && actual.source !== 'assignment';
                return <label key={empresa.id} className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(actual)}
                    disabled={!puedeEditar || ocupado || Boolean(heredada)}
                    onChange={(evento) => cambiarEmpresa.mutate({ clientId: empresa.id, conceder: evento.target.checked })}
                  />
                  <span>{empresa.name}{actual && <small> · {ORIGEN_EMPRESA[actual.source]}</small>}</span>
                </label>;
              })}
              {empresas.length === 0 && <p className="page-subtitle">No hay empresas registradas.</p>}
            </div>
          </>
        )}
      </section>}

      {!puedeEditar && <p className="page-subtitle">Sólo Administración puede cambiar permisos.</p>}
      <div className="modal-actions"><button type="button" className="btn btn-primary" onClick={onCerrar}>Listo</button></div>
    </div>
  </Modal>;
}
