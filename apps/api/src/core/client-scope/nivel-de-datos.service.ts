import { Injectable } from '@nestjs/common';
import { recortarProtegidos, sePuedePedir, type NivelDeDatosProtegidos, type OrganizationModuleKey } from '@espartanos/shared';
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
 * Mientras no exista el perfil de cada persona, quien administra el equipo de una empresa ve sus
 * datos `directo` y todos los demás `bajo_registro`: lo ven si lo piden y queda anotado quién.
 * **Aquí se enchufa el perfil** cuando llegue: el nivel pasará a salir del perfil de la persona
 * para el módulo pedido, y `modulo` —que hoy no cambia el resultado— decidirá cuál se consulta.
 */
@Injectable()
export class NivelDeDatosService {
  constructor(private readonly administradores: AdministradoresDeEmpresaService) {}

  async nivelesDe(organizationId: string, userId: string, _modulo: OrganizationModuleKey): Promise<NivelesDeDatos> {
    const administradas = new Set(await this.administradores.empresasQueAdministra(organizationId, userId));
    const de = (clientId: string | null | undefined): NivelDeDatosProtegidos =>
      clientId && administradas.has(clientId) ? 'directo' : 'bajo_registro';
    return {
      de,
      deTodas: (clientIds) => (clientIds === undefined ? 'bajo_registro' : elMasRestrictivo(clientIds.map(de))),
    };
  }
}
