import {
  MODULE_LIFECYCLE_STATUSES,
  ORGANIZATION_MODULE_CATALOG,
  moduleLifecycleSettingKey,
} from '@espartanos/shared';
// Ambos son archivos de constantes sin dependencias: el catálogo describe qué se puede
// configurar, y los tipos de pieza con su matriz son justamente lo que se configura.
import { PieceType, PIECE_TYPE_LABELS } from '../../modules/production/piece-type.enum';
import { CAROUSEL_EXTRA_PER_SLIDE, UD_CAROUSEL_EXTRA_KEY, UD_DEFAULTS, udValueKey } from '../../modules/design-budget/ud-calculator';

export type OrganizationSettingCategory =
  | 'operation'
  | 'production'
  | 'design_budget'
  | 'meetings'
  | 'alerts'
  | 'documents'
  | 'compliance'
  | 'modules';

export type OrganizationSettingValueType = 'boolean' | 'number' | 'select' | 'text';
export type MasterSettingStatus = 'master_defined' | 'direction_required';

export interface OrganizationSettingOption {
  value: string;
  label: string;
}

export interface OrganizationSettingDefinition {
  key: string;
  category: OrganizationSettingCategory;
  label: string;
  description: string;
  valueType: OrganizationSettingValueType;
  defaultValue: string | number | boolean | null;
  masterStatus: MasterSettingStatus;
  options?: OrganizationSettingOption[];
  min?: number;
  max?: number;
  unit?: string;
  nullable?: boolean;
}

const MODULE_LIFECYCLE_SETTINGS: OrganizationSettingDefinition[] = ORGANIZATION_MODULE_CATALOG.map((module) => ({
  key: moduleLifecycleSettingKey(module.key),
  category: 'modules',
  label: `Lifecycle de ${module.key}`,
  description: 'Define si el modulo esta en desarrollo, piloto, activo, mantenimiento o deshabilitado para esta organizacion.',
  valueType: 'select',
  defaultValue: module.lifecycle,
  masterStatus: 'direction_required',
  options: MODULE_LIFECYCLE_STATUSES.map((status) => ({ value: status, label: status })),
}));

/**
 * Un parámetro por cada tipo de pieza, con su valor en unidades.
 *
 * La matriz del Documento Maestro 6.1 sigue siendo el valor por defecto, pero deja de estar
 * clavada en el código: Dirección puede corregir un valor o asignárselo a los tipos que todavía
 * no lo tienen —logotipos, gigantografías, brochures— desde la pantalla de configuración, sin
 * esperar un despliegue. El cambio queda auditado como cualquier otro parámetro.
 *
 * Los que nacen en `null` son los que la Dirección de Arte enumeró y el maestro no cubre: su
 * precio es una decisión económica, no técnica. Mientras siga en `null` la pieza consume cero y
 * queda listada para valorar.
 */
const UD_VALUE_SETTINGS: OrganizationSettingDefinition[] = Object.values(PieceType).map((pieceType) => ({
  key: udValueKey(pieceType),
  category: 'design_budget',
  label: `Unidades de ${PIECE_TYPE_LABELS[pieceType]}`,
  description: `Cuántas unidades del presupuesto consume una pieza de tipo «${PIECE_TYPE_LABELS[pieceType]}». Sin valor, la pieza se registra pero no descuenta.`,
  valueType: 'number',
  defaultValue: UD_DEFAULTS[pieceType] ?? null,
  masterStatus: UD_DEFAULTS[pieceType] === undefined ? 'direction_required' : 'master_defined',
  min: 0,
  max: 100,
  unit: 'UD',
  nullable: true,
}));

export const ORGANIZATION_SETTINGS: readonly OrganizationSettingDefinition[] = [
  ...UD_VALUE_SETTINGS,
  {
    key: UD_CAROUSEL_EXTRA_KEY,
    category: 'design_budget',
    label: 'Unidades por lámina adicional del carrusel',
    description: 'El carrusel cobra su valor base más este extra por cada lámina después de la primera, porque su esfuerzo crece con el número de láminas.',
    valueType: 'number',
    defaultValue: CAROUSEL_EXTRA_PER_SLIDE,
    masterStatus: 'master_defined',
    min: 0,
    max: 100,
    unit: 'UD',
  },
  {
    key: 'production.piece_type_approver_role',
    category: 'production',
    label: 'Cargo que aprueba tipos de pieza nuevos',
    description: 'Quién puede aprobar un tipo de pieza propuesto y fijar cuántas unidades descuenta. Administración y Dirección de Operaciones pueden siempre, para que la atribución nunca quede sin titular. Acá se agrega un cargo más.',
    valueType: 'select',
    defaultValue: 'art_director',
    masterStatus: 'direction_required',
    options: [
      { value: 'art_director', label: 'Dirección de Arte' },
      { value: 'av_director', label: 'Dirección Audiovisual' },
      { value: 'creative_director', label: 'Dirección Creativa' },
      { value: 'commercial_director', label: 'Dirección Comercial' },
    ],
  },
  {
    key: 'ud.reversal_mode',
    category: 'design_budget',
    label: 'Devolución de unidades al cancelar',
    description: 'Qué pasa con las unidades ya descontadas cuando un trabajo se cancela. **Automática** las devuelve al saldo del mes sin trámite. **Manual** exige que alguien con permiso haga el ajuste, dejando constancia de quién lo autorizó. **No devolver** las mantiene descontadas. En los tres casos queda registrado el movimiento.',
    valueType: 'select',
    defaultValue: 'automatic',
    masterStatus: 'direction_required',
    options: [
      { value: 'automatic', label: 'Automática al cancelar' },
      { value: 'manual', label: 'Requiere ajuste autorizado' },
      { value: 'none', label: 'No se devuelve' },
    ],
  },
  {
    key: 'ud.reversal_allows_closed_budget',
    category: 'design_budget',
    label: 'Permitir devolver sobre un mes cerrado',
    description: 'Si una cancelación puede mover el saldo de un mes que ya se cerró. Desactivado, un mes cerrado queda firme y la cancelación se rechaza indicando el motivo: lo que ya se facturó no cambia porque alguien anule algo después.',
    valueType: 'boolean',
    defaultValue: false,
    masterStatus: 'direction_required',
  },
  {
    key: 'compliance.terms_enforced',
    category: 'compliance',
    label: 'Exigir aceptación de condiciones',
    description: 'Cuando está activo, nadie puede operar sin haber aceptado las condiciones vigentes. Al desactivarlo dejan de pedirse, pero las aceptaciones ya registradas se conservan.',
    valueType: 'boolean',
    defaultValue: true,
    masterStatus: 'direction_required',
  },
  {
    key: 'compliance.terms_version',
    category: 'compliance',
    label: 'Versión vigente de las condiciones',
    description: 'Identificador del texto en vigor. Al cambiarlo, todo el equipo debe volver a aceptar la próxima vez que entre. Es la forma de publicar una actualización.',
    valueType: 'text',
    defaultValue: 'v1',
    masterStatus: 'direction_required',
  },
  {
    key: 'compliance.rights_response_days',
    category: 'compliance',
    label: 'Plazo para responder una solicitud de derechos',
    description: 'Días hábiles comprometidos para responder una solicitud sobre datos personales. **El valor legal debe confirmarlo asesoría jurídica**: la Ley 21.719 fija plazos que rigen desde su entrada en vigencia y este parámetro solo los registra, no los interpreta. Se usa para alertar antes de vencer, nunca para cerrar una solicitud sola.',
    valueType: 'number',
    defaultValue: 15,
    masterStatus: 'direction_required',
    min: 1,
    max: 90,
    unit: 'días hábiles',
  },
  {
    key: 'compliance.rights_channel_procedure',
    category: 'compliance',
    label: 'Procedimiento del canal de derechos',
    description: 'Cómo se recibe, verifica, resuelve y responde una solicitud sobre datos personales, y quién responde por cada paso. Queda versionado: cambiarlo deja registro de quién y cuándo.',
    valueType: 'text',
    defaultValue: 'Pendiente de redacción por la agencia.',
    masterStatus: 'direction_required',
  },
  {
    key: 'compliance.terms_renewal_months',
    category: 'compliance',
    label: 'Renovar aceptación cada',
    description: 'Meses tras los cuales se vuelve a pedir la aceptación aunque el texto no haya cambiado. 0 la pide solo cuando cambia la versión.',
    valueType: 'number',
    defaultValue: 0,
    masterStatus: 'direction_required',
    min: 0,
    max: 36,
    unit: 'meses',
  },
  {
    key: 'operation.assignment_mode',
    category: 'operation',
    label: 'Modelo de asignación',
    description: 'Define si las cuentas se coordinan por responsable individual, pod o un esquema híbrido.',
    valueType: 'select',
    defaultValue: 'individual',
    masterStatus: 'direction_required',
    options: [
      { value: 'individual', label: 'Responsable individual' },
      { value: 'pod', label: 'Pod por cuenta' },
      { value: 'hybrid', label: 'Modelo híbrido' },
    ],
  },
  {
    key: 'production.stale_hours',
    category: 'production',
    label: 'Alerta por pieza sin movimiento',
    description: 'Activa una alerta cuando una pieza en curso supera este tiempo sin cambios.',
    valueType: 'number',
    defaultValue: 48,
    masterStatus: 'master_defined',
    min: 1,
    max: 168,
    unit: 'horas',
  },
  {
    key: 'production.max_client_corrections',
    category: 'production',
    label: 'Correcciones incluidas',
    description: 'Las solicitudes del cliente que superen esta cantidad quedan marcadas como cobrables.',
    valueType: 'number',
    defaultValue: 3,
    masterStatus: 'master_defined',
    min: 0,
    max: 10,
    unit: 'rondas',
  },
  {
    key: 'production.client_validation_months',
    category: 'production',
    label: 'Meses con validación del cliente',
    description: 'Periodo inicial sugerido para mantener la aprobación externa antes de automatizar el flujo.',
    valueType: 'number',
    defaultValue: 3,
    masterStatus: 'direction_required',
    min: 0,
    max: 24,
    unit: 'meses',
  },
  {
    key: 'ud.warning_threshold_percent',
    category: 'design_budget',
    label: 'Aviso de consumo UD',
    description: 'Muestra estado preventivo cuando el consumo alcanza este porcentaje del presupuesto.',
    valueType: 'number',
    defaultValue: 80,
    masterStatus: 'direction_required',
    min: 50,
    max: 100,
    unit: '%',
  },
  {
    key: 'ud.limit_action',
    category: 'design_budget',
    label: 'Acción al superar UD',
    description: 'Controla si una reserva sin saldo se bloquea o continúa dejando el presupuesto excedido.',
    valueType: 'select',
    defaultValue: 'block',
    masterStatus: 'direction_required',
    options: [
      { value: 'block', label: 'Bloquear reserva' },
      { value: 'warn', label: 'Advertir y continuar' },
    ],
  },
  {
    key: 'ud.client_visibility',
    category: 'design_budget',
    label: 'Visibilidad de UD para clientes',
    description: 'Registra la política de acceso al saldo UD desde el portal de cada cuenta.',
    valueType: 'boolean',
    defaultValue: false,
    masterStatus: 'direction_required',
  },
  {
    key: 'ud.display_name',
    category: 'design_budget',
    label: 'Nombre visible del presupuesto',
    description: 'Define el término que verá el equipo al comunicar el presupuesto de diseño.',
    valueType: 'select',
    defaultValue: 'UD',
    masterStatus: 'direction_required',
    options: [
      { value: 'UD', label: 'UD' },
      { value: 'Créditos de Diseño', label: 'Créditos de Diseño' },
    ],
  },
  {
    key: 'ud.internal_cost',
    category: 'design_budget',
    label: 'Costo interno por UD',
    description: 'Valor interno de referencia; nunca se expone en el portal del cliente.',
    valueType: 'number',
    defaultValue: null,
    masterStatus: 'direction_required',
    min: 0,
    max: 10000000,
    unit: 'CLP',
    nullable: true,
  },
  {
    key: 'meetings.weekly_duration_minutes',
    category: 'meetings',
    label: 'Duración de reunión semanal',
    description: 'Duración base recomendada para la reunión operativa de seguimiento.',
    valueType: 'number',
    defaultValue: 30,
    masterStatus: 'master_defined',
    min: 15,
    max: 120,
    unit: 'minutos',
  },
  {
    key: 'alerts.deadline_notice_hours',
    category: 'alerts',
    label: 'Anticipación de vencimientos',
    description: 'Tiempo de anticipación registrado para comunicar entregas próximas.',
    valueType: 'number',
    defaultValue: 24,
    masterStatus: 'direction_required',
    min: 1,
    max: 168,
    unit: 'horas',
  },
  {
    key: 'documents.naming_pattern',
    category: 'documents',
    label: 'Convención de nombres',
    description: 'Patrón oficial para archivos entregables y trazabilidad de versiones.',
    valueType: 'text',
    defaultValue: 'CLIENTE_TIPO-PIEZA_FORMATO_vVERSIÓN_ESTADO',
    masterStatus: 'master_defined',
  },
  {
    key: 'documents.final_immutable',
    category: 'documents',
    label: 'Finales inmutables',
    description: 'Mantiene las entregas finales protegidas; cualquier cambio requiere una nueva versión.',
    valueType: 'boolean',
    defaultValue: true,
    masterStatus: 'master_defined',
  },
  ...MODULE_LIFECYCLE_SETTINGS,
] as const;

export function validateOrganizationSettingValue(
  definition: OrganizationSettingDefinition,
  value: unknown,
): string | number | boolean | null {
  if (value === null && definition.nullable) return null;

  if (definition.valueType === 'boolean') {
    if (typeof value !== 'boolean') throw new Error('debe ser verdadero o falso');
    return value;
  }

  if (definition.valueType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('debe ser un número válido');
    if (!Number.isInteger(value)) throw new Error('debe ser un número entero');
    if (definition.min !== undefined && value < definition.min) throw new Error(`no puede ser menor que ${definition.min}`);
    if (definition.max !== undefined && value > definition.max) throw new Error(`no puede ser mayor que ${definition.max}`);
    return value;
  }

  if (typeof value !== 'string') throw new Error('debe ser texto');
  const normalized = value.trim();
  if (!normalized) throw new Error('no puede estar vacío');
  if (normalized.length > 255) throw new Error('no puede superar 255 caracteres');
  if (definition.valueType === 'select' && !definition.options?.some((option) => option.value === normalized)) {
    throw new Error('contiene una opción no permitida');
  }
  return normalized;
}
