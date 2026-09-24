import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';

/** Cargos internos que administran a todo el equipo de la organización. */
const CARGOS_INTERNOS = [UserRole.ADMIN, UserRole.DEV, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR];

/**
 * Hasta dónde llega quien está administrando cuentas.
 *
 * `undefined` en `soloEmpresa` es el alcance de siempre: toda la organización. Un valor es una
 * empresa concreta, y entonces quien administra solo ve y solo toca las cuentas de esa empresa.
 */
export interface AlcanceDeAdministracion {
  soloEmpresa?: string;
}

/**
 * Quién puede administrar cuentas, y de quiénes.
 *
 * Administrar el equipo estaba reservado a los cargos internos, así que cada cuenta de una
 * empresa cliente la tenía que crear la agencia a mano. Ahora también puede hacerlo alguien de
 * la empresa, si tiene el permiso de administrar «users» en ella.
 *
 * Es un permiso y no un cargo a propósito: el cargo es uno solo por persona, y hay quien
 * administra una empresa y en otra solo mira. Con el permiso por empresa, cada empresa decide
 * por separado y la misma persona puede tener un alcance distinto en cada una.
 */
@Injectable()
export class AdministracionDelEquipoService {
  constructor(
    private readonly permisos: PermissionResolverService,
    private readonly alcanceDeCuentas: AccountAccessService,
  ) {}

  /**
   * Resuelve el alcance de quien hace la petición, o rechaza si no administra cuentas.
   *
   * @param request - Petición autenticada.
   * @param empresaPedida - Empresa sobre la que se está trabajando, cuando se atiende más de
   *   una. Se acepta solo si esa persona la alcanza; cualquier otra cae en la de su cuenta.
   * @throws ForbiddenException - Si no es un cargo interno ni tiene el permiso en su empresa.
   */
  async alcance(request: AuthenticatedRequest, empresaPedida?: string): Promise<AlcanceDeAdministracion> {
    const rol = request.user.role as UserRole;
    if (CARGOS_INTERNOS.includes(rol)) return {};

    /*
     * Sin empresa en la sesión no hay nada que acotar.
     *
     * Devolver el alcance completo sería darle a una cuenta externa el equipo entero de la
     * organización, así que la ausencia se trata como un no.
     */
    /*
     * La empresa sobre la que se administra, no la de la sesión.
     *
     * Con la de la sesión, cambiar de local en el menú dejaba esta pantalla mostrando el equipo
     * del anterior: se crean cuentas y se reparten accesos creyendo estar en el otro local.
     *
     * Lo pedido solo se acepta si esa persona lo alcanza de verdad; una empresa escrita a mano
     * en la dirección cae en la de su cuenta y no abre nada.
     */
    const organizacion = request.organizationId || request.user.organizationId;
    if (!organizacion) throw new ForbiddenException('Tu cuenta no administra personas');
    const alcanzables = await this.alcanceDeCuentas.allowedClientIds(organizacion, request.user);
    const empresa = empresaPedida && alcanzables?.includes(empresaPedida)
      ? empresaPedida
      : request.user.clientId;
    if (!empresa) throw new ForbiddenException('Tu cuenta no administra personas');

    const puede = await this.permisos.can(organizacion, request.user.id, rol, 'users', 'manage', empresa);
    if (!puede) throw new ForbiddenException('Tu cuenta no administra personas');
    return { soloEmpresa: empresa };
  }

  /**
   * Comprueba que la cuenta a tocar esté dentro del alcance.
   *
   * @param alcance - Lo que devolvió `alcance()`.
   * @param destino - Empresa y cargo de la cuenta que se quiere crear o modificar.
   */
  asegurarDentro(alcance: AlcanceDeAdministracion, destino: { clientId?: string | null; role?: string | null }): void {
    if (!alcance.soloEmpresa) return;
    if (destino.clientId !== alcance.soloEmpresa) throw new ForbiddenException('Esa cuenta es de otra empresa');
    // Quien administra una empresa no crea ni edita cuentas de la agencia: es su equipo, no el nuestro.
    if (destino.role && destino.role !== UserRole.CLIENT) throw new ForbiddenException('Solo puedes administrar cuentas de tu empresa');
  }
}
