import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { REQUIRES_PERMISSION_KEY, RequiredPermission } from './requires-permission.decorator';
import { MODULE_EXEMPT_KEY, MODULE_SCOPE_KEY } from './module-scope.decorator';
import { REQUIRES_FEATURE_KEY } from './requires-feature.decorator';
import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionLevel } from './permission-level';
import { isModuleInInitialOperationScope } from '@espartanos/shared';
import { ClientCapabilityService } from '../client-scope/client-capability.service';
import type { ClientCapabilityKey } from '../../modules/clients/client-capabilities';

/** Módulos que son un servicio contratado por empresa: sin el servicio, la empresa no entra. */
const MODULOS_CONTRATADOS = new Set<string>(['crm', 'reservations', 'surveys']);

/**
 * Nivel que exige cada verbo cuando el endpoint no declara uno propio.
 *
 * Consultar exige `view`, crear o modificar exige `edit`, y borrar exige `manage` porque es
 * la única operación que no admite corrección posterior.
 */
const LEVEL_BY_METHOD: Record<string, PermissionLevel> = {
  GET: 'view',
  HEAD: 'view',
  OPTIONS: 'view',
  POST: 'edit',
  PUT: 'edit',
  PATCH: 'edit',
  DELETE: 'manage',
};

/**
 * Aplica los permisos configurados sobre cada endpoint autenticado.
 *
 * El módulo se toma, en este orden, de `@RequiresPermission`, `@ModuleScope` o
 * `@RequiresFeature`; el nivel, del propio `@RequiresPermission` o del verbo HTTP.
 *
 * Un endpoint que no declara módulo ni exención se rechaza. Negar por omisión es lo que
 * hace que la pantalla de permisos gobierne de verdad: mientras lo no anotado pasaba libre,
 * quitarle un módulo a una persona ocultaba su menú pero la API le seguía respondiendo.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionResolverService,
    @Optional() private readonly capacidades?: ClientCapabilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets: [Function, Function] = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<string>(MODULE_EXEMPT_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const organizationId: string | undefined = request.organizationId ?? request.user?.organizationId;
    const user = request.user;
    if (!organizationId || !user?.id || !user?.role) {
      throw new ForbiddenException('No se pudo determinar el usuario o la organización de la petición');
    }

    const required = this.resolveRequirement(context, targets);
    if (!required) {
      // Un endpoint sin módulo declarado es un descuido de programación, no una decisión de
      // producto. Se registra con su ruta para que aparezca en los registros de la
      // aplicación en vez de quedar como un 403 sin explicación.
      this.logger.error(`Endpoint sin módulo declarado: ${request.method} ${request.url}`);
      throw new ForbiddenException('Este endpoint no tiene módulo declarado');
    }

    // La superficie inicial se corta también en la puerta HTTP. El resolutor aplica la misma
    // regla al construir el menú y los permisos efectivos; mantener este corte acá evita que
    // un controlador nuevo o una caché mal invalidada expongan un módulo futuro por URL.
    if (!isModuleInInitialOperationScope(required.module, user.role)) {
      throw new ForbiddenException('Este módulo aún no está disponible en la operación');
    }

    /*
     * La empresa sobre la que se está trabajando, si la hay.
     *
     * Hay permisos que se entregan empresa por empresa —administrar el equipo es el caso— y
     * viven como excepción con `client_id`. Resolver sin decir cuál las descarta todas, así que
     * la puerta negaba lo que la base concedía: una cuenta de empresa con «Administra el equipo»
     * marcado recibía 403 en cada ruta de Usuarios, y el servicio que sí mira la empresa nunca
     * llegaba a ejecutarse.
     *
     * Se toma de la ruta, de la consulta, del cuerpo o, en el portal, de la cuenta; la misma
     * procedencia —más la ruta— que ya usaba la comprobación de servicios contratados.
     */
    const empresa = this.empresaDeLaPeticion(request, user);

    const allowed = await this.permissions.can(organizationId, user.id, user.role, required.module, required.level, empresa);
    if (!allowed) throw new ForbiddenException('No tienes acceso a este módulo');

    /*
     * La empresa pedida tiene que tener contratado el servicio del módulo.
     *
     * Varias rutas lo comprobaban una por una y otras no —campañas, etapas, reglas,
     * oportunidades—: una empresa sin CRM se podía elegir y configurar igual. Aquí queda una sola
     * vez para todas. La empresa sale de la consulta, del cuerpo o, en el portal, de la cuenta.
     */
    if (this.capacidades && MODULOS_CONTRATADOS.has(required.module) && empresa) {
      await this.capacidades.assert(organizationId, empresa, required.module as ClientCapabilityKey);
    }
    return true;
  }

  /**
   * La empresa sobre la que va esta petición, si viene alguna.
   *
   * Nombrar una empresa no concede nada: solo hace que se miren las excepciones escritas para
   * ella. Una empresa ajena escrita a mano en la dirección no encuentra ninguna, y las rutas que
   * después tocan datos siguen comprobándola contra el alcance de la cuenta.
   */
  private empresaDeLaPeticion(request: any, user: { role?: string; clientId?: string }): string | undefined {
    // La ruta primero: `PUT users/:id/administra/:clientId` dice en la propia dirección sobre qué
    // empresa actúa, y sin leerla quien administra un segundo local se medía contra el primero.
    const pedida = request.params?.clientId ?? request.query?.clientId ?? request.body?.clientId
      ?? (user.role === 'client' ? user.clientId : undefined);
    return typeof pedida === 'string' && pedida ? pedida : undefined;
  }

  /** Módulo y nivel exigidos por el endpoint, o `undefined` si no declara ninguno. */
  private resolveRequirement(context: ExecutionContext, targets: [Function, Function]): RequiredPermission | undefined {
    const explicit = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRES_PERMISSION_KEY, targets);
    if (explicit) return explicit;

    const module = this.reflector.getAllAndOverride<OrganizationFeatureKey>(MODULE_SCOPE_KEY, targets)
      ?? this.reflector.getAllAndOverride<OrganizationFeatureKey>(REQUIRES_FEATURE_KEY, targets);
    if (!module) return undefined;

    const method = context.switchToHttp().getRequest().method as string;
    return { module, level: LEVEL_BY_METHOD[method] ?? 'manage' };
  }
}
