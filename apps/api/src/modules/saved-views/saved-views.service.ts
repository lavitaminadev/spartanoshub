import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { SavedView } from './saved-view.entity';
import type { AuthUser } from '../../shared/types/request';

/** Listas que pueden guardar vistas. Un ámbito libre sería un almacén genérico de JSON por usuario. */
const AMBITO = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){1,3}$/;

/** Filtros: sólo texto plano, pocos y cortos. Es lo que cabe en una barra de filtros. */
const MAXIMO_FILTROS = 20;
const LARGO_MAXIMO_VALOR = 200;

/** Cuántas vistas propias por lista. Con más, el desplegable cuesta tanto como armar el filtro. */
export const MAXIMO_VISTAS_POR_LISTA = 20;

export interface VistaParaLeer {
  id: string;
  name: string;
  filters: Record<string, string>;
  shared: boolean;
  /** Si quien la pide puede borrarla o dejar de compartirla. */
  propia: boolean;
}

/**
 * Normaliza los filtros que llegan del navegador, o falla con un mensaje claro.
 *
 * Se aceptan sólo claves y valores de texto: una vista describe cómo filtrar una lista, y nada
 * de lo que la pantalla necesita para eso es un objeto anidado.
 */
export function limpiarFiltros(filtros: unknown): Record<string, string> {
  if (!filtros || typeof filtros !== 'object' || Array.isArray(filtros)) throw new BadRequestException('Los filtros no tienen un formato válido');
  const entradas = Object.entries(filtros as Record<string, unknown>);
  if (entradas.length > MAXIMO_FILTROS) throw new BadRequestException('Demasiados filtros en una vista');
  const limpios: Record<string, string> = {};
  for (const [clave, valor] of entradas) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(clave)) throw new BadRequestException(`Filtro inválido: ${clave.slice(0, 40)}`);
    if (valor === null || valor === undefined || valor === '') continue;
    if (typeof valor !== 'string' && typeof valor !== 'number' && typeof valor !== 'boolean') throw new BadRequestException(`El filtro ${clave} no es texto`);
    limpios[clave] = String(valor).slice(0, LARGO_MAXIMO_VALOR);
  }
  return limpios;
}

@Injectable()
export class SavedViewsService {
  constructor(@InjectRepository(SavedView) private readonly vistas: Repository<SavedView>) {}

  private validarAmbito(scope: string): string {
    const limpio = (scope ?? '').trim();
    if (!AMBITO.test(limpio) || limpio.length > 80) throw new BadRequestException('Lista inválida');
    return limpio;
  }

  /** Las del portal quedan atadas a su empresa; las del equipo, a ninguna. */
  private empresaDe(user: AuthUser): string | null {
    return user.clientId ?? null;
  }

  /** Las propias y las compartidas del mismo mundo: equipo con equipo, portal con su empresa. */
  async listar(user: AuthUser, scope: string): Promise<VistaParaLeer[]> {
    const ambito = this.validarAmbito(scope);
    const empresa = this.empresaDe(user);
    const qb = this.vistas.createQueryBuilder('v')
      .where('v.organizationId = :org AND v.scope = :ambito', { org: user.organizationId, ambito })
      .andWhere(empresa ? 'v.clientId = :empresa' : 'v.clientId IS NULL', empresa ? { empresa } : {})
      .andWhere(new Brackets((w) => w.where('v.ownerUserId = :yo', { yo: user.id }).orWhere('v.shared = :si', { si: true })))
      .orderBy('v.name', 'ASC')
      .take(100);
    const filas = await qb.getMany();
    return filas.map((fila) => ({ id: fila.id, name: fila.name, filters: fila.filters ?? {}, shared: fila.shared, propia: fila.ownerUserId === user.id }));
  }

  /**
   * Guarda o reemplaza una vista propia por su nombre.
   *
   * Repetir un nombre reemplaza la vista en vez de crear otra igual: dos «Hoy» que sólo se
   * distinguen abriéndolos es peor que ninguno.
   */
  async guardar(user: AuthUser, datos: { scope: string; name: string; filters: unknown; shared?: boolean }): Promise<VistaParaLeer> {
    const ambito = this.validarAmbito(datos.scope);
    const nombre = (datos.name ?? '').trim().slice(0, 60);
    if (!nombre) throw new BadRequestException('La vista necesita un nombre');
    const filtros = limpiarFiltros(datos.filters);

    const existente = await this.vistas.findOne({ where: { ownerUserId: user.id, scope: ambito, name: nombre } });
    if (!existente) {
      const cuantas = await this.vistas.count({ where: { ownerUserId: user.id, scope: ambito } });
      if (cuantas >= MAXIMO_VISTAS_POR_LISTA) throw new BadRequestException(`Ya tienes ${MAXIMO_VISTAS_POR_LISTA} vistas en esta lista. Borra alguna para guardar otra.`);
    }

    const guardada = await this.vistas.save(this.vistas.create({
      ...(existente ?? {}),
      organizationId: user.organizationId,
      clientId: this.empresaDe(user),
      ownerUserId: user.id,
      scope: ambito,
      name: nombre,
      filters: filtros,
      shared: datos.shared ?? existente?.shared ?? false,
    }));
    return { id: guardada.id, name: guardada.name, filters: guardada.filters, shared: guardada.shared, propia: true };
  }

  /** Sólo quien la creó la comparte, la deja de compartir o la borra. */
  private async propia(user: AuthUser, id: string): Promise<SavedView> {
    const vista = await this.vistas.findOne({ where: { id, organizationId: user.organizationId } });
    if (!vista) throw new NotFoundException('Vista no encontrada');
    if (vista.ownerUserId !== user.id) throw new ForbiddenException('Sólo quien creó la vista puede cambiarla');
    return vista;
  }

  async compartir(user: AuthUser, id: string, shared: boolean): Promise<VistaParaLeer> {
    const vista = await this.propia(user, id);
    vista.shared = Boolean(shared);
    const guardada = await this.vistas.save(vista);
    return { id: guardada.id, name: guardada.name, filters: guardada.filters, shared: guardada.shared, propia: true };
  }

  async borrar(user: AuthUser, id: string): Promise<{ deleted: true }> {
    const vista = await this.propia(user, id);
    await this.vistas.delete({ id: vista.id });
    return { deleted: true };
  }
}
