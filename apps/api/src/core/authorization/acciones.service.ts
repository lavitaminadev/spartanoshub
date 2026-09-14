/**
 * @fileoverview Resuelve si una persona puede hacer una acción concreta.
 *
 * Primero su ajuste personal, si existe; si no, el nivel de su módulo contra el nivel por
 * defecto de la acción. Así, sin ajustes, nada cambia respecto de antes.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { ACCIONES, definicionDeAccion } from './acciones';
import { satisfies } from './permission-level';
import { PermissionResolverService } from './permission-resolver.service';
import { UserActionOverride } from './user-action-override.entity';

export interface AccionEfectiva {
  clave: string;
  modulo: string;
  nombre: string;
  ayuda: string;
  permitida: boolean;
  /** Lo que daría su nivel sin ajuste. */
  porNivel: boolean;
  origen: 'nivel' | 'ajuste';
}

@Injectable()
export class AccionesService {
  constructor(
    @InjectRepository(UserActionOverride) private readonly ajustes: Repository<UserActionOverride>,
    private readonly permisos: PermissionResolverService,
  ) {}

  async explicar(organizationId: string, userId: string, role: UserRole): Promise<AccionEfectiva[]> {
    const [niveles, filas] = await Promise.all([
      this.permisos.permissionsFor(organizationId, userId, role),
      this.ajustes.find({ where: { organizationId, userId } }),
    ]);
    const porAccion = new Map(filas.map((fila) => [fila.action, fila]));
    return ACCIONES.map((accion) => {
      const porNivel = satisfies(niveles[accion.modulo] ?? 'none', accion.nivelPorDefecto);
      const ajuste = porAccion.get(accion.clave);
      // Un ajuste nunca abre una acción de un módulo al que la persona no entra.
      const permitida = ajuste ? ajuste.allowed && (niveles[accion.modulo] ?? 'none') !== 'none' : porNivel;
      return { clave: accion.clave, modulo: accion.modulo, nombre: accion.nombre, ayuda: accion.ayuda, permitida, porNivel, origen: ajuste ? 'ajuste' : 'nivel' };
    });
  }

  async puede(organizationId: string, userId: string, role: UserRole, clave: string): Promise<boolean> {
    if (role === UserRole.DEV) return true;
    if (!definicionDeAccion(clave)) return false;
    const acciones = await this.explicar(organizationId, userId, role);
    return acciones.find((accion) => accion.clave === clave)?.permitida ?? false;
  }
}
