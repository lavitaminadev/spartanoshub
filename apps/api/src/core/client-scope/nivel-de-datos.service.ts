import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { datosEfectivos, recortarProtegidos, sePuedePedir, type NivelDeDatosProtegidos, type OrganizationModuleKey } from '@espartanos/shared';
import { PerfilAsignacion } from '../../modules/users/perfiles/perfil-asignacion.entity';
import { PerfilDeEmpresa } from '../../modules/users/perfiles/perfil-de-empresa.entity';
import { AdministradoresDeEmpresaService } from '../../modules/users/administradores-de-empresa.service';

/**
 * Cuánto de los datos protegidos de cada empresa ve una persona.
 *
 * Se resuelve una vez por petición y se consulta por empresa: una lista puede mezclar reservas de
 * varios locales y cada una se recorta según lo que esa persona es en *esa* empresa.
 */
export interface NivelesDeDatos {
  /** El nivel para los datos de una empresa. Sin empresa no hay forma de comprobar nada: el menos abierto. */
  de(clientId: string | null | undefined): NivelDeDatosProtegidos;
  /**
   * El nivel para un conjunto de empresas, que es el de la que menos abre.
   * `undefined` es «todas»: no se puede comprobar una por una y se trata como la más cerrada.
   */
  deTodas(clientIds: readonly string[] | undefined): NivelDeDatosProtegidos;
}

const ORDEN: readonly NivelDeDatosProtegidos[] = ['oculto', 'bajo_registro', 'directo'];

/** El menos abierto de varios niveles. */
export function elMasRestrictivo(niveles: readonly NivelDeDatosProtegidos[]): NivelDeDatosProtegidos {
  if (niveles.length === 0) return 'bajo_registro';
  return niveles.reduce((peor, nivel) => (ORDEN.indexOf(nivel) < ORDEN.indexOf(peor) ? nivel : peor));
}

/** Un resolvedor que da el mismo nivel a todas las empresas. Lo usan las pruebas y los trabajos sin persona. */
export function nivelesFijos(nivel: NivelDeDatosProtegidos): NivelesDeDatos {
  return { de: () => nivel, deTodas: () => nivel };
}

/** Lo que una pantalla necesita para decidir si ofrece el botón «Ver» en una fila recortada. */
export interface AvisoDeDatosProtegidos {
  campos: readonly string[];
  sePuedePedir: boolean;
}

/**
 * Recorta cada fila según el nivel de su empresa.
 *
 * Las filas que salen recortadas llevan `datosProtegidos` para que la pantalla sepa qué decir.
 * Las que salen completas no llevan nada: el nivel `directo` deja la respuesta como siempre.
 */
export function recortarFilasPorEmpresa<T extends { clientId?: string | null }>(
  filas: readonly T[],
  modulo: OrganizationModuleKey,
  niveles: NivelesDeDatos,
): Array<T & { datosProtegidos?: AvisoDeDatosProtegidos }> {
  return filas.map((fila) => {
    const nivel = niveles.de(fila.clientId);
    const { datos, recortados } = recortarProtegidos(fila as unknown as Record<string, unknown>, modulo, nivel);
    return recortados.length === 0 ? (datos as unknown as T) : { ...(datos as unknown as T), datosProtegidos: { campos: recortados, sePuedePedir: sePuedePedir(nivel) } };
  });
}

/**
 * Dónde se decide el nivel de datos protegidos de una persona.
 *
 * Es el único sitio: las rutas y las exportaciones preguntan aquí y no deciden por su cuenta.
 *
 * El nivel sale del **perfil que esa persona tiene en esa empresa**, para el módulo pedido. Va por
 * módulo porque no es lo mismo el teléfono de un prospecto, que comercial necesita para llamarlo,
 * que el documento de un comensal, que casi nadie necesita para atender.
 *
 * Sin perfil asignado manda quien administra: la empresa ve sus datos `directo` y el resto
 * `bajo_registro` —lo ven si lo piden y queda anotado quién—. Ése era el comportamiento antes de
 * que existieran los perfiles, y conservarlo evita que el día del despliegue un local se quede
 * sin poder atender porque nadie había repartido perfiles todavía.
 */
@Injectable()
export class NivelDeDatosService {
  constructor(
    private readonly administradores: AdministradoresDeEmpresaService,
    @InjectRepository(PerfilAsignacion) private readonly asignaciones: Repository<PerfilAsignacion>,
    @InjectRepository(PerfilDeEmpresa) private readonly perfiles: Repository<PerfilDeEmpresa>,
  ) {}

  async nivelesDe(organizationId: string, userId: string, modulo: OrganizationModuleKey): Promise<NivelesDeDatos> {
    const [administradas, porEmpresa] = await Promise.all([
      this.administradores.empresasQueAdministra(organizationId, userId).then((lista) => new Set(lista)),
      this.perfilesPorEmpresa(organizationId, userId),
    ]);

    const de = (clientId: string | null | undefined): NivelDeDatosProtegidos => {
      if (!clientId) return 'bajo_registro';
      const perfil = porEmpresa.get(clientId);
      // `datosEfectivos` trata lo ausente como `oculto`, que es lo correcto cuando hay perfil:
      // lo que no se concedió, no se tiene.
      if (perfil) return datosEfectivos(perfil.datosProtegidos ?? {}, {}, modulo);
      return administradas.has(clientId) ? 'directo' : 'bajo_registro';
    };

    return {
      de,
      deTodas: (clientIds) => (clientIds === undefined ? 'bajo_registro' : elMasRestrictivo(clientIds.map(de))),
    };
  }

  /** El perfil que esta persona tiene en cada una de sus empresas, en una sola consulta. */
  private async perfilesPorEmpresa(organizationId: string, userId: string): Promise<Map<string, PerfilDeEmpresa>> {
    const asignaciones = await this.asignaciones.find({ where: { organizationId, userId } });
    if (!asignaciones.length) return new Map();

    const perfiles = await this.perfiles.find({
      where: { id: In(asignaciones.map((asignacion) => asignacion.perfilId)) },
    });
    const porId = new Map(perfiles.map((perfil) => [perfil.id, perfil]));

    const porEmpresa = new Map<string, PerfilDeEmpresa>();
    for (const asignacion of asignaciones) {
      const perfil = porId.get(asignacion.perfilId);
      if (perfil) porEmpresa.set(asignacion.clientId, perfil);
    }
    return porEmpresa;
  }
}
