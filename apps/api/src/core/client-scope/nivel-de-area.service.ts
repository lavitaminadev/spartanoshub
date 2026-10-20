import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { alcanza, definicionDeArea, nivelEfectivo, type JuegoDeAreas, type NivelDeArea } from '@espartanos/shared';
import { PerfilAsignacion } from '../../modules/users/perfiles/perfil-asignacion.entity';
import { PerfilDeEmpresa } from '../../modules/users/perfiles/perfil-de-empresa.entity';
import { UserActionOverride } from '../authorization/user-action-override.entity';

/**
 * Hasta dónde llega una persona en un área de un módulo, dentro de una empresa.
 *
 * Es el único sitio donde se decide: las rutas preguntan y no resuelven por su cuenta. Resolverlo
 * ruta por ruta es exactamente cómo aparecieron los cuatro idiomas de acotado que el forense
 * encontró, y después nadie puede contestar «¿quién puede hacer esto?» sin leer veinte archivos.
 *
 * El nivel sale del perfil de esa persona en esa empresa, más sus excepciones. Las excepciones
 * **conceden y también quitan**: sin lo segundo habría que inventar un perfil nuevo cada vez que
 * alguien concreto necesita una cosa menos, y los perfiles dejarían de significar algo.
 *
 * **Sin perfil asignado no se bloquea nada.** Manda el permiso de módulo, como antes de que los
 * perfiles existieran. Es lo que permite repartirlos poco a poco sin dejar a nadie sin trabajar
 * el día del despliegue: quien no tiene perfil sigue operando igual que ayer.
 */
@Injectable()
export class NivelDeAreaService {
  constructor(
    @InjectRepository(PerfilAsignacion) private readonly asignaciones: Repository<PerfilAsignacion>,
    @InjectRepository(PerfilDeEmpresa) private readonly perfiles: Repository<PerfilDeEmpresa>,
    @InjectRepository(UserActionOverride) private readonly extras: Repository<UserActionOverride>,
  ) {}

  /**
   * Si esta persona alcanza el nivel pedido sobre el área, en esa empresa.
   *
   * Devuelve `true` cuando no hay perfil: el área no se exige a quien todavía no tiene uno.
   */
  async alcanzaArea(
    organizationId: string,
    userId: string,
    clientId: string | undefined,
    clave: string,
    nivel: NivelDeArea,
  ): Promise<boolean> {
    // Una clave que no está en el catálogo es un error de programación, no una negativa: dejarlo
    // pasar en silencio escondería la ruta mal escrita hasta que alguien la reclamara.
    if (!definicionDeArea(clave)) {
      throw new Error(`Área desconocida: «${clave}». Las válidas están en packages/shared/src/areas.ts`);
    }
    if (!clientId) return true;

    const perfil = await this.perfilDe(organizationId, userId, clientId);
    if (!perfil) return true;

    const extras = await this.extrasDe(organizationId, userId, clientId);
    return alcanza(nivelEfectivo(perfil.areas ?? {}, extras, clave), nivel);
  }

  private async perfilDe(organizationId: string, userId: string, clientId: string): Promise<PerfilDeEmpresa | null> {
    const asignacion = await this.asignaciones.findOne({ where: { organizationId, userId, clientId } });
    if (!asignacion) return null;
    return this.perfiles.findOne({ where: { id: asignacion.perfilId } });
  }

  /**
   * Lo escrito para esta persona en esta empresa, que gana sobre el perfil.
   *
   * Se guardan en `user_action_override`, que ya existía para las acciones sueltas y admite
   * conceder y quitar con su motivo y quién lo hizo. Una excepción vencida no cuenta: la
   * caducidad es lo que evita que lo prestado se quede para siempre.
   */
  private async extrasDe(organizationId: string, userId: string, clientId: string): Promise<JuegoDeAreas> {
    const filas = await this.extras.find({ where: { organizationId, userId } });
    const ahora = Date.now();
    const juego: Record<string, NivelDeArea> = {};

    for (const fila of filas) {
      const propio = (fila as { clientId?: string | null }).clientId;
      if (propio && propio !== clientId) continue;
      const vence = (fila as { expiresAt?: Date | null }).expiresAt;
      if (vence && vence.getTime() <= ahora) continue;
      if (!definicionDeArea(fila.action)) continue;
      juego[fila.action] = fila.allowed ? 'hacer' : 'ninguno';
    }
    return juego;
  }
}
