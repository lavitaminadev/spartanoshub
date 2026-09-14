import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

interface DatosLegales {
  legalName: string | null; taxId: string | null; privacyEmail: string | null;
  privacyUrl: string | null; termsUrl: string | null; legalMode: 'enlace' | 'texto';
  privacyText: string | null; termsText: string | null;
}

const vacio = { legalName: '', taxId: '', privacyEmail: '', privacyUrl: '', termsUrl: '', legalMode: 'enlace' as 'enlace' | 'texto', privacyText: '', termsText: '' };

/**
 * Datos legales de la empresa, manejados por ella misma.
 *
 * La empresa es la responsable de los datos de sus clientes: lo que guarde aquí aparece en las
 * aceptaciones de reservas y encuestas de todas sus sucursales.
 */
export function ClientLegalData() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['company-legal'], queryFn: () => api.get<DatosLegales>('/reservations/company-legal') });
  const [form, setForm] = useState(vacio);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({ legalName: data.legalName || '', taxId: data.taxId || '', privacyEmail: data.privacyEmail || '', privacyUrl: data.privacyUrl || '', termsUrl: data.termsUrl || '', legalMode: data.legalMode === 'texto' ? 'texto' : 'enlace', privacyText: data.privacyText || '', termsText: data.termsText || '' });
  }, [data]);

  const guardar = useMutation({
    mutationFn: () => api.put('/reservations/company-legal', form),
    onSuccess: () => { setGuardado(true); queryClient.invalidateQueries({ queryKey: ['company-legal'] }); },
  });
  const cambiar = (campo: keyof typeof vacio, valor: string) => { setGuardado(false); setForm({ ...form, [campo]: valor }); };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="page datos-legales-portal">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">TU EMPRESA</span>
          <h1>Datos legales</h1>
          <p className="page-subtitle">Tu empresa es la responsable de los datos de sus clientes. Esto aparece en las aceptaciones de reservas y encuestas de todas tus sucursales; Espartanos sólo los trata por encargo tuyo.</p>
        </div>
      </div>
      <form className="card datos-legales-form" onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }}>
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
          {guardado && <span className="text-success">Guardado. Se usa desde la próxima reserva.</span>}
          <button type="submit" className="btn btn-primary" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
