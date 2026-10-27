import { SetMetadata } from '@nestjs/common';
import type { NivelDeArea } from '@espartanos/shared';

export const REQUIERE_AREA_KEY = 'requiereArea';

export interface AreaExigida {
  /** La clave del catálogo, con la forma `modulo.area`. */
  clave: string;
  nivel: NivelDeArea;
}

/**
 * Exige un nivel mínimo sobre un área del módulo.
 *
 * Un módulo entero es demasiado grueso para repartir trabajo: Reservas son trece cosas bajo un
 * mismo interruptor, y «aplicar reglas» del CRM reescribe el semáforo, la etapa y el responsable
 * de los prospectos elegidos viviendo junto a «ver la lista». El área es el grano que permite
 * que un garzón anote una llegada sin poder cambiar los horarios del local.
 *
 * **No reemplaza a `@RequiresPermission`, se suma.** Aquél comprueba el módulo, el nivel del
 * cargo y el servicio contratado por la empresa; éste comprueba el perfil que esa persona tiene
 * en esa empresa. Las dos rejas responden preguntas distintas y las dos tienen que estar.
 *
 * Una ruta sin área declarada **no se bloquea**: el módulo sigue mandando, como hasta ahora. Es
 * deliberado mientras se declaran las áreas una por una, porque exigirla de golpe dejaría sin
 * servicio todo lo que todavía no la declare. Cuando estén todas, esto pasa a ser obligatorio con
 * el mismo criterio que ya usa el módulo —un endpoint sin declarar es un descuido, no una
 * decisión— y entonces olvidarla deja de ser posible.
 *
 * @param clave - La del catálogo de `areas.ts`; escribir una que no existe falla al arrancar.
 * @param nivel - El mínimo exigido. `hacer` incluye `ver`: quien edita, mira.
 */
export const RequiereArea = (clave: string, nivel: NivelDeArea = 'hacer') =>
  SetMetadata(REQUIERE_AREA_KEY, { clave, nivel } satisfies AreaExigida);
