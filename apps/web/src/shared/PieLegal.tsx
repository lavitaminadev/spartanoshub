import { DOCUMENTOS_DE_ESPARTANOS, rutaDocumentoLegal } from '@espartanos/shared';

/** Pie con los documentos legales de Espartanos, visible en toda página pública. El contrato de encargo es para empresas y no se lista. */
export function PieLegal() {
  return <nav className="pie-legal" aria-label="Documentos legales de Espartanos">
    {DOCUMENTOS_DE_ESPARTANOS.filter((doc) => doc.id !== 'encargo' && doc.id !== 'servicio').map((doc) => <a key={doc.id} href={rutaDocumentoLegal(doc.id)} target="_blank" rel="noopener">{doc.titulo}</a>)}
  </nav>;
}
