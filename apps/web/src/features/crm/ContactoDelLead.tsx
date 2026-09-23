import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { CamposPropiosEnFicha, hayValoresInvalidos, useDefinicionesDeCampos, type ValoresEnEdicion } from './CamposPropiosEnFicha';

/**
 * @fileoverview El contacto del lead: la misma persona, vista desde la empresa.
 *
 * El contacto se crea solo con cada lead y guarda el papel de la persona en esa cuenta, las notas
 * y sus campos propios. No tenía ninguna pantalla: existía, se usaba por dentro y nadie podía
 * verlo ni completarlo. Vive acá, dentro de la ficha del lead, porque es la misma persona y una
 * pantalla aparte llamada «Contactos» se confundiría con la que ya existe.
 */

interface Contacto {
  id: string;
  position?: string | null;
  notes?: string | null;
  customFields?: Record<string, unknown> | null;
}

export function ContactoDelLead({ leadId, puedeEditar }: { leadId: string; puedeEditar: boolean }) {
  const queryClient = useQueryClient();
  const { data: definiciones = [] } = useDefinicionesDeCampos('contact');
  const { data } = useQuery<{ data: Contacto[] }>({
    queryKey: ['crm-contacto-del-lead', leadId],
    queryFn: () => api.get(`/crm/contacts?leadId=${encodeURIComponent(leadId)}&limit=1`),
    staleTime: 60_000,
  });
  const contacto = data?.data?.[0];

  const [cargo, setCargo] = useState('');
  const [notas, setNotas] = useState('');
  const [camposPropios, setCamposPropios] = useState<ValoresEnEdicion>({});
  useEffect(() => {
    setCargo(contacto?.position ?? '');
    setNotas(contacto?.notes ?? '');
    setCamposPropios((contacto?.customFields ?? {}) as ValoresEnEdicion);
  }, [contacto?.id, contacto?.position, contacto?.notes, contacto?.customFields]);

  const guardar = useMutation({
    mutationFn: (cambios: Record<string, unknown>) => api.patch(`/crm/contacts/${contacto!.id}`, cambios),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['crm-contacto-del-lead', leadId] }); },
  });

  // Sin contacto no hay nada que mostrar: un lead sin empresa todavía no lo tiene.
  if (!contacto) return null;
  const sinNada = definiciones.length === 0 && !cargo && !notas && !puedeEditar;
  if (sinNada) return null;

  return <section className="contacto-del-lead">
    <h4>En esta empresa</h4>
    <p className="crm-admin-ayuda">El papel de esta persona en la cuenta. Se guarda en su contacto, no en el lead.</p>
    <label>Cargo
      <input
        className="input"
        maxLength={255}
        placeholder="Ej.: encargada de marketing"
        disabled={!puedeEditar || guardar.isPending}
        value={cargo}
        onChange={(evento) => setCargo(evento.target.value)}
        onBlur={() => { if (cargo.trim() !== (contacto.position ?? '')) guardar.mutate({ position: cargo.trim() }); }}
      />
    </label>
    <label>Notas del contacto
      <textarea
        className="input"
        rows={2}
        maxLength={5000}
        disabled={!puedeEditar || guardar.isPending}
        value={notas}
        onChange={(evento) => setNotas(evento.target.value)}
        onBlur={() => { if (notas.trim() !== (contacto.notes ?? '')) guardar.mutate({ notes: notas.trim() }); }}
      />
    </label>
    {definiciones.length > 0 ? <>
      <CamposPropiosEnFicha
        entidad="contact"
        valores={camposPropios}
        deshabilitado={!puedeEditar}
        onCambiar={(clave, valor) => setCamposPropios({ ...camposPropios, [clave]: valor })}
      />
      {puedeEditar ? <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={guardar.isPending || hayValoresInvalidos(definiciones, camposPropios)}
        onClick={() => guardar.mutate({ customFields: camposPropios })}
      >{guardar.isPending ? 'Guardando…' : 'Guardar datos del contacto'}</button> : null}
    </> : null}
    {guardar.error ? <p className="error-text">{guardar.error instanceof Error ? guardar.error.message : 'No se pudo guardar'}</p> : null}
  </section>;
}
