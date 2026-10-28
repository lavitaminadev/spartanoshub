/**
 * @fileoverview Rubros y tipos de captación: con qué valores nace un formulario de reservas.
 *
 * Crear un formulario hoy es fijar de cero la duración, el margen entre horas, la capacidad, el
 * aviso mínimo, la antelación, el modo de confirmación, los campos y el texto del botón. Son nueve
 * decisiones para algo que, dentro de un rubro, es casi siempre lo mismo: una mesa son noventa
 * minutos para cuatro, y una hora médica cuarenta y cinco para uno.
 *
 * El rubro **no es una reja**: no decide quién ve qué ni qué se puede hacer. Sólo dice con qué
 * valores arranca el formulario, y desde ahí se cambia todo. Por eso vive en código y no en una
 * tabla con panel de administración: igual que `areas.ts` y el catálogo de módulos, cambia unas
 * pocas veces al año y revisarlo en un diff vale más que poder editarlo desde una pantalla.
 *
 * `campos` son los que el tipo trae puestos. `obligatorio` es el contrato del formulario público;
 * un campo que el rubro trae se puede quitar en el constructor, porque el local manda sobre su
 * propio formulario.
 */
/** Cómo se ofrecen las horas: en bloques de agenda, o sin agenda (un formulario que sólo recoge). */
export type ModoDeAgenda = 'bloques' | 'sin_agenda';
/** Tipos de campo que un preset puede traer. Los admite el constructor tal cual. */
export type TipoDeCampoDeRubro = 'texto' | 'texto_largo' | 'telefono' | 'correo' | 'numero' | 'seleccion' | 'consentimiento';
export interface CampoDeRubro {
    clave: string;
    etiqueta: string;
    tipo: TipoDeCampoDeRubro;
    obligatorio: boolean;
}
export interface TipoDeCaptacion {
    clave: string;
    nombre: string;
    /** El texto del botón del formulario público. */
    llamado: string;
    /** Lo que lee quien acaba de reservar. */
    confirmacion: string;
    /** Minutos que ocupa cada reserva. `0` con `sin_agenda`: no ocupa hora. */
    duracionMinutos: number;
    /** Personas por bloque. `0` con `sin_agenda`. */
    capacidad: number;
    agenda: ModoDeAgenda;
    /**
     * Cómo se llama lo que se reserva y a quién: «mesa» y «comensales», «hora» y «pacientes».
     *
     * El motor de reservas no sabe de restaurantes —lo mismo agenda una mesa que una hora médica—,
     * y lo único que lo amarraba a uno era la palabra en la pantalla pública. Que salga del rubro es
     * lo que deja ofrecer el mismo producto a una clínica sin tocar una línea de lógica.
     */
    sustantivoReserva: string;
    sustantivoPersonas: string;
    campos: CampoDeRubro[];
}
export interface Rubro {
    clave: string;
    nombre: string;
    tipos: TipoDeCaptacion[];
}
export declare const CATALOGO_DE_RUBROS: Rubro[];
/** El tipo de captación que nombran esas dos claves, o `null` si alguna no existe. */
export declare function tipoDeCaptacion(rubro?: string | null, tipo?: string | null): TipoDeCaptacion | null;
//# sourceMappingURL=catalogo-de-rubros.d.ts.map