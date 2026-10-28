/**
 * @fileoverview Perfiles de la empresa, su reparto y la invitación al equipo.
 *
 * Escrito para quien reparte el trabajo en un local, no para quien programa: las áreas se leen
 * con su ayuda en lenguaje corriente, agrupadas por módulo, y cada cambio que alcanza a otras
 * personas lo dice antes de guardar.
 */

import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AREAS,
  concederExigeAceptacion,
  DATOS_PROTEGIDOS,
  type JuegoDeAreas,
  type JuegoDeDatos,
  type NivelDeArea,
  type NivelDeDatosProtegidos,
  type OrganizationModuleKey,
} from '@espartanos/shared';
import { api } from '../../core/api';
import { ROLE_LABELS } from '../../core/role-labels';
import { ConfirmarAccion } from '../../shared/ConfirmarAccion';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueVeUnaPersona } from './QueVeUnaPersona';

interface PerfilFila {
  id: string;
  nombre: string;
  descripcion?: string | null;
  areas: JuegoDeAreas;
  datosProtegidos: JuegoDeDatos;
  personas: number;
}

interface Persona {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: string;
}

interface Texto { id: string; titulo: string; texto: string }

const NOMBRE_DE_MODULO: Record<string, string> = {
  reservations: 'Reservas', crm: 'CRM', surveys: 'Encuestas', marketing: 'Marketing', production: 'Producción', users: 'Equipo',
};
const NIVEL: Record<NivelDeArea, string> = { ninguno: 'Sin acceso', ver: 'Puede ver', hacer: 'Puede hacer' };
const NIVEL_DE_DATOS: Record<NivelDeDatosProtegidos, string> = {
  oculto: 'No los ve',
  bajo_registro: 'Los ve y queda constancia',
  directo: 'Los ve',
};
const MODULOS = [...new Set(AREAS.map((area) => area.modulo))] as OrganizationModuleKey[];

/** Los módulos que la empresa tiene contratados. Producción y Equipo no se contratan aparte. */
function moduloDisponible(modulo: string, capacidades?: Partial<Record<string, boolean>> | null): boolean {
  if (!['reservations', 'crm', 'surveys', 'marketing'].includes(modulo)) return true;
  return capacidades?.[modulo] !== false && (modulo !== 'marketing' || capacidades?.marketing === true);
}

interface Props {
  clientId: string;
  empresa: string;
  capacidades?: Partial<Record<string, boolean>> | null;
  /** La agencia puede retirar a la última persona que administra, con motivo; la empresa no. */
  esAgencia?: boolean;
  /**
   * Soporte: se mira la configuración de la empresa y no se toca.
   *
   * Es el modo de Dirección comercial. Si la agencia cambiara los perfiles de un local sin
   * dejar rastro se rompe el contrato de encargo: el responsable de los datos es el restaurante
   * y la agencia actúa según sus instrucciones. Mirar para poder ayudar sí; decidir por él, no.
   *
   * Esconde lo que escribe y deja lo que explica, que es «qué ve esta persona»: sin eso la vista
   * no sirve para responder la pregunta por la que se abre.
   */
  soloLectura?: boolean;
  onCerrar: () => void;
}

export function PerfilesDelEquipo({ clientId, empresa, capacidades, esAgencia = false, soloLectura = false, onCerrar }: Props): JSX.Element {
  const q = `?clientId=${encodeURIComponent(clientId)}`;
  const qc = useQueryClient();
  const [editando, setEditando] = useState<PerfilFila | 'nuevo' | null>(null);
  /* El perfil del que se parte al crear otro: «como Anfitrión, pero además…». */
  const [partiendoDe, setPartiendoDe] = useState<PerfilFila | null>(null);
  const [borrando, setBorrando] = useState<PerfilFila | null>(null);
  const [quitando, setQuitando] = useState<Persona | null>(null);
  const [mirando, setMirando] = useState<Persona | null>(null);
  const [motivo, setMotivo] = useState('');
  const [vetar, setVetar] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);

  const perfiles = useQuery<{ data: PerfilFila[] }>({ queryKey: ['perfiles', clientId], queryFn: () => api.get(`/perfiles${q}`) });
  const asignaciones = useQuery<{ data: Array<{ userId: string; perfilId: string }> }>({ queryKey: ['perfiles-asignaciones', clientId], queryFn: () => api.get(`/perfiles/asignaciones${q}`) });
  const equipo = useQuery<Persona[]>({ queryKey: ['users', 'equipo-de', clientId], queryFn: () => api.get(`/users?clientId=${encodeURIComponent(clientId)}`) });
  const reingresos = useQuery<{ data: Array<{ userId: string; reingresoEl: string; motivo: string | null; reinvitadoPor: string | null; antesHasta: string | null }> }>({ queryKey: ['perfiles-reingresos', clientId], queryFn: () => api.get(`/perfiles/reingresos${q}`) });
  const pendientes = useQuery<{ data: Array<{ id: string; email: string; perfilId: string; venceEl: string }> }>({ queryKey: ['perfiles-invitaciones', clientId], queryFn: () => api.get(`/perfiles/invitaciones${q}`) });

  const administran = useQuery<{ userIds: string[] }>({ queryKey: ['administran-equipo', clientId], queryFn: () => api.get(`/users/administran-equipo${q}`) });
  const esUltima = (userId: string) => administran.data?.userIds.length === 1 && administran.data.userIds[0] === userId;

  const lista = perfiles.data?.data ?? [];
  const perfilDe = useMemo(() => new Map((asignaciones.data?.data ?? []).map((fila) => [fila.userId, fila.perfilId])), [asignaciones.data]);

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['perfiles', clientId] });
    void qc.invalidateQueries({ queryKey: ['perfiles-asignaciones', clientId] });
    void qc.invalidateQueries({ queryKey: ['perfiles-invitaciones', clientId] });
    void qc.invalidateQueries({ queryKey: ['perfiles-reingresos', clientId] });
    void qc.invalidateQueries({ queryKey: ['users'] });
  };
  const fallo = (error: Error) => setMensaje({ tono: 'error', texto: error.message });

  const asignar = useMutation({
    mutationFn: ({ userId, perfilId }: { userId: string; perfilId: string | null }) => api.put(`/perfiles/asignaciones/${userId}${q}`, { perfilId }),
    onSuccess: () => { refrescar(); setMensaje({ tono: 'success', texto: 'Perfil asignado.' }); },
    onError: fallo,
  });
  const sugeridos = useMutation({
    mutationFn: () => api.post<{ copiados: number }>(`/perfiles/sugeridos${q}`),
    onSuccess: (r) => { refrescar(); setMensaje({ tono: 'success', texto: r.copiados ? `Se agregaron ${r.copiados} perfiles sugeridos.` : 'Ya tienes todos los perfiles sugeridos.' }); },
    onError: fallo,
  });
  const quitar = useMutation({
    mutationFn: (userId: string) => api.delete<{ desactivada: boolean }>(`/perfiles/equipo/${userId}${q}&motivo=${encodeURIComponent(motivo.trim())}${vetar ? '&vetar=1' : ''}`),
    onSuccess: (r) => {
      refrescar(); void qc.invalidateQueries({ queryKey: ['administran-equipo'] }); setQuitando(null); setMotivo(''); setVetar(false);
      setMensaje({ tono: 'success', texto: r.desactivada ? 'Se quitó del equipo. Era su única empresa: la cuenta queda desactivada y su historial se conserva.' : 'Se quitó del equipo de esta empresa. Sigue con sus otras empresas.' });
    },
    onError: fallo,
  });

  if (perfiles.isLoading) return <LoadingSpinner />;

  return (
    <div className="modal-form perfiles-equipo">
      <p>Los perfiles dicen qué ve y qué puede hacer cada persona en <strong>{empresa}</strong>. Solo puedes dar lo que tú mismo tienes.</p>
      {mensaje && <div className={`alert alert-${mensaje.tono}`} role={mensaje.tono === 'error' ? 'alert' : 'status'}>{mensaje.texto}</div>}

      <section aria-labelledby="perfiles-lista">
        <h3 id="perfiles-lista">Perfiles</h3>
        {lista.length === 0 && <p>Todavía no hay perfiles. Puedes empezar con los sugeridos y cambiarlos a tu gusto.</p>}
        <ul className="lista-simple">
          {lista.map((perfil) => (
            <li key={perfil.id}>
              <strong>{perfil.nombre}</strong>{' '}
              <small>{perfil.personas === 0 ? 'Nadie lo usa' : `${perfil.personas} persona${perfil.personas === 1 ? '' : 's'}`}</small>
              {perfil.descripcion && <small> — {perfil.descripcion}</small>}{' '}
              {!soloLectura && <>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(perfil)}>Editar</button>{' '}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setBorrando(perfil)}>Borrar</button>{' '}
                {/* Casi todos los perfiles de un local son otro con un permiso más o uno menos. */}
                <button type="button" className="btn btn-outline btn-sm" title={`Crea uno nuevo con las mismas áreas y niveles que ${perfil.nombre}`} onClick={() => { setPartiendoDe(perfil); setEditando('nuevo'); }}>Partir de este</button>
              </>}
            </li>
          ))}
        </ul>
        {soloLectura ? (
          <p className="page-subtitle">Estás viendo la configuración de {empresa} para poder ayudar. Los perfiles los decide quien administra el local.</p>
        ) : (
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => sugeridos.mutate()} disabled={sugeridos.isPending}>Agregar los sugeridos</button>
            <button type="button" className="btn btn-primary" onClick={() => setEditando('nuevo')}>+ Nuevo perfil</button>
          </div>
        )}
      </section>

      <section aria-labelledby="perfiles-equipo">
        <h3 id="perfiles-equipo">Quién tiene qué perfil</h3>
        <ul className="lista-simple">
          {/*
            * Sin filtrar por cargo: en esta empresa trabaja su propia gente y la de la agencia
            * cedida a ella, y las dos necesitan perfil. El filtro `role === 'client'` dejaba
            * fuera a la segunda, así que un anfitrión de la agencia que atiende el local no podía
            * recibir el nivel de datos protegidos que su trabajo pide.
            *
            * El alcance ya lo puso el servidor: `GET /users?clientId=` devuelve a quien pertenece
            * a la empresa y a quien la atiende por asignación, y a quien administra sólo su propia
            * empresa le sigue devolviendo nada más que las cuentas de ella.
            */}
          {(equipo.data ?? []).map((persona) => (
            <li key={persona.id}>
              <strong>{persona.name}</strong> <small>{persona.email}</small>
              {persona.role !== 'client' && <small className="etiqueta-de-agencia"> · {ROLE_LABELS[persona.role] ?? 'agencia'}</small>}
              {(() => {
                const vuelta = (reingresos.data?.data ?? []).find((fila) => fila.userId === persona.id);
                if (!vuelta) return null;
                const dia = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
                return (
                  <small className="linea-de-reingreso">
                    {' '}Reingresó el {dia(vuelta.reingresoEl)}.{vuelta.motivo ? ` Motivo: ${vuelta.motivo}.` : ''}
                    {vuelta.reinvitadoPor ? ` Lo reinvitó ${vuelta.reinvitadoPor}.` : ''}
                    {vuelta.antesHasta ? ` Antes estuvo hasta el ${dia(vuelta.antesHasta)}.` : ''}
                  </small>
                );
              })()}{' '}
              <select
                className="input"
                aria-label={`Perfil de ${persona.name}`}
                value={perfilDe.get(persona.id) ?? ''}
                onChange={(evento) => asignar.mutate({ userId: persona.id, perfilId: evento.target.value || null })}
                disabled={asignar.isPending || soloLectura}
              >
                <option value="">Sin perfil</option>
                {lista.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nombre}</option>)}
              </select>{' '}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setMirando(persona)}>Qué ve</button>{' '}
              {!soloLectura && <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={esUltima(persona.id) && !esAgencia}
                title={esUltima(persona.id) ? (esAgencia ? 'Es la única que administra el equipo: retirarla exige motivo y queda en auditoría.' : 'Es la única persona que administra el equipo. Nombra primero a otra.') : undefined}
                onClick={() => setQuitando(persona)}
              >Quitar del equipo</button>}
              {!soloLectura && esUltima(persona.id) && !esAgencia && <small className="field-hint"> Es la única que administra el equipo: nombra primero a otra.</small>}
            </li>
          ))}
        </ul>
      </section>

      {!soloLectura && <Invitar q={q} perfiles={lista} onListo={(texto) => { refrescar(); setMensaje({ tono: 'success', texto }); }} onError={fallo} />}

      {(pendientes.data?.data ?? []).length > 0 && (
        <section aria-labelledby="perfiles-pendientes">
          <h3 id="perfiles-pendientes">Invitaciones pendientes</h3>
          <ul className="lista-simple">
            {(pendientes.data?.data ?? []).map((invitacion) => (
              <li key={invitacion.id}>
                {invitacion.email} <small>· Pendiente hasta el {new Date(invitacion.venceEl).toLocaleDateString('es-CL')}</small>{' '}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void api.delete(`/perfiles/invitaciones/${invitacion.id}${q}`).then(refrescar).catch(fallo)}>Cancelar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mirando && (
        <QueVeUnaPersona clientId={clientId} empresa={empresa} persona={mirando} onCerrar={() => setMirando(null)} />
      )}

      {editando && (
        <EditorDePerfil
          key={editando === 'nuevo' ? `nuevo:${partiendoDe?.id ?? ''}` : editando.id}
          q={q}
          perfil={editando === 'nuevo' ? null : editando}
          partirDe={editando === 'nuevo' ? partiendoDe : null}
          capacidades={capacidades}
          onCerrar={() => { setEditando(null); setPartiendoDe(null); }}
          onGuardado={() => { setEditando(null); setPartiendoDe(null); refrescar(); setMensaje({ tono: 'success', texto: 'Perfil guardado.' }); }}
        />
      )}

      {borrando && (
        <BorrarPerfil
          q={q}
          perfil={borrando}
          otros={lista.filter((perfil) => perfil.id !== borrando.id)}
          onCerrar={() => setBorrando(null)}
          onBorrado={() => { setBorrando(null); refrescar(); setMensaje({ tono: 'success', texto: 'Perfil borrado.' }); }}
          onError={fallo}
        />
      )}

      {quitando && (
        <ConfirmarAccion
          titulo={`Quitar a ${quitando.name} del equipo`}
          consecuencia={
            <>
              {quitando.name} deja de entrar a {empresa}; sus otras empresas no cambian. Queda constancia de quién la retiró, cuándo y por qué.
              Si es la única empresa que tiene, su cuenta queda desactivada, no se borra.
              <label htmlFor="retiro-motivo">Motivo (obligatorio)
                <input id="retiro-motivo" className="input" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={vetar} onChange={(e) => setVetar(e.target.checked)} />
                {' '}No debe volver: vetarla. Invitarla de nuevo exigirá confirmarlo.
              </label>
            </>
          }
          empresa={empresa}
          confirmar={vetar ? 'Vetar y quitar' : 'Quitar del equipo'}
          irreversible={false}
          enCurso={quitar.isPending || motivo.trim().length < 3}
          onConfirmar={() => quitar.mutate(quitando.id)}
          onCancelar={() => { setQuitando(null); setMotivo(''); setVetar(false); }}
        />
      )}

      <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onCerrar}>Cerrar</button></div>
    </div>
  );
}

function Invitar({ q, perfiles, onListo, onError }: { q: string; perfiles: PerfilFila[]; onListo: (texto: string) => void; onError: (e: Error) => void }): JSX.Element {
  const [email, setEmail] = useState('');
  const [perfilId, setPerfilId] = useState('');
  const [motivoReingreso, setMotivoReingreso] = useState('');
  const [vetoPendiente, setVetoPendiente] = useState<string | null>(null);
  const invitar = useMutation({
    mutationFn: (confirmaVeto: boolean) => api.post<{ mensaje: string; antecedente?: { resultado: string; retiradoEl: string; retiradoPor: string | null; motivo: string | null } }>(
      `/perfiles/invitaciones${q}`, { email: email.trim(), perfilId, ...(motivoReingreso.trim() ? { motivoReingreso: motivoReingreso.trim() } : {}), ...(confirmaVeto ? { confirmaVeto: true } : {}) }),
    // Siempre el mismo mensaje: no se sabe ni se dice si esa persona ya tenía cuenta. Sólo se cuenta
    // su paso anterior por esta misma empresa, que es historia de esta empresa.
    onSuccess: (r) => {
      setEmail(''); setMotivoReingreso(''); setVetoPendiente(null);
      const antes = r.antecedente
        ? ` Estuvo en tu equipo hasta el ${new Date(r.antecedente.retiradoEl).toLocaleDateString('es-CL')}${r.antecedente.retiradoPor ? `; la retiró ${r.antecedente.retiradoPor}` : ''}${r.antecedente.motivo ? `: ${r.antecedente.motivo}` : ''}. Entrará con el perfil que elegiste, no con el anterior.`
        : '';
      onListo(`${r.mensaje}. Quedará pendiente hasta que la acepte.${antes}`);
    },
    onError: (error: Error) => {
      // El servidor pide confirmar cuando la persona fue vetada de esta empresa.
      if (/vetada de tu equipo/.test(error.message)) setVetoPendiente(error.message);
      else if (/motivo del reingreso/.test(error.message)) onError(new Error('Esa persona ya estuvo en tu equipo: escribe el motivo del reingreso.'));
      else onError(error);
    },
  });
  return (
    <section aria-labelledby="perfiles-invitar">
      <h3 id="perfiles-invitar">Invitar a alguien</h3>
      {vetoPendiente && (
        <ConfirmarAccion
          titulo="Invitar a alguien que fue vetado"
          consecuencia={
            <>
              {vetoPendiente}. Si la invitas, podrá volver a entrar con el perfil que elegiste, no con el que tenía. Se avisará a los demás administradores y a la agencia.
              <label htmlFor="reingreso-motivo-veto">Motivo (obligatorio)
                <input id="reingreso-motivo-veto" className="input" value={motivoReingreso} maxLength={300} onChange={(e) => setMotivoReingreso(e.target.value)} />
              </label>
            </>
          }
          confirmar="Sí, invitarla de nuevo"
          irreversible={false}
          enCurso={invitar.isPending || motivoReingreso.trim().length < 3}
          onConfirmar={() => invitar.mutate(true)}
          onCancelar={() => setVetoPendiente(null)}
        />
      )}
      <form className="modal-form" onSubmit={(evento) => { evento.preventDefault(); invitar.mutate(false); }}>
        <label htmlFor="invitar-correo">Correo<input id="invitar-correo" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label htmlFor="invitar-perfil">Perfil con el que entra
          <select id="invitar-perfil" className="input" required value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
            <option value="">Elige un perfil</option>
            {perfiles.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nombre}</option>)}
          </select>
        </label>
        <label htmlFor="invitar-motivo">Motivo del reingreso
          <input id="invitar-motivo" className="input" value={motivoReingreso} maxLength={300} onChange={(e) => setMotivoReingreso(e.target.value)} />
          <small>Solo si esa persona ya estuvo en tu equipo: queda como constancia y se avisa a los demás administradores.</small>
        </label>
        <button className="btn btn-primary" type="submit" disabled={invitar.isPending || !perfilId || !email}>{invitar.isPending ? 'Enviando...' : 'Enviar invitación'}</button>
      </form>
    </section>
  );
}

function BorrarPerfil({ q, perfil, otros, onCerrar, onBorrado, onError }: { q: string; perfil: PerfilFila; otros: PerfilFila[]; onCerrar: () => void; onBorrado: () => void; onError: (e: Error) => void }): JSX.Element {
  const [destino, setDestino] = useState('');
  const borrar = useMutation({
    mutationFn: () => api.delete(`/perfiles/${perfil.id}${q}${destino ? `&reasignarA=${destino}` : ''}`),
    onSuccess: onBorrado,
    onError,
  });
  const enUso = perfil.personas > 0;
  return (
    <ConfirmarAccion
      titulo={`Borrar el perfil ${perfil.nombre}`}
      consecuencia={enUso
        ? <>Lo usan {perfil.personas} persona{perfil.personas === 1 ? '' : 's'}. Pasarán al perfil que elijas y verán lo que ese perfil permite.{' '}
            <select className="input" aria-label="Perfil al que pasan" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Elige a qué perfil pasan</option>
              {otros.map((otro) => <option key={otro.id} value={otro.id}>{otro.nombre}</option>)}
            </select></>
        : 'Nadie lo usa; se borra sin afectar a nadie.'}
      confirmar="Borrar perfil"
      enCurso={borrar.isPending || (enUso && !destino)}
      onConfirmar={() => borrar.mutate()}
      onCancelar={onCerrar}
    />
  );
}

/**
 * Crear o editar un perfil.
 *
 * `partirDe` sólo se mira al crear: hereda las áreas y los niveles de datos protegidos de otro
 * perfil y deja el nombre vacío, porque el nombre es lo que lo distingue. Casi todos los perfiles
 * de un local son otro con un permiso más o uno menos, y reconstruir cuarenta y cuatro áreas a
 * mano para cambiar una es cómo se terminan concediendo de más por cansancio.
 *
 * Guardar sigue siendo `POST`: partir de otro cambia con qué valores nace el formulario, no qué
 * hace el botón.
 */
function EditorDePerfil({ q, perfil, partirDe, capacidades, onCerrar, onGuardado }: { q: string; perfil: PerfilFila | null; partirDe?: PerfilFila | null; capacidades?: Partial<Record<string, boolean>> | null; onCerrar: () => void; onGuardado: () => void }): JSX.Element {
  const base = perfil ?? partirDe ?? null;
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? '');
  const [areas, setAreas] = useState<Record<string, NivelDeArea>>({ ...(base?.areas ?? {}) });
  const [datos, setDatos] = useState<Record<string, NivelDeDatosProtegidos>>({ ...(base?.datosProtegidos ?? {}) });
  const [acepta, setAcepta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const texto = useQuery<Texto>({ queryKey: ['perfiles-texto', q], queryFn: () => api.get(`/perfiles/texto-de-confidencialidad${q}`) });

  // Sólo se pide aceptar cuando se sube el acceso a datos de salud; quien ya lo tenía no vuelve a aceptar.
  const rango: Record<NivelDeDatosProtegidos, number> = { oculto: 0, bajo_registro: 1, directo: 2 };
  const modulosConAceptacion = (Object.keys(datos) as OrganizationModuleKey[]).filter((modulo) =>
    rango[datos[modulo] ?? 'oculto'] > rango[perfil?.datosProtegidos[modulo] ?? 'oculto'] && concederExigeAceptacion(modulo, datos[modulo]!));
  const personas = perfil?.personas ?? 0;

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        nombre, descripcion,
        areas, datosProtegidos: datos,
        ...(modulosConAceptacion.length ? { aceptacion: texto.data?.id } : {}),
        ...(perfil ? { confirmaPersonas: personas } : {}),
      };
      return perfil ? api.put(`/perfiles/${perfil.id}${q}`, cuerpo) : api.post(`/perfiles${q}`, cuerpo);
    },
    onSuccess: onGuardado,
    onError: (e: Error) => { setConfirmando(false); setError(e.message); },
  });

  const puedeGuardar = nombre.trim().length >= 2 && (modulosConAceptacion.length === 0 || (acepta && Boolean(texto.data)));
  const alEnviar = () => { setError(null); if (personas > 0) setConfirmando(true); else guardar.mutate(); };

  return (
    <div className="editor-de-perfil">
      <h3>{perfil ? `Editar ${perfil.nombre}` : 'Nuevo perfil'}</h3>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <label htmlFor="perfil-nombre">Nombre<input id="perfil-nombre" className="input" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} /></label>
      <label htmlFor="perfil-desc">Para qué sirve<input id="perfil-desc" className="input" value={descripcion} maxLength={300} onChange={(e) => setDescripcion(e.target.value)} /></label>

      {MODULOS.filter((modulo) => moduloDisponible(modulo, capacidades)).map((modulo) => {
        const delModulo = AREAS.filter((area) => area.modulo === modulo);
        const protegidos = DATOS_PROTEGIDOS.find((entrada) => entrada.modulo === modulo);
        return (
          <fieldset key={modulo} className="form-choice-group">
            <legend>{NOMBRE_DE_MODULO[modulo] ?? modulo}</legend>
            {delModulo.map((area) => (
              <label key={area.clave} htmlFor={`area-${area.clave}`}>
                {area.nombre}
                <select id={`area-${area.clave}`} className="input" value={areas[area.clave] ?? 'ninguno'} onChange={(e) => setAreas({ ...areas, [area.clave]: e.target.value as NivelDeArea })}>
                  {area.niveles.map((nivel) => <option key={nivel} value={nivel}>{NIVEL[nivel]}</option>)}
                </select>
                <small>{area.ayuda}</small>
              </label>
            ))}
            {protegidos && (
              <label htmlFor={`datos-${modulo}`}>
                {protegidos.nombre}
                <select id={`datos-${modulo}`} className="input" value={datos[modulo] ?? 'oculto'} onChange={(e) => setDatos({ ...datos, [modulo]: e.target.value as NivelDeDatosProtegidos })}>
                  {(Object.keys(NIVEL_DE_DATOS) as NivelDeDatosProtegidos[]).map((nivel) => <option key={nivel} value={nivel}>{NIVEL_DE_DATOS[nivel]}</option>)}
                </select>
                <small>{protegidos.ayuda}</small>
              </label>
            )}
          </fieldset>
        );
      })}

      {modulosConAceptacion.length > 0 && texto.data && (
        <div className="alert alert-info">
          <strong>{texto.data.titulo}</strong>
          <p>{texto.data.texto}</p>
          <label className="toggle-row"><input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} /> Lo leí y lo acepto</label>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!puedeGuardar || guardar.isPending} onClick={alEnviar}>{guardar.isPending ? 'Guardando...' : 'Guardar perfil'}</button>
      </div>

      {confirmando && perfil && (
        <ConfirmarAccion
          titulo={`Guardar los cambios de ${perfil.nombre}`}
          consecuencia={`Esto cambia lo que ven ${personas} persona${personas === 1 ? '' : 's'}: desde que guardes, entran con el perfil nuevo.`}
          confirmar="Guardar para todas"
          irreversible={false}
          enCurso={guardar.isPending}
          onConfirmar={() => guardar.mutate()}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}
