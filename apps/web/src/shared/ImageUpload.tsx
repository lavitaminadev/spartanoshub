import { useState, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../core/api';
import { MediaLibraryModal } from './MediaLibraryModal';
import { VitaIcons } from './Icons';

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  helperText?: string;
  placeholder?: string;
  /** Ancho máximo con que se entrega la imagen; el original queda intacto en Cloudinary. */
  maxWidth?: number;
  /** Empresa dueña: la imagen queda en su carpeta. */
  clientId?: string;
}

interface UploadResponse {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

/** Segmento de transformaciones de Cloudinary, como `f_auto,q_auto,c_limit,w_1600`. */
const TRANSFORMACION = /^[a-z]{1,3}_[^/]*$/;

function extractPublicId(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // URLs de Cloudinary: /image/upload/[transformaciones/]v1234567890/folder/public_id.ext
    const match = path.match(/\/image\/upload\/(?:[a-z]{1,3}_[^/]*\/)*(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) return undefined;
    return match[1];
  } catch {
    return undefined;
  }
}

/**
 * Versión liviana de una imagen de Cloudinary: formato y calidad automáticos y sin pasar del ancho
 * pedido. Una foto de celular de 5 MB se entrega así en unos cientos de KB. Las URL externas o que
 * ya traen transformaciones se devuelven tal cual.
 */
export function optimizedUrl(url?: string, maxWidth?: number): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('cloudinary.com')) return url;
    const pathParts = parsed.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1 || TRANSFORMACION.test(pathParts[uploadIndex + 1] || '')) return url;
    pathParts.splice(uploadIndex + 1, 0, maxWidth ? `f_auto,q_auto,c_limit,w_${maxWidth}` : 'f_auto,q_auto');
    parsed.pathname = pathParts.join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

export function ImageUpload({
  label,
  value,
  onChange,
  accept = 'image/jpeg,image/png,image/gif,image/webp,image/avif',
  maxSizeMB = 5,
  helperText = `JPG, PNG, GIF, WebP o AVIF. Máximo ${maxSizeMB} MB.`,
  placeholder = 'https://...',
  maxWidth = 1600,
  clientId,
}: ImageUploadProps) {
  // Se consulta una vez por sesión: sin Cloudinary se avisa y queda la opción de pegar una URL.
  const estado = useQuery({ queryKey: ['uploads', 'images', 'status'], queryFn: () => api.get<{ configured: boolean }>('/uploads/images/status'), staleTime: 5 * 60_000, retry: false });
  const sinAlmacenamiento = estado.data?.configured === false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastPublicId, setLastPublicId] = useState<string | undefined>();
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<UploadResponse>('/uploads/images', file, clientId ? { clientId } : undefined),
    onSuccess: (data) => {
      setValidationError(null);
      setLastPublicId(data.publicId);
      // Se guarda ya optimizada: todas las páginas que la muestran reciben la versión liviana.
      onChange(optimizedUrl(data.url, maxWidth) || data.url);
    },
    onError: (error: Error) => setValidationError(error.message),
  });

  const remove = useMutation({
    mutationFn: async (publicId: string) => api.delete(`/uploads/images/cloudinary/${encodeURIComponent(publicId)}`),
    onSuccess: () => {
      setLastPublicId(undefined);
      onChange('');
    },
    onError: (error: Error) => {
      // La referencia no se borra hasta que Cloudinary confirma la eliminación. De otro
      // modo un corte de red podía hacer desaparecer el logo o portada al siguiente guardado.
      setValidationError(error.message || 'No pudimos quitar la imagen. Inténtalo nuevamente.');
    },
  });

  const validate = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return 'Formato no soportado. Usa JPG, PNG, GIF, WebP o AVIF.';
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `El archivo supera los ${maxSizeMB} MB.`;
      }
      return null;
    },
    [maxSizeMB],
  );

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (sinAlmacenamiento) {
      setValidationError('Las imágenes no se pueden subir todavía: falta conectar Cloudinary en Integraciones. Mientras tanto puedes pegar la URL de una imagen.');
      return;
    }
    const error = validate(file);
    if (error) {
      setValidationError(error);
      upload.reset();
      return;
    }
    setValidationError(null);
    upload.mutate(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files[0]);
  };

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    const publicId = lastPublicId || extractPublicId(value);
    if (publicId) {
      remove.mutate(publicId);
    } else {
      onChange('');
    }
  };

  const previewUrl = useMemo(() => optimizedUrl(value), [value]);
  const isBusy = upload.isPending || remove.isPending;
  const errorMessage = validationError || upload.error?.message || remove.error?.message;

  return (
    <div className="image-upload">
      <label>{label}</label>
      <div
        className={`image-upload-zone ${dragOver ? 'drag-over' : ''} ${isBusy ? 'uploading' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label}`}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            // Permite volver a elegir el mismo archivo después de un error o
            // de quitarlo, algo habitual al probar fondos.
            event.currentTarget.value = '';
          }}
        />
        {value ? (
          <div className="image-upload-preview">
            <img
              src={previewUrl}
              alt={label}
              onLoad={() => setValidationError(null)}
              onError={() => setValidationError('La URL guardada no apunta a una imagen accesible. Sube un archivo o usa el enlace directo de una imagen.')}
            />
            <div className="image-upload-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}
                disabled={isBusy}
              >
                {upload.isPending ? 'Subiendo...' : 'Cambiar'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={handleRemove}
                disabled={isBusy}
              >
                {remove.isPending ? 'Eliminando...' : 'Quitar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="image-upload-placeholder">
            <span><VitaIcons.image /></span>
            <strong>{upload.isPending ? 'Subiendo imagen...' : sinAlmacenamiento ? 'Subida de imágenes no disponible' : 'Arrastra una imagen o haz clic'}</strong>
            <small>{sinAlmacenamiento ? 'Falta conectar Cloudinary en Integraciones. Puedes pegar una URL abajo.' : helperText}</small>
          </div>
        )}
      </div>
      {errorMessage && <div className="alert alert-error" role="alert">{errorMessage}</div>}
      <div className="image-upload-url">
        <small>O usa una URL externa</small>
        <div className="image-upload-url-row">
          <input
            className="input"
            type="url"
            aria-label={`URL de ${label.toLowerCase()}`}
            value={value || ''}
            onChange={(event) => { setValidationError(null); onChange(event.target.value.trim()); }}
            placeholder={placeholder}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setMediaLibraryOpen(true); }} title="Elegir de la biblioteca">
            <VitaIcons.folder />
          </button>
        </div>
      </div>
      <MediaLibraryModal open={mediaLibraryOpen} onClose={() => setMediaLibraryOpen(false)} onSelect={(url) => { onChange(url); setMediaLibraryOpen(false); }} />
    </div>
  );
}
