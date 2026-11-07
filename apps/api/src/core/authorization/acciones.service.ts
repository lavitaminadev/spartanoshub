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
  /**
   * De qué empresa es el ajuste que manda, cuando hay uno.
   *
   * `null` con `origen: 'ajuste'` significa que ese ajuste vale en **todas** las empresas de esa
   * persona. La pantalla lo necesita para poder decirlo y ofrecer acotarlo: un ajuste general que
   * se ve bajo una empresa elegida se lee como suyo, y no lo es.
   */
  empresaDelAjuste?: string | null;
}

@Injectable()
export class AccionesService {
  constructor(
    @InjectRepository(UserActionOverride) private readonly ajustes: Repository<UserActionOverride>,
    private readonly permisos: PermissionResolverService,
  ) {}

  /**
   * @param clientId - Empresa sobre la que se pregunta. Los niveles de los que cuelgan las
   *   acciones se conceden empresa por empresa, así que sin ella una acción de un módulo
   *   entregado sólo en un local se anunciaba como negada estando dentro de ese local.
   */
  async explicar(organizationId: string, userId: string, role: UserRole, clientId?: string): Promise<AccionEfectiva[]> {
    const [niveles, filas] = await Promise.all([
      this.permisos.permissionsFor(organizationId, userId, role, clientId),
      this.ajustes.find({ where: { organizationId, userId } }),
    ]);
    const porAccion = this.ajustesVigentes(filas, clientId);
    return ACCIONES.map((accion) => {
      const porNivel = satisfies(niveles[accion.modulo] ?? 'none', accion.nivelPorDefecto);
      const ajuste = porAccion.get(accion.clave);
      // Un ajuste nunca abre una acción de un módulo al que la persona no entra.
      const permitida = ajuste ? ajuste.allowed && (niveles[accion.modulo] ?? 'none') !== 'none' : porNivel;
      return { clave: accion.clave, modulo: accion.modulo, nombre: accion.nombre, ayuda: accion.ayuda, permitida, porNivel, origen: ajuste ? 'ajuste' : 'nivel', empresaDelAjuste: ajuste ? ajuste.clientId ?? null : undefined };
    });
  }

  /**
   * El ajuste que manda en cada acción.
   *
   * Es la misma regla que ya aplica `permission-resolver` a las excepciones de módulo, y tiene
   * que ser la misma: el de la empresa que se está mirando gana sobre el general —lo particular
   * describe mejor el caso que la regla de siempre—, los de otras empresas no se miran, y uno
   * vencido tampoco, porque dejarlo aplicando mientras se muestra como vencido es exactamente el
   * fallo que el vencimiento existe para evitar.
   *
   * Sin esta resolución la columna `client_id` no serviría de nada al leer: un ajuste concedido
   * en un local seguiría rigiendo en todos.
   *
   * @param clientId - Empresa sobre la que se pregunta, si hay una.
   */
  private ajustesVigentes(filas: UserActionOverride[], clientId?: string): Map<string, UserActionOverride> {
    const ahora = Date.now();
    const resultado = new Map<string, UserActionOverride>();
    for (const fila of filas) {
      if (fila.expiresAt && fila.expiresAt.getTime() <= ahora) continue;
      if (fila.clientId && fila.clientId !== clientId) continue;
      const anterior = resultado.get(fila.action);
      if (anterior?.clientId && !fila.clientId) continue;
      resultado.set(fila.action, fila);
    }
    return resultado;
  }

  async puede(organizationId: string, userId: string, role: UserRole, clave: string, clientId?: string): Promise<boolean> {
    if (role === UserRole.DEV) return true;
    if (!definicionDeAccion(clave)) return false;
    const acciones = await this.explicar(organizationId, userId, role, clientId);
    return acciones.find((accion) => accion.clave === clave)?.permitida ?? false;
  }
}
