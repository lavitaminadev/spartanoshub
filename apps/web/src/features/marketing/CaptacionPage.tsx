import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { rutaDocumentoLegal } from '@espartanos/shared';

interface DatosDeCaptacion { local: string; texto: string; red?: string }
interface Resultado { estado: 'alta' | 'omitida' | 'local' | 'todas'; local: string }

/**
 * Suscribirse a la lista de un local sin reservar: el QR de la carta, el cartel del mesón.
 *
 * Era el tercer camino que faltaba. Una dirección sólo entraba marcando la casilla al reservar o
 * importando un archivo con su procedencia declarada; quien quería recibir las promociones sin
 * tener una reserva en curso no tenía por dónde.
 *
 * Todo lo que la hace defendible lo pone el servidor: el texto que se acepta viene de la identidad
 * legal del local —uno escrito acá no probaría nada, porque se puede cambiar desde el navegador—,
 * y al enviar se guarda ese texto, la fecha y la IP, y se consulta la lista de exclusión antes de
 * crear nada. Una página de captación sin eso es la forma más rápida de llenar una lista de
 * direcciones que no se pueden defender ante un reclamo.
 */
export function CaptacionPage() {
  const { slug = '' } = useParams();
  /*
   * De qué sitio llegó: el QR de la carta, el del mesón, el enlace del Instagram.
   *
   * Se leen las UTM de siempre y no unos nombres propios, porque es el mismo panel de compartir
   * que genera los enlaces de reservas y de encuestas: así un «QR de mesa» se llama igual en los
   * tres informes y se pueden comparar. Sin esto, todas las altas quedaban escritas igual y la
   * pregunta del local —cuál de los dos carteles trae gente— no tenía respuesta.
   */
  const [parametros] = useSearchParams();
  const canal = parametros.get('utm_source') ?? undefined;
  const campana = parametros.get('utm_campaign') ?? undefined;
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [cumple, setCumple] = useState('');
  const [mayor, setMayor] = useState(false);
  const [acepta, setAcepta] = useState(false);
  // Campo trampa: invisible para una persona, irresistible para un robot.
  const [website, setWebsite] = useState('');

  const { data, isLoading, error } = useQuery<DatosDeCaptacion>({
    queryKey: ['captacion', slug],
    queryFn: () => api.get(`/public/reservations/${encodeURIComponent(slug)}/captacion`),
    enabled: Boolean(slug),
    retry: false,
  });

  const suscribir = useMutation<Resultado>({
    mutationFn: () => api.post(`/public/reservations/${encodeURIComponent(slug)}/suscribirse`, {
      email: email.trim(),
      name: nombre.trim() || undefined,
      birthDate: cumple || undefined,
      adultDeclared: mayor,
      website: website || undefined,
      canal,
      campana,
    }),
  });

  if (isLoading) return <main className="captacion"><p>Cargando…</p></main>;
  if (error || !data) {
    return (
      <main className="captacion">
        <h1>Este enlace no está disponible</h1>
        <p>Puede que el local haya dejado de usarlo. Si llegaste por un código QR, pregunta en el mesón.</p>
      </main>
    );
  }

  if (suscribir.isSuccess) {
    const { estado } = suscribir.data;
    return (
      <main className="captacion">
        {estado === 'alta' ? <>
          <h1>Listo</h1>
          <p>Vas a recibir las novedades de {data.local}.</p>
          <p className="captacion-nota">
            Puedes salirte cuando quieras desde el enlace que lleva cada correo abajo del todo. No
            hace falta escribirle a nadie.
          </p>
        </> : <>
          {/* Pidió no recibir antes. No se le vuelve a suscribir en silencio: el artículo 28 B
              dice que tras la petición los envíos quedan prohibidos, y una casilla marcada en
              otra página no es la misma persona diciendo que cambió de opinión. */}
          <h1>Ya nos habías pedido que no te escribiéramos</h1>
          <p>
            {estado === 'todas'
              ? 'Pediste no recibir correos comerciales de ninguno de nuestros locales, así que no te volvimos a sumar.'
              : `Pediste no recibir correos comerciales de ${data.local}, así que no te volvimos a sumar.`}
          </p>
          <p className="captacion-nota">
            Si cambiaste de opinión, escríbenos y lo arreglamos. Preferimos preguntártelo a darlo
            por hecho.
          </p>
        </>}
      </main>
    );
  }

  const puedeEnviar = email.includes('@') && acepta && !suscribir.isPending;

  return (
    <main className="captacion">
      <h1>Novedades de {data.local}</h1>
      <p>Déjanos tu correo y te contamos lo que vale la pena.</p>

      <form onSubmit={(evento) => { evento.preventDefault(); suscribir.mutate(); }}>
        <label>
          Correo <span className="required-star">*</span>
          <input className="input" type="email" required value={email} onChange={(evento) => setEmail(evento.target.value)} placeholder="tu@correo.cl" />
        </label>
        <label>
          Nombre <small>(opcional)</small>
          <input className="input" value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Cómo te llamamos" />
        </label>
        {/* El cumpleaños sólo sirve si el local manda el beneficio; por eso se pide y no se exige. */}
        <label>
          Tu cumpleaños <small>(opcional)</small>
          <input className="input" type="date" value={cumple} onChange={(evento) => setCumple(evento.target.value)} />
        </label>

        {/* El campo trampa: oculto a la vista y al lector de pantalla, sin autocompletado. */}
        <input
          type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          className="captacion-trampa" value={website} onChange={(evento) => setWebsite(evento.target.value)}
        />

        <div className="captacion-consent">
          <label>
            <input type="checkbox" checked={acepta} onChange={(evento) => setAcepta(evento.target.checked)} />
            <span>Quiero recibir las novedades y beneficios de {data.local} <span className="required-star">*</span></span>
          </label>
          <details><summary>Ver qué estoy aceptando</summary><p>{data.texto}</p></details>
        </div>

        <div className="captacion-consent">
          <label>
            <input type="checkbox" checked={mayor} onChange={(evento) => setMayor(evento.target.checked)} />
            <span>Declaro ser mayor de 18 años <small>(opcional)</small></span>
          </label>
        </div>

        {suscribir.isError && <p className="error-text">No se pudo completar. Inténtalo de nuevo en un momento.</p>}

        <button type="submit" className="btn btn-primary" disabled={!puedeEnviar}>
          {suscribir.isPending ? 'Enviando…' : 'Quiero recibirlas'}
        </button>
      </form>

      <p className="captacion-nota">
        Cada correo lleva abajo un enlace para dejar de recibirlos, y funciona sin tener cuenta.
        {' '}<a href={rutaDocumentoLegal('privacidad')} target="_blank" rel="noopener">Política de privacidad</a>
      </p>
    </main>
  );
}
