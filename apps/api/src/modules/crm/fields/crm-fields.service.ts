import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  problemaDeClave, claveDesdeEtiqueta, TIPOS_DE_CAMPO, validarCamposPersonalizados, valoresQueSeRomperian,
  type CustomFieldDefinition, type CustomFieldEntity, type CustomFieldType, type CustomFieldValues,
} from '@espartanos/shared';
import { CrmFieldDefinition } from './crm-field-definition.entity';
import { comparable } from './respuestas-de-formularios';

/** Dónde guarda sus valores cada tipo de registro. Nombres fijos: nunca vienen del pedido. */
const TABLA_DE: Record<CustomFieldEntity, string> = { lead: 'leads', contact: 'crm_contacts', opportunity: 'crm_opportunities' };

const ENTIDADES = new Set<CustomFieldEntity>(['lead', 'contact', 'opportunity']);
const TIPOS = new Set<CustomFieldType>(TIPOS_DE_CAMPO.map((tipo) => tipo.value));
const CON_OPCIONES = new Set<CustomFieldType>(['select', 'multi_select']);

/** Cuántos campos activos por tipo de registro. Con más, la ficha deja de leerse. */
export const MAXIMO_CAMPOS_POR_ENTIDAD = 40;

function aContrato(def: CrmFieldDefinition): CustomFieldDefinition {
  return {
    id: def.id,
    entity: def.entity,
    key: def.fieldKey,
    label: def.label,
    type: def.type,
    options: def.options ?? null,
    required: def.required,
    position: def.position,
    metaQuestions: def.metaQuestions ?? null,
    archivedAt: def.archivedAt ? def.archivedAt.toISOString() : null,
  };
}

/** Opciones limpias: sin vacías, sin repetidas, con un largo razonable. */
function limpiarOpciones(opciones: unknown): string[] {
  if (!Array.isArray(opciones)) throw new BadRequestException('Las opciones tienen que ser una lista');
  const limpias = [...new Set(opciones.map((opcion) => String(opcion).trim()).filter(Boolean))];
  if (limpias.length === 0) throw new BadRequestException('Agrega al menos una opción');
  if (limpias.length > 100) throw new BadRequestException('Son demasiadas opciones (máximo 100)');
  if (limpias.some((opcion) => opcion.length > 80)) throw new BadRequestException('Cada opción admite hasta 80 caracteres');
  // «;» y «|» separan valores al importar varias opciones desde un CSV.
  if (limpias.some((opcion) => /[;|]/.test(opcion))) throw new BadRequestException('Las opciones no pueden llevar «;» ni «|»');
  return limpias;
}

@Injectable()
export class CrmFieldsService {
  constructor(
    @InjectRepository(CrmFieldDefinition) private readonly campos: Repository<CrmFieldDefinition>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private entidadValida(entity: string): CustomFieldEntity {
    if (!ENTIDADES.has(entity as CustomFieldEntity)) throw new BadRequestException('Tipo de registro inválido');
    return entity as CustomFieldEntity;
  }

  async listar(organizationId: string, entity: string, incluirArchivados = false): Promise<CustomFieldDefinition[]> {
    const entidad = this.entidadValida(entity);
    const filas = await this.campos.find({
      where: { organizationId, entity: entidad, ...(incluirArchivados ? {} : { archivedAt: IsNull() }) },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return filas.map(aContrato);
  }

  async crear(
    organizationId: string,
    actorId: string,
    datos: { entity: string; label: string; key?: string; type: string; options?: unknown; required?: boolean },
  ): Promise<CustomFieldDefinition> {
    const entidad = this.entidadValida(datos.entity);
    const etiqueta = (datos.label ?? '').trim().slice(0, 80);
    if (!etiqueta) throw new BadRequestException('El campo necesita un nombre');
    if (!TIPOS.has(datos.type as CustomFieldType)) throw new BadRequestException('Tipo de campo inválido');
    const tipo = datos.type as CustomFieldType;

    const clave = (datos.key?.trim() || claveDesdeEtiqueta(etiqueta));
    const problema = problemaDeClave(clave);
    if (problema) throw new BadRequestException(problema);

    const activos = await this.campos.count({ where: { organizationId, entity: entidad, archivedAt: IsNull() } });
    if (activos >= MAXIMO_CAMPOS_POR_ENTIDAD) throw new BadRequestException(`Ya hay ${MAXIMO_CAMPOS_POR_ENTIDAD} campos activos. Archiva alguno antes de agregar otro.`);

    // Una clave usada antes —aunque esté archivada— no se reutiliza: sus valores siguen guardados
    // y un campo nuevo con esa clave los heredaría con otro significado.
    const repetida = await this.campos.findOne({ where: { organizationId, entity: entidad, fieldKey: clave } });
    if (repetida) {
      throw new ConflictException(repetida.archivedAt
        ? `Ya existió un campo con la clave «${clave}» y está archivado. Desarchívalo, o usa otra clave.`
        : `Ya existe un campo con la clave «${clave}».`);
    }

    const guardado = await this.campos.save(this.campos.create({
      organizationId,
      entity: entidad,
      fieldKey: clave,
      label: etiqueta,
      type: tipo,
      options: CON_OPCIONES.has(tipo) ? limpiarOpciones(datos.options) : null,
      required: Boolean(datos.required),
      position: activos,
      createdBy: actorId,
    }));
    return aContrato(guardado);
  }

  /**
   * Cambia nombre, obligatoriedad, orden, opciones o tipo.
   *
   * La clave no se cambia nunca. El tipo y las opciones sí, pero sólo si todo lo ya guardado sigue
   * siendo válido: se cuentan los valores que se romperían y, si hay alguno, se rechaza diciendo
   * cuántos. Así nadie convierte «texto» en «número» con fichas que dicen «entre 5 y 10».
   */
  async actualizar(
    organizationId: string,
    id: string,
    datos: { label?: string; required?: boolean; position?: number; options?: unknown; type?: string; metaQuestions?: string[] },
  ): Promise<CustomFieldDefinition> {
    const campo = await this.campos.findOne({ where: { id, organizationId } });
    if (!campo) throw new NotFoundException('Campo no encontrado');

    const tipoNuevo = datos.type !== undefined ? datos.type : campo.type;
    if (!TIPOS.has(tipoNuevo as CustomFieldType)) throw new BadRequestException('Tipo de campo inválido');
    const opcionesNuevas = CON_OPCIONES.has(tipoNuevo as CustomFieldType)
      ? (datos.options !== undefined ? limpiarOpciones(datos.options) : campo.options ?? [])
      : null;
    if (CON_OPCIONES.has(tipoNuevo as CustomFieldType) && (opcionesNuevas ?? []).length === 0) {
      throw new BadRequestException('Agrega al menos una opción');
    }

    const cambiaForma = tipoNuevo !== campo.type || JSON.stringify(opcionesNuevas ?? null) !== JSON.stringify(campo.options ?? null);
    if (cambiaForma) {
      const guardados = await this.valoresGuardados(organizationId, campo.entity, campo.fieldKey);
      const rotos = valoresQueSeRomperian(
        { key: campo.fieldKey, type: campo.type, options: campo.options, label: campo.label },
        tipoNuevo as CustomFieldType,
        opcionesNuevas,
        guardados,
      );
      if (rotos > 0) {
        throw new BadRequestException(`${rotos} ${rotos === 1 ? 'registro tiene' : 'registros tienen'} un valor que dejaría de ser válido con este cambio. Corrígelos primero o crea un campo nuevo.`);
      }
    }

    if (datos.label !== undefined) {
      const etiqueta = datos.label.trim().slice(0, 80);
      if (!etiqueta) throw new BadRequestException('El campo necesita un nombre');
      campo.label = etiqueta;
    }
    if (datos.required !== undefined) campo.required = Boolean(datos.required);
    if (datos.position !== undefined && Number.isInteger(datos.position)) campo.position = Math.max(0, datos.position);
    campo.type = tipoNuevo as CustomFieldType;
    campo.options = opcionesNuevas;
    /*
     * Las preguntas de Meta que llenan este campo.
     *
     * Se limpian y se desduplican por su forma comparable —sin tildes ni signos—: dos variantes
     * que ya emparejan igual no aportan nada y ensucian la lista que se le muestra a quien
     * configura. Una lista vacía deja el campo sólo para llenarse a mano.
     */
    if (datos.metaQuestions !== undefined) {
      const vistas = new Set<string>();
      const preguntas = datos.metaQuestions
        .map((pregunta) => pregunta.trim().slice(0, 120))
        .filter((pregunta) => {
          const llave = comparable(pregunta);
          if (!llave || vistas.has(llave)) return false;
          vistas.add(llave);
          return true;
        });
      campo.metaQuestions = preguntas.length > 0 ? preguntas : null;
    }
    return aContrato(await this.campos.save(campo));
  }

  /** Archivar esconde el campo sin tocar lo guardado; desarchivar lo devuelve con sus valores. */
  async archivar(organizationId: string, id: string, archivar: boolean): Promise<CustomFieldDefinition> {
    const campo = await this.campos.findOne({ where: { id, organizationId } });
    if (!campo) throw new NotFoundException('Campo no encontrado');
    if (!archivar && !campo.archivedAt) return aContrato(campo);
    if (!archivar) {
      const activos = await this.campos.count({ where: { organizationId, entity: campo.entity, archivedAt: IsNull() } });
      if (activos >= MAXIMO_CAMPOS_POR_ENTIDAD) throw new BadRequestException(`Ya hay ${MAXIMO_CAMPOS_POR_ENTIDAD} campos activos. Archiva alguno antes.`);
    }
    campo.archivedAt = archivar ? new Date() : null;
    return aContrato(await this.campos.save(campo));
  }

  /**
   * Valida lo que llega para un registro y devuelve cómo queda, o falla con todos los problemas.
   *
   * @param exigirObligatorios Sólo cuando edita una persona. Lo que entra por Meta o por una
   *   importación no puede rebotar por un campo que su origen no conoce.
   */
  async validarPara(
    organizationId: string,
    entity: CustomFieldEntity,
    previos: CustomFieldValues | null | undefined,
    nuevos: Record<string, unknown> | null | undefined,
    exigirObligatorios: boolean,
  ): Promise<CustomFieldValues | null> {
    if (!nuevos && !exigirObligatorios) return previos ?? null;
    const definiciones = await this.listar(organizationId, entity, true);
    const { valores, errores } = validarCamposPersonalizados(definiciones, previos, nuevos, { exigirObligatorios });
    if (errores.length > 0) throw new BadRequestException(errores.join('. '));
    return Object.keys(valores).length > 0 ? valores : null;
  }

  /** Lo guardado de un campo, para saber qué rompería un cambio. Sólo los registros que lo tienen. */
  private async valoresGuardados(organizationId: string, entity: CustomFieldEntity, clave: string): Promise<CustomFieldValues[]> {
    const tabla = TABLA_DE[entity];
    const filas = await this.dataSource.query(
      `SELECT custom_fields FROM ${tabla} WHERE organization_id = ? AND custom_fields IS NOT NULL AND JSON_CONTAINS_PATH(custom_fields, 'one', ?)`,
      [organizationId, `$.${clave}`],
    ) as Array<{ custom_fields: unknown }>;
    return filas.map((fila) => {
      const valor = fila.custom_fields;
      if (typeof valor === 'string') {
        try { return JSON.parse(valor) as CustomFieldValues; } catch { return {}; }
      }
      return (valor ?? {}) as CustomFieldValues;
    });
  }
}
