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
import { canEditCrm, CrmScopeContext, type CrmScopeValue } from './crm-scope';
import './crm-layout.css';

/**
 * Secciones del CRM, en el orden en que se usan durante el día.
 *
 * **Una sola lista, no dos.** Antes la barra las repartía en dos grupos —«Clientes» y
 * «Espartanos»— porque la base separa dos embudos en `leads.domain`. En pantalla eso se leía
 * como dos CRM conviviendo dentro de uno, que es exactamente lo que no es: hay un CRM y se
 * mira una empresa a la vez.
 *
 * Qué empresa se está mirando lo dice el selector de la derecha, y de ahí sale el embudo: la
 * agencia ve sus propios prospectos, una cuenta ve los contactos que trajeron sus campañas.
 * La separación de la base sigue intacta; lo que cambia es que deja de ser una decisión de
 * navegación para volverse una de contexto.
 *
 * `end` en el inicio porque su ruta es prefijo de todas las demás: sin eso quedaría marcado
 * como activo estando en cualquier otra sección.
 */
/*
  Seis secciones y no nueve.

  «Contactos», «Oportunidades» y «Actividad» salieron de la barra porque respondían preguntas
  que ya responde otra sección o la propia ficha:

  - Contactos mostraba el embudo `audience`, que ahora sale del selector de empresa: con una
    cuenta elegida, «Leads» ya son sus contactos de campaña.
  - Actividad listaba interacciones sueltas; se leen en la ficha del lead, que es donde
    significan algo.
  - Oportunidades es otra entidad y merece su propia decisión, no una pestaña más que se
    confunde con el embudo de al lado.

  Sus rutas siguen vivas —los enlaces que ya circulan no se rompen—, pero fuera de la barra.
*/
const SECCIONES: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/crm', label: 'Inicio', end: true },
  // «Tablero» es el embudo por etapas y «Leads» la lista. Son dos formas del mismo dato, pero
  // con nombre propio cada una: un alternador dentro de una pantalla dejaba ambiguo cuál se
  // estaba mirando, y mezclar kanban y lista bajo un mismo rótulo confunde las dos cosas.
  { to: '/crm/tablero', label: 'Tablero' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/dashboard', label: 'Dashboard' },
  { to: '/crm/calendario', label: 'Calendario' },
  { to: '/crm/administracion', label: 'Administración' },
];

/** Valor del selector cuando se está mirando el embudo propio de la agencia. */
export const CUENTA_AGENCIA = 'espartanos';


export function CrmLayout(): JSX.Element {
  const { user } = useAuth();
  const esPortalCliente = user?.role === 'client';

  // El servidor ya devuelve solo las cuentas que la persona alcanza —pod, asignación directa o
  // ser su community manager—, así que la lista del selector no necesita filtrarse acá: una
  // dirección ve todas y una CM ve las suyas, sin dos reglas que mantener de acuerdo.
  const { data: clientsResp } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    // El portal no administra ni enumera empresas. Su empresa viene firmada en la sesión; pedir
    // el listado acá convertía una respuesta 403 correcta en un CRM sin contexto.
    enabled: !esPortalCliente,
  });
  // Memorizado para conservar la identidad del arreglo entre renders: `?? []` crea uno nuevo
  // cada vez, y con eso el `useMemo` del mapa de nombres se recalculaba siempre.
  const clients = useMemo(() => clientsResp?.data ?? [], [clientsResp]);

  // Se recuerda por persona: quien atiende una sola cuenta no debería tener que elegirla cada
  // vez que entra, y quien las ve todas rara vez cambia de cuenta dentro de la misma jornada.
  const scopeKey = storageKey('crm-cuenta', user?.id ?? 'anon');
  const [cuentaElegida, setCuentaElegida] = useState<string>(() => readStoredJson<string>(scopeKey, CUENTA_AGENCIA));
  // Nunca se toma la cuenta del portal desde localStorage ni desde la URL: ambos se pueden
  // alterar en el navegador. La sesión es la única fuente para el tenant de un cliente.
  const clientId = esPortalCliente ? (user?.clientId ?? '') : cuentaElegida;
  const setClientId = (value: string) => {
    if (esPortalCliente) return;
    setCuentaElegida(value);
    writeStoredJson(scopeKey, value);
  };

  const nombrePorId = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const nombreDe = (id?: string | null) => (id ? nombrePorId.get(id) ?? 'Cuenta no encontrada' : 'Sin cuenta');

  /**
   * Embudo que corresponde a la empresa elegida.
   *
   * Es la traducción de «qué CRM estoy mirando» a lo que la base ya distingue: los prospectos
   * de la agencia son empresas que Espartanos quiere sumar; los de una cuenta son las personas
   * que trajeron sus campañas. Al derivarlo del selector, elegir la empresa es lo único que hay
   * que hacer, y ninguna pantalla tiene que volver a preguntarlo.
   */
  const esAgencia = !esPortalCliente && clientId === CUENTA_AGENCIA;
  /*
   * CRM y reservas no son dos vistas del mismo dato. El CRM contratado por una empresa usa el
   * embudo comercial completo y se acota por `clientId`; el ciclo audience queda para los
   * contactos creados por reservas. Antes elegir una empresa forzaba audience y el tablero
   * cambiaba a cuatro estados de reserva, aunque la empresa estuviera trabajando su CRM.
   */
  const domain: 'audience' | 'commercial' = 'commercial';

  const scope: CrmScopeValue = {
    clientId: esAgencia ? '' : clientId,
    setClientId,
    clients,
    nombreDe,
    domain,
    esAgencia,
    // La misma matriz que autoriza la API gobierna todos los controles de escritura. Derivarlo
    // del cargo dejaba excepciones web sin efecto y mostraba drag-and-drop a personas `view`.
    puedeEditar: canEditCrm(user?.permissions?.crm),
    /** Nombre de la empresa que se está mirando, para los encabezados de cada pantalla. */
    empresa: esAgencia ? 'Espartanos' : (esPortalCliente ? 'Tu empresa' : nombreDe(clientId)),
  };

  /*
    Qué secciones ve cada persona lo decide la matriz de permisos, no una lista de cargos
    escrita acá.

    Antes cada sección declaraba sus roles a mano, así que cambiar quién ve el calendario
    obligaba a tocar código y desplegar, y la pantalla de permisos —que es donde se espera
    hacerlo— no gobernaba esta barra. Ahora se resuelve con la misma función que la lateral
    general: mismo módulo, mismos permisos efectivos, misma respuesta en las dos.
  */
  const visibles = SECCIONES.filter((seccion) => {
    /*
      Administración exige administrar el CRM, no solo operarlo.

      El portal nunca la ve: la configuración de campañas, llaves y vocabulario pertenece a
      Espartanos y ofrecérsela sería una pantalla vacía con su nombre en el encabezado.

      Para el equipo interno la reja es el nivel `manage` y no una lista de cargos. Con solo
      comprobar que el CRM esté habilitado, la veía cualquiera que pudiera editar leads —un
      ejecutivo con `edit`—, y desde ahí se rotan llaves de campaña y se renombra el vocabulario
      de una empresa entera. Quién tiene `manage` se ajusta en Configuración, sin desplegar.
    */
    if (seccion.to === '/crm/administracion') {
      if (esPortalCliente) return false;
      if (user?.permissions?.crm !== 'manage') return false;
    }
    return isPathEnabled(
      seccion.to,
      user?.features,
      user?.permissions,
      user?.moduleLifecycle,
      user?.role,
      user?.capabilities,
    );
  });


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
            {visibles.map((seccion) => (
              <NavLink
                key={seccion.to}
                to={seccion.to}
                end={seccion.end}
                className={({ isActive }) => (isActive ? 'crm-nav-link activo' : 'crm-nav-link')}
              >
                {seccion.label}
              </NavLink>
            ))}
          </div>

          <div className="crm-nav-derecha">
            {/*
              De qué empresa es el CRM que se está mirando.

              No es un filtro sino el contexto: cambiarlo cambia el embudo, no acota una lista.
              Por eso siempre hay una empresa elegida y no existe un «todas» —mirar el conjunto
              de dos embudos con significados distintos no responde ninguna pregunta—.

              Las opciones son las cuentas que esta persona alcanza, resueltas por el servidor,
              más la propia agencia. Con eso, qué CRM ve cada quien sale de las cuentas que
              maneja, sin una regla aparte que mantener de acuerdo.
            */}
            {esPortalCliente ? (
              <span className="crm-nav-cuenta" aria-label="Empresa asignada">
                <span className="crm-nav-cuenta-label">Empresa</span>
                <strong>Empresa asignada</strong>
              </span>
            ) : (
              <label className="crm-nav-cuenta">
                <span className="crm-nav-cuenta-label">Empresa</span>
                <select
                  className="input"
                  aria-label="Empresa cuyo CRM se está mirando"
                  value={esAgencia ? CUENTA_AGENCIA : clientId}
                  onChange={(event) => setClientId(event.target.value)}
                >
{/* El embudo propio de la agencia no es de nadie más: ofrecérselo al portal de un cliente
                    lo lleva a una pantalla vacía con el nombre de la agencia en el encabezado. */}
                <option value={CUENTA_AGENCIA}>Espartanos</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
            )}

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
