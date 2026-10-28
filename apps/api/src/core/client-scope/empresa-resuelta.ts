/**
 * @fileoverview La empresa de una petición, una vez comprobada.
 *
 * El defecto que esto cierra no es que falte una comprobación, es que `clientId?: string` no
 * distingue tres cosas que se comportan distinto: una empresa que alguien pidió y nadie revisó,
 * una empresa ya comprobada contra el alcance de la cuenta, y «ninguna empresa». Al ser las tres
 * el mismo tipo, pasar la primera donde se esperaba la segunda compila, y `assertClient(undefined)`
 * —que no comprueba nada— es la forma más común de que una consulta termine tocando la
 * organización entera.
 *
 * Con la marca, un servicio sólo puede recibir una empresa que pasó por `resolverEmpresa`, o el
 * literal `AGENCIA`. Olvidar la comprobación deja de compilar en vez de deja de notarse.
 */

import { BadRequestException } from '@nestjs/common';
import type { AuthUser } from '../../shared/types/request';

/**
 * Una empresa que ya se comprobó contra el alcance de quien pide.
 *
 * La marca no existe en ejecución: en el cable es el mismo id de siempre. Lo que impide es
 * construirla sin pasar por `resolverEmpresa`, que es donde vive la comprobación.
 */
export type EmpresaResuelta = string & { readonly __empresa: unique symbol };

/**
 * La petición no va sobre una empresa, sino sobre la agencia entera.
 *
 * Es un valor y no `undefined` a propósito: `undefined` se cuela por cualquier parámetro
 * opcional sin que nadie lo decida, y eso es exactamente lo que se quiere volver visible. Una
 * consulta que recibe `AGENCIA` lo recibe porque alguien lo escribió.
 */
export const AGENCIA = 'AGENCIA' as const;
export type AmbitoDeEmpresa = EmpresaResuelta | typeof AGENCIA;

/** Lo que `resolverEmpresa` necesita saber del alcance, sin arrastrar el servicio entero. */
export interface AlcanceDeLaCuenta {
  /** Empresas que la cuenta alcanza; `undefined` es sin límite (cargo global). */
  alcanzables: string[] | undefined;
  /** Comprueba que la empresa exista y esté al alcance; lanza 404 si no. */
  comprobar: (clientId: string) => Promise<void>;
}

/**
 * La empresa sobre la que va esta petición, o `AGENCIA`.
 *
 * | Situación | Resultado |
 * |---|---|
 * | La declara y la alcanza | La empresa |
 * | La declara y no la alcanza | 404, el mismo que si no existiera |
 * | No la declara y alcanza una sola | Esa |
 * | No la declara y alcanza varias | `VariasEmpresasAlcanzables`, un 400, para que la pantalla pregunte |
 * | No la declara y no tiene límite | `AGENCIA` |
 *
 * No hay repliegue silencioso: pedir una empresa y recibir otra —«la mía»— es el defecto que
 * esta función existe para quitar del repertorio. Quien pidió una empresa que no alcanza recibe
 * un 404 y no la suya, y quien no pidió ninguna teniendo varias recibe una pregunta y no un
 * resultado sobre una empresa que no eligió.
 */
export async function resolverEmpresa(
  pedida: string | null | undefined,
  user: AuthUser,
  alcance: AlcanceDeLaCuenta,
): Promise<AmbitoDeEmpresa> {
  const declarada = (pedida ?? '').trim();
  if (declarada) {
    await alcance.comprobar(declarada);
    return declarada as EmpresaResuelta;
  }

  // Sin límite y sin empresa declarada: la petición es de la agencia. Que lo sea sin declararlo
  // es lo que `@SinEmpresa` pasa a exigir; aquí se resuelve, no se autoriza.
  if (alcance.alcanzables === undefined) return AGENCIA;

  // La empresa escrita en la propia cuenta de portal cuenta como alcanzable aunque la lista
  // llegue por otra vía: es la que no se le puede quitar.
  const suyas = [...new Set([...(user.clientId ? [user.clientId] : []), ...alcance.alcanzables])];
  if (suyas.length === 1) return suyas[0] as EmpresaResuelta;
  if (suyas.length === 0) throw new SinEmpresasAlcanzables();
  throw new VariasEmpresasAlcanzables();
}

/**
 * La cuenta alcanza varias empresas y la petición no dijo sobre cuál va.
 *
 * Tiene clase propia, y no sólo mensaje, porque hay rutas para las que esto no es un problema:
 * las que suman sobre todo el alcance —un pulso, un consolidado— ya acotan por la lista de
 * empresas alcanzables, así que no les falta nada. Esas lo convierten en `AGENCIA` declarándolo
 * con `@Empresa({ oAgencia: true, oTodasLasQueAlcanza: true })`; distinguirlo por la clase evita
 * que eso se haga mirando el texto del error, que cambia sin avisar.
 */
export class VariasEmpresasAlcanzables extends BadRequestException {
  constructor() {
    super('Elige la empresa sobre la que trabajas');
  }
}

/**
 * La cuenta no alcanza ninguna empresa: no está en ningún pod, no lleva cuentas y no tiene
 * asignaciones.
 *
 * Es un estado normal de una cuenta recién creada, no un error de quien la usa. Para una ruta
 * que trabaja sobre una empresa sigue siendo un 400 —no hay sobre qué trabajar—, pero para las
 * que suman sobre el alcance la respuesta correcta es «cero», no un fallo: ya acotan por la
 * lista de empresas alcanzables, y una lista vacía no devuelve filas.
 *
 * Tiene clase propia por lo mismo que `VariasEmpresasAlcanzables`: distinguirlo por el texto
 * del error es atarse a una frase que cambia sin avisar.
 */
export class SinEmpresasAlcanzables extends BadRequestException {
  constructor() {
    super('Tu cuenta no tiene ninguna empresa asignada');
  }
}

/** Si el ámbito es una empresa concreta. Estrecha el tipo, para no repetir la comparación. */
export function esUnaEmpresa(ambito: AmbitoDeEmpresa): ambito is EmpresaResuelta {
  return ambito !== AGENCIA;
}
