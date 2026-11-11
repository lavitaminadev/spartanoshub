import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RECORRIDO, FLUJOS, ORDEN_COMPLETO, ROLES_DEL_RECORRIDO, pasosDelFlujo, pasosDelRol, type SaltoDePerspectiva } from './recorrido-guiado';
import {
  claveDelPaso, componerInforme, componerResumen, entregarInforme,
  guardarObservacion, leerObservaciones, leerVistas, marcarVista, type Observacion,
} from './observaciones-de-la-maqueta';
import { guardarEnLaNube, hayDondeGuardar } from './nube-de-la-maqueta';
import { enviarObservaciones } from './envio-de-observaciones';
import './recorrido-guiado.css';

/**
 * El manual de la aplicación: un panel al lado de la pantalla que explica lo que se está viendo.
 *
 * Existe sólo en el modo visual y es una capa encima: no toca ninguna pantalla, de modo que lo que
 * se explica es la vista de verdad y no una versión preparada para la explicación.
 *
 * Se entra eligiendo un flujo, no por el principio. Quien viene a entender los cupones no tiene
 * que recorrer el sistema entero, y quien quiere el recorrido completo lo pide aparte.
 *
 * Un paso se ve desde el cargo y la empresa que declara, y eso obliga a recargar la página: el
 * perfil que responde `/auth/me` se arma al cargar el módulo. Sin recargar, el menú seguiría
 * siendo el del cargo anterior y el panel estaría explicando lo contrario de lo que hay delante.
 */

const CLAVE_ROL = 'espartanos.modo-visual.rol';
const CLAVE_EMPRESA = 'espartanos.modo-visual.empresa';
const CLAVE_FLUJO = 'espartanos.modo-visual.flujo';
const CLAVE_POSICION = 'espartanos.modo-visual.posicion';
const CLAVE_OCULTO = 'espartanos.modo-visual.panel-oculto';
const CLAVE_DESVIO = 'espartanos.modo-visual.desvio';
const CLAVE_PLEGADO = 'espartanos.modo-visual.panel-plegado';
const CLAVE_NOMBRE = 'espartanos.maqueta.nombre-de-quien-revisa';

const ROL_POR_OMISION = 'admin';
const EMPRESA_POR_OMISION = 'visual-client';
const FLUJOS_EXTERNOS = FLUJOS.filter((flujo) => !['enObra', 'decidir'].includes(flujo.id));
const PASOS_EXTERNOS = new Set(FLUJOS_EXTERNOS.flatMap((flujo) => pasosDelFlujo(flujo.id)));

/** El router de la maqueta compilada enruta por el fragmento; el de desarrollo, por la ruta. */
const ENRUTA_POR_FRAGMENTO = import.meta.env.PROD;

/** De dónde salió un salto de perspectiva, para poder volver al paso que lo ofreció. */
interface Desvio {
  etiqueta: string;
  queCambia: string;
  flujo: string;
  posicion: number;
}

function leer(clave: string): string | null {
  try { return window.sessionStorage.getItem(clave); } catch { return null; }
}

function guardar(clave: string, valor: string): void {
  try { window.sessionStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}

function olvidar(clave: string): void {
  try { window.sessionStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
}

function leerDesvio(): Desvio | null {
  try {
    const crudo = leer(CLAVE_DESVIO);
    return crudo ? (JSON.parse(crudo) as Desvio) : null;
  } catch { return null; }
}

/**
 * Carga una ruta con el cargo y la empresa que pide, recargando la página.
 *
 * La dirección se arma distinta según el router porque `?rol=` se lee de la consulta, que en el
 * modo fragmento va antes del `#`. Dejarlo dentro del fragmento haría que el parámetro no se
 * leyera y la vista se mostraría desde el cargo anterior.
 */
function recargarEn(ruta: string, rol: string, empresa: string): void {
  const [camino, consultaDeLaRuta] = ruta.split('?');
  const partes = [`rol=${encodeURIComponent(rol)}`, `empresa=${encodeURIComponent(empresa)}`];
  if (consultaDeLaRuta) partes.push(consultaDeLaRuta);
  const consulta = `?${partes.join('&')}`;
  const { origin, pathname } = window.location;
  window.location.href = ENRUTA_POR_FRAGMENTO
    ? `${origin}${pathname}${consulta}#${ruta}`
    : `${origin}${camino}${consulta}`;
}

function pasosDeSeleccion(seleccion: string): number[] {
  if (seleccion === 'todo') return ORDEN_COMPLETO.filter((indice) => PASOS_EXTERNOS.has(indice));
  if (seleccion.startsWith('rol:')) return pasosDelRol(seleccion.slice(4)).filter((indice) => PASOS_EXTERNOS.has(indice));
  return pasosDelFlujo(seleccion).filter((indice) => PASOS_EXTERNOS.has(indice));
}

export function RecorridoGuiado() {
  const navigate = useNavigate();
  const [flujo, setFlujo] = useState(() => leer(CLAVE_FLUJO) ?? '');
  const [posicion, setPosicion] = useState(() => Math.max(0, Number(leer(CLAVE_POSICION)) || 0));
  const [oculto, setOculto] = useState(() => leer(CLAVE_OCULTO) === '1');
  const [plegado, setPlegado] = useState(() => leer(CLAVE_PLEGADO) === '1');
  const [desvio, setDesvio] = useState<Desvio | null>(leerDesvio);
  const [observaciones, setObservaciones] = useState<Record<string, Observacion>>({});
  const [vistas, setVistas] = useState<Record<string, true>>({});
  const [borrador, setBorrador] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [entregado, setEntregado] = useState<string | null>(null);
  /*
   * El nombre se pide una vez y se recuerda.
   *
   * Un comentario sin autor no se puede responder ni contrastar, y volver a pedirlo en cada envío
   * hace que la segunda tanda llegue sin él.
   */
  const [nombre, setNombre] = useState(() => {
    try { return window.localStorage.getItem(CLAVE_NOMBRE) ?? ''; } catch { return ''; }
  });
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [mostrarAcciones, setMostrarAcciones] = useState(false);
  /** Si esta vista puede dejar lo anotado en el artefacto, sin que nadie tenga que enviarlo. */
  const [enLaNube, setEnLaNube] = useState(false);
  const panel = useRef<HTMLElement>(null);

  /* Lo anotado vive en el navegador, que no existe hasta que el componente está montado. */
  useEffect(() => {
    setObservaciones(leerObservaciones());
    setVistas(leerVistas());
    /* Se pregunta después de pintar: la respuesta tarda y el panel no debe esperarla. */
    void hayDondeGuardar().then(setEnLaNube);
  }, []);

  const orden = useMemo(() => (flujo ? pasosDeSeleccion(flujo) : []), [flujo]);
  const indice = orden[Math.min(posicion, Math.max(orden.length - 1, 0))] ?? 0;
  const paso = RECORRIDO[indice];
  const clave = paso ? claveDelPaso(paso) : '';
  const anotado = observaciones[clave];

  /*
   * El ancho del panel lo dicta el panel, medido.
   *
   * Escrito a mano se queda corto en cuanto cambia el contenido o el ancho de la ventana, y
   * entonces el panel tapa el borde de la pantalla que está explicando sin que nadie lo note.
   */
  useEffect(() => {
    const elemento = panel.current;
    if (!elemento) {
      document.documentElement.style.removeProperty('--manual-ancho');
      document.documentElement.style.removeProperty('--manual-alto');
      return;
    }

    function medir() {
      const medida = elemento?.getBoundingClientRect();
      if (!medida) return;
      document.documentElement.style.setProperty('--manual-ancho', `${Math.ceil(medida.width)}px`);
      document.documentElement.style.setProperty('--manual-alto', `${Math.ceil(medida.height)}px`);
    }

    /*
     * Se mide en cada render y además cuando el panel cambia de tamaño por su cuenta.
     *
     * El `ResizeObserver` solo no basta: no entrega nada mientras la pestaña no se está pintando,
     * y entonces el hueco se queda en el valor de reserva y el panel tapa el borde de la vista.
     * La medición directa cubre todo lo que nace de un render, que es casi todo.
     */
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    window.addEventListener('resize', medir);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  });

  /* Abrir una vista cuenta como haberla visto, aunque no se diga nada de ella. */
  useEffect(() => {
    if (!flujo || !clave) return;
    setVistas(marcarVista(clave));
    setBorrador('');
    setEscribiendo(false);
  }, [flujo, clave]);

  useEffect(() => {
    document.documentElement.classList.toggle('maqueta-muestra-acciones', mostrarAcciones);
    return () => document.documentElement.classList.remove('maqueta-muestra-acciones');
  }, [mostrarAcciones]);

  const irA = useCallback((siguiente: number, flujoDestino: string) => {
    const lista = pasosDeSeleccion(flujoDestino);
    if (lista.length === 0) return;
    const destino = Math.min(Math.max(siguiente, 0), lista.length - 1);
    const pasoDestino = RECORRIDO[lista[destino]];
    const rol = pasoDestino.rol;
    const empresa = pasoDestino.empresa ?? EMPRESA_POR_OMISION;

    guardar(CLAVE_FLUJO, flujoDestino);
    guardar(CLAVE_POSICION, String(destino));
    olvidar(CLAVE_DESVIO);
    setDesvio(null);
    setFlujo(flujoDestino);
    setPosicion(destino);

    const cambiaDeMirada = rol !== (leer(CLAVE_ROL) ?? ROL_POR_OMISION)
      || empresa !== (leer(CLAVE_EMPRESA) ?? EMPRESA_POR_OMISION);
    if (cambiaDeMirada) {
      guardar(CLAVE_ROL, rol);
      guardar(CLAVE_EMPRESA, empresa);
      recargarEn(pasoDestino.ruta, rol, empresa);
      return;
    }
    navigate(pasoDestino.ruta);
  }, [navigate]);

  /** Salta a la misma cosa vista por otro cargo, recordando desde dónde se fue. */
  const irAlOtroLado = useCallback((destino: SaltoDePerspectiva) => {
    const empresa = destino.empresa ?? EMPRESA_POR_OMISION;
    const vuelta: Desvio = { etiqueta: destino.etiqueta, queCambia: destino.queCambia, flujo, posicion };
    try { window.sessionStorage.setItem(CLAVE_DESVIO, JSON.stringify(vuelta)); } catch { /* sin almacenamiento */ }
    guardar(CLAVE_ROL, destino.rol);
    guardar(CLAVE_EMPRESA, empresa);
    recargarEn(destino.ruta, destino.rol, empresa);
  }, [flujo, posicion]);

  const volverDelDesvio = useCallback(() => {
    const vuelta = desvio;
    olvidar(CLAVE_DESVIO);
    setDesvio(null);
    if (vuelta) irA(vuelta.posicion, vuelta.flujo);
  }, [desvio, irA]);

  const volverALaPortada = useCallback(() => {
    guardar(CLAVE_FLUJO, '');
    olvidar(CLAVE_DESVIO);
    setDesvio(null);
    setFlujo('');
    setEntregado(null);
  }, []);

  // Las flechas del teclado, que es como se recorre algo de sesenta vistas sin apuntar con el ratón.
  useEffect(() => {
    if (oculto || !flujo || desvio) return;
    function alPulsar(evento: KeyboardEvent) {
      const enUnCampo = evento.target instanceof HTMLElement
        && ['INPUT', 'TEXTAREA', 'SELECT'].includes(evento.target.tagName);
      if (enUnCampo || evento.metaKey || evento.ctrlKey || evento.altKey) return;
      if (evento.key === 'ArrowRight') irA(posicion + 1, flujo);
      if (evento.key === 'ArrowLeft') irA(posicion - 1, flujo);
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [posicion, flujo, irA, oculto, desvio]);

  const anotar = useCallback((estado: 'ok' | 'nota') => {
    const texto = estado === 'nota' ? borrador : undefined;
    const mapa = guardarObservacion(clave, estado, texto);
    setObservaciones(mapa);
    setEscribiendo(false);
    /* El navegador ya la tiene; la base es un extra que no debe hacer esperar a nadie. */
    void guardarEnLaNube(clave, mapa[clave]);
  }, [clave, borrador]);

  const enviar = useCallback(async () => {
    if (!nombre.trim()) return;
    try { window.localStorage.setItem(CLAVE_NOMBRE, nombre.trim()); } catch { /* sin almacenamiento */ }
    setEnviando(true);
    setEntregado(null);
    const { asunto } = componerResumen(RECORRIDO);
    const resultado = await enviarObservaciones(nombre.trim(), correo, asunto, componerInforme(FLUJOS, RECORRIDO));
    setEnviando(false);
    setEntregado(resultado.mensaje);
  }, [nombre, correo]);

  /* El archivo, para cuando el envío no sale: lo anotado no se pierde por no tener red. */
  const descargar = useCallback(async () => {
    const resultado = await entregarInforme(componerInforme(FLUJOS, RECORRIDO));
    setEntregado(resultado === 'copiado'
      ? 'Copiado al portapapeles y descargado como archivo.'
      : 'Descargado como archivo.');
  }, []);

  const formularioDeEnvio = <div className="manual-envio">
    <p className="manual-matiz">Tu mensaje se enviará al equipo revisor mediante un servicio de formularios externo.</p>
    <label>
      Tu nombre
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Para saber quién lo dice" />
    </label>
    <label>
      Tu correo <small>(opcional, para poder responderte)</small>
      <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" placeholder="nombre@ejemplo.cl" />
    </label>
    <div className="manual-acciones">
      <button type="button" className="btn btn-primary btn-sm" disabled={enviando || nombre.trim().length === 0} onClick={() => void enviar()}>
        {enviando ? 'Enviando…' : 'Enviar comentario'}
      </button>
      <button type="button" className="manual-enlace" onClick={() => void descargar()}>Descargar el archivo</button>
    </div>
    {enLaNube && <p className="manual-matiz">Además queda guardado en el artefacto según lo vas anotando.</p>}
    {entregado && <p className="manual-aviso">{entregado}</p>}
  </div>;

  const conNota = Object.values(observaciones).filter((o) => o.estado === 'nota').length;

  if (oculto) {
    return <button
      type="button"
      className="manual-reabrir"
      onClick={() => { guardar(CLAVE_OCULTO, '0'); setOculto(false); }}
    >Manual de la app</button>;
  }

  const cerrar = <button
    type="button"
    className="manual-cerrar"
    onClick={() => { guardar(CLAVE_OCULTO, '1'); setOculto(true); }}
    aria-label="Ocultar el manual"
  >×</button>;

  /* El desvío: se está mirando lo mismo desde otro cargo, y hay que poder volver. */
  if (desvio) {
    return <aside ref={panel} className="manual-panel es-desvio" aria-label="Manual de la aplicación">
      <header className="manual-cabecera">
        <span className="manual-etiqueta">Desde el otro lado</span>
        {cerrar}
      </header>
      <div className="manual-cuerpo">
        <h2>{desvio.etiqueta}</h2>
        <p>{desvio.queCambia}</p>
      </div>
      <footer className="manual-pie">
        <button type="button" className="btn btn-primary btn-sm" onClick={volverDelDesvio}>Volver al paso</button>
        <button type="button" className="manual-enlace" onClick={volverALaPortada}>Elegir otro flujo</button>
      </footer>
    </aside>;
  }

  /* La portada: se elige qué conocer antes de ver nada. */
  if (!flujo) {
    return <aside ref={panel} className="manual-panel es-portada" aria-label="Recorrido guiado de la maqueta">
      <header className="manual-cabecera">
        <span className="manual-etiqueta">Recorrido guiado de la maqueta</span>
        {cerrar}
      </header>
      <div className="manual-cuerpo">
        <h2>Cómo quieres revisar</h2>
        <p className="manual-intro">
          Revisa pantallas y recorridos representativos de EspartanosHUB. Los nombres, empresas, personas y datos
          son ficticios y se usan sólo para demostración; esta maqueta no opera información de producción.
        </p>
        <h3 className="manual-subtitulo">Revisar desde un rol</h3>
        <ul className="manual-roles">
          {ROLES_DEL_RECORRIDO.filter((rol) => pasosDeSeleccion(`rol:${rol.id}`).length > 0).map((rol) => {
            const suyos = pasosDeSeleccion(`rol:${rol.id}`);
            return <li key={rol.id}>
              <button type="button" onClick={() => irA(0, `rol:${rol.id}`)}>
                <span className="manual-flujo-nombre">{rol.nombre}</span>
                <small>{rol.para}</small>
                <em>{suyos.length} vistas para revisar</em>
              </button>
            </li>;
          })}
        </ul>
        <h3 className="manual-subtitulo">Revisar por flujo</h3>
        <ul className="manual-flujos">
          {FLUJOS_EXTERNOS.map((item) => {
            const suyos = pasosDelFlujo(item.id);
            const abiertos = suyos.filter((i) => vistas[claveDelPaso(RECORRIDO[i])]).length;
            const completo = abiertos === suyos.length;
            return <li key={item.id}>
              <button type="button" onClick={() => irA(0, item.id)}>
                <span className="manual-flujo-nombre">
                  {completo && <i className="manual-tilde" aria-hidden="true">✓</i>}
                  {item.nombre}
                </span>
                <small>{item.para}</small>
                <em>{abiertos} de {suyos.length} vistas</em>
              </button>
            </li>;
          })}
        </ul>
        <button type="button" className="manual-todo" onClick={() => irA(0, 'todo')}>
          Todos los recorridos, de corrido
          <small>{FLUJOS_EXTERNOS.length} flujos y {pasosDeSeleccion('todo').length} vistas, sin repetir ninguna.</small>
        </button>
      </div>
      <footer className="manual-pie">
        {mostrarEnvio ? formularioDeEnvio : <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setMostrarEnvio(true)}>
            Enviar comentarios{conNota > 0 ? ` (${conNota})` : ''}
          </button>
          <button
            type="button"
            className="manual-enlace"
            onClick={() => { guardar(CLAVE_OCULTO, '1'); setOculto(true); }}
          >Mirar por mi cuenta</button>
        </>}
      </footer>
    </aside>;
  }

  const nombreDelFlujo = flujo === 'todo'
    ? 'Todo el sistema'
    : flujo.startsWith('rol:')
      ? ROLES_DEL_RECORRIDO.find((rol) => rol.id === flujo.slice(4))?.nombre ?? 'Rol'
      : FLUJOS.find((f) => f.id === flujo)?.nombre ?? '';
  const ultimo = posicion >= orden.length - 1;

  return <aside
    ref={panel}
    className={`manual-panel es-lateral ${plegado ? 'esta-plegado' : ''}`}
    aria-label="Manual de la aplicación"
  >
    <div className="manual-progreso"><i style={{ width: `${((posicion + 1) / orden.length) * 100}%` }} /></div>
    <header className="manual-cabecera">
      <button type="button" className="manual-volver" onClick={volverALaPortada}>← Flujos</button>
      <span className="manual-posicion">{nombreDelFlujo} · {posicion + 1} de {orden.length}</span>
      {/* En pantalla angosta el panel se pliega a su cabecera; en ancha no hay nada que plegar. */}
      <button
        type="button"
        className="manual-plegar"
        onClick={() => { const ahora = !plegado; guardar(CLAVE_PLEGADO, ahora ? '1' : '0'); setPlegado(ahora); }}
        aria-expanded={!plegado}
      >{plegado ? 'Ver' : 'Plegar'}</button>
      {cerrar}
    </header>

    <div className="manual-cuerpo">
      <h2>{paso.titulo}</h2>
      <p className="manual-ruta">
        <code>{paso.ruta}</code>
        {paso.muestra && <span className="manual-sin-datos">
          {paso.muestra === 'vacia' ? 'sin datos de muestra' : 'datos de muestra parciales'}
        </span>}
      </p>

      <section className="manual-bloque">
        <h3>¿Qué estoy viendo?</h3>
        <p>{paso.queVes}</p>
      </section>

      <section className="manual-bloque">
        <h3>¿Por qué existe?</h3>
        <p>{paso.porQueExiste}</p>
      </section>

      <section className="manual-bloque">
        <h3>¿Qué hace?</h3>
        <ul>{paso.queHace.map((linea) => <li key={linea}>{linea}</li>)}</ul>
      </section>

      <section className="manual-bloque es-acciones-visibles">
        <h3>Pruébalo en pantalla</h3>
        <p>Resalta los controles reales disponibles en esta vista. Puedes usarlos con datos de demostración.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setMostrarAcciones((actual) => !actual)}>
          {mostrarAcciones ? 'Ocultar acciones' : 'Resaltar acciones'}
        </button>
      </section>

      {/*
        El criterio va aparte y se dibuja distinto.

        Escrito con el mismo tono que «qué hace», una lectura se confunde con una función, y el
        lector no tiene cómo saber cuál de las dos está leyendo.
      */}
      {paso.comoSeLee && <section className="manual-bloque es-medicion">
        <h3>¿Cómo se lee?</h3>
        <p className="manual-matiz">Criterio, no comportamiento.</p>
        <ul>{paso.comoSeLee.map((linea) => <li key={linea}>{linea}</li>)}</ul>
      </section>}

      {paso.tambienDesde && <section className="manual-bloque">
        <h3>¿Y desde el otro lado?</h3>
        {paso.tambienDesde.map((destino) => <button
          key={destino.etiqueta}
          type="button"
          className="manual-otro-lado"
          onClick={() => irAlOtroLado(destino)}
        >
          <strong>{destino.etiqueta}</strong>
          <small>{destino.queCambia}</small>
        </button>)}
      </section>}

      <section className="manual-bloque es-retroalimentacion">
        <h3>¿Qué te parece esta vista?</h3>
        {anotado && !escribiendo
          ? <p className="manual-anotado">
            {anotado.estado === 'ok' ? 'Anotaste que está bien.' : 'Anotaste una observación.'}
            {anotado.texto && <em>{anotado.texto}</em>}
            <button type="button" className="manual-enlace" onClick={() => { setBorrador(anotado.texto ?? ''); setEscribiendo(true); }}>Cambiar</button>
          </p>
          : <>
            <textarea
              value={borrador}
              onChange={(evento) => setBorrador(evento.target.value)}
              placeholder="Qué falta, qué sobra, qué no se entiende"
              rows={3}
            />
            <div className="manual-acciones">
              <button type="button" className="btn btn-primary btn-sm" disabled={borrador.trim().length === 0} onClick={() => anotar('nota')}>Guardar observación</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => anotar('ok')}>Está bien</button>
            </div>
          </>}
      </section>

      {ultimo && <section className="manual-bloque es-final">
        <h3>Terminaste este flujo</h3>
        <p>
          {flujo === 'todo'
            ? 'Viste el sistema completo. Lo que anotaste se puede enviar de una vez.'
            : 'Puedes elegir otro flujo, o enviar lo que anotaste hasta acá.'}
        </p>
        <div className="manual-acciones">
          <button type="button" className="btn btn-primary btn-sm" onClick={volverALaPortada}>Elegir otro flujo</button>
          {!mostrarEnvio && <button type="button" className="btn btn-outline btn-sm" onClick={() => setMostrarEnvio(true)}>
            Enviar comentarios{conNota > 0 ? ` (${conNota})` : ''}
          </button>}
        </div>
        {mostrarEnvio && formularioDeEnvio}
      </section>}
    </div>

    <footer className="manual-pie">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => irA(posicion - 1, flujo)} disabled={posicion === 0}>← Anterior</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => irA(posicion + 1, flujo)} disabled={ultimo}>Siguiente →</button>
    </footer>
  </aside>;
}
