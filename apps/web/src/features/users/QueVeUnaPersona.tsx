/**
 * @fileoverview Qué ve una persona en esta empresa, y de dónde le viene cada cosa.
 *
 * Quien reparte perfiles podía conceder pero no comprobar: para saber qué alcanzaba alguien había
 * que leer la base. Esta pantalla lo contesta, y separa lo que trae el perfil —que se revisa en
 * grupo, cambiando el perfil— de lo que alguien escribió para esa persona, que se revisa una por
 * una y es donde aparecen los accesos que nadie recuerda haber dado.
 *
 * Por eso cada línea dice su origen antes que su nivel: «puede hacer» es el dato menos útil de
 * los dos cuando lo que se está decidiendo es si ese acceso debería seguir ahí.
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import type { NivelDeArea, NivelDeDatosProtegidos, OrganizationModuleKey } from '@espartanos/shared';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import './que-ve-una-persona.css';

interface AreaDeUnaPersona {
  clave: string;
  nombre: string;
  modulo: OrganizationModuleKey;
  nivel: NivelDeArea;
  origen: 'perfil' | 'concedido' | 'quitado';
  motivo: string | null;
  porQuien: string | null;
  venceEl: string | null;
}

interface VistaDeUnaPersona {
  userId: string;
  nombre: string;
  correo: string;
  perfil: { id: string; nombre: string } | null;
  sinPerfil: boolean;
  asignadoPor: string | null;
  areas: AreaDeUnaPersona[];
  datosProtegidos: Array<{ modulo: OrganizationModuleKey; nombre: string; nivel: NivelDeDatosProtegidos; incluyeSensibles: boolean }>;
  avisoDeExtrasGlobales: boolean;
}

const NOMBRE_DE_MODULO: Record<string, string> = {
  reservations: 'Reservas', crm: 'CRM', surveys: 'Encuestas', marketing: 'Marketing', production: 'Producción', users: 'Equipo',
};
const NIVEL: Record<NivelDeArea, string> = { ninguno: 'Sin acceso', ver: 'Puede ver', hacer: 'Puede hacer' };
const NIVEL_DE_DATOS: Record<NivelDeDatosProtegidos, string> = {
  oculto: 'No los ve',
  bajo_registro: 'Los puede pedir, y queda constancia',
  directo: 'Los ve',
};

const dia = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

/** Cómo se rotula cada origen. Lo concedido y lo quitado se destacan; lo del perfil es lo normal. */
const ORIGEN: Record<AreaDeUnaPersona['origen'], { etiqueta: string; clase: string }> = {
  perfil: { etiqueta: 'Del perfil', clase: 'origen-perfil' },
  concedido: { etiqueta: 'Concedido aparte', clase: 'origen-concedido' },
  quitado: { etiqueta: 'Quitado aparte', clase: 'origen-quitado' },
};

interface Props {
  clientId: string;
  empresa: string;
  persona: { id: string; name: string };
  onCerrar: () => void;
}

export function QueVeUnaPersona({ clientId, empresa, persona, onCerrar }: Props): JSX.Element {
  const vista = useQuery<VistaDeUnaPersona>({
    queryKey: ['perfiles-que-ve', clientId, persona.id],
    queryFn: () => api.get(`/perfiles/que-ve/${persona.id}?clientId=${encodeURIComponent(clientId)}`),
  });

  // Agrupado por módulo porque así se reparte el trabajo en un local: quien revisa mira Reservas
  // entera, no una lista alfabética de cuarenta y tres claves.
  const porModulo = new Map<string, AreaDeUnaPersona[]>();
  for (const area of vista.data?.areas ?? []) {
    const grupo = porModulo.get(area.modulo) ?? [];
    grupo.push(area);
    porModulo.set(area.modulo, grupo);
  }

  return (
    <Modal open onClose={onCerrar} title={`Qué ve ${persona.name} en ${empresa}`}>
      {vista.isLoading && <LoadingSpinner />}
      {vista.isError && <p className="alert alert-error">No se pudo consultar qué ve esta persona.</p>}

      {vista.data && (
        <div className="que-ve">
          <p className="que-ve-perfil">
            {vista.data.perfil
              ? <>Perfil <strong>{vista.data.perfil.nombre}</strong>{vista.data.asignadoPor ? <> · se lo asignó {vista.data.asignadoPor}</> : null}</>
              : <>Sin perfil asignado.</>}
          </p>

          {/*
            * Sin perfil la lista de áreas sale vacía, y una lista vacía se lee como «no ve nada»,
            * que es lo contrario de la verdad: manda el permiso de módulo del cargo, que es más
            * ancho. Decirlo es la mitad del valor de la pantalla.
            */}
          {vista.data.sinPerfil && (
            <p className="alert alert-warning">
              Sin perfil no se acota por áreas: esta persona alcanza lo que su cargo permite en los módulos que la
              empresa tiene contratados. Asignarle un perfil es lo que la deja ver sólo su parte.
            </p>
          )}

          {vista.data.avisoDeExtrasGlobales && (
            <p className="alert alert-warning">
              Los accesos concedidos aparte no distinguen empresa: alcanzan a esta persona en todas las empresas que
              atiende, no sólo en {empresa}.
            </p>
          )}

          {porModulo.size === 0 && !vista.data.sinPerfil && (
            <p className="texto-apagado">Su perfil no incluye ninguna parte de ningún módulo.</p>
          )}

          {[...porModulo.entries()].map(([modulo, areas]) => (
            <section key={modulo} className="que-ve-modulo">
              <h4>{NOMBRE_DE_MODULO[modulo] ?? modulo}</h4>
              <ul className="lista-simple">
                {areas.map((area) => (
                  <li key={area.clave} className={ORIGEN[area.origen].clase}>
                    <strong>{area.nombre}</strong>{' '}
                    <small>· {NIVEL[area.nivel]}</small>{' '}
                    <small className="que-ve-origen">{ORIGEN[area.origen].etiqueta}</small>
                    {area.origen !== 'perfil' && (
                      <small className="que-ve-detalle">
                        {area.porQuien ? ` Lo hizo ${area.porQuien}.` : ''}
                        {area.motivo ? ` Motivo: ${area.motivo}.` : ''}
                        {area.venceEl ? ` Vence el ${dia(area.venceEl)}.` : ' Sin fecha de término.'}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="que-ve-datos">
            <h4>Datos protegidos</h4>
            <ul className="lista-simple">
              {vista.data.datosProtegidos.map((fila) => (
                <li key={fila.modulo}>
                  <strong>{fila.nombre}</strong> <small>· {NIVEL_DE_DATOS[fila.nivel]}</small>
                  {fila.incluyeSensibles && fila.nivel !== 'oculto' && (
                    <small className="que-ve-detalle"> Incluye datos de categoría especial.</small>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
