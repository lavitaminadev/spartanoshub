import { createParamDecorator, ExecutionContext, InternalServerErrorException, SetMetadata } from '@nestjs/common';
import { AGENCIA, type AmbitoDeEmpresa } from './empresa-resuelta';
import { ambitoDeLaPeticion } from './empresa.interceptor';

/** Marca que la ruta es de toda la agencia, con el motivo escrito. */
export const SIN_EMPRESA_KEY = 'sinEmpresa';

/**
 * La ruta no va sobre una empresa, y aquí está por qué.
 *
 * Exige el motivo por lo mismo que `@ModuleExempt`: una exención sin explicación se copia al
 * controlador siguiente sin que nadie vuelva a pensarla, y entonces deja de ser una excepción.
 *
 * @param motivo - Por qué esta ruta abarca la agencia: «listado de empresas», «panel agregado de
 *   dirección». No vale «no aplica».
 */
export const SinEmpresa = (motivo: string) => SetMetadata(SIN_EMPRESA_KEY, motivo);

/**
 * La empresa sobre la que va esta petición, ya comprobada contra el alcance de la cuenta.
 *
 * Lo que aporta sobre leerla a mano es que llega comprobada: la empresa que el controlador recibe
 * es una que la cuenta alcanza, o no se llega al controlador. Quien pidió una que no alcanza
 * recibió un 404, y quien no pidió ninguna teniendo varias, un 400; ninguna ruta vuelve a
 * replegarse a «la mía» cuando se le pidió otra.
 *
 * Por defecto exige una empresa concreta: una petición de la agencia entera da 400, porque la
 * mayoría de las rutas trabajan sobre una empresa y recibir `AGENCIA` sin querer es cómo una
 * consulta termina leyendo la organización completa. Las que sí abarcan la agencia se declaran
 * con `@Empresa({ oAgencia: true })` y `@SinEmpresa('motivo')`.
 */
export const Empresa = createParamDecorator(
  ({ oAgencia = false }: { oAgencia?: boolean } = {}, ctx: ExecutionContext): AmbitoDeEmpresa => {
    const ambito = ambitoDeLaPeticion(ctx.switchToHttp().getRequest());

    // El interceptor guarda lo que falló al resolver y lo lanza quien sabe que hacía falta: una
    // ruta que no necesita empresa no tiene por qué fallar porque la petición no la declarara.
    if (ambito instanceof Error) throw ambito;

    if (ambito === undefined) {
      // No hay petición autenticada de la que resolverla, o el interceptor no corrió. Las dos
      // cosas son un error de montaje, no una decisión de producto: se dice como tal.
      throw new InternalServerErrorException('La empresa de la petición no se resolvió');
    }

    // Una ruta que trabaja sobre una empresa y recibe la agencia entera está mal declarada, no
    // mal pedida: se responde como error del servidor para que aparezca en los registros.
    if (ambito === AGENCIA && !oAgencia) {
      throw new InternalServerErrorException('Esta ruta necesita una empresa; usa @Empresa({ oAgencia: true }) si abarca la agencia');
    }

    return ambito;
  },
);
