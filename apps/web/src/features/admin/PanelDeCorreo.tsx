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

import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
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

interface Empresa { id: string; name: string }

/** Alguien del equipo que puede recibir una prueba. */
interface Destinatario { id: string; name: string; email: string }

/**
 * Los avisos, en el orden en que conviene mirarlos.
 *
 * El prefijo agrupa las claves de cada uno —`email.daily_digest_*`— y el rótulo es el que se
 * muestra. Va escrito acá y no derivado de las claves porque el orden es una decisión editorial:
 * primero lo que le llega a un cliente, después lo interno.
 */
const AVISOS: Array<{ prefijo: string; titulo: string; explica: string }> = [
  {
    prefijo: 'email.reservation_confirmation',
    titulo: 'Confirmación de reserva',
    explica: 'Se envía al instante a quien reserva. Es su comprobante: sin él no tiene fecha ni código.',
  },
  {
    prefijo: 'email.reservation_reminder',
    titulo: 'Recordatorio de reserva',
    explica: 'La víspera, o con la anticipación que elijas. Es la medida que más reduce las ausencias.',
  },
  {
    prefijo: 'email.birthday',
    titulo: 'Saludo de cumpleaños',
    explica: 'Solo a quien dio su fecha y está suscrito. Lleva enlace de baja como todo correo comercial.',
  },
  {
    prefijo: 'email.daily_digest',
    titulo: 'Resumen diario del CRM',
    explica: 'Un correo por la mañana a cada responsable. Solo se envía si tiene algo que leer.',
  },
  {
    prefijo: 'email.task_reminder',
    titulo: 'Recordatorio de tareas',
    explica: 'Doce y tres horas antes. El de doce se omite si la tarea nació con menos margen.',
  },
  {
    prefijo: 'email.new_lead',
    titulo: 'Aviso de lead nuevo',
    explica: 'Al responsable, indicando de dónde viene.',
  },
  {
    prefijo: 'email.idle_lead',
    titulo: 'Aviso de lead parado',
    explica: 'Por correo además de en la aplicación. El resumen diario ya lo cuenta, así que suele sobrar.',
  },
];

/** Las variables que admite una plantilla, sacadas de su propia descripción. */
function variablesDe(descripcion: string): string[] {
  return [...descripcion.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)].map((m) => m[1]);
}

export function PanelDeCorreo(): JSX.Element {
  const queryClient = useQueryClient();
  /** Vacío significa «la plantilla general», la que usa quien no tenga la suya. */
  const [empresa, setEmpresa] = useState('');
  const [borrador, setBorrador] = useState<Record<string, string | number | boolean> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Qué aviso tiene una prueba en vuelo, para deshabilitar solo su botón. */
  const [probando, setProbando] = useState<string | null>(null);
  /** Vacío significa «a mí», que es el caso normal. */
  const [destinatario, setDestinatario] = useState('');

  const ajustesQuery = useQuery<Ajuste[]>({
    // La empresa forma parte de la clave: cambiarla trae otros valores, no los mismos filtrados.
    queryKey: ['ajustes-correo', empresa],
    queryFn: () => api.get(`/settings${empresa ? `?clientId=${encodeURIComponent(empresa)}` : ''}`),
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
      `/settings${empresa ? `?clientId=${encodeURIComponent(empresa)}` : ''}`,
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

  const valorDe = (clave: string) => borrador?.[clave] ?? porClave.get(clave)?.value ?? '';
  const editar = (clave: string, valor: string | number | boolean) => {
    setBorrador({ ...(borrador ?? {}), [clave]: valor });
    setAviso(null);
  };

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

      {empresa ? (
        <p className="panel-correo-nota">
          Lo que no cambies acá sigue usando la plantilla general. Guardar solo afecta a esta
          empresa.
        </p>
      ) : null}

      {aviso ? <div className="alert alert-success" role="status">{aviso}</div> : null}

      {AVISOS.map((grupo) => {
        const encendido = porClave.get(`${grupo.prefijo}_enabled`);
        if (!encendido) return null;
        const activo = Boolean(valorDe(encendido.key));

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

            {/*
              Los textos solo se muestran cuando el aviso está encendido. Apagado, son campos que
              no afectan a nada y llenan la pantalla de cajas que nadie va a leer.
            */}
            {activo ? (
              <div className="panel-correo-campos">
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
                        <textarea
                          className="input"
                          rows={6}
                          value={String(valorDe(ajuste.key))}
                          onChange={(evento) => editar(ajuste.key, evento.target.value)}
                        />
                      ) : (
                        <input
                          className="input"
                          value={String(valorDe(ajuste.key))}
                          onChange={(evento) => editar(ajuste.key, evento.target.value)}
                        />
                      )}
                      {/*
                        Las variables se listan y se pueden pulsar para insertarlas: escribirlas a
                        mano es donde aparecen las erratas, y una variable mal escrita no falla
                        —se borra al enviar— así que nadie se entera hasta que falta un dato.
                      */}
                      {variables.length > 0 ? (
                        <small className="panel-correo-variables">
                          {variables.map((variable) => (
                            <button
                              key={variable}
                              type="button"
                              onClick={() => editar(ajuste.key, `${String(valorDe(ajuste.key))}{{${variable}}}`)}
                            >
                              {`{{${variable}}}`}
                            </button>
                          ))}
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
              </div>
            ) : null}
          </article>
        );
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
          Ningún correo sale si <code>SMTP_ENABLED</code> está apagado en el servidor, aunque el
          aviso esté encendido acá.
        </small>
      </footer>
    </section>
  );
}
