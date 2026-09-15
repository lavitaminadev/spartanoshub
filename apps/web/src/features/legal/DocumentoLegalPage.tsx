import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOCUMENTOS_DE_ESPARTANOS, OPERADOR_ESPARTANOS, documentoDeEspartanos, rutaDocumentoLegal, type IdDocumentoLegal, type SeccionLegal } from '@espartanos/shared';
import './documento-legal.css';

const anclaDe = (titulo: string) => `seccion-${titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** Documentos legales de Espartanos en una página pública, sin sesión, con índice, listas y tablas. */
export function DocumentoLegalPage() {
  const { id } = useParams();
  const existe = !id || DOCUMENTOS_DE_ESPARTANOS.some((doc) => doc.id === id);
  const documento = documentoDeEspartanos((id && existe ? id : 'privacidad') as IdDocumentoLegal);

  useEffect(() => {
    document.title = `${documento.titulo} · ${OPERADOR_ESPARTANOS.marca}`;
    window.scrollTo(0, 0);
  }, [documento.titulo]);

  return <main className="documento-legal-pagina">
    <nav className="documento-legal-nav" aria-label="Documentos">
      {DOCUMENTOS_DE_ESPARTANOS.map((doc) => <Link key={doc.id} to={rutaDocumentoLegal(doc.id)} aria-current={doc.id === documento.id ? 'page' : undefined}>{doc.titulo}</Link>)}
    </nav>
    <article>
      {!existe && <p className="documento-legal-aviso">No encontramos ese documento. Te mostramos la política de privacidad.</p>}
      <p className="documento-legal-marca">{OPERADOR_ESPARTANOS.marca}</p>
      <h1>{documento.titulo}</h1>
      <p className="documento-legal-version">Versión {documento.version} · vigente desde {new Date(`${documento.vigenteDesde}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p className="documento-legal-resumen">{documento.resumen}</p>
      {documento.secciones.length > 4 && <nav className="documento-legal-indice" aria-label="Contenido">
        <strong>Contenido</strong>
        <ol>{documento.secciones.map((seccion) => <li key={seccion.titulo}><a href={`#${anclaDe(seccion.titulo)}`}>{seccion.titulo.replace(/^\d+\.\s*/, '')}</a></li>)}</ol>
      </nav>}
      {documento.secciones.map((seccion) => <Seccion key={seccion.titulo} seccion={seccion} />)}
      <footer>
        <p>Consultas sobre estos documentos o tus datos: <a href={`mailto:${OPERADOR_ESPARTANOS.correo}`}>{OPERADOR_ESPARTANOS.correo}</a>.</p>
      </footer>
    </article>
  </main>;
}

function Seccion({ seccion }: { seccion: SeccionLegal }) {
  return <section id={anclaDe(seccion.titulo)}>
    <h2>{seccion.titulo}</h2>
    {seccion.parrafos.map((parrafo) => <p key={parrafo}>{parrafo}</p>)}
    {seccion.lista && <ul>{seccion.lista.map((item) => {
      const [termino, ...resto] = item.split(': ');
      return <li key={item}>{resto.length && termino.length < 40 ? <><strong>{termino}:</strong> {resto.join(': ')}</> : item}</li>;
    })}</ul>}
    {seccion.tabla && <div className="documento-legal-tabla">
      <table>
        <thead><tr>{seccion.tabla.columnas.map((columna) => <th key={columna} scope="col">{columna}</th>)}</tr></thead>
        <tbody>{seccion.tabla.filas.map((fila) => <tr key={fila.join('|')}>{fila.map((celda, i) => <td key={i} data-columna={seccion.tabla!.columnas[i]}>{celda}</td>)}</tr>)}</tbody>
      </table>
    </div>}
    {seccion.cierre?.map((parrafo) => <p key={parrafo}>{parrafo}</p>)}
  </section>;
}
