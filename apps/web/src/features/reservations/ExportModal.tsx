import { DialogoModal } from '../../shared/DialogoModal';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../core/api';
import './ExportModal.css';
import { VitaIcons } from '../../shared/Icons';
import { triggerToast } from '../../shared/toast-events';

/** Para qué se exporta: decide el formato, qué lleva y qué se exige. */
type Finalidad = 'planilla' | 'hoja' | 'csv';

interface ExportOptions {
  finalidad: Finalidad;
  dateFrom: string;
  dateTo: string;
  fields: string[];
  /** El día de la hoja del turno. */
  fecha: string;
  motivo: string;
}

const MOTIVO_MINIMO = 10;
const DIAS_QUE_EXIGEN_MOTIVO = 31;

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Formulario a exportar. Sin él no hay nada que descargar y el botón queda inhabilitado. */
  formId?: string;
  /** Locales entre los que elegir cuando no llega un `formId`: la exportación es de un local a la vez. */
  locales?: Array<{ id: string; name: string }>;
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

/**
 * El mensaje del servidor cuando la respuesta se pidió como archivo.
 *
 * Con `responseType: 'blob'` hasta el error llega como Blob; sin leerlo, el motivo por el que se
 * rechazó una exportación se perdía detrás de un mensaje genérico.
 */
async function mensajeDeError(error: unknown, porDefecto: string): Promise<string> {
  const datos = (error as { response?: { data?: unknown } })?.response?.data;
  if (datos instanceof Blob) {
    try {
      const cuerpo = JSON.parse(await datos.text()) as { message?: string | string[] };
      return Array.isArray(cuerpo.message) ? cuerpo.message.join(' · ') : cuerpo.message || porDefecto;
    } catch {
      return porDefecto;
    }
  }
  return error instanceof Error && error.message ? error.message : porDefecto;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cuántos días abarca el rango; `null` si le falta alguno de los dos extremos. */
function diasDelRango(desde: string, hasta: string): number | null {
  if (!desde || !hasta) return null;
  return (new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000;
}

export function ExportModal({ open, onClose, formId: formIdRecibido, locales = [], clientView = false }: ExportModalProps) {
  const [formIdElegido, setFormIdElegido] = useState('');
  const formId = formIdRecibido || formIdElegido || (locales.length === 1 ? locales[0].id : undefined);
  const [options, setOptions] = useState<ExportOptions>({
    finalidad: 'planilla',
    dateFrom: '',
    dateTo: '',
    fields: ['name', 'phone', 'email', 'date', 'status', 'attendance'],
    fecha: new Date().toLocaleDateString('en-CA'),
    motivo: '',
  });

  const availableFields = AVAILABLE_FIELDS.filter((field) => !field.internal || !clientView);
  const esHoja = options.finalidad === 'hoja';

  /*
   * Si pedir este archivo exigirá un motivo, para avisarlo antes de enviar.
   *
   * Es una estimación para no rebotar a la persona: la decisión es del servidor, que además
   * considera cuántas filas salen y si el archivo lleva las respuestas del formulario.
   */
  const dias = diasDelRango(options.dateFrom, options.dateTo);
  const llevaContacto = options.fields.includes('phone') || options.fields.includes('email');
  const motivoProbable = !esHoja && (llevaContacto || dias === null || dias > DIAS_QUE_EXIGEN_MOTIVO);
  const motivoLimpio = options.motivo.replace(/\s+/g, ' ').trim();
  const faltaMotivo = motivoProbable && motivoLimpio.length < MOTIVO_MINIMO;

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error('Selecciona un local antes de exportar');
      try {
        // El cliente de API adjunta la sesión y renueva el token; una llamada directa a axios
        // no lleva la cabecera de autorización. Todo se arma en el servidor, que además deja
        // constancia de quién lo sacó.
        if (esHoja) {
          const blob = await api.get<Blob>(`/reservations/forms/${formId}/hoja-del-turno?fecha=${encodeURIComponent(options.fecha)}`, { responseType: 'blob' });
          return { blob, nombre: `hoja-del-turno-${options.fecha}.pdf` };
        }
        const formato = options.finalidad === 'csv' ? 'csv' : 'xlsx';
        const blob = await api.post<Blob>(
          `/reservations/forms/${formId}/export`,
          {
            format: formato,
            fields: clientView ? options.fields.filter((field) => field !== 'notes') : options.fields,
            ...(options.dateFrom ? { dateFrom: options.dateFrom } : {}),
            ...(options.dateTo ? { dateTo: options.dateTo } : {}),
            ...(motivoLimpio ? { motivo: motivoLimpio } : {}),
          },
          { responseType: 'blob' },
        );
        const dia = new Date().toISOString().slice(0, 10);
        return { blob, nombre: formato === 'csv' ? `reservas-para-procesar-${dia}.csv` : `reservas-${dia}.xlsx` };
      } catch (error) {
        throw new Error(await mensajeDeError(error, 'No se pudo preparar el archivo'));
      }
    },
    onSuccess: ({ blob, nombre }) => {
      descargar(blob, nombre);
      triggerToast(esHoja ? 'Hoja del turno descargada.' : options.finalidad === 'csv' ? 'CSV descargado.' : 'Planilla descargada.', 'success');
      onClose();
    },
    onError: (error: Error) => {
      triggerToast(error.message || 'No se pudo descargar el archivo', 'error');
    },
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
    <DialogoModal etiqueta="Exportar reservas" onCerrar={onClose} className="modal-overlay">
      <div className="modal export-modal" data-retiene-toque>
        <div className="modal-header">
          <h2>Exportar reservas</h2>
          <button className="close-btn" onClick={onClose} title="Cerrar">
            <VitaIcons.close />
          </button>
        </div>

        <div className="modal-content">
          {!formIdRecibido && locales.length > 1 && <label>
            <span>Local a exportar</span>
            <select value={formIdElegido} onChange={(e) => setFormIdElegido(e.target.value)}>
              <option value="">Elige un local</option>
              {locales.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
            </select>
            <small>Se exporta un local a la vez.</small>
          </label>}

          <label>
            <span>¿Para qué la necesitas?</span>
            <select
              value={options.finalidad}
              onChange={(e) => setOptions({ ...options, finalidad: e.target.value as Finalidad })}
            >
              <option value="hoja">Hoja del turno (PDF para imprimir)</option>
              <option value="planilla">Planilla con contacto (Excel)</option>
              <option value="csv">CSV para otra herramienta</option>
            </select>
            {esHoja && <small>Un día, listo para imprimir. No lleva teléfonos, correos ni respuestas del formulario: donde una reserva tiene restricciones dice «ver en pantalla», porque el papel no deja constancia de quién lo leyó.</small>}
            {options.finalidad === 'planilla' && <small>Se abre en Excel tal cual: cabecera fija, columnas al ancho de su contenido y todo como texto, así que un teléfono con «+» no se convierte en fórmula. Lleva una primera fila que dice quién la sacó y cuándo.</small>}
            {options.finalidad === 'csv' && <small>Texto separado por comas, solo para subirlo a otra herramienta. Para leerlo tú, la planilla se ve mejor.</small>}
          </label>

          {esHoja ? (
            <label>
              <span>Día del turno</span>
              <input type="date" value={options.fecha} onChange={(e) => setOptions({ ...options, fecha: e.target.value })} />
            </label>
          ) : (
            <>
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
                <small>Sacar un mes o más, o sin fechas, queda anotado y pide un motivo.</small>
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
                <small>Quien no tiene acceso directo a los datos de contacto recibe el archivo sin esas columnas.</small>
              </fieldset>

              <label>
                <span>Motivo{motivoProbable ? ' (obligatorio)' : ''}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={options.motivo}
                  onChange={(e) => setOptions({ ...options, motivo: e.target.value })}
                  placeholder="Ej.: confirmar las mesas del fin de semana"
                />
                <small>Queda anotado junto a tu nombre, la fecha y las columnas que salieron.</small>
              </label>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !formId || (esHoja ? !options.fecha : options.fields.length === 0 || faltaMotivo)}
            title={!formId ? 'Elige un local para poder exportar' : faltaMotivo ? 'Escribe el motivo para poder exportar' : undefined}
          >
            {exportMutation.isPending ? 'Preparando...' : esHoja ? 'Descargar la hoja' : 'Descargar'}
          </button>
        </div>
      </div>
    </DialogoModal>
  );
}
