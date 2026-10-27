/**
 * @fileoverview La reja de «nadie concede lo que no tiene», y la validación de un juego de áreas.
 *
 * Es una función pura a propósito: es la única comprobación que decide si alguien puede dar un
 * nivel, y vive aparte para que cualquier camino que entregue accesos (crear, editar, asignar,
 * invitar) pase por la misma puerta y para poder probarla sin base de datos.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  alcanza,
  datosEfectivos,
  definicionDeArea,
  NIVELES_DE_DATOS,
  nivelEfectivo,
  tieneDatosProtegidos,
  type JuegoDeAreas,
  type JuegoDeDatos,
  type NivelDeDatosProtegidos,
  type OrganizationModuleKey,
} from '@espartanos/shared';

/**
 * Lo que alguien alcanza en una empresa, y por tanto lo máximo que puede conceder.
 *
 * `null` es «sin tope»: la agencia, que enciende la primera cuenta de una empresa y no tiene
 * perfil dentro de ella. Una persona de la empresa sin perfil asignado tiene un tope vacío, es
 * decir, no concede nada.
 */
export type TopeDeConcesion = { areas: JuegoDeAreas; datos: JuegoDeDatos } | null;

const RANGO_DE_DATOS: Record<NivelDeDatosProtegidos, number> = { oculto: 0, bajo_registro: 1, directo: 2 };

/**
 * Rechaza un juego que nombre algo que el catálogo no tiene o con un nivel que el área no admite.
 *
 * @throws BadRequestException - Con el nombre de lo que no existe, para que la pantalla lo diga.
 */
export function validarJuegos(areas: JuegoDeAreas, datos: JuegoDeDatos): void {
  for (const [clave, nivel] of Object.entries(areas)) {
    const definicion = definicionDeArea(clave);
    if (!definicion) throw new BadRequestException(`El área «${clave}» no existe`);
    if (!definicion.niveles.includes(nivel)) {
      throw new BadRequestException(`El área «${definicion.nombre}» no admite el nivel «${nivel}»`);
    }
  }
  for (const [modulo, nivel] of Object.entries(datos)) {
    if (!tieneDatosProtegidos(modulo as OrganizationModuleKey)) {
      throw new BadRequestException(`El módulo «${modulo}» no tiene datos protegidos que repartir`);
    }
    if (!NIVELES_DE_DATOS.includes(nivel as NivelDeDatosProtegidos)) {
      throw new BadRequestException(`El nivel de datos «${String(nivel)}» no existe`);
    }
  }
}

/**
 * Garantiza que quien concede no da un nivel por encima del suyo, ni en áreas ni en datos.
 *
 * Compara contra `nivelEfectivo()` y `datosEfectivos()` del catálogo, sin reescribir su regla:
 * lo que el tope no nombra vale «ninguno» y «oculto». Dar `ninguno` u `oculto` nunca se
 * rechaza, porque quitar no es conceder.
 *
 * @param tope - Lo que alcanza quien concede; `null` no impone tope.
 * @throws ForbiddenException - Nombrando el área o módulo, para que el administrador sepa cuál.
 */
export function asegurarQueNoConcedePorEncima(tope: TopeDeConcesion, areas: JuegoDeAreas, datos: JuegoDeDatos): void {
  if (tope === null) return;
  for (const [clave, nivel] of Object.entries(areas)) {
    if (nivel === 'ninguno') continue;
    if (!alcanza(nivelEfectivo(tope.areas, {}, clave), nivel)) {
      const nombre = definicionDeArea(clave)?.nombre ?? clave;
      throw new ForbiddenException(`No puedes dar «${nombre}» en nivel «${nivel}»: es más de lo que tú tienes`);
    }
  }
  for (const [modulo, nivel] of Object.entries(datos) as Array<[OrganizationModuleKey, NivelDeDatosProtegidos]>) {
    if (RANGO_DE_DATOS[nivel] > RANGO_DE_DATOS[datosEfectivos(tope.datos, {}, modulo)]) {
      throw new ForbiddenException(`No puedes dar ese nivel de datos protegidos en «${modulo}»: es más de lo que tú tienes`);
    }
  }
}

/** Si un nivel de datos pasa a ser mayor que el que había: lo único que obliga a aceptar el texto. */
export function datosSubieron(antes: JuegoDeDatos, despues: JuegoDeDatos, modulo: OrganizationModuleKey): boolean {
  return RANGO_DE_DATOS[despues[modulo] ?? 'oculto'] > RANGO_DE_DATOS[antes[modulo] ?? 'oculto'];
}
