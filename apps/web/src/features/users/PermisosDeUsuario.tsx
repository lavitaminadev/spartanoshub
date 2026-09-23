/**
 * @fileoverview Qué puede hacer una persona, módulo por módulo, y qué empresas alcanza.
 *
 * El cargo define lo de todos; aquí se ajusta a una persona concreta sin tocar a las demás.
 * Cada fila muestra lo que da el cargo y, si hay un ajuste, lo marca como tal: volver a «Según
 * su cargo» borra el ajuste en vez de copiar el nivel, así un cambio futuro del cargo le llega.
 *
 * Administración y Desarrollo ajustan a cualquiera; Dirección de operaciones, sólo a su equipo y sin
 * tocar Usuarios, Ajustes ni Integraciones. El servidor aplica las mismas reglas.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';
import { ROLE_LABELS } from '../../core/role-labels';
import './permisos-de-usuario.css';

type Nivel = 'none' | 'view' | 'edit' | 'manage';
interface PermisoEfectivo { module: string; level: Nivel; source: 'role' | 'override'; moduleDisabled: boolean; productHidden: boolean }
/** `own`: la empresa escrita en la cuenta de portal, que no se quita desde aqui. */
interface AccesoEmpresa { clientId: string; source: 'pod' | 'assignment' | 'community-manager' | 'own' }
interface AccionEfectiva { clave: string; modulo: string; nombre: string; ayuda: string; permitida: boolean; porNivel: boolean; origen: 'nivel' | 'ajuste' }

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
  own: 'la empresa de su cuenta',
};

export function PermisosDeUsuario({ usuario, empresas, puedeEditar, limitadoAOperaciones = false, limitadoASuEmpresa = false, onCerrar }: {
  usuario: { id: string; name: string; role: string };
  empresas: Array<{ id: string; name: string }>;
  puedeEditar: boolean;
  /** Dirección de operaciones no ajusta Usuarios, Ajustes ni Integraciones (lo exige el servidor). */
  limitadoAOperaciones?: boolean;
  /** Quien administra su propia empresa: reparte los servicios y no los módulos del sistema. */
  limitadoASuEmpresa?: boolean;
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
  });

  const acciones = useQuery<{ acciones: AccionEfectiva[] }>({ queryKey: ['acciones-de-usuario', usuario.id], queryFn: () => api.get(`/users/${usuario.id}/actions`) });
  const cambiarAccion = useMutation({
    mutationFn: ({ accion, valor }: { accion: string; valor: 'nivel' | 'si' | 'no' }) => valor === 'nivel'
      ? api.delete(`/users/${usuario.id}/actions/${accion}`)
      : api.put(`/users/${usuario.id}/actions/${accion}`, { allowed: valor === 'si', reason: 'Ajuste desde Usuarios' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['acciones-de-usuario', usuario.id] }); triggerToast('Acción actualizada'); },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo guardar el cambio', 'error'),
  });

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: clave });
    void qc.invalidateQueries({ queryKey: ['acciones-de-usuario', usuario.id] });
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
              /*
                Los módulos con los que se administra el sistema no se muestran, no se atenúan.
                Quien administra su empresa nunca va a poder tocarlos —el servidor los rechaza—,
                así que enseñarlos solo invita a intentarlo y a leer un error.
              */
              if (limitadoASuEmpresa && ['users', 'settings', 'integrations', 'clients', 'governance'].includes(modulo.clave)) return null;
              const bloqueado = efectivo.moduleDisabled || efectivo.productHidden;
              const soloAdministracion = limitadoAOperaciones && ['users', 'settings', 'integrations'].includes(modulo.clave);
              const nivelDelCargo = delCargo.data?.permissions?.[modulo.clave];
              return <div key={modulo.clave} className={`permisos-usuario-fila ${efectivo.source === 'override' ? 'es-ajuste' : ''}`}>
                <div>
                  <strong>{modulo.nombre}</strong>
                  {/*
                    * Los dos bloqueos se dicen por separado: se resuelven en pantallas distintas.
                    *
                    * Apagado para la organización se corrige en Accesos y seguridad → Módulos, y lo
                    * cambia cualquiera que administre. Que el producto no entregue el módulo a ese
                    * cargo no se corrige desde ninguna pantalla, y decirlo ahorra buscarla.
                    */}
                  <small>{efectivo.moduleDisabled
                    ? 'Apagado para toda la organización. Se enciende en Accesos y seguridad → Módulos.'
                    : efectivo.productHidden
                      ? `El producto todavía no entrega este módulo al cargo ${ROLE_LABELS[usuario.role] ?? usuario.role}. No se abre desde esta pantalla.`
                      : modulo.ayuda}</small>
                </div>
                {puedeEditar && !bloqueado && !soloAdministracion ? (
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
                {(acciones.data?.acciones ?? []).filter((accion) => accion.modulo === modulo.clave).map((accion) => (
                  <div key={accion.clave} className={`permisos-usuario-accion ${accion.origen === 'ajuste' ? 'es-ajuste' : ''}`}>
                    <span><strong>{accion.nombre}</strong><small>{accion.ayuda}</small></span>
                    {puedeEditar && !bloqueado && !soloAdministracion ? (
                      <select
                        className="input"
                        aria-label={accion.nombre}
                        disabled={cambiarAccion.isPending}
                        value={accion.origen === 'ajuste' ? (accion.permitida ? 'si' : 'no') : 'nivel'}
                        onChange={(evento) => cambiarAccion.mutate({ accion: accion.clave, valor: evento.target.value as 'nivel' | 'si' | 'no' })}
                      >
                        <option value="nivel">Según su nivel ({accion.porNivel ? 'Sí' : 'No'})</option>
                        <option value="si">Permitir</option>
                        <option value="no">No permitir</option>
                      </select>
                    ) : <span className={`level-pill level-${accion.permitida ? 'edit' : 'none'}`}>{accion.permitida ? 'Sí' : 'No'}</span>}
                  </div>
                ))}
              </div>;
            })}
          </div>
        )}
      </section>

      {/*
        Las cuentas de portal también llegan acá.

        Esta sección las excluía, así que una persona que atiende dos locales de dueños
        distintos necesitaba dos cuentas y dos contraseñas. La empresa escrita en su cuenta
        aparece marcada y bloqueada: define a quién pertenece y se cambia editando la persona,
        no desmarcándola aquí.
      */}
      <section>
        <h3>Qué empresas alcanza</h3>
        {accesos.isLoading ? <p>Cargando empresas…</p> : acceso === 'unrestricted' ? (
          <p className="page-subtitle">Su cargo ve todas las empresas de la organización.</p>
        ) : (
          <>
            <p className="page-subtitle">{usuario.role === 'client'
              ? 'Marca las empresas que además atiende. La de su cuenta va siempre y se cambia editando la persona.'
              : 'Ve sólo las empresas marcadas. Las que vienen por su equipo se cambian desde el pod.'}</p>
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
      </section>

      {!puedeEditar && <p className="page-subtitle">No puedes cambiar los accesos de esta persona: los ajusta Administración.</p>}
      <div className="modal-actions"><button type="button" className="btn btn-primary" onClick={onCerrar}>Listo</button></div>
    </div>
  </Modal>;
}
