"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmFieldsService = exports.MAXIMO_CAMPOS_POR_ENTIDAD = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const crm_field_definition_entity_1 = require("./crm-field-definition.entity");
const respuestas_de_formularios_1 = require("./respuestas-de-formularios");
const TABLA_DE = { lead: 'leads', contact: 'crm_contacts', opportunity: 'crm_opportunities' };
const ENTIDADES = new Set(['lead', 'contact', 'opportunity']);
const TIPOS = new Set(shared_1.TIPOS_DE_CAMPO.map((tipo) => tipo.value));
const CON_OPCIONES = new Set(['select', 'multi_select']);
exports.MAXIMO_CAMPOS_POR_ENTIDAD = 40;
function aContrato(def) {
    return {
        id: def.id,
        entity: def.entity,
        key: def.fieldKey,
        label: def.label,
        type: def.type,
        options: def.options ?? null,
        required: def.required,
        position: def.position,
        clientId: def.clientId ?? null,
        metaQuestions: def.metaQuestions ?? null,
        archivedAt: def.archivedAt ? def.archivedAt.toISOString() : null,
    };
}
function limpiarOpciones(opciones) {
    if (!Array.isArray(opciones))
        throw new common_1.BadRequestException('Las opciones tienen que ser una lista');
    const limpias = [...new Set(opciones.map((opcion) => String(opcion).trim()).filter(Boolean))];
    if (limpias.length === 0)
        throw new common_1.BadRequestException('Agrega al menos una opción');
    if (limpias.length > 100)
        throw new common_1.BadRequestException('Son demasiadas opciones (máximo 100)');
    if (limpias.some((opcion) => opcion.length > 80))
        throw new common_1.BadRequestException('Cada opción admite hasta 80 caracteres');
    if (limpias.some((opcion) => /[;|]/.test(opcion)))
        throw new common_1.BadRequestException('Las opciones no pueden llevar «;» ni «|»');
    return limpias;
}
let CrmFieldsService = class CrmFieldsService {
    constructor(campos, dataSource) {
        this.campos = campos;
        this.dataSource = dataSource;
    }
    entidadValida(entity) {
        if (!ENTIDADES.has(entity))
            throw new common_1.BadRequestException('Tipo de registro inválido');
        return entity;
    }
    async listar(organizationId, entity, incluirArchivados = false, clientId) {
        const entidad = this.entidadValida(entity);
        const filas = await this.campos.find({
            where: [
                { organizationId, entity: entidad, clientId: (0, typeorm_2.IsNull)(), ...(incluirArchivados ? {} : { archivedAt: (0, typeorm_2.IsNull)() }) },
                ...(clientId ? [{ organizationId, entity: entidad, clientId, ...(incluirArchivados ? {} : { archivedAt: (0, typeorm_2.IsNull)() }) }] : []),
            ],
            order: { position: 'ASC', createdAt: 'ASC' },
        });
        return filas.map(aContrato);
    }
    async crear(organizationId, actorId, datos) {
        const entidad = this.entidadValida(datos.entity);
        const etiqueta = (datos.label ?? '').trim().slice(0, 80);
        if (!etiqueta)
            throw new common_1.BadRequestException('El campo necesita un nombre');
        if (!TIPOS.has(datos.type))
            throw new common_1.BadRequestException('Tipo de campo inválido');
        const tipo = datos.type;
        const clave = (datos.key?.trim() || (0, shared_1.claveDesdeEtiqueta)(etiqueta));
        const problema = (0, shared_1.problemaDeClave)(clave);
        if (problema)
            throw new common_1.BadRequestException(problema);
        const activos = await this.campos.count({ where: { organizationId, entity: entidad, archivedAt: (0, typeorm_2.IsNull)() } });
        if (activos >= exports.MAXIMO_CAMPOS_POR_ENTIDAD)
            throw new common_1.BadRequestException(`Ya hay ${exports.MAXIMO_CAMPOS_POR_ENTIDAD} campos activos. Archiva alguno antes de agregar otro.`);
        const repetida = await this.campos.findOne({ where: { organizationId, entity: entidad, fieldKey: clave, clientId: datos.clientId ?? (0, typeorm_2.IsNull)() } });
        if (repetida) {
            throw new common_1.ConflictException(repetida.archivedAt
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
            clientId: datos.clientId ?? null,
            position: activos,
            createdBy: actorId,
        }));
        return aContrato(guardado);
    }
    async actualizar(organizationId, id, datos) {
        const campo = await this.campos.findOne({ where: { id, organizationId } });
        if (!campo)
            throw new common_1.NotFoundException('Campo no encontrado');
        const tipoNuevo = datos.type !== undefined ? datos.type : campo.type;
        if (!TIPOS.has(tipoNuevo))
            throw new common_1.BadRequestException('Tipo de campo inválido');
        const opcionesNuevas = CON_OPCIONES.has(tipoNuevo)
            ? (datos.options !== undefined ? limpiarOpciones(datos.options) : campo.options ?? [])
            : null;
        if (CON_OPCIONES.has(tipoNuevo) && (opcionesNuevas ?? []).length === 0) {
            throw new common_1.BadRequestException('Agrega al menos una opción');
        }
        const cambiaForma = tipoNuevo !== campo.type || JSON.stringify(opcionesNuevas ?? null) !== JSON.stringify(campo.options ?? null);
        if (cambiaForma) {
            const guardados = await this.valoresGuardados(organizationId, campo.entity, campo.fieldKey);
            const rotos = (0, shared_1.valoresQueSeRomperian)({ key: campo.fieldKey, type: campo.type, options: campo.options, label: campo.label }, tipoNuevo, opcionesNuevas, guardados);
            if (rotos > 0) {
                throw new common_1.BadRequestException(`${rotos} ${rotos === 1 ? 'registro tiene' : 'registros tienen'} un valor que dejaría de ser válido con este cambio. Corrígelos primero o crea un campo nuevo.`);
            }
        }
        if (datos.label !== undefined) {
            const etiqueta = datos.label.trim().slice(0, 80);
            if (!etiqueta)
                throw new common_1.BadRequestException('El campo necesita un nombre');
            campo.label = etiqueta;
        }
        if (datos.required !== undefined)
            campo.required = Boolean(datos.required);
        if (datos.position !== undefined && Number.isInteger(datos.position))
            campo.position = Math.max(0, datos.position);
        campo.type = tipoNuevo;
        campo.options = opcionesNuevas;
        if (datos.metaQuestions !== undefined) {
            const vistas = new Set();
            const preguntas = datos.metaQuestions
                .map((pregunta) => pregunta.trim().slice(0, 120))
                .filter((pregunta) => {
                const llave = (0, respuestas_de_formularios_1.comparable)(pregunta);
                if (!llave || vistas.has(llave))
                    return false;
                vistas.add(llave);
                return true;
            });
            campo.metaQuestions = preguntas.length > 0 ? preguntas : null;
        }
        return aContrato(await this.campos.save(campo));
    }
    async archivar(organizationId, id, archivar) {
        const campo = await this.campos.findOne({ where: { id, organizationId } });
        if (!campo)
            throw new common_1.NotFoundException('Campo no encontrado');
        if (!archivar && !campo.archivedAt)
            return aContrato(campo);
        if (!archivar) {
            const activos = await this.campos.count({ where: { organizationId, entity: campo.entity, archivedAt: (0, typeorm_2.IsNull)() } });
            if (activos >= exports.MAXIMO_CAMPOS_POR_ENTIDAD)
                throw new common_1.BadRequestException(`Ya hay ${exports.MAXIMO_CAMPOS_POR_ENTIDAD} campos activos. Archiva alguno antes.`);
        }
        campo.archivedAt = archivar ? new Date() : null;
        return aContrato(await this.campos.save(campo));
    }
    async validarPara(organizationId, entity, previos, nuevos, exigirObligatorios, clientId) {
        if (!nuevos && !exigirObligatorios)
            return previos ?? null;
        const definiciones = await this.listar(organizationId, entity, true, clientId);
        const { valores, errores } = (0, shared_1.validarCamposPersonalizados)(definiciones, previos, nuevos, { exigirObligatorios });
        if (errores.length > 0)
            throw new common_1.BadRequestException(errores.join('. '));
        return Object.keys(valores).length > 0 ? valores : null;
    }
    async valoresGuardados(organizationId, entity, clave) {
        const tabla = TABLA_DE[entity];
        const filas = await this.dataSource.query(`SELECT custom_fields FROM ${tabla} WHERE organization_id = ? AND custom_fields IS NOT NULL AND JSON_CONTAINS_PATH(custom_fields, 'one', ?)`, [organizationId, `$.${clave}`]);
        return filas.map((fila) => {
            const valor = fila.custom_fields;
            if (typeof valor === 'string') {
                try {
                    return JSON.parse(valor);
                }
                catch {
                    return {};
                }
            }
            return (valor ?? {});
        });
    }
};
exports.CrmFieldsService = CrmFieldsService;
exports.CrmFieldsService = CrmFieldsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(crm_field_definition_entity_1.CrmFieldDefinition)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], CrmFieldsService);
