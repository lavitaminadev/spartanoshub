/**
 * @fileoverview Las plantillas de los correos que salen del sistema.
 *
 * Vive aparte de la pantalla de administración porque es otra cosa: allí se decide quién puede
 * hacer qué, y acá qué le llega a una persona. Y porque esa pantalla ya es larga.
 *
 * Cada aviso se agrupa con su interruptor, su asunto y su cuerpo: separados por orden alfabético
 * —que es como llegan del servidor— quedaban repartidos por toda la lista y encender uno obligaba
 * a buscar sus dos textos en otro sitio.
 *
 * **Las escribe Espartanos, no la empresa cliente.** El selector de empresa dice de quién es la
 * plantilla que se está editando, no quién la edita.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import './panel-de-correo.css';

interface Ajuste {
  key: string;
  label: string;
  description: string;
  valueType: 'boolean' | 'number' | 'select' | 'text';
  value: string | number | boolean | null;
  /** De dónde salió el valor: propio de la empresa, de la organización, o de fábrica. */
  source: 'client' | 'organization' | 'master_default';
  unit?: string;
  min?: number;
  max?: number;
}

interface Empresa { id: string; name: string; capabilities?: { reservations?: boolean; crm?: boolean; surveys?: boolean } }

/** Alguien del equipo que puede recibir una prueba. */
interface Destinatario { id: string; name: string; email: string }

/**
 * Los avisos, en el orden en que conviene mirarlos.
 *
 * El prefijo agrupa las claves de cada uno —`email.daily_digest_*`— y el rótulo es el que se
 * muestra. Va escrito acá y no derivado de las claves porque el orden es una decisión editorial:
 * primero lo que le llega a un cliente, después lo interno.
 */
type ModuloDeAviso = 'reservas' | 'encuestas' | 'crm' | 'equipo' | 'cobranza';

/** Rótulo y orden de cada grupo. Reservas primero: es lo que más se edita. */
const MODULOS: Array<{ clave: ModuloDeAviso; titulo: string; explica: string; servicio?: 'reservations' | 'crm' | 'surveys' }> = [
  { clave: 'reservas', titulo: 'Reservas', explica: 'Lo que recibe quien reserva.', servicio: 'reservations' },
  { clave: 'encuestas', titulo: 'Encuestas', explica: 'Después de la visita.', servicio: 'surveys' },
  { clave: 'equipo', titulo: 'Avisos al equipo del local', explica: 'Internos: no los ve quien reserva.', servicio: 'reservations' },
  { clave: 'crm', titulo: 'CRM', explica: 'Para el equipo que atiende prospectos.', servicio: 'crm' },
  // Cobranza es de Espartanos hacia la empresa: no depende de lo que ella contrató.
  { clave: 'cobranza', titulo: 'Cobranza', explica: 'A la empresa cliente.' },
];

const AVISOS: Array<{ prefijo: string; titulo: string; explica: string; modulo: ModuloDeAviso }> = [
  {
    prefijo: 'email.reservation_confirmation',
    modulo: 'reservas',
    titulo: 'Confirmación de reserva',
    explica: 'Se envía al instante a quien reserva. Es su comprobante: sin él no tiene fecha ni código.',
  },
  {
    prefijo: 'email.reservation_reminder',
    modulo: 'reservas',
    titulo: 'Recordatorio de reserva',
    explica: 'La víspera, o con la anticipación que elijas. Es la medida que más reduce las ausencias.',
  },
  {
    prefijo: 'email.reservation_change',
    modulo: 'reservas',
    titulo: 'Cambio de hora',
    explica: 'Cuando la reserva cambia de horario, desde el local o desde su enlace. Lleva la cita nueva para el calendario.',
  },
  {
    prefijo: 'email.post_visit_survey',
    modulo: 'encuestas',
    titulo: 'Encuesta después de la visita',
    explica: 'Unas horas después de una reserva marcada como asistida. Primero pide estrellas; con nota baja ofrece escribirle al equipo, con nota alta ofrece contestar la encuesta.',
  },
  {
    prefijo: 'email.reservation_cancellation',
    modulo: 'reservas',
    titulo: 'Cancelación',
    explica: 'Cuando se cancela, desde el local o por la propia persona. Si la canceló el local, {{motivo}} trae la razón.',
  },
  {
    prefijo: 'email.group_request_ack',
    modulo: 'reservas',
    titulo: 'Acuse de solicitud de grupo',
    explica: 'Confirma que la solicitud llegó y deja claro que todavía no hay nada reservado.',
  },
  {
    prefijo: 'email.waitlist_ack',
    modulo: 'reservas',
    titulo: 'Acuse de lista de espera',
    explica: 'Confirma a quien se anotó y deja claro que no es una reserva.',
  },
  {
    prefijo: 'email.waitlist_spot',
    modulo: 'reservas',
    titulo: 'Cupo liberado',
    explica: 'A quienes esperaban ese horario cuando alguien cancela. El cupo queda para quien confirme primero.',
  },
  {
    prefijo: 'email.reservation_recovery',
    modulo: 'reservas',
    titulo: 'Enlace para recuperar la reserva',
    explica: 'Cuando alguien sin su código lo pide desde la página del local. Solo llega al correo con que reservó.',
  },
  {
    prefijo: 'email.collection_overdue',
    modulo: 'cobranza',
    titulo: 'Aviso de pago vencido',
    explica: 'Se envía al contacto principal de la empresa cuando una factura queda vencida.',
  },
  {
    prefijo: 'email.birthday',
    modulo: 'crm',
    titulo: 'Saludo de cumpleaños',
    explica: 'Solo a quien dio su fecha y está suscrito. Lleva enlace de baja como todo correo comercial.',
  },
  {
    prefijo: 'email.daily_digest',
    modulo: 'crm',
    titulo: 'Resumen diario del CRM',
    explica: 'Un correo por la mañana a cada responsable. Solo se envía si tiene algo que leer.',
  },
  {
    prefijo: 'email.task_reminder',
    modulo: 'crm',
    titulo: 'Recordatorio de tareas',
    explica: 'Doce y tres horas antes. El de doce se omite si la tarea nació con menos margen.',
  },
  {
    prefijo: 'email.new_lead',
    modulo: 'crm',
    titulo: 'Aviso de lead nuevo',
    explica: 'Al responsable, indicando de dónde viene.',
  },
  {
    prefijo: 'email.team_new_reservation',
    modulo: 'equipo',
    titulo: 'Aviso al equipo: reserva nueva',
    explica: 'A los correos del equipo anotados en cada local. Si un local no tiene ninguno, no sale.',
  },
  {
    prefijo: 'email.team_group_request',
    modulo: 'equipo',
    titulo: 'Aviso al equipo: solicitud de grupo',
    explica: 'Cuando alguien pide un evento. No toma cupo hasta que el equipo lo resuelva.',
  },
  {
    prefijo: 'email.team_waitlist',
    modulo: 'equipo',
    titulo: 'Aviso al equipo: lista de espera',
    explica: 'Cuando alguien se anota en la lista de espera de un horario lleno.',
  },
];

/**
 * Qué es cada variable, en palabras.
 *
 * La ficha mostraba sólo `{{codigo}}`, que no dice de qué código habla ni si es el de la reserva
 * o el de la factura. Cada aviso ofrece las suyas, así que el mismo nombre no siempre significa lo
 * mismo: el rótulo se resuelve por variable y el texto entre llaves queda al lado para quien ya
 * sabe cuál quiere.
 */
const EXPLICA_VARIABLE: Record<string, string> = {
  local: 'La sucursal de la reserva de quien recibe el correo, no una fija: cada persona ve la suya.',
  nombre: 'El nombre con que reservó quien recibe el correo.',
  fecha: 'La fecha y hora de esa reserva, en la zona horaria del local.',
  personas: 'Cuántas personas trae esa reserva.',
  codigo: 'El código de esa reserva, el que sirve para buscarla.',
  gestion: 'Un enlace propio de esa reserva para cambiarla o cancelarla.',
  empresa: 'La empresa dueña del local, no la sucursal.',
};

const ETIQUETAS_DE_VARIABLE: Record<string, string> = {
  nombre: 'Nombre de quien recibe',
  local: 'Nombre del local',
  fecha: 'Fecha y hora',
  personas: 'Cuántas personas',
  codigo: 'Código de la reserva',
  gestion: 'Enlace para cambiarla o cancelarla',
  motivo: 'Motivo de la cancelación',
  empresa: 'Nombre de la empresa',
  factura: 'Número de la factura',
  monto: 'Monto',
  vencimiento: 'Fecha de vencimiento',
  tarea: 'Título de la tarea',
  horas: 'Horas que faltan',
  lead: 'Nombre del prospecto',
  origen: 'De dónde llegó',
  campana: 'Campaña',
  pendientes: 'Cuántos pendientes',
  parados: 'Cuántos sin movimiento',
};

/** Las variables que admite una plantilla, sacadas de su propia descripción. */
function variablesDe(descripcion: string): string[] {
  return [...descripcion.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)].map((m) => m[1]);
}

/**
 * Cuerpo del correo con las variables resaltadas.
 *
 * Un textarea no sabe pintar parte de su texto, así que debajo va una capa con el mismo texto y la
 * misma tipografía donde las variables llevan color, y encima el textarea con fondo y letra
 * transparentes. Se escribe en el de arriba y se ve el de abajo, alineados carácter a carácter.
 *
 * Importa porque en un párrafo corrido `{{personas}}` se confunde con el texto, y una variable mal
 * escrita —que al enviar se borra— pasa desapercibida justo cuando conviene notarla.
 */
function CuerpoConVariables({ id, valor, admitidas, onCambio }: {
  id: string;
  valor: string;
  admitidas: string[];
  onCambio: (valor: string) => void;
}): JSX.Element {
  const capa = useRef<HTMLDivElement>(null);
  const trozos = valor.split(/(\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\})/g);
  return (
    <div className="panel-correo-cuerpo">
      <div className="panel-correo-cuerpo-capa" ref={capa} aria-hidden="true">
        {trozos.map((trozo, indice) => {
          const variable = trozo.match(/^\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}$/)?.[1];
          if (!variable) return <span key={indice}>{trozo}</span>;
          return <mark key={indice} className={admitidas.includes(variable) ? '' : 'no-existe'}>{trozo}</mark>;
        })}
        {/* Una línea final vacía mantiene la capa tan alta como el texto mientras se escribe. */}
        {'\n'}
      </div>
      <textarea
        className="input"
        id={id}
        rows={6}
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        onScroll={(evento) => { if (capa.current) capa.current.scrollTop = evento.currentTarget.scrollTop; }}
      />
    </div>
  );
}

export function PanelDeCorreo(): JSX.Element {
  const queryClient = useQueryClient();
  /*
   * Las instrucciones del servidor son para quien tiene acceso a él.
   *
   * Nombrar el panel del hosting, las variables y la contraseña del correo a quien administra
   * reservas no le sirve —no puede entrar ahí— y además dice en voz alta cómo está montado el
   * sistema. Ve que aún no está activo y a quién pedírselo, que es lo que necesita saber.
   */
  const { user } = useAuth();
  const esDev = user?.role === 'dev';
  /*
   * La lista de encuestas es de otro módulo.
   *
   * Quien escribe los correos puede no tener Encuestas, y pedirlas igual devolvía 403: la pantalla
   * funcionaba pero recibía a la persona con «no tienes acceso a este módulo», que además señala a
   * un módulo que no es el que está mirando.
   */
  const alcanzaEncuestas = user?.permissions?.surveys !== undefined && user.permissions.surveys !== 'none';
  /** Vacío significa «la plantilla general», la que usa quien no tenga la suya. */
  const [empresa, setEmpresa] = useState('');
  /*
   * Encuestas que se pueden enviar después de la visita.
   *
   * Sólo las activas y de clientes, de la empresa elegida o generales. Ofrecer una cerrada, o una
   * de otra empresa, dejaría elegir algo que el envío después descarta sin decir nada.
   */
  const encuestasQuery = useQuery<Array<{ id: string; title: string; status: string; type: string; clientId?: string | null }>>({
    queryKey: ['encuestas-para-correo', empresa],
    queryFn: () => api.get(`/surveys${empresa ? `?clientId=${encodeURIComponent(empresa)}` : ''}`),
    enabled: alcanzaEncuestas,
  });
  const encuestasElegibles = (encuestasQuery.data ?? []).filter((encuesta) => encuesta.status === 'active' && encuesta.type === 'customer' && (!encuesta.clientId || encuesta.clientId === empresa));
  const [borrador, setBorrador] = useState<Record<string, string | number | boolean | null> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Aviso cuya vista previa está abierta. Sólo una a la vez: son pesadas y se comparan de a una. */
  const [previsualizando, setPrevisualizando] = useState<string | null>(null);
  /** Qué aviso tiene una prueba en vuelo, para deshabilitar solo su botón. */
  const [probando, setProbando] = useState<string | null>(null);
  /** Vacío significa «a mí», que es el caso normal. */
  const [destinatario, setDestinatario] = useState('');
  /** Qué avisos se listan. «pendientes» es el que importa: encendidos que no van a salir. */
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'apagados' | 'pendientes'>('todos');
  /** Vacío es «todos los módulos». */
  const [moduloElegido, setModuloElegido] = useState<'' | ModuloDeAviso>('');
  const [busqueda, setBusqueda] = useState('');

  const ajustesQuery = useQuery<Ajuste[]>({
    // La empresa forma parte de la clave: cambiarla trae otros valores, no los mismos filtrados.
    queryKey: ['ajustes-correo', empresa],
    queryFn: () => api.get(`/settings/correos${empresa ? `?clientId=${encodeURIComponent(empresa)}` : ''}`),
  });

  const equipoQuery = useQuery<Destinatario[]>({
    queryKey: ['destinatarios-de-prueba'],
    queryFn: () => api.get('/settings/destinatarios-de-prueba'),
  });

  const empresasQuery = useQuery<{ data: Empresa[] }>({
    queryKey: ['empresas-para-correo'],
    // Cien es el tope del endpoint. Con más empresas habría que paginar o buscar, pero un
    // desplegable con cien opciones ya es incómodo mucho antes de llegar a ese límite.
    queryFn: () => api.get('/clients?limit=100'),
  });

  const guardar = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.put(
      `/settings/correos${empresa ? `?clientId=${encodeURIComponent(empresa)}` : ''}`,
      { values },
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ajustes-correo'] });
      setBorrador(null);
      setAviso('Guardado. Los próximos correos usarán este texto.');
    },
    onError: (error: Error) => setAviso(error.message || 'No se pudo guardar'),
  });

  /*
    La prueba va siempre al correo de quien la pide; el servidor no acepta destinatario.

    Manda el borrador, no lo guardado: se prueba para decidir si guardar, y probar lo que ya
    está guardado no responde a esa pregunta.
  */
  /*
   * Cómo queda el correo, sin mandarlo.
   *
   * Se compone en el servidor con el mismo armazón del envío, así que lo que se ve es lo que
   * llega. Manda el borrador, no lo guardado: se mira para decidir si guardar.
   */
  const vistaPrevia = useMutation({
    mutationFn: (texto: { asunto: string; cuerpo: string }) => api.post<{ subject: string; html: string }>('/settings/correos/vista-previa', texto),
  });

  const probar = useMutation({
    mutationFn: (texto: { asunto: string; cuerpo: string; destinatarioId?: string }) =>
      api.post<{ enviado: boolean; destino: string; motivo: string | null }>('/settings/probar', texto),
    onSuccess: (respuesta) => setAviso(respuesta.enviado
      ? `Enviado a ${respuesta.destino}. Si no llega, revisa la carpeta de no deseados.`
      : respuesta.motivo ?? 'No se pudo enviar'),
    onError: (error: Error) => setAviso(error.message || 'No se pudo enviar la prueba'),
    onSettled: () => setProbando(null),
  });

  const porClave = useMemo(
    () => new Map((ajustesQuery.data ?? []).map((ajuste) => [ajuste.key, ajuste])),
    [ajustesQuery.data],
  );

  /**
   * Variables escritas que la plantilla no conoce.
   *
   * Una variable mal escrita no falla: se borra al enviar y la frase llega incompleta, así que el
   * error viaja hasta la bandeja de un cliente sin que nadie lo note. Acá se ve al escribirla.
   */
  const variablesDesconocidas = (texto: string, admitidas: string[]): string[] => [
    ...new Set([...texto.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)].map((coincidencia) => coincidencia[1])),
  ].filter((variable) => !admitidas.includes(variable));

  /** Dónde dejar el cursor en cuanto React termine de pintar el valor nuevo. */
  const cursorPendiente = useRef<{ clave: string; posicion: number } | null>(null);
  useEffect(() => {
    const pendiente = cursorPendiente.current;
    if (!pendiente) return;
    cursorPendiente.current = null;
    const campo = document.getElementById(pendiente.clave) as HTMLInputElement | HTMLTextAreaElement | null;
    campo?.focus();
    campo?.setSelectionRange(pendiente.posicion, pendiente.posicion);
  });

  const valorDe = (clave: string) => borrador?.[clave] ?? porClave.get(clave)?.value ?? '';

  /**
   * Inserta una variable **donde está el cursor**.
   *
   * Pegarla al final obligaba a cortar y pegar para ponerla en medio de la frase, que es donde
   * casi siempre va. El campo conserva el foco —el botón cancela el `mousedown`— así que se puede
   * seguir escribiendo sin volver a hacer clic.
   */
  const insertarVariable = (clave: string, variable: string) => {
    const campo = document.getElementById(clave) as HTMLInputElement | HTMLTextAreaElement | null;
    const texto = String(valorDe(clave));
    const marca = `{{${variable}}}`;
    if (!campo || campo.selectionStart === null) { editar(clave, texto + marca); return; }
    const desde = campo.selectionStart;
    const hasta = campo.selectionEnd ?? desde;
    editar(clave, texto.slice(0, desde) + marca + texto.slice(hasta));
    // El cursor se coloca después de repintar: hacerlo aquí lo pisaría React al escribir el
    // valor nuevo, y el punto de edición saltaría al final del texto.
    cursorPendiente.current = { clave, posicion: desde + marca.length };
  };

  /**
   * Requisitos de un aviso, ya resueltos a algo que se pueda leer de un vistazo.
   *
   * `cumple` en falso significa comprobado y fallando; `null`, que no se puede comprobar desde
   * acá y sólo cabe advertirlo.
   */
  const requisitosDe = (prefijo: string): Array<{ texto: string; cumple: boolean | null; enlace?: string }> => {
    const datos = requisitosQuery.data;
    if (!datos) return [];
    const lista = datos.avisos?.[prefijo] ?? [];
    const requisitos = lista.map((requisito): { texto: string; cumple: boolean | null; enlace?: string } | null => {
      /*
       * Las tareas programadas sólo se le nombran a quien puede crearlas.
       *
       * A los demás les decía que algo no se está enviando sin darles nada que hacer al respecto,
       * y aparecía en varias tarjetas a la vez: ruido en la pantalla donde se escriben los textos.
       */
      if (requisito.clave === 'cron') {
        if (!esDev) return null;
        const tarea = datos.tareas?.[requisito.tarea ?? ''];
        return {
          // El nombre de la tarea sólo le sirve a quien puede crearla; a los demás les dice a
          // quién pedirla, que es lo único que pueden hacer.
          texto: tarea?.corriendo
            ? 'Se está enviando: la tarea programada corre con normalidad'
            : `No corre la tarea programada «${requisito.tarea}»: créala en cPanel → Cron Jobs`,
          cumple: Boolean(tarea?.corriendo),
        };
      }
      // Asistencia y correos del equipo ya los explica la descripción del aviso, arriba: repetirlos
      // como advertencia llenaba la tarjeta de líneas que no piden hacer nada.
      if (requisito.clave === 'asistencia' || requisito.clave === 'equipo') return null;
      if (requisito.clave === 'encuesta') {
        const elegida = String(valorDe('email.post_visit_survey_id') ?? '');
        return {
          texto: elegida
            ? 'Encuesta elegida'
            : empresa
              ? 'Falta elegir qué encuesta se envía, en «Encuesta que se envía», más abajo'
              : 'Elige una empresa arriba para poder elegir su encuesta',
          cumple: Boolean(elegida),
        };
      }
      return null;
    }).filter((requisito): requisito is { texto: string; cumple: boolean | null; enlace?: string } => requisito !== null);
    // La casilla es común a todos: se nombra una sola vez y sólo cuando falta.
    if (datos.casilla === false) requisitos.unshift({ texto: 'La casilla que envía no está configurada', cumple: false });
    return requisitos;
  };
  /** Nulo significa «vuelve a heredar el general»; el servidor cierra el valor propio. */
  const editar = (clave: string, valor: string | number | boolean | null) => {
    setBorrador({ ...(borrador ?? {}), [clave]: valor });
    setAviso(null);
  };

  /*
   * Lo que le falta a cada aviso además de su interruptor.
   *
   * El servidor sabe si la casilla envía y si cada tarea programada corrió hace poco; lo demás
   * —la asistencia de una reserva— sólo se puede advertir. Un aviso encendido que depende de una
   * tarea inexistente no sale nunca y hasta ahora se veía igual que uno funcionando.
   */
  const requisitosQuery = useQuery<{ casilla: boolean; tareas: Record<string, { ultima: string | null; corriendo: boolean }>; avisos: Record<string, Array<{ clave: string; tarea?: string }>> }>({
    queryKey: ['requisitos-de-correo'],
    queryFn: () => api.get('/settings/correos/requisitos'),
  });

  const estadoQuery = useQuery({
    queryKey: ['estado-del-correo'],
    queryFn: () => api.get<{ habilitado: boolean; remitente: string | null; servidor: string | null; puerto: number | null; respuestasA: string | null; faltan: string[] }>('/settings/estado-del-correo'),
  });

  /*
   * Con una empresa elegida se listan sólo los módulos que ella tiene contratados.
   *
   * Editar la plantilla de CRM de una empresa que no contrató CRM es trabajo que no llega a
   * nadie, y llena la pantalla de avisos que nunca van a salir para esa cuenta. Lo de Espartanos
   * —la cobranza— no depende de eso: va de la agencia hacia ella.
   *
   * En «General» se muestran todos: esa plantilla la heredan todas las empresas.
   */
  const contratados = (empresasQuery.data?.data ?? []).find((cliente) => cliente.id === empresa)?.capabilities;
  const modulosVisibles = MODULOS.filter((modulo) => {
    if (!empresa || !modulo.servicio || !contratados) return true;
    return contratados[modulo.servicio] !== false;
  });
  const clavesVisibles = new Set(modulosVisibles.map((modulo) => modulo.clave));

  /** Un aviso encendido al que le falta algo comprobable: está prendido y no sale. */
  const tieneAlgoPendiente = (prefijo: string) => Boolean(valorDe(`${prefijo}_enabled`))
    && requisitosDe(prefijo).some((requisito) => requisito.cumple === false);

  const visibles = AVISOS.filter((grupo) => {
    if (!porClave.get(`${grupo.prefijo}_enabled`)) return false;
    const activo = Boolean(valorDe(`${grupo.prefijo}_enabled`));
    if (filtro === 'activos' && !activo) return false;
    if (filtro === 'apagados' && activo) return false;
    if (filtro === 'pendientes' && !tieneAlgoPendiente(grupo.prefijo)) return false;
    if (!clavesVisibles.has(grupo.modulo)) return false;
    if (moduloElegido && grupo.modulo !== moduloElegido) return false;
    const texto = busqueda.trim().toLowerCase();
    if (texto && !`${grupo.titulo} ${grupo.explica}`.toLowerCase().includes(texto)) return false;
    return true;
  });

  const conInterruptor = AVISOS.filter((grupo) => porClave.get(`${grupo.prefijo}_enabled`) && clavesVisibles.has(grupo.modulo));
  const activos = conInterruptor.filter((grupo) => Boolean(valorDe(`${grupo.prefijo}_enabled`))).length;
  const pendientes = conInterruptor.filter((grupo) => tieneAlgoPendiente(grupo.prefijo)).length;

  if (ajustesQuery.isLoading) return <LoadingSpinner />;

  return (
    <section className="panel-correo">
      <header>
        <div>
          <h2>Correos automáticos</h2>
          <p>
            Se escribe texto con variables, nunca HTML: el diseño y la marca los pone el sistema.
            Una variable sin valor se borra al enviar, así que la frase queda incompleta pero
            nunca se ve <code>{'{{nombre}}'}</code> en la bandeja de nadie.
          </p>
        </div>
        <label className="panel-correo-empresa">
          <span>Plantilla de</span>
          <select
            className="input"
            value={empresa}
            onChange={(evento) => { setEmpresa(evento.target.value); setBorrador(null); setAviso(null); }}
          >
            <option value="">General (todas las empresas)</option>
            {(empresasQuery.data?.data ?? []).map((cliente) => (
              <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
            ))}
          </select>
        </label>
      </header>

      {/*
        * Dónde se configura cada cosa.
        *
        * Los tres pasos son el montaje del sistema y los da desarrollo. Quien entra a escribir los
        * textos ya tiene la pantalla delante: repetirle que los escriba aquí es ruido, y las otras
        * dos cosas no las puede tocar. Lo único que sí necesita saber es si los avisos están
        * saliendo, porque de eso depende que lo que escriba llegue a alguien; eso se conserva en
        * una línea, abajo.
        */}
      {esDev && <section className="panel-correo-guia" aria-label="Cómo se configuran los correos">
        <div className={`panel-correo-paso ${estadoQuery.isLoading ? '' : estadoQuery.data?.habilitado ? 'is-listo' : 'is-pendiente'}`} aria-busy={estadoQuery.isLoading}>
          <span>1</span>
          <div>
            <strong>Casilla que envía {estadoQuery.isLoading ? '· revisando…' : estadoQuery.isError ? '· no se pudo revisar' : estadoQuery.data?.habilitado ? '· lista' : esDev ? '· falta configurar' : '· aún no está activa'}</strong>
            {estadoQuery.data?.habilitado
              ? <small>Los correos salen desde <b>{estadoQuery.data.remitente}</b> ({estadoQuery.data.servidor}:{estadoQuery.data.puerto}). Es la misma para todas las empresas y sucursales.</small>
              : esDev
                ? <small>Crea una casilla en cPanel → Cuentas de correo (por ejemplo reservas@espartanos.cl) y en cPanel → Setup Node.js App → Environment variables agrega: <code>SMTP_ENABLED=true</code>, <code>SMTP_HOST=mail.espartanos.cl</code>, <code>SMTP_PORT=465</code>, <code>SMTP_SECURE=true</code>, <code>SMTP_USER</code> y <code>SMTP_FROM</code> con esa casilla, y <code>SMTP_PASSWORD</code> con su contraseña. Luego reinicia la aplicación.{estadoQuery.data?.faltan?.length ? ` Falta: ${estadoQuery.data.faltan.join(', ')}.` : ''}</small>
                : <small>Todavía no está activa, así que los avisos no se envían. La activa el equipo de Espartanos; mientras tanto puedes dejar escritos los textos de abajo.</small>}
          </div>
        </div>
        <div className="panel-correo-paso is-listo">
          <span>2</span>
          <div><strong>Qué dice cada correo · aquí</strong><small>Enciende y escribe los avisos de abajo: confirmación, recordatorio, cambios y encuesta después de la visita. Puedes tener una versión por empresa.</small></div>
        </div>
        <div className="panel-correo-paso is-listo">
          <span>3</span>
          <div><strong>Respuestas y avisos de cada sucursal · en la sucursal</strong><small>A qué correo del local llegan las respuestas de los clientes y quién del equipo recibe el aviso de cada reserva nueva: Reservas → sucursal → Datos del local y textos legales → Correos.</small></div>
        </div>
      </section>}


      {empresa ? (
        <p className="panel-correo-nota">
          Lo que no cambies acá sigue usando la plantilla general. Guardar solo afecta a esta
          empresa.
        </p>
      ) : null}

      {aviso ? <div className="alert alert-success" role="status">{aviso}</div> : null}

      {/*
        * Cuántos están encendidos y cuántos no van a salir.
        *
        * Recorrer diecisiete tarjetas para saberlo era el trabajo que nadie hacía, así que un
        * aviso apagado de hecho podía quedarse así durante meses.
        */}
      <div className="panel-correo-resumen">
        <span><strong>{activos}</strong> de {conInterruptor.length} encendidos</span>
        {pendientes > 0 && <button type="button" className={`panel-correo-pendientes${filtro === 'pendientes' ? ' es-activo' : ''}`} onClick={() => setFiltro(filtro === 'pendientes' ? 'todos' : 'pendientes')}>
          <strong>{pendientes}</strong> encendido{pendientes === 1 ? '' : 's'} que no {pendientes === 1 ? 'sale' : 'salen'}
        </button>}
        <div className="panel-correo-filtros">
          <input className="input" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar aviso…" aria-label="Buscar aviso" />
          <select className="input" value={moduloElegido} onChange={(evento) => setModuloElegido(evento.target.value as '' | ModuloDeAviso)} aria-label="Filtrar por módulo">
            <option value="">Todos los módulos</option>
            {modulosVisibles.map((modulo) => <option key={modulo.clave} value={modulo.clave}>{modulo.titulo}</option>)}
          </select>
          <select className="input" value={filtro} onChange={(evento) => setFiltro(evento.target.value as typeof filtro)} aria-label="Filtrar avisos">
            <option value="todos">Todos</option>
            <option value="activos">Encendidos</option>
            <option value="apagados">Apagados</option>
            <option value="pendientes">Con algo pendiente</option>
          </select>
        </div>
      </div>

      {visibles.length === 0 && <p className="panel-correo-nota">Ningún aviso coincide con el filtro.</p>}

      {modulosVisibles.map((modulo) => {
        const delModulo = visibles.filter((grupo) => grupo.modulo === modulo.clave);
        if (delModulo.length === 0) return null;
        return <section key={modulo.clave} className="panel-correo-modulo">
          <h3>{modulo.titulo} <small>{modulo.explica}</small></h3>
          {delModulo.map((grupo) => {
        const encendido = porClave.get(`${grupo.prefijo}_enabled`)!;
        const activo = Boolean(valorDe(encendido.key));
        const requisitos = requisitosDe(grupo.prefijo);

        return (
          <article key={grupo.prefijo} className={`panel-correo-aviso${activo ? ' esta-activo' : ''}`}>
            <header>
              <label>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={() => editar(encendido.key, !activo)}
                />
                <strong>{grupo.titulo}</strong>
              </label>
              {porClave.get(`${grupo.prefijo}_subject`)?.source === 'client' ? (
                <em className="panel-correo-propio">Propia de esta empresa</em>
              ) : null}
            </header>
            <p>{grupo.explica}</p>
            {/* Sólo cuando está encendido: apagado, lo que le falte no cambia nada. */}
            {activo && requisitos.some((requisito) => requisito.cumple === false) && <ul className="panel-correo-requisitos">
              {requisitos.filter((requisito) => requisito.cumple === false).map((requisito) => <li key={requisito.texto} className="falta">
                <span aria-hidden="true">✕</span>{requisito.texto}
                {requisito.enlace && <Link to={requisito.enlace}>Resolverlo</Link>}
              </li>)}
            </ul>}

            {/*
              Los textos solo se muestran cuando el aviso está encendido. Apagado, son campos que
              no afectan a nada y llenan la pantalla de cajas que nadie va a leer.
            */}
            {activo ? (
              <div className="panel-correo-campos">
                {porClave.get(`${grupo.prefijo}_id`) && grupo.prefijo === 'email.post_visit_survey' ? (() => {
                  const ajuste = porClave.get(`${grupo.prefijo}_id`)!;
                  const elegida = String(valorDe(ajuste.key) ?? '');
                  const vigente = encuestasElegibles.some((encuesta) => encuesta.id === elegida);
                  return (
                    <label key={ajuste.key}>
                      <span>Encuesta que se envía</span>
                      {!empresa ? (
                        <small>Elige una empresa arriba: cada empresa envía su propia encuesta.</small>
                      ) : (
                        <>
                          <select className="input" value={elegida} onChange={(evento) => editar(ajuste.key, evento.target.value)}>
                            <option value="">— Ninguna: no se envía —</option>
                            {encuestasElegibles.map((encuesta) => <option key={encuesta.id} value={encuesta.id}>{encuesta.title}</option>)}
                          </select>
                          {elegida && !vigente && !encuestasQuery.isLoading ? <small className="error-text">La encuesta elegida ya no está activa o no es de esta empresa: no se enviará nada hasta elegir otra.</small> : null}
                          <small>Es la de toda la empresa. Cada sucursal puede elegir otra en Reservas → sucursal → Datos del local y textos legales.</small>
                          {encuestasElegibles.length === 0 && !encuestasQuery.isLoading ? <small>{alcanzaEncuestas ? 'Esta empresa no tiene encuestas activas de clientes. Crea una en Encuestas, con una pregunta de estrellas.' : 'No alcanzas el módulo de Encuestas, así que no se puede elegir cuál se envía. El texto de abajo sí se guarda.'}</small> : null}
                        </>
                      )}
                    </label>
                  );
                })() : null}
                {['subject', 'body', 'hours'].map((sufijo) => {
                  const ajuste = porClave.get(`${grupo.prefijo}_${sufijo}`);
                  if (!ajuste) return null;
                  const variables = variablesDe(ajuste.description);

                  return (
                    <label key={ajuste.key}>
                      <span>{ajuste.label.split('·')[1]?.trim() ?? ajuste.label}</span>
                      {ajuste.valueType === 'number' ? (
                        <input
                          className="input"
                          type="number"
                          min={ajuste.min}
                          max={ajuste.max}
                          value={String(valorDe(ajuste.key))}
                          onChange={(evento) => editar(ajuste.key, Number(evento.target.value))}
                        />
                      ) : sufijo === 'body' ? (
                        <CuerpoConVariables
                          id={ajuste.key}
                          valor={String(valorDe(ajuste.key))}
                          admitidas={variables}
                          onCambio={(texto) => editar(ajuste.key, texto)}
                        />
                      ) : (
                        <input
                          className="input"
                          id={ajuste.key}
                          value={String(valorDe(ajuste.key))}
                          onChange={(evento) => editar(ajuste.key, evento.target.value)}
                        />
                      )}
                      {/*
                        Las variables se listan y se pueden pulsar para insertarlas: escribirlas a
                        mano es donde aparecen las erratas, y una variable mal escrita no falla
                        —se borra al enviar— así que nadie se entera hasta que falta un dato.
                      */}
                      {(() => {
                        const desconocidas = variables.length > 0 ? variablesDesconocidas(String(valorDe(ajuste.key)), variables) : [];
                        return desconocidas.length > 0 ? (
                          <small className="panel-correo-desconocidas">
                            {desconocidas.map((variable) => `{{${variable}}}`).join(', ')} no {desconocidas.length === 1 ? 'existe' : 'existen'} en este correo: al enviar se {desconocidas.length === 1 ? 'borra' : 'borran'} y la frase queda incompleta.
                          </small>
                        ) : null;
                      })()}
                      {empresa && ajuste.source === 'client' ? (
                        <button
                          type="button"
                          className="panel-correo-heredar"
                          onClick={() => editar(ajuste.key, null)}
                        >
                          Propio de esta empresa · volver al general
                        </button>
                      ) : null}
                      {variables.length > 0 ? (
                        <small className="panel-correo-variables">
                          <span>Insertar:</span>
                          {variables.map((variable) => (
                            <button
                              key={variable}
                              type="button"
                              title={EXPLICA_VARIABLE[variable]
                                ? `${EXPLICA_VARIABLE[variable]} · Se inserta donde está el cursor.`
                                : `Insertar {{${variable}}} donde está el cursor`}
                              // Sin esto el campo pierde el foco al pulsar y se pierde la posición del cursor.
                              onMouseDown={(evento) => evento.preventDefault()}
                              onClick={() => insertarVariable(ajuste.key, variable)}
                            >
                              <b>{ETIQUETAS_DE_VARIABLE[variable] ?? variable}</b>
                              <code>{`{{${variable}}}`}</code>
                            </button>
                          ))}
                          {/* De dónde sale cada dato: sin esto, «{{local}}» no dice cuál de las sucursales. */}
                          <span className="panel-correo-variables-nota">Se llenan con los datos de la reserva de quien recibe: su local, su fecha, su código.</span>
                        </small>
                      ) : ajuste.unit ? <small>{ajuste.unit}</small> : null}
                    </label>
                  );
                })}
                {/*
                  A quién llega la prueba.

                  Se elige de la lista del equipo, no se escribe: un campo libre convertiría
                  esta pantalla en un formulario para mandar correo con la marca de la agencia a
                  cualquier dirección, desde una cuenta del dominio propio.
                */}
                <div className="panel-correo-envio">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      if (previsualizando === grupo.prefijo) { setPrevisualizando(null); return; }
                      setPrevisualizando(grupo.prefijo);
                      vistaPrevia.mutate({ asunto: String(valorDe(`${grupo.prefijo}_subject`)), cuerpo: String(valorDe(`${grupo.prefijo}_body`)) });
                    }}
                  >
                    {previsualizando === grupo.prefijo ? 'Ocultar vista previa' : 'Ver cómo queda'}
                  </button>
                <label className="panel-correo-destinatario">
                  <span>Enviar la prueba a</span>
                  <select
                    className="input"
                    value={destinatario}
                    onChange={(evento) => setDestinatario(evento.target.value)}
                  >
                    <option value="">A mí</option>
                    {(equipoQuery.data ?? []).map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name} — {persona.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-outline panel-correo-probar"
                  disabled={probando !== null}
                  onClick={() => {
                    setProbando(grupo.prefijo);
                    probar.mutate({
                      destinatarioId: destinatario || undefined,
                      asunto: String(valorDe(`${grupo.prefijo}_subject`) || grupo.titulo),
                      cuerpo: String(valorDe(`${grupo.prefijo}_body`) || ""),
                    });
                  }}
                >
                  {probando === grupo.prefijo ? "Enviando..." : "Enviar una prueba"}
                </button>
                </div>

                {/*
                  * El correo tal como llega, con su diseño.
                  *
                  * En un marco aislado: el correo trae sus propios estilos y sueltos pisarían los de
                  * la aplicación. Se compone en el servidor con el mismo armazón del envío.
                  */}
                {previsualizando === grupo.prefijo && <div className="panel-correo-vista-previa">
                  {vistaPrevia.isPending && <p>Componiendo…</p>}
                  {vistaPrevia.error && <p className="error-text">{(vistaPrevia.error as Error).message}</p>}
                  {vistaPrevia.data && <>
                    <p><span>Asunto</span><strong>{vistaPrevia.data.subject}</strong></p>
                    <iframe title={`Vista previa de ${grupo.titulo}`} srcDoc={vistaPrevia.data.html} sandbox="" />
                    <small>Las variables van con datos de ejemplo. El correo real usa los de cada reserva.</small>
                  </>}
                </div>}
              </div>
            ) : null}
          </article>
        );
          })}
        </section>;
      })}

      <footer className="panel-correo-acciones">
        <button
          type="button"
          className="btn btn-accent"
          disabled={borrador === null || guardar.isPending}
          onClick={() => guardar.mutate(borrador ?? {})}
        >
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={borrador === null || guardar.isPending}
          onClick={() => { setBorrador(null); setAviso(null); }}
        >
          Descartar cambios
        </button>
        <small>
          Los avisos se enviarán cuando el servicio de correo del sistema esté configurado y el
          interruptor de esta plantilla esté encendido.
        </small>
      </footer>
    </section>
  );
}
