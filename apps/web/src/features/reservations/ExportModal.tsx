import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../core/api';
import './ExportModal.css';
import { VitaIcons } from '../../shared/Icons';
import { triggerToast } from '../../shared/toast-events';

interface ExportOptions {
  format: 'csv' | 'json' | 'imprimir';
  dateFrom: string;
  dateTo: string;
  fields: string[];
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Formulario a exportar. Sin él no hay nada que descargar y el botón queda inhabilitado. */
  formId?: string;
  /** Oculta los campos de uso interno cuando la vista corresponde al cliente. */
  clientView?: boolean;
}

/** Campos exportables y si son de uso interno del equipo. */
const AVAILABLE_FIELDS: Array<{ id: string; label: string; internal?: boolean }> = [
  { id: 'name', label: 'Nombre' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'email', label: 'Email' },
  { id: 'date', label: 'Fecha' },
  { id: 'status', label: 'Estado' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'notes', label: 'Notas internas', internal: true },
  { id: 'origin', label: 'Origen (utm_source)' },
  { id: 'medium', label: 'Medio (utm_medium)' },
  { id: 'campaign', label: 'Campaña (utm_campaign)' },
  { id: 'content', label: 'Contenido (utm_content)' },
  { id: 'code', label: 'Código de reserva' },
  { id: 'coupon', label: 'Cupón' },
  { id: 'party_size', label: 'Personas' },
];

/** Escapa lo que entra en la hoja: los datos los escribe quien reserva, no el equipo. */
function escaparHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]!);
}

/**
 * Hoja imprimible de las reservas.
 *
 * El navegador ya sabe convertir una página a PDF, así que en vez de sumar una librería de 300 KB
 * al paquete se abre una ventana con la tabla lista y se pide imprimir. Se ve igual en pantalla y
 * en papel, y en el teléfono la tabla se adapta en vez de salirse de la hoja.
 */
function abrirHojaImprimible(titulo: string, registros: Array<Record<string, unknown>>, etiquetaDe: (clave: string) => string): boolean {
  const columnas = [...new Set(registros.flatMap((registro) => Object.keys(registro)))];
  const ventana = window.open('', '_blank', 'noopener');
  if (!ventana) return false;
  const filas = registros.map((registro) => `<tr>${columnas.map((columna) => `<td data-col="${escaparHtml(etiquetaDe(columna))}">${escaparHtml(registro[columna])}</td>`).join('')}</tr>`).join('');
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title><style>
  :root { color-scheme: light; }
  body { margin:0; padding:24px; background:#fff; color:#1c1a1d; font:14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; border-bottom:2px solid #0e8c82; padding-bottom:10px; }
  h1 { margin:0; font-size:20px; }
  header small { color:#706a73; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { padding:7px 9px; text-align:left; vertical-align:top; border-bottom:1px solid #e7e1e5; }
  th { background:#f4f7f5; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#4a4247; }
  tbody tr:nth-child(even) td { background:#fafbfa; }
  tfoot { color:#706a73; font-size:11px; }
  @media print { body { padding:0; } thead { display:table-header-group; } tr { break-inside:avoid; } .no-imprimir { display:none; } }
  @media (max-width:640px) {
    thead { display:none; }
    tbody tr { display:block; margin-bottom:10px; border:1px solid #e7e1e5; border-radius:8px; padding:6px; }
    tbody td { display:flex; justify-content:space-between; gap:12px; border:0; padding:4px 6px; }
    tbody td::before { content:attr(data-col); color:#706a73; font-size:11px; text-transform:uppercase; }
  }
</style></head><body>
<header><h1>${escaparHtml(titulo)}</h1><small>${registros.length} reserva${registros.length === 1 ? '' : 's'} · ${escaparHtml(new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' }))}</small></header>
<table><thead><tr>${columnas.map((columna) => `<th>${escaparHtml(etiquetaDe(columna))}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>
</body></html>`);
  ventana.document.close();
  ventana.focus();
  // Deja pintar antes de abrir el diálogo: sin esto algunos navegadores imprimen la hoja vacía.
  ventana.setTimeout(() => ventana.print(), 300);
  return true;
}

export function ExportModal({ open, onClose, formId, clientView = false }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    dateFrom: '',
    dateTo: '',
    fields: ['name', 'phone', 'email', 'date', 'status', 'attendance'],
  });

  const availableFields = AVAILABLE_FIELDS.filter((field) => !field.internal || !clientView);

  /**
   * Hoja lista para imprimir o guardar como PDF, con los mismos datos y filtros del archivo.
   *
   * Pide el JSON de siempre: la tabla se arma en el navegador. Si el navegador bloquea la ventana
   * emergente se avisa, porque el fallo es silencioso y parece que el botón no hizo nada.
   */
  const imprimirMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error('Selecciona una sucursal antes de exportar');
      const { dateFrom, dateTo, fields } = options;
      return api.post<Array<Record<string, unknown>>>(`/reservations/forms/${formId}/export`, {
        format: 'json',
        fields: clientView ? fields.filter((field) => field !== 'notes') : fields,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      });
    },
    onSuccess: (registros) => {
      const lista = Array.isArray(registros) ? registros : [];
      if (lista.length === 0) { triggerToast('No hay reservas en ese rango', 'error'); return; }
      const etiquetaDe = (clave: string) => AVAILABLE_FIELDS.find((campo) => campo.id === clave)?.label ?? clave;
      const abierta = abrirHojaImprimible(`Reservas · ${new Date().toLocaleDateString('es-CL', { dateStyle: 'long' })}`, lista, etiquetaDe);
      if (!abierta) { triggerToast('Tu navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.', 'error'); return; }
      onClose();
    },
    onError: (error: Error) => triggerToast(error.message || 'No se pudo preparar la hoja', 'error'),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error('Selecciona un formulario antes de exportar');
      // El cliente de API adjunta la sesión y renueva el token; una llamada directa a axios
      // no lleva la cabecera de autorización.
      const { dateFrom, dateTo, ...exportOptions } = options;
      const payload = {
        ...exportOptions,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      };
      return api.post<Blob>(
        `/reservations/forms/${formId}/export`,
        clientView ? { ...payload, fields: options.fields.filter((field) => field !== 'notes') } : payload,
        { responseType: 'blob' },
      );
    },
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservas-${new Date().toISOString().slice(0, 10)}.${options.format}`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast('Archivo descargado exitosamente', 'success');
      onClose();
    },
    onError: (error: Error) => {
      triggerToast(error.message || 'Error al descargar el archivo', 'error');
    }
  });

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      setOptions({ ...options, fields: [...options.fields, fieldId] });
    } else {
      setOptions({ ...options, fields: options.fields.filter(f => f !== fieldId) });
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal export-modal">
        <div className="modal-header">
          <h2>Exportar reservas</h2>
          <button className="close-btn" onClick={onClose} title="Cerrar">
            <VitaIcons.close />
          </button>
        </div>

        <div className="modal-content">
          <label>
            <span>Rango de fechas</span>
            <div className="date-range">
              <input
                type="date"
                value={options.dateFrom}
                onChange={(e) => setOptions({ ...options, dateFrom: e.target.value })}
              />
              <span>a</span>
              <input
                type="date"
                value={options.dateTo}
                onChange={(e) => setOptions({ ...options, dateTo: e.target.value })}
              />
            </div>
          </label>

          <label>
            <span>Formato</span>
            <select
              value={options.format}
              onChange={(e) => setOptions({ ...options, format: e.target.value as ExportOptions['format'] })}
            >
              <option value="csv">CSV (Excel)</option>
              <option value="imprimir">Hoja imprimible (PDF)</option>
              <option value="json">JSON</option>
            </select>
            {options.format === 'imprimir' && <small>Se abre una hoja lista para imprimir. En el diálogo del navegador elige «Guardar como PDF».</small>}
          </label>

          <fieldset>
            <legend>Campos a incluir</legend>
            <div className="fields-grid">
              {availableFields.map(field => (
                <label key={field.id} className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={options.fields.includes(field.id)}
                    onChange={(e) => handleFieldToggle(field.id, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => (options.format === 'imprimir' ? imprimirMutation.mutate() : exportMutation.mutate())}
            disabled={exportMutation.isPending || imprimirMutation.isPending || !formId || options.fields.length === 0}
            title={!formId ? 'Elige una sucursal para poder exportar' : undefined}
          >
            {options.format === 'imprimir'
              ? (imprimirMutation.isPending ? 'Preparando...' : 'Abrir hoja imprimible')
              : (exportMutation.isPending ? 'Descargando...' : 'Descargar')}
          </button>
        </div>
      </div>
    </>
  );
}
