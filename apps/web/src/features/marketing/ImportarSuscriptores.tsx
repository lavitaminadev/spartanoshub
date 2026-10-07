import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';

/** Lo que el servidor cuenta de vuelta, para poder decirle a quien subió el archivo qué pasó. */
interface ResultadoDeImportacion {
  creados: number;
  actualizados: number;
  respetadosDeBaja: number;
  excluidos: number;
  descartados: Array<{ linea: number; motivo: string }>;
  /** Columnas del archivo que no se usaron. */
  ignoradas: string[];
  /** Qué encabezado se reconoció para cada dato. */
  reconocidas: { email: string; nombre?: string; consentimiento?: string };
}

/**
 * Subir una lista de correos declarando de dónde salió.
 *
 * El origen es obligatorio y no es burocracia: la Ley 19.628 exige poder demostrar la procedencia
 * de cada dirección, y «estaba en un Excel» no es una respuesta. Sin ese dato la importación no
 * se envía, porque una lista sin procedencia no se puede defender después.
 *
 * El texto del consentimiento es opcional pero pesa: si el archivo no trae una columna que diga
 * qué aceptó cada persona, lo que se escriba aquí es la única prueba. Sin ninguna de las dos
 * cosas, las filas entran en «pendiente» y ninguna campaña las alcanza.
 */
export function ImportarSuscriptores({ empresas }: { empresas: Array<{ id: string; name: string }> }) {
  const [abierto, setAbierto] = useState(false);
  const [contenido, setContenido] = useState('');
  const [origen, setOrigen] = useState('');
  const [detalle, setDetalle] = useState('');
  const [textoConsentimiento, setTextoConsentimiento] = useState('');
  const [empresa, setEmpresa] = useState('');
  const clienteDeConsultas = useQueryClient();

  const importar = useMutation<ResultadoDeImportacion>({
    mutationFn: () => api.post('/marketing/suscriptores/importar', {
      contenido,
      origen: origen.trim(),
      detalle: detalle.trim() || undefined,
      textoConsentimiento: textoConsentimiento.trim() || undefined,
      // Vacío es la lista de la agencia, que en la base es una ficha sin empresa.
      clientId: empresa || null,
    }),
    onSuccess: () => void clienteDeConsultas.invalidateQueries({ queryKey: ['suscriptores'] }),
  });

  const cerrar = () => {
    setAbierto(false);
    importar.reset();
    setContenido(''); setOrigen(''); setDetalle(''); setTextoConsentimiento(''); setEmpresa('');
  };

  const leerArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setContenido(await archivo.text());
    // El nombre del archivo es la mejor pista de la procedencia, y nadie la escribe dos veces.
    if (!detalle.trim()) setDetalle(archivo.name);
  };

  const resultado = importar.data;

  return <>
    <button type="button" className="btn btn-outline" onClick={() => setAbierto(true)}>Importar una lista</button>

    <Modal open={abierto} onClose={cerrar} title="Importar una lista de correos">
      {resultado ? (
        <div className="importacion-resultado">
          <p className="importacion-cifras">
            <strong>{resultado.creados}</strong> nuevos · <strong>{resultado.actualizados}</strong> actualizados
          </p>
          {resultado.respetadosDeBaja > 0 && (
            <p className="importacion-nota">
              {resultado.respetadosDeBaja} ya se habían dado de baja en esta lista y se quedaron como estaban.
            </p>
          )}
          {resultado.excluidos > 0 && (
            <p className="importacion-nota es-aviso">
              {resultado.excluidos} habían pedido no recibir nunca más, así que no entraron. Si son
              muchos, conviene revisar de dónde salió este archivo.
            </p>
          )}
          {/*
            * Qué columna se usó para cada dato.
            *
            * Va antes que los descartes porque responde la duda más cara: si el consentimiento
            * no se reconoció, nadie quedó marcado como que aceptó y la importación igual dice
            * que salió bien.
            */}
          <p className="importacion-nota">
            Se usó <strong>«{resultado.reconocidas.email}»</strong> como correo
            {resultado.reconocidas.nombre ? <>, <strong>«{resultado.reconocidas.nombre}»</strong> como nombre</> : null}
            {resultado.reconocidas.consentimiento
              ? <>, y <strong>«{resultado.reconocidas.consentimiento}»</strong> como consentimiento.</>
              : <>. <strong>No se reconoció ninguna columna de consentimiento</strong>, así que nadie quedó marcado como que aceptó.</>}
          </p>
          {resultado.ignoradas.length > 0 && (
            <details className="importacion-descartes">
              <summary>{resultado.ignoradas.length} {resultado.ignoradas.length === 1 ? 'columna ignorada' : 'columnas ignoradas'}</summary>
              <ul>{resultado.ignoradas.map((columna) => <li key={columna}>{columna}</li>)}</ul>
              <p>
                No se guardan para no meter en la lista datos que nadie pidió. Si alguna era el
                consentimiento o el nombre, renómbrala en el archivo y vuelve a subirlo.
              </p>
            </details>
          )}
          {resultado.descartados.length > 0 && (
            <details className="importacion-descartes">
              <summary>{resultado.descartados.length} filas descartadas</summary>
              <ul>
                {resultado.descartados.slice(0, 50).map((fila) => (
                  <li key={fila.linea}>Línea {fila.linea}: {fila.motivo}</li>
                ))}
              </ul>
              {resultado.descartados.length > 50 && <p>…y {resultado.descartados.length - 50} más.</p>}
            </details>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={cerrar}>Listo</button>
          </div>
        </div>
      ) : (
        <form
          className="form-grid"
          onSubmit={(evento) => { evento.preventDefault(); importar.mutate(); }}
        >
          <label>
            Archivo CSV
            <input type="file" accept=".csv,text/csv" className="input" onChange={(evento) => void leerArchivo(evento.target.files?.[0])} />
          </label>
          <label>
            …o pega aquí el contenido
            <textarea
              className="input"
              rows={6}
              value={contenido}
              onChange={(evento) => setContenido(evento.target.value)}
              placeholder={'correo,nombre,acepta\nana@correo.cl,Ana,sí'}
            />
          </label>
          <p className="form-hint">
            Se reconocen las columnas de correo, nombre y consentimiento en español e inglés, con el
            nombre que les ponga Google Forms. Lo que no se reconoce se ignora.
          </p>

          <label>
            Empresa
            <select className="input" value={empresa} onChange={(evento) => setEmpresa(evento.target.value)}>
              <option value="">Espartanos (agencia)</option>
              {empresas.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.name}</option>)}
            </select>
          </label>

          <label>
            De dónde salió <span className="required-star">*</span>
            <input
              className="input"
              required
              maxLength={60}
              value={origen}
              onChange={(evento) => setOrigen(evento.target.value)}
              placeholder="google_forms, landing_verano, csv_evento_marzo"
            />
          </label>
          <label>
            El formulario, archivo o campaña concreta
            <input className="input" maxLength={120} value={detalle} onChange={(evento) => setDetalle(evento.target.value)} placeholder="Formulario de bienvenida, marzo 2026" />
          </label>
          <label>
            Qué aceptaron, tal como se les mostró
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={textoConsentimiento}
              onChange={(evento) => setTextoConsentimiento(evento.target.value)}
              placeholder="Quiero recibir novedades y beneficios de…"
            />
          </label>
          <p className="form-hint">
            Si el archivo no trae una columna que diga qué aceptó cada persona, esto es la única
            prueba. Sin ninguna de las dos, las filas entran como «pendiente» y no reciben campañas.
          </p>

          {importar.isError && <p className="error-text">No se pudo importar. Revisa el archivo e inténtalo de nuevo.</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={cerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!contenido.trim() || !origen.trim() || importar.isPending}>
              {importar.isPending ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  </>;
}
