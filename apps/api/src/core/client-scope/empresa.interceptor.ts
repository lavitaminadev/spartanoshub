import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { AccountAccessService } from './account-access.service';
import { AGENCIA, resolverEmpresa, type AmbitoDeEmpresa } from './empresa-resuelta';

/** Dónde queda el ámbito resuelto, para que `@Empresa()` lo lea sin resolverlo otra vez. */
export const EMPRESA_RESUELTA = Symbol('empresaResuelta');

/**
 * Resuelve, una sola vez por petición, sobre qué empresa va.
 *
 * Que exista un único sitio es el punto: la misma decisión estaba reescrita en dieciséis
 * archivos, y dos resoluciones distintas sobre la misma petición es cómo una escritura acaba en
 * la empresa equivocada respondiendo 200.
 *
 * Resolver no autoriza nada. El resultado es sólo la empresa que la cuenta alcanza —o `AGENCIA`
 * cuando no tiene límite—; qué módulo, qué capacidad contratada y qué área hacen falta lo siguen
 * decidiendo las tres rejas de `PermissionGuard`.
 *
 * La empresa se lee de la ruta, de la consulta o del cuerpo, en ese orden: la ruta es la más
 * explícita —`PUT users/:id/administra/:clientId` dice en la dirección sobre qué empresa actúa— y
 * leer primero la consulta hacía que quien administra un segundo local se midiera contra el
 * primero.
 *
 * Un error al resolver no se lanza aquí. Una petición que no declara empresa teniendo varias es
 * un 400, pero sólo si la ruta necesitaba una: muchas no, y fallar en el interceptor rompería
 * todas por igual. Se guarda y lo lanza `@Empresa()`, que es quien sabe que hacía falta.
 */
@Injectable()
export class EmpresaInterceptor implements NestInterceptor {
  constructor(private readonly accesos: AccountAccessService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId: string | undefined = request.organizationId ?? user?.organizationId;

    if (user?.id && organizationId) {
      const pedida = request.params?.clientId ?? request.query?.clientId ?? request.body?.clientId;
      try {
        request[EMPRESA_RESUELTA] = await resolverEmpresa(typeof pedida === 'string' ? pedida : undefined, user, {
          alcanzables: await this.accesos.allowedClientIds(organizationId, user),
          comprobar: (clientId) => this.accesos.assertClient(organizationId, user, clientId),
        });
      } catch (error) {
        request[EMPRESA_RESUELTA] = error as Error;
      }
    }

    return next.handle();
  }
}

/** El ámbito que el interceptor dejó, o el error que encontró al resolverlo. */
export function ambitoDeLaPeticion(request: Record<PropertyKey, unknown>): AmbitoDeEmpresa | Error | undefined {
  const guardado = request[EMPRESA_RESUELTA];
  if (guardado instanceof Error) return guardado;
  return typeof guardado === 'string' ? (guardado as AmbitoDeEmpresa) : undefined;
}

export { AGENCIA };
