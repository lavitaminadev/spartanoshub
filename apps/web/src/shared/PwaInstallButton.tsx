import { useEffect, useState } from 'react';
import {
  esSafariDeApple, estaInstalada, fueDescartada, olvidarDescarteSiLaQuitaron,
  recordarDescarte, recordarInstalacion,
} from './instalacion-pwa';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Ofrecer instalar la aplicación, según lo que el dispositivo permita.
 *
 * Hay dos mundos y no se parecen. En Android y escritorio el navegador avisa de que el sitio es
 * instalable y deja abrir su propio diálogo, así que basta con capturar ese aviso y ofrecer un
 * botón. **Safari no implementa nada de eso**: no avisa, no hay diálogo que abrir, y la única vía
 * es que la persona use Compartir → «Añadir a pantalla de inicio». Lo único que se puede hacer
 * ahí es explicárselo.
 *
 * Y en los dos casos se calla cuando toca: si ya está instalada, o si alguien dijo que no.
 */
export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(() => estaInstalada());
  const [descartada, setDescartada] = useState(() => fueDescartada());
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState(false);

  useEffect(() => {
    const capturar = (evento: Event) => {
      evento.preventDefault();
      /*
       * El navegador ofrece instalarla en cada carga, así que este aviso por sí solo no dice
       * nada nuevo. Solo si antes llegó a estar instalada significa que la quitaron, y entonces
       * el «no, gracias» anterior describe una situación que ya no existe.
       */
      if (olvidarDescarteSiLaQuitaron()) setDescartada(false);
      setInstalada(false);
      setPromptEvent(evento as InstallPromptEvent);
    };
    const marcarInstalada = () => {
      // Se deja constancia para poder notar más adelante que la quitaron, que es lo único que
      // justifica volver a preguntar a quien ya dijo que no.
      recordarInstalacion();
      setInstalada(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', capturar);
    window.addEventListener('appinstalled', marcarInstalada);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturar);
      window.removeEventListener('appinstalled', marcarInstalada);
    };
  }, []);

  const decirQueNo = () => {
    recordarDescarte();
    setDescartada(true);
    setInstruccionesAbiertas(false);
  };

  if (instalada || descartada) return null;

  /*
   * En Safari no hay botón que valga: hay un gesto que explicar.
   *
   * Se muestra solo en Safari y no en Chrome de iPhone, que usa el mismo motor pero no ofrece
   * añadir a la pantalla de inicio: ahí las instrucciones mandarían a buscar algo inexistente.
   */
  if (!promptEvent) {
    if (!esSafariDeApple()) return null;
    return (
      <div className="pwa-install-button pwa-install-apple">
        <button type="button" onClick={() => setInstruccionesAbiertas(!instruccionesAbiertas)}>
          <span>Instalar Espartanos</span>
          <small>Cómo añadirla a tu pantalla de inicio</small>
        </button>
        {instruccionesAbiertas ? (
          <div className="pwa-install-pasos">
            <ol>
              <li>Toca <strong>Compartir</strong>, el cuadrado con la flecha hacia arriba.</li>
              <li>Baja y elige <strong>Añadir a pantalla de inicio</strong>.</li>
              <li>Confirma con <strong>Añadir</strong>.</li>
            </ol>
            <button type="button" className="pwa-install-no" onClick={decirQueNo}>No, gracias</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pwa-install-button">
      <button
        type="button"
        onClick={async () => {
          await promptEvent.prompt();
          const eleccion = await promptEvent.userChoice;
          // Rechazar el diálogo del navegador no es decir «nunca más»: puede haberlo cerrado sin
          // querer, y el propio navegador lo volverá a ofrecer más adelante.
          if (eleccion.outcome === 'accepted') setPromptEvent(null);
        }}
      >
        <span>Instalar Espartanos</span>
        <small>Usar como app en este equipo</small>
      </button>
      {/* Decir que no tiene que costar un clic, o se convierte en algo que se ignora cada vez. */}
      <button type="button" className="pwa-install-no" onClick={decirQueNo}>No, gracias</button>
    </div>
  );
}
