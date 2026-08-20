import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { guessMapping, type TargetField } from './import-field-mapping';

/** Campos del prospecto que la importación sabe llenar. */
const TARGET_FIELDS = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'email', label: 'Correo', required: false },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'company', label: 'Empresa', required: false },
  { key: 'notes', label: 'Notas', required: false },
  // Los cuatro de abajo salen de mirar una exportación real de Meta: sin ellos, nueve de sus
  // doce columnas no tenían destino y se perdían al importar.
  { key: 'campaignName', label: 'Campaña o formulario', required: false },
  { key: 'source', label: 'Origen (pagado / orgánico)', required: false },
  { key: 'sourceDetail', label: 'Canal de contacto', required: false },
  { key: 'tags', label: 'Etiquetas', required: false },
  { key: 'altPhone', label: 'Teléfono alternativo', required: false },
] as const;

/** Tope del servidor. Se comprueba acá para no mandar un archivo que va a ser rechazado entero. */
const MAX_ROWS = 500;

interface ImportResult {
  imported: number;
  duplicates: number;
  failed: Array<{ row: number; name: string; reason: string }>;
}

export interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Importación de prospectos desde un archivo separado por comas.
 *
 * El archivo se lee **en el navegador** y nunca se sube: lo que viaja son las filas ya
 * mapeadas. Así no hace falta manejar archivos en el servidor ni almacenarlos, y una planilla
 * con columnas que no interesan no deja copia de esos datos en ninguna parte.
 *
 * Se muestra una vista previa antes de escribir nada. Importar sin ver qué va a entrar es la
 * forma más rápida de meter cuatrocientos registros mal mapeados en el CRM.
 */
export function ImportLeadsModal({ open, onClose }: ImportLeadsModalProps): JSX.Element {
  const queryClient = useQueryClient();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField | ''>>({});
  const [source, setSource] = useState('importacion');
  const [sourceDetail, setSourceDetail] = useState('');
  const [clientId, setClientId] = useState('');
  const [domain, setDomain] = useState<'audience' | 'commercial'>('audience');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: clientsResp } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: open,
  });
  const clients = clientsResp?.data ?? [];

  /**
   * La cuenta solo aplica a los contactos de campaña.
   *
   * En el embudo de la agencia el prospecto **es** la empresa, así que pedirle una cuenta a la
   * que pertenece no significa nada. Se limpia al cambiar de embudo para no arrastrar una
   * elección que dejó de tener sentido.
   */
  const necesitaCliente = domain === 'audience';

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({});
    setError(null); setResult(null); setSourceDetail('');
  };

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const fields = parsed.meta.fields ?? [];
        if (!fields.length) {
          setError('El archivo no tiene encabezados. La primera fila debe nombrar las columnas.');
          return;
        }
        if (parsed.data.length > MAX_ROWS) {
          setError(`El archivo trae ${parsed.data.length} filas y el máximo por tanda es ${MAX_ROWS}. Divídelo y súbelo por partes.`);
          return;
        }
        setHeaders(fields);
        setRows(parsed.data);
        setMapping(guessMapping(fields));
      },
      error: () => setError('No se pudo leer el archivo. Comprueba que sea un CSV válido.'),
    });
  };

  /** Filas ya traducidas al formato que espera el servidor, descartando las que quedan vacías. */
  const buildRows = () => rows
    .map((row) => {
      const mapped: Record<string, string> = {};
      for (const [header, target] of Object.entries(mapping)) {
        const value = row[header]?.trim();
        if (target && value) mapped[target] = value;
      }
      return mapped;
    })
    .filter((row) => row.name);

  const nameMapped = Object.values(mapping).includes('name');
  const preparedRows = headers.length ? buildRows() : [];

  const importMutation = useMutation({
    mutationFn: () => api.post<ImportResult>('/crm/leads/import', {
      rows: preparedRows,
      source: source.trim(),
      sourceDetail: sourceDetail.trim() || undefined,
      domain,
      clientId: necesitaCliente ? clientId : undefined,
    }),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Importar prospectos">
      <div className="modal-form import-leads">
        {result ? (
          <div className="import-result">
            <p>
              <strong>{result.imported}</strong> prospectos nuevos ·{' '}
              <strong>{result.duplicates}</strong> ya existían y se actualizaron ·{' '}
              <strong>{result.failed.length}</strong> con problemas
            </p>
            {result.failed.length > 0 ? (
              <div className="import-failed">
                <h4>Filas que no entraron</h4>
                <ul>
                  {result.failed.slice(0, 20).map((item) => (
                    <li key={item.row}>Fila {item.row} — {item.name || 'sin nombre'}: {item.reason}</li>
                  ))}
                </ul>
                {result.failed.length > 20 ? <p>…y {result.failed.length - 20} más.</p> : null}
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={reset}>Importar otro archivo</button>
              <button type="button" className="btn btn-primary" onClick={() => { reset(); onClose(); }}>Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            <label>
              Archivo CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="input"
                onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); }}
              />
              <small className="field-hint">
                La primera fila debe nombrar las columnas. El archivo se lee en tu navegador y no se sube.
              </small>
            </label>

            {error ? <div className="alert alert-error">{error}</div> : null}

            {headers.length > 0 ? (
              <>
                {/*
                  Van antes del mapeo de columnas a propósito: son las dos decisiones que no se
                  pueden corregir cómodamente después. Un origen mal puesto se arregla filtrando
                  y reescribiendo; trescientos contactos en el embudo equivocado o en la cuenta
                  equivocada hay que localizarlos y borrarlos uno por uno.
                */}
                <label>
                  A qué CRM entran
                  <select className="input" value={domain} onChange={(event) => { setDomain(event.target.value as 'audience' | 'commercial'); setClientId(''); }}>
                    <option value="audience">Contactos de campaña — el CRM de un cliente</option>
                    <option value="commercial">Prospectos de La Vitamina — el embudo de la agencia</option>
                  </select>
                  <small className="field-hint">
                    Son dos embudos separados. Los contactos de campaña pertenecen a la cuenta que
                    los generó; los prospectos son empresas que la agencia quiere sumar.
                  </small>
                </label>

                {necesitaCliente ? (
                  <label>
                    Cuenta
                    <select className="input" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                      <option value="">Elige la cuenta…</option>
                      {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                    <small className="field-hint">
                      Solo el equipo que atiende esta cuenta verá los contactos importados.
                    </small>
                  </label>
                ) : null}

                <div className="import-mapping">
                  <h4>A qué corresponde cada columna</h4>
                  {headers.map((header) => (
                    <label key={header} className="import-mapping-row">
                      <span>{header}</span>
                      <select
                        className="input"
                        value={mapping[header] ?? ''}
                        onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value as TargetField | '' }))}
                      >
                        <option value="">No importar</option>
                        {TARGET_FIELDS.map((field) => (
                          <option key={field.key} value={field.key}>{field.label}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <label>
                  Origen
                  <input className="input" value={source} onChange={(event) => setSource(event.target.value)} />
                  <small className="field-hint">Con qué origen quedan marcados, para poder distinguirlos después en los informes.</small>
                </label>
                <label>
                  Detalle del origen (opcional)
                  <input className="input" value={sourceDetail} onChange={(event) => setSourceDetail(event.target.value)} placeholder="Ej. Feria gastronómica agosto" />
                </label>

                <div className="import-preview">
                  <h4>Vista previa</h4>
                  {!nameMapped ? (
                    <p className="alert alert-error">Falta indicar qué columna trae el nombre. Sin eso no se puede importar.</p>
                  ) : necesitaCliente && !clientId ? (
                    <p className="alert alert-error">Falta elegir la cuenta. Sin ella, los contactos entran sin dueño y el equipo del cliente no los ve.</p>
                  ) : (
                    <>
                      <p>
                        Se importarán <strong>{preparedRows.length}</strong> de {rows.length} filas.
                        {preparedRows.length < rows.length ? ' Las demás no tienen nombre.' : ''}
                      </p>
                      <ul>
                        {preparedRows.slice(0, 3).map((row, index) => (
                          <li key={index}>{row.name}{row.email ? ` · ${row.email}` : ''}{row.phone ? ` · ${row.phone}` : ''}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => { reset(); onClose(); }}>Cancelar</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={importMutation.isPending || !nameMapped || preparedRows.length === 0 || !source.trim() || (necesitaCliente && !clientId)}
                    onClick={() => importMutation.mutate()}
                  >
                    {importMutation.isPending ? 'Importando...' : `Importar ${preparedRows.length}`}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
