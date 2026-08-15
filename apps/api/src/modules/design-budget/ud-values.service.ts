import { Injectable } from '@nestjs/common';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { PieceType } from '../production/piece-type.enum';
import {
  CAROUSEL_EXTRA_PER_SLIDE,
  UD_CAROUSEL_EXTRA_KEY,
  UD_DEFAULTS,
  udValueKey,
} from './ud-calculator';

/** Valor en unidades de cada tipo de pieza; `null` es un tipo que todavía nadie valoró. */
export type UdMatrix = Record<string, number | null>;

/**
 * Resuelve cuántas unidades consume una pieza leyendo los valores que Dirección configuró.
 *
 * La matriz del Documento Maestro 6.1 vive en el código como valor por defecto, pero deja de ser
 * la última palabra: cada tipo tiene su parámetro `ud.value.<tipo>` y la organización puede
 * cambiarlo desde la pantalla de configuración sin tocar el repositorio ni desplegar.
 *
 * Eso es lo que permite que los trece tipos que la Dirección de Arte enumeró se puedan valorar
 * cuando se decida su precio, en vez de quedar esperando un cambio de código. Un tipo sin valor
 * resuelve `null` y consume cero: la pieza se registra y queda listada para valorar, que es
 * visible y corregible, en lugar de cobrarse con una cifra que nadie decidió.
 *
 * El resolutor de parámetros mantiene su propia caché de un minuto, así que una organización que
 * crea muchas piezas seguidas no vuelve a la base por cada una.
 */
@Injectable()
export class UdValuesService {
  constructor(private readonly parameters: ParameterResolver) {}

  /** Matriz vigente de la organización: los parámetros configurados sobre los valores del maestro. */
  async matrixFor(organizationId?: string | null): Promise<UdMatrix> {
    const keys = Object.values(PieceType).map(udValueKey);
    const configured = await this.parameters.getManyForOrganization(keys, organizationId);

    const matrix: UdMatrix = {};
    for (const type of Object.values(PieceType)) {
      const value = configured.get(udValueKey(type));
      matrix[type] = value === null || value === undefined ? UD_DEFAULTS[type] ?? null : Number(value);
    }
    return matrix;
  }

  /**
   * Unidades que consume una pieza según la configuración vigente.
   *
   * El carrusel se cobra por tramos —una base más un extra por cada lámina adicional— porque su
   * esfuerzo crece con el número de láminas, a diferencia del resto de los tipos.
   */
  async udFor(pieceType: string, carouselSlides = 0, organizationId?: string | null): Promise<number> {
    const matrix = await this.matrixFor(organizationId);
    const base = matrix[pieceType];
    if (base === null || base === undefined) return 0;

    if (pieceType !== PieceType.CAROUSEL) return base;

    const extra = await this.parameters.get(UD_CAROUSEL_EXTRA_KEY, null, null, organizationId);
    const porLamina = extra === null || extra === undefined ? CAROUSEL_EXTRA_PER_SLIDE : Number(extra);
    return base + Math.max(0, carouselSlides - 1) * porLamina;
  }

  /** Tipos que todavía esperan que Dirección les asigne un valor, para poder listarlos. */
  async tiposSinValor(organizationId?: string | null): Promise<string[]> {
    const matrix = await this.matrixFor(organizationId);
    return Object.keys(matrix).filter((type) => matrix[type] === null || matrix[type] === undefined);
  }
}
