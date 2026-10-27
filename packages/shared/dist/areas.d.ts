/**
 * @fileoverview Las áreas de cada módulo: en qué partes se puede separar lo que alguien hace.
 *
 * Un módulo entero es demasiado grueso para repartir trabajo. Reservas son trece cosas bajo un
 * mismo interruptor: quien anota que un comensal llegó y quien cambia los horarios del local
 * reciben hoy el mismo acceso. Lo mismo en CRM, donde «aplicar reglas» reescribe el semáforo, la
 * etapa y el responsable de los prospectos que recibe, y vive junto a «ver la lista».
 *
 * Un **área** es un grupo de acciones con nombre dentro de un módulo. Un **perfil** es un juego
 * de áreas con nombre que la empresa compone y reparte entre su gente. Las excepciones por
 * persona se siguen guardando donde ya se guardan, en `user_action_override`, que admite conceder
 * y quitar con su motivo y quién lo hizo.
 *
 * ESTE ARCHIVO ES LA ÚNICA FUENTE. De aquí salen tres cosas: la pantalla donde se componen los
 * perfiles, la comprobación del servidor y la pantalla que explica qué ve una persona. Es el
 * mismo patrón que ya funcionó dos veces: `status-labels.ts` es la única tabla de estados y por
 * eso no hay ni un estado crudo en pantalla, y `documentos-legales.ts` hace que el plazo que se
 * publica y el que borra no puedan contradecirse.
 *
 * **El catálogo es código, no datos.** Las empresas componen perfiles a partir de esta lista;
 * no pueden inventar áreas. Es la diferencia entre un modelo que se lee en un archivo y un motor
 * de permisos donde nadie puede contestar «¿quién ve esto?» sin ejecutarlo.
 *
 * No sustituye a las otras dos rejas, se suma: la empresa tiene que haber contratado el módulo, y
 * quien concede nunca puede dar lo que él mismo no alcanza.
 */
import type { OrganizationModuleKey } from './constants/modules';
/**
 * Hasta dónde llega alguien en un área.
 *
 * Tres y no más: cada nivel extra multiplica las combinaciones que hay que entender para
 * responder «¿qué ve esta persona?», que es la pregunta que todo esto existe para contestar.
 */
export type NivelDeArea = 'ninguno' | 'ver' | 'hacer';
export declare const NIVELES_DE_AREA: readonly NivelDeArea[];
/**
 * Qué se ve de los datos personales de un tercero: el comensal, el prospecto, quien respondió.
 *
 * Son tres y no dos por el caso difícil. La alergia de un comensal es dato de salud, y a la vez
 * es lo que la cocina necesita para no enfermar a nadie: esconderla sería peor que mostrarla. Con
 * `bajo_registro` no hay que elegir entre proteger y operar —se opera, y queda constancia de
 * quién la vio y cuándo—, que es además lo que permite contestarle a un titular quién trató sus
 * datos.
 */
export type NivelDeDatosProtegidos = 'oculto' | 'bajo_registro' | 'directo';
export declare const NIVELES_DE_DATOS: readonly NivelDeDatosProtegidos[];
export interface DefinicionDeArea {
    /** `modulo.area`, con la misma forma que las claves de `acciones.ts`. */
    clave: string;
    modulo: OrganizationModuleKey;
    nombre: string;
    /** Qué incluye, dicho para quien reparte el trabajo y no para quien programa. */
    ayuda: string;
    /**
     * Los niveles que esta área admite. Dos valores cuando es de sí o no —`ninguno` y `hacer`—,
     * porque una acción irreversible no tiene un punto medio que signifique algo.
     */
    niveles: readonly NivelDeArea[];
    /** Si toca datos personales de un tercero, y entonces el nivel de protección también aplica. */
    tocaDatosDeTerceros?: true;
}
/**
 * Qué son los datos protegidos en cada módulo, y por qué el nivel va **por módulo**.
 *
 * No es lo mismo el teléfono de un prospecto, que alguien de comercial necesita para llamarlo,
 * que el documento de un comensal, que casi nadie necesita para atender. Un solo nivel por
 * persona obligaría a conceder el más alto que necesite en cualquier módulo, y se llevaría por
 * delante todo lo demás.
 *
 * No va aquí como área porque su escala es otra —tres valores, no «ver» y «hacer»— y mezclarlas
 * en un mismo registro acaba en un campo que significa dos cosas según dónde se lea.
 */
export interface DatosProtegidosDeModulo {
    modulo: OrganizationModuleKey;
    nombre: string;
    ayuda: string;
    /**
     * Si entre estos datos hay alguno de categoría especial —salud, en la práctica las alergias y
     * restricciones alimentarias del comensal—.
     *
     * Cuando lo hay, conceder el acceso exige que quien lo concede acepte un texto con versión, y
     * queda guardado con `ConsentVersion` y `DataConsent`, que es el mecanismo que la plataforma ya
     * usa para los consentimientos. No lo pide la ley con esas palabras: lo pide la obligación de
     * **poder demostrar** que el acceso se limitó y que quien lo recibió conocía su deber de
     * confidencialidad.
     */
    incluyeSensibles?: true;
}
export declare const DATOS_PROTEGIDOS: readonly DatosProtegidosDeModulo[];
/**
 * Si conceder este módulo exige que quien concede acepte el texto de confidencialidad.
 *
 * Sólo donde hay datos de categoría especial. Pedirlo en todos convertiría la aceptación en un
 * clic automático, y una evidencia que nadie leyó no prueba nada.
 */
export declare function concederExigeAceptacion(modulo: OrganizationModuleKey, nivel: NivelDeDatosProtegidos): boolean;
export declare function tieneDatosProtegidos(modulo: OrganizationModuleKey): boolean;
export declare const AREAS: readonly DefinicionDeArea[];
export declare function definicionDeArea(clave: string): DefinicionDeArea | undefined;
export declare function areasDelModulo(modulo: OrganizationModuleKey): DefinicionDeArea[];
/** Las áreas que tocan datos de un tercero, que son las que la protección de datos alcanza. */
export declare function areasConDatosDeTerceros(): DefinicionDeArea[];
/**
 * Qué áreas y con qué nivel. Es lo que guarda un perfil y lo que resuelve una persona.
 *
 * Un área ausente significa `ninguno`: lo que no se concedió, no se tiene. Nunca al revés.
 */
export type JuegoDeAreas = Readonly<Record<string, NivelDeArea>>;
/**
 * El nivel de datos protegidos, módulo por módulo.
 *
 * Un módulo ausente significa `oculto`, con la misma regla que las áreas: lo que no se concedió,
 * no se tiene. La migración escribe `directo` de forma explícita para quienes hoy ya los ven, de
 * modo que nadie pierda nada el día del despliegue.
 */
export type JuegoDeDatos = Readonly<Partial<Record<OrganizationModuleKey, NivelDeDatosProtegidos>>>;
export interface Perfil {
    id: string;
    /** De la empresa, no del producto: un local dice «anfitrión» y otro «recepción». */
    clientId: string;
    nombre: string;
    descripcion?: string;
    areas: JuegoDeAreas;
    datosProtegidos: JuegoDeDatos;
}
export declare function nivelEnJuego(areas: JuegoDeAreas, clave: string): NivelDeArea;
/** `hacer` incluye `ver`: quien edita, mira. */
export declare function alcanza(actual: NivelDeArea, exigido: NivelDeArea): boolean;
/**
 * El nivel que resulta de un perfil más las excepciones escritas para una persona.
 *
 * Las excepciones pueden **conceder y también quitar**. Sin lo segundo habría que inventar un
 * perfil nuevo cada vez que alguien concreto necesita una cosa menos, y los perfiles dejarían de
 * significar algo en una semana.
 *
 * @param extras - Lo escrito para esa persona en esa empresa. Gana sobre el perfil, que es lo que
 *   significa ser una excepción.
 */
export declare function nivelEfectivo(perfil: JuegoDeAreas, extras: JuegoDeAreas, clave: string): NivelDeArea;
/**
 * El nivel de datos protegidos que resulta, para un módulo, del perfil más sus excepciones.
 *
 * Misma regla que las áreas: la excepción gana, y lo ausente es lo más restrictivo. Va por
 * módulo porque alguien puede necesitar el teléfono del prospecto y no el del comensal.
 */
export declare function datosEfectivos(perfil: JuegoDeDatos, extras: JuegoDeDatos, modulo: OrganizationModuleKey): NivelDeDatosProtegidos;
/** Si hay que anotar quién lo vio. Es lo que `bajo_registro` significa. */
export declare function exigeDejarConstancia(nivel: NivelDeDatosProtegidos): boolean;
/**
 * Los tres perfiles que se entregan sugeridos para Reservas, y los tres de CRM.
 *
 * Se copian a la empresa al encender el módulo y desde ahí son suyos: puede renombrarlos,
 * cambiarlos o borrarlos. No son roles del producto, y por eso no se consultan en tiempo de
 * ejecución: sólo sirven para no empezar con una pantalla en blanco.
 */
export declare const PERFILES_SUGERIDOS: readonly {
    modulo: OrganizationModuleKey;
    nombre: string;
    descripcion: string;
    areas: JuegoDeAreas;
    datosProtegidos: JuegoDeDatos;
}[];
//# sourceMappingURL=areas.d.ts.map