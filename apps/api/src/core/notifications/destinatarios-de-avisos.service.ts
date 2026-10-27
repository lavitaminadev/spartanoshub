import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  DestinatarioDeAvisos, TIPOS_DE_AVISO_VALIDOS, type TipoDeAviso,
} from './destinatario-de-avisos.entity';

/** Lo que hace falta para anotar o corregir una casilla del equipo. */
export interface DatosDeDestinatario {
  email: string;
  name?: string | null;
  cargo?: string | null;
  tipos?: string[] | null;
}

/**
 * Quién del equipo recibe cada aviso.
 *
 * Un solo punto de resolución, y es lo importante: antes cada aviso sacaba las direcciones por su
 * cuenta —uno del formulario, el de encuestas con una consulta SQL propia, y el de pausa de ningún
 * sitio—, así que «a quién le llega esto» no se podía responder sin leer seis archivos. Con esto la
 * respuesta es una función y cambiarla cambia todos los avisos a la vez.
 */
@Injectable()
export class DestinatariosDeAvisosService {
  constructor(
    @InjectRepository(DestinatarioDeAvisos)
    private readonly repo: Repository<DestinatarioDeAvisos>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Las direcciones a las que toca escribir un aviso de este tipo en este local.
   *
   * @param heredadas Las del campo antiguo del formulario, si el local todavía las usa. Reciben
   *   **todos** los tipos, que es lo que hacían hasta ahora: quitarles avisos al pasar por aquí
   *   sería apagarle en silencio los correos a alguien que los venía recibiendo.
   * @returns Direcciones únicas y en minúsculas. Vacío significa que no hay a quién escribir, y el
   *   aviso simplemente no sale: nunca se cae hacia un destinatario por defecto, porque escribirle
   *   a quien no corresponde es peor que no escribir.
   */
  async para(
    organizationId: string,
    clientId: string | null | undefined,
    tipo: TipoDeAviso,
    heredadas: string[] = [],
  ): Promise<string[]> {
    const correos = new Set<string>();
    for (const correo of heredadas) {
      if (typeof correo === 'string' && correo.includes('@')) correos.add(correo.trim().toLowerCase());
    }

    if (clientId) {
      const filas = await this.repo.find({ where: { organizationId, clientId } });
      for (const fila of filas) {
        if (fila.recibe(tipo)) correos.add(fila.email);
      }
    }

    return [...correos];
  }

  /**
   * De estas direcciones, las que son una cuenta activa con nivel `directo` sobre los datos
   * protegidos de un módulo en este local.
   *
   * Es la única comprobación de «esta dirección es alguien con nivel» que hacen los correos: una
   * dirección escrita a mano en ajustes —un buzón compartido— no tiene perfil ni nivel y nunca
   * entra al resultado. Lo que no se pueda resolver (sin cuenta, sin perfil, perfil ilegible, la
   * consulta falla) queda fuera: la duda se resuelve recortando, nunca entregando.
   */
  async conNivelDirecto(
    organizationId: string,
    clientId: string,
    modulo: string,
    correos: string[],
  ): Promise<Set<string>> {
    const candidatos = [...new Set(correos.map((c) => c.trim().toLowerCase()).filter(Boolean))];
    if (!candidatos.length) return new Set();
    try {
      const filas = (await this.dataSource.query(
        `SELECT LOWER(u.email) AS email, p.protected_data AS datos
           FROM users u
           JOIN perfil_asignaciones a ON a.user_id = u.id AND a.client_id = ? AND a.organization_id = ?
           JOIN perfiles p ON p.id = a.perfil_id AND p.client_id = ? AND p.organization_id = ?
          WHERE u.organization_id = ? AND u.is_active = 1 AND LOWER(u.email) IN (?)`,
        [clientId, organizationId, clientId, organizationId, organizationId, candidatos],
      )) as Array<{ email: string; datos: unknown }>;
      const directos = new Set<string>();
      for (const fila of filas ?? []) {
        let datos: unknown = fila.datos;
        if (typeof datos === 'string') {
          try { datos = JSON.parse(datos); } catch { continue; }
        }
        if ((datos as Record<string, unknown> | null)?.[modulo] === 'directo') directos.add(fila.email);
      }
      return directos;
    } catch {
      return new Set();
    }
  }

  /** Las casillas anotadas en un local, para la pantalla que las mantiene. */
  async listar(organizationId: string, clientId: string): Promise<DestinatarioDeAvisos[]> {
    return this.repo.find({ where: { organizationId, clientId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Anota una casilla, o corrige la que ya estuviera con ese correo en ese local.
   *
   * Corrige en vez de fallar porque el error que se comete es volver a agregar a alguien que ya
   * estaba para cambiarle los avisos, y un choque de clave única ahí no explica nada.
   */
  async guardar(
    organizationId: string,
    clientId: string,
    datos: DatosDeDestinatario,
    actor?: string,
  ): Promise<DestinatarioDeAvisos> {
    const email = datos.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('Falta una dirección de correo válida');
    const tipos = this.tiposValidos(datos.tipos);

    const existente = await this.repo.findOne({ where: { organizationId, clientId, email } });
    if (existente) {
      existente.name = datos.name ?? existente.name ?? null;
      existente.cargo = datos.cargo ?? existente.cargo ?? null;
      existente.tipos = tipos;
      return this.repo.save(existente);
    }

    return this.repo.save(this.repo.create({
      organizationId, clientId, email,
      name: datos.name ?? null,
      cargo: datos.cargo ?? null,
      tipos,
      createdBy: actor ?? null,
    }));
  }

  async borrar(organizationId: string, clientId: string, id: string): Promise<void> {
    const fila = await this.repo.findOne({ where: { id, organizationId, clientId } });
    if (!fila) throw new NotFoundException('Esta casilla no está anotada en este local');
    await this.repo.remove(fila);
  }

  /**
   * Descarta lo que no sea un tipo conocido.
   *
   * Callando y no fallando: un tipo que dejó de existir en una lista guardada no es motivo para
   * impedir que se corrija la fila, y dejarlo pasar haría que un aviso se resolviera por un nombre
   * que ya no significa nada.
   */
  private tiposValidos(tipos?: string[] | null): string[] {
    if (!Array.isArray(tipos)) return [];
    return TIPOS_DE_AVISO_VALIDOS.filter((valido) => tipos.includes(valido));
  }
}
