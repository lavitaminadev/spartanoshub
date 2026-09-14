import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';

/**
 * Ruta de los datos legales. Los exponen Reservas y Encuestas; la empresa llega por el servicio
 * que tenga. El equipo usa Reservas salvo que la empresa sólo tenga Encuestas.
 */
export function rutaDatosLegales(capacidades: { reservations?: boolean; surveys?: boolean } | undefined, clientId?: string): string {
  const modulo = capacidades?.reservations === false && capacidades?.surveys ? 'surveys' : capacidades?.reservations ? 'reservations' : capacidades?.surveys ? 'surveys' : 'reservations';
  return `/${modulo}/company-legal${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`;
}
import { LoadingSpinner } from '../../shared/LoadingSpinner';

interface DatosLegales {
  legalName: string | null; taxId: string | null; privacyEmail: string | null;
  privacyUrl: string | null; termsUrl: string | null; legalMode: 'enlace' | 'texto';
  privacyText: string | null; termsText: string | null;
}

const vacio = { legalName: '', taxId: '', privacyEmail: '', privacyUrl: '', termsUrl: '', legalMode: 'enlace' as 'enlace' | 'texto', privacyText: '', termsText: '' };

/** Cuántos de los datos que usa la aceptación están completos, para mostrar el avance. */
export function datosLegalesCompletos(datos: DatosLegales | undefined): { completos: number; total: number } {
  if (!datos) return { completos: 0, total: 4 };
  const politica = datos.legalMode === 'texto' ? datos.privacyText : datos.privacyUrl;
  const campos = [datos.legalName, datos.taxId, datos.privacyEmail, politica];
  return { completos: campos.filter((valor) => Boolean(valor && valor.trim())).length, total: campos.length };
}

/**
 * Datos legales de la empresa.
 *
 * La empresa es la responsable de los datos de sus clientes: lo que guarde aquí aparece en las
 * aceptaciones de reservas y encuestas de todas sus sucursales. Sin `clientId` es la página del
 * portal (la empresa edita los suyos); con `clientId` es el mismo formulario abierto por el equipo
 * para completarlos a pedido de la empresa.
 */
export function ClientLegalData({ clientId, embebido = false, onGuardado, capacidades }: { clientId?: string; embebido?: boolean; onGuardado?: () => void; capacidades?: { reservations?: boolean; surveys?: boolean } } = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ruta = rutaDatosLegales(capacidades ?? user?.capabilities, clientId);
  const { data, isLoading, error } = useQuery({ queryKey: ['company-legal', clientId ?? 'propia'], queryFn: () => api.get<DatosLegales>(ruta) });
  const [form, setForm] = useState(vacio);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({ legalName: data.legalName || '', taxId: data.taxId || '', privacyEmail: data.privacyEmail || '', privacyUrl: data.privacyUrl || '', termsUrl: data.termsUrl || '', legalMode: data.legalMode === 'texto' ? 'texto' : 'enlace', privacyText: data.privacyText || '', termsText: data.termsText || '' });
  }, [data]);

  const guardar = useMutation({
    mutationFn: () => api.put(ruta, form),
    onSuccess: () => { setGuardado(true); queryClient.invalidateQueries({ queryKey: ['company-legal'] }); onGuardado?.(); },
  });
  const cambiar = (campo: keyof typeof vacio, valor: string) => { setGuardado(false); setForm({ ...form, [campo]: valor }); };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-error" role="alert">{(error as Error).message}</div>;

  const formulario = (
    <form className={`card datos-legales-form${embebido ? ' is-embebido' : ''}`} onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); guardar.mutate(); }}>
      {embebido && <p className="datos-legales-nota">Estás completando los datos a pedido de la empresa. Queda registrado quién hizo el cambio.</p>}
      <div className="datos-legales-fila">
        <label>Razón social<input className="input" value={form.legalName} onChange={(e) => cambiar('legalName', e.target.value)} placeholder="Empresa SpA" /></label>
        <label>RUT<input className="input" value={form.taxId} onChange={(e) => cambiar('taxId', e.target.value)} placeholder="76.123.456-7" /></label>
      </div>
      <label>Correo para ejercer derechos<input className="input" type="email" value={form.privacyEmail} onChange={(e) => cambiar('privacyEmail', e.target.value)} placeholder="privacidad@empresa.cl" /></label>

      <fieldset className="datos-legales-modo">
        <legend>¿Cómo muestras tu política de privacidad y condiciones?</legend>
        <label><input type="radio" checked={form.legalMode === 'enlace'} onChange={() => cambiar('legalMode', 'enlace')} /> Enlace a mi sitio web</label>
        <label><input type="radio" checked={form.legalMode === 'texto'} onChange={() => cambiar('legalMode', 'texto')} /> Escribir el texto aquí (se abre dentro de la página)</label>
      </fieldset>

      {form.legalMode === 'enlace' ? (
        <div className="datos-legales-fila">
          <label>Política de privacidad (https)<input className="input" type="url" value={form.privacyUrl} onChange={(e) => cambiar('privacyUrl', e.target.value)} placeholder="https://empresa.cl/privacidad" /></label>
          <label>Condiciones (https)<input className="input" type="url" value={form.termsUrl} onChange={(e) => cambiar('termsUrl', e.target.value)} placeholder="https://empresa.cl/condiciones" /></label>
        </div>
      ) : (
        <>
          <label>Política de privacidad<textarea className="input" rows={8} value={form.privacyText} onChange={(e) => cambiar('privacyText', e.target.value)} /></label>
          <label>Condiciones<textarea className="input" rows={8} value={form.termsText} onChange={(e) => cambiar('termsText', e.target.value)} /></label>
        </>
      )}

      <div className="datos-legales-acciones">
        {guardar.isError && <span className="text-danger">No se pudo guardar. Revisa que los enlaces empiecen con https:// y el correo sea válido.</span>}
        {guardado && <span className="text-success">Guardado. Se usa desde la próxima reserva o respuesta.</span>}
        <button type="submit" className="btn btn-primary" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  );

  if (embebido) return <div className="datos-legales-portal">{formulario}</div>;

  return (
    <div className="page datos-legales-portal">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">TU EMPRESA</span>
          <h1>Datos legales</h1>
          <p className="page-subtitle">Tu empresa es la responsable de los datos de sus clientes. Esto aparece en las aceptaciones de reservas y encuestas de todas tus sucursales; Espartanos sólo los trata por encargo tuyo.</p>
        </div>
      </div>
      {formulario}
    </div>
  );
}
