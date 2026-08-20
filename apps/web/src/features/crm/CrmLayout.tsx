/**
 * @fileoverview Barra propia del CRM y alcance de cuenta compartido por sus secciones.
 *
 * El CRM se recorre entero sin salir de él —se mira el inicio, se abre el tablero, se revisa una
 * ficha, se vuelve—, así que sus secciones viven en una barra suya y no repartidas en la lateral
 * general. Con la lateral sola, «Inicio» aparecía dos veces: el del sistema y el del CRM, y lo
 * único que los distinguía era el título de la sección.
 *
 * La lateral conserva una sola entrada, «CRM», que trae acá. Desde adentro se navega con esta
 * barra, igual que en la herramienta que se tomó como referencia.
 */

import { useMemo, useState, type JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../core/auth';
import { api } from '../../core/api';
import { readStoredJson, storageKey, writeStoredJson } from '../../core/browser-storage';
import { isPathEnabled } from '../../core/navigation.registry';
import { CrmScopeContext, type CrmScopeValue } from './crm-scope';
import './crm-layout.css';

/**
 * A qué embudo pertenece cada sección.
 *
 * No es decoración: son dos CRM con significados distintos que la base separa en `leads.domain`
 * desde la migración 0069. Presentarlos como una sola fila de nueve pestañas invita a leer
 * «Contactos» y «Oportunidades» como dos etapas del mismo recorrido, y no lo son.
 */
type Grupo = 'general' | 'cliente' | 'agencia';

const GRUPO_LABEL: Record<Grupo, string> = {
  general: '',
  cliente: 'Clientes',
  agencia: 'Espartanos',
};

/**
 * Secciones, en el orden en que se usan durante el día.
 *
 * `end` en el inicio porque su ruta es prefijo de todas las demás: sin eso quedaría marcado como
 * activo estando en cualquier otra sección.
 */
const SECCIONES: Array<{ to: string; label: string; end?: boolean; grupo: Grupo }> = [
  { to: '/crm', label: 'Inicio', end: true, grupo: 'general' },

  // Contactos de campaña (`domain=audience`): pertenecen a una cuenta y el selector los acota.
  // Es la única sección que consulta ese embudo; las demás son todas de la agencia.
  { to: '/crm/contacts', label: 'Contactos', grupo: 'cliente' },

  // Embudo propio de la agencia (`domain=commercial`): sus prospectos son empresas, no personas
  // de una cuenta, así que el selector de cuenta no les aplica.
  // Sin «Tablero» aparte: el tablero y la tabla son dos vistas de esta misma sección y se
  // alternan dentro de ella. Como pestañas separadas eran dos entradas al mismo dato, y la
  // barra marcaba una u otra como activa según por dónde se hubiera entrado.
  { to: '/crm/leads', label: 'Prospectos', grupo: 'agencia' },
  { to: '/crm/opportunities', label: 'Oportunidades', grupo: 'agencia' },
  { to: '/crm/pipeline', label: 'Pipeline', grupo: 'agencia' },
  { to: '/crm/interactions', label: 'Actividad', grupo: 'agencia' },

  { to: '/crm/dashboard', label: 'Dashboard', grupo: 'general' },
  { to: '/crm/calendario', label: 'Calendario', grupo: 'general' },
  { to: '/crm/administracion', label: 'Administración', grupo: 'general' },
];


export function CrmLayout(): JSX.Element {
  const { user } = useAuth();

  // El servidor ya devuelve solo las cuentas que la persona alcanza —pod, asignación directa o
  // ser su community manager—, así que la lista del selector no necesita filtrarse acá: una
  // dirección ve todas y una CM ve las suyas, sin dos reglas que mantener de acuerdo.
  const { data: clientsResp } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  // Memorizado para conservar la identidad del arreglo entre renders: `?? []` crea uno nuevo
  // cada vez, y con eso el `useMemo` del mapa de nombres se recalculaba siempre.
  const clients = useMemo(() => clientsResp?.data ?? [], [clientsResp]);

  // Se recuerda por persona: quien atiende una sola cuenta no debería tener que elegirla cada
  // vez que entra, y quien las ve todas rara vez cambia de cuenta dentro de la misma jornada.
  const scopeKey = storageKey('crm-cliente', user?.id ?? 'anon');
  const [clientId, setClientIdState] = useState<string>(() => readStoredJson<string>(scopeKey, ''));
  const setClientId = (value: string) => { setClientIdState(value); writeStoredJson(scopeKey, value); };

  const nombrePorId = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const nombreDe = (id?: string | null) => (id ? nombrePorId.get(id) ?? 'Cuenta no encontrada' : 'Sin cuenta');

  const scope: CrmScopeValue = { clientId, setClientId, clients, nombreDe };

  /*
    Qué secciones ve cada persona lo decide la matriz de permisos, no una lista de cargos
    escrita acá.

    Antes cada sección declaraba sus roles a mano, así que cambiar quién ve el calendario
    obligaba a tocar código y desplegar, y la pantalla de permisos —que es donde se espera
    hacerlo— no gobernaba esta barra. Ahora se resuelve con la misma función que la lateral
    general: mismo módulo, mismos permisos efectivos, misma respuesta en las dos.
  */
  const visibles = SECCIONES.filter((seccion) => isPathEnabled(
    seccion.to,
    user?.features,
    user?.permissions,
    user?.moduleLifecycle,
    user?.role,
  ));

  // El selector solo gobierna los contactos de campaña. Ofrecerlo a quien no alcanza esa
  // sección sería un control que no cambia nada de lo que esa persona ve.
  const mostrarSelector = visibles.some((seccion) => seccion.grupo === 'cliente');

  /*
    Sin secciones no hay barra.

    Un cargo que no opera ninguna sección del CRM —administración, por ejemplo, que administra
    el sistema y no el embudo— dibujaba igual el marco: una barra sin una sola pestaña y un
    selector de cuenta que no acotaba nada. La pantalla a la que llegó se sigue mostrando; lo
    que se omite es el envoltorio que prometía una navegación que no existe para esa persona.
  */
  // El proveedor de alcance se conserva: las pantallas hijas lo consultan, y quedarse sin él por
  // no tener barra son dos cosas sin relación.
  if (!visibles.length) {
    return <CrmScopeContext.Provider value={scope}><Outlet /></CrmScopeContext.Provider>;
  }

  return (
    <CrmScopeContext.Provider value={scope}>
      <div className="crm-shell">
        <nav className="crm-nav" aria-label="Secciones del CRM">
          <div className="crm-nav-secciones">
            {visibles.map((seccion, indice) => {
              // El rótulo del grupo se dibuja al empezar cada tramo, no en cada pestaña: separa
              // los dos embudos sin convertir la barra en una lista de encabezados.
              const anterior = visibles[indice - 1];
              const abreGrupo = seccion.grupo !== anterior?.grupo && GRUPO_LABEL[seccion.grupo];

              return (
                <span className="crm-nav-item" key={seccion.to}>
                  {abreGrupo ? <span className="crm-nav-grupo">{GRUPO_LABEL[seccion.grupo]}</span> : null}
                  <NavLink
                    to={seccion.to}
                    end={seccion.end}
                    className={({ isActive }) => (isActive ? 'crm-nav-link activo' : 'crm-nav-link')}
                  >
                    {seccion.label}
                  </NavLink>
                </span>
              );
            })}
          </div>

          <div className="crm-nav-derecha">
            {/*
              «Todas» es una opción legítima y no un estado sin elegir: la agencia necesita mirar
              el conjunto tanto como una cuenta concreta. Por eso no arranca forzando una.
            */}
            <label className="crm-nav-cuenta" hidden={!mostrarSelector}>
              <span className="crm-nav-cuenta-label">Cuenta</span>
              <select
                className="input"
                aria-label="Acotar el CRM a una cuenta"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Todas las cuentas</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>

            {/* Quién está mirando: varias secciones cambian con el cargo, y verlo evita atribuir
                a un fallo lo que es una diferencia de permisos. */}
            <span className="crm-nav-usuario">{user?.name}</span>
          </div>
        </nav>

        <Outlet />
      </div>
    </CrmScopeContext.Provider>
  );
}
