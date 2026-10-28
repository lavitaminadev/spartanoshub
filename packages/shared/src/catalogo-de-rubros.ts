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

/** Nombre y teléfono: sin ellos no se puede atender a nadie, y los pide todo rubro. */
const CONTACTO: CampoDeRubro[] = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
  { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono', obligatorio: true },
];

const CORREO: CampoDeRubro = { clave: 'correo', etiqueta: 'Correo', tipo: 'correo', obligatorio: true };

export const CATALOGO_DE_RUBROS: Rubro[] = [
  {
    clave: 'gastronomico',
    nombre: 'Gastronómico',
    tipos: [
      {
        clave: 'mesa',
        nombre: 'Reserva de mesa',
        llamado: 'Reserva tu mesa',
        confirmacion: 'Tu mesa está confirmada. ¡Te esperamos!',
        duracionMinutos: 90,
        capacidad: 4,
        agenda: 'bloques',
        sustantivoReserva: 'mesa',
        sustantivoPersonas: 'comensales',
        campos: [
          ...CONTACTO,
          CORREO,
          { clave: 'comensales', etiqueta: 'Comensales', tipo: 'numero', obligatorio: true },
          { clave: 'ocasion', etiqueta: 'Ocasión', tipo: 'texto', obligatorio: false },
        ],
      },
      {
        clave: 'terraza',
        nombre: 'Terraza o exterior',
        llamado: 'Reserva tu terraza',
        confirmacion: 'Tu espacio en terraza está confirmado.',
        // Más larga que la mesa de adentro: en terraza la gente se queda.
        duracionMinutos: 120,
        capacidad: 4,
        agenda: 'bloques',
        sustantivoReserva: 'mesa en terraza',
        sustantivoPersonas: 'comensales',
        campos: [...CONTACTO, { clave: 'comensales', etiqueta: 'Comensales', tipo: 'numero', obligatorio: true }],
      },
      {
        clave: 'pedido',
        nombre: 'Pedido o delivery',
        llamado: 'Haz tu pedido',
        confirmacion: 'Recibimos tu pedido.',
        duracionMinutos: 15,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'pedido',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, { clave: 'retiro', etiqueta: 'Tipo de retiro', tipo: 'seleccion', obligatorio: true }],
      },
    ],
  },
  {
    clave: 'salud',
    nombre: 'Salud y estética',
    tipos: [
      {
        clave: 'hora',
        nombre: 'Reserva de hora',
        llamado: 'Reserva tu hora',
        confirmacion: 'Tu hora quedó agendada.',
        duracionMinutos: 45,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'hora',
        sustantivoPersonas: 'pacientes',
        campos: [...CONTACTO, CORREO],
      },
      {
        clave: 'consulta',
        nombre: 'Consulta',
        llamado: 'Agenda tu consulta',
        confirmacion: 'Tu consulta está agendada.',
        duracionMinutos: 30,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'consulta',
        sustantivoPersonas: 'pacientes',
        campos: [...CONTACTO, { clave: 'motivo', etiqueta: 'Motivo de consulta', tipo: 'texto_largo', obligatorio: false }],
      },
      {
        clave: 'procedimiento',
        nombre: 'Procedimiento o tratamiento',
        llamado: 'Agenda tu procedimiento',
        confirmacion: 'Tu procedimiento está agendado.',
        duracionMinutos: 60,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'procedimiento',
        sustantivoPersonas: 'pacientes',
        /*
         * El consentimiento viene obligatorio y no es decoración: un procedimiento de salud trata
         * datos de categoría especial, y la Ley 21.719 pide que el consentimiento sea libre,
         * informado, específico y **demostrable**. La casilla es lo que lo vuelve demostrable.
         */
        campos: [...CONTACTO, { clave: 'consentimiento', etiqueta: 'Consentimiento informado', tipo: 'consentimiento', obligatorio: true }],
      },
    ],
  },
  {
    clave: 'legal',
    nombre: 'Legal',
    tipos: [
      {
        clave: 'consulta_inicial',
        nombre: 'Consulta inicial',
        llamado: 'Agenda tu consulta',
        confirmacion: 'Tu consulta inicial está agendada.',
        duracionMinutos: 30,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'consulta',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO, { clave: 'area', etiqueta: 'Área legal', tipo: 'seleccion', obligatorio: true }],
      },
      {
        clave: 'revision',
        nombre: 'Revisión de contrato',
        llamado: 'Agenda tu revisión',
        confirmacion: 'Tu revisión está agendada.',
        duracionMinutos: 45,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'revisión',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO, { clave: 'detalle', etiqueta: 'Detalle del contrato', tipo: 'texto_largo', obligatorio: false }],
      },
    ],
  },
  {
    clave: 'inmobiliario',
    nombre: 'Inmobiliario',
    tipos: [
      {
        clave: 'visita',
        nombre: 'Visita a proyecto',
        llamado: 'Agenda tu visita',
        confirmacion: 'Tu visita está agendada.',
        duracionMinutos: 60,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'visita',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO, { clave: 'presupuesto', etiqueta: 'Presupuesto aproximado', tipo: 'numero', obligatorio: false }],
      },
      {
        clave: 'informacion',
        nombre: 'Solicitud de información',
        llamado: 'Solicita información',
        confirmacion: 'Te enviamos la información.',
        duracionMinutos: 0,
        capacidad: 0,
        agenda: 'sin_agenda',
        sustantivoReserva: 'solicitud',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO, { clave: 'proyecto', etiqueta: 'Proyecto de interés', tipo: 'seleccion', obligatorio: true }],
      },
    ],
  },
  {
    clave: 'servicios',
    nombre: 'Servicios y startups',
    tipos: [
      {
        clave: 'demo',
        nombre: 'Demostración',
        llamado: 'Agenda una demo',
        confirmacion: 'Tu demo está agendada.',
        duracionMinutos: 30,
        capacidad: 1,
        agenda: 'bloques',
        sustantivoReserva: 'demo',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO],
      },
      {
        clave: 'informacion',
        nombre: 'Solicitud de información',
        llamado: 'Solicita información',
        confirmacion: 'Te contactaremos.',
        duracionMinutos: 0,
        capacidad: 0,
        agenda: 'sin_agenda',
        sustantivoReserva: 'solicitud',
        sustantivoPersonas: 'personas',
        campos: [...CONTACTO, CORREO, { clave: 'mensaje', etiqueta: 'Cuéntanos tu caso', tipo: 'texto_largo', obligatorio: false }],
      },
    ],
  },
];

/** El tipo de captación que nombran esas dos claves, o `null` si alguna no existe. */
export function tipoDeCaptacion(rubro?: string | null, tipo?: string | null): TipoDeCaptacion | null {
  if (!rubro || !tipo) return null;
  return CATALOGO_DE_RUBROS.find((fila) => fila.clave === rubro)?.tipos.find((uno) => uno.clave === tipo) ?? null;
}
