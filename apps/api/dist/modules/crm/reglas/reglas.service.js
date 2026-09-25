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
var ReglasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReglasService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const regla_de_calificacion_entity_1 = require("./regla-de-calificacion.entity");
const lead_entity_1 = require("../leads/lead.entity");
const evaluar_reglas_1 = require("./evaluar-reglas");
const MAX_REGLAS = 60;
const MAX_POR_TANDA = 500;
const MEMORIA_MS = 30_000;
let ReglasService = ReglasService_1 = class ReglasService {
    constructor(reglas, leads) {
        this.reglas = reglas;
        this.leads = leads;
        this.logger = new common_1.Logger(ReglasService_1.name);
        this.memoria = new Map();
    }
    olvidar(organizationId, clientId) {
        this.memoria.delete(`${organizationId}:${clientId}`);
    }
    async vigentes(organizationId, clientId) {
        const clave = `${organizationId}:${clientId}`;
        const recordado = this.memoria.get(clave);
        if (recordado && recordado.vence > Date.now())
            return recordado.reglas;
        const reglas = (await this.listar(organizationId, clientId)).map((regla) => this.aDominio(regla));
        this.memoria.set(clave, { reglas, vence: Date.now() + MEMORIA_MS });
        return reglas;
    }
    async listar(organizationId, clientId, incluirArchivadas = false) {
        return this.reglas.find({
            where: { organizationId, clientId, ...(incluirArchivadas ? {} : { archivedAt: (0, typeorm_2.IsNull)() }) },
            order: { posicion: 'ASC', createdAt: 'ASC' },
        });
    }
    async unaOFalla(organizationId, id) {
        const regla = await this.reglas.findOne({ where: { id, organizationId } });
        if (!regla)
            throw new common_1.NotFoundException('Esa regla no existe');
        return regla;
    }
    validar(datos) {
        const nombre = datos.nombre?.trim();
        if (!nombre)
            throw new common_1.BadRequestException('La regla necesita un nombre');
        for (const condicion of datos.condiciones ?? []) {
            const sinValor = !['vacio', 'no_vacio'].includes(condicion.comparador) && !String(condicion.valor ?? '').trim();
            if (sinValor)
                throw new common_1.BadRequestException('Hay una condición sin valor: no calzaría con nada');
            if (['pregunta', 'campo'].includes(condicion.donde) && !String(condicion.clave ?? '').trim()) {
                throw new common_1.BadRequestException('Falta decir qué pregunta o qué campo mirar');
            }
        }
        if (datos.automatica && (datos.condiciones ?? []).length === 0) {
            throw new common_1.BadRequestException('Una regla sin condiciones no puede quedar automática: calificaría todos los leads');
        }
    }
    async crear(organizationId, clientId, datos, creadaPor) {
        this.validar(datos);
        const cuantas = await this.reglas.count({ where: { organizationId, clientId, archivedAt: (0, typeorm_2.IsNull)() } });
        if (cuantas >= MAX_REGLAS)
            throw new common_1.BadRequestException(`No caben más de ${MAX_REGLAS} reglas por empresa`);
        const ultima = await this.reglas.findOne({
            where: { organizationId, clientId, archivedAt: (0, typeorm_2.IsNull)() },
            order: { posicion: 'DESC' },
        });
        const creada = await this.reglas.save(this.reglas.create({
            organizationId,
            clientId,
            nombre: datos.nombre.trim().slice(0, 120),
            unir: datos.unir === 'alguna' ? 'alguna' : 'todas',
            condiciones: datos.condiciones ?? [],
            acciones: datos.acciones ?? {},
            activa: datos.activa ?? true,
            automatica: datos.automatica ?? false,
            posicion: (ultima?.posicion ?? 0) + 1,
            createdBy: creadaPor ?? null,
        }));
        this.olvidar(organizationId, clientId);
        return creada;
    }
    async editar(organizationId, id, datos) {
        const regla = await this.unaOFalla(organizationId, id);
        const mezcla = {
            nombre: datos.nombre ?? regla.nombre,
            unir: datos.unir ?? regla.unir,
            condiciones: datos.condiciones ?? regla.condiciones ?? [],
            acciones: datos.acciones ?? regla.acciones ?? {},
            activa: datos.activa ?? regla.activa,
            automatica: datos.automatica ?? regla.automatica,
        };
        this.validar(mezcla);
        regla.nombre = mezcla.nombre.trim().slice(0, 120);
        regla.unir = mezcla.unir === 'alguna' ? 'alguna' : 'todas';
        regla.condiciones = mezcla.condiciones ?? [];
        regla.acciones = mezcla.acciones ?? {};
        regla.activa = mezcla.activa ?? true;
        regla.automatica = mezcla.automatica ?? false;
        const guardada = await this.reglas.save(regla);
        this.olvidar(regla.organizationId, regla.clientId);
        return guardada;
    }
    async activar(organizationId, id, activa) {
        const regla = await this.unaOFalla(organizationId, id);
        regla.activa = activa;
        const guardada = await this.reglas.save(regla);
        this.olvidar(regla.organizationId, regla.clientId);
        return guardada;
    }
    async automatizar(organizationId, id, automatica) {
        const regla = await this.unaOFalla(organizationId, id);
        if (automatica && (regla.condiciones ?? []).length === 0) {
            throw new common_1.BadRequestException('Una regla sin condiciones no puede quedar automática: calificaría todos los leads');
        }
        regla.automatica = automatica;
        const guardada = await this.reglas.save(regla);
        this.olvidar(regla.organizationId, regla.clientId);
        return guardada;
    }
    async archivar(organizationId, id, archivar) {
        const regla = await this.unaOFalla(organizationId, id);
        regla.archivedAt = archivar ? new Date() : null;
        if (archivar)
            regla.automatica = false;
        const guardada = await this.reglas.save(regla);
        this.olvidar(regla.organizationId, regla.clientId);
        return guardada;
    }
    async reordenar(organizationId, clientId, idsEnOrden) {
        const suyas = await this.listar(organizationId, clientId, true);
        const conocidas = new Set(suyas.map((regla) => regla.id));
        const ajena = idsEnOrden.find((id) => !conocidas.has(id));
        if (ajena)
            throw new common_1.BadRequestException('Esa regla no es de esta empresa');
        const cambios = idsEnOrden
            .map((id, indice) => ({ id, posicion: indice + 1 }))
            .filter(({ id, posicion }) => suyas.find((regla) => regla.id === id)?.posicion !== posicion);
        if (cambios.length > 0) {
            const casos = cambios.map(() => 'WHEN ? THEN ?').join(' ');
            const valores = cambios.flatMap(({ id, posicion }) => [id, posicion]);
            await this.reglas.query(`UPDATE crm_reglas_de_calificacion SET posicion = CASE id ${casos} ELSE posicion END
         WHERE organization_id = ? AND client_id = ? AND id IN (${cambios.map(() => '?').join(',')})`, [...valores, organizationId, clientId, ...cambios.map(({ id }) => id)]);
        }
        this.olvidar(organizationId, clientId);
        return this.listar(organizationId, clientId);
    }
    async copiarDesde(organizationId, origenClientId, destinoClientId, creadaPor) {
        if (origenClientId === destinoClientId)
            throw new common_1.BadRequestException('Esa es la misma empresa');
        const origen = await this.listar(organizationId, origenClientId);
        if (origen.length === 0)
            throw new common_1.BadRequestException('Esa empresa no tiene reglas que copiar');
        const yaHay = await this.reglas.count({ where: { organizationId, clientId: destinoClientId, archivedAt: (0, typeorm_2.IsNull)() } });
        if (yaHay + origen.length > MAX_REGLAS)
            throw new common_1.BadRequestException(`No caben más de ${MAX_REGLAS} reglas por empresa`);
        let desde = yaHay;
        for (const regla of origen) {
            desde += 1;
            await this.reglas.save(this.reglas.create({
                organizationId,
                clientId: destinoClientId,
                nombre: regla.nombre,
                unir: regla.unir,
                condiciones: regla.condiciones ?? [],
                acciones: regla.acciones ?? {},
                activa: false,
                automatica: false,
                posicion: desde,
                createdBy: creadaPor ?? null,
            }));
        }
        this.olvidar(organizationId, destinoClientId);
        return origen.length;
    }
    aDominio(regla) {
        return {
            id: regla.id,
            nombre: regla.nombre,
            posicion: regla.posicion,
            activa: regla.activa,
            archivadaEn: regla.archivedAt ? regla.archivedAt.toISOString() : null,
            unir: regla.unir === 'alguna' ? 'alguna' : 'todas',
            condiciones: regla.condiciones ?? [],
            acciones: regla.acciones ?? {},
            automatica: regla.automatica,
        };
    }
    aLeadParaReglas(lead) {
        const metadata = (lead.metadata ?? {});
        const respuestas = Array.isArray(metadata.answers) ? metadata.answers : [];
        return {
            respuestas: respuestas.map((fila) => ({
                pregunta: String(fila?.question ?? ''),
                respuesta: String(fila?.answer ?? ''),
            })),
            campos: (lead.customFields ?? {}),
            fuente: lead.source ?? null,
            responsable: lead.assignedTo ?? null,
            monto: lead.estimatedAmount === null || lead.estimatedAmount === undefined ? null : Number(lead.estimatedAmount),
            campana: lead.campaignName ?? null,
        };
    }
    async queLeTocaria(organizationId, clientId, lead, modo = 'manual') {
        const reglas = await this.vigentes(organizationId, clientId);
        return (0, evaluar_reglas_1.primeraReglaQueCalza)(this.aLeadParaReglas(lead), reglas, modo);
    }
    async cuantosCalzan(organizationId, clientId, datos, limiteEjemplos = 5) {
        const candidata = {
            id: 'prueba',
            nombre: datos.nombre || 'Prueba',
            posicion: 0,
            activa: true,
            unir: datos.unir === 'alguna' ? 'alguna' : 'todas',
            condiciones: datos.condiciones ?? [],
            acciones: datos.acciones ?? {},
            automatica: true,
        };
        const leads = await this.leads
            .createQueryBuilder('lead')
            .select([
            'lead.id', 'lead.name', 'lead.metadata', 'lead.customFields',
            'lead.source', 'lead.assignedTo', 'lead.estimatedAmount', 'lead.campaignName',
        ])
            .where('lead.organization_id = :organizationId AND lead.client_id = :clientId', { organizationId, clientId })
            .orderBy('lead.created_at', 'DESC')
            .take(MAX_POR_TANDA)
            .getMany();
        const ejemplos = [];
        let total = 0;
        for (const lead of leads) {
            const aplicada = (0, evaluar_reglas_1.primeraReglaQueCalza)(this.aLeadParaReglas(lead), [candidata], 'automatica');
            if (!aplicada)
                continue;
            total += 1;
            if (ejemplos.length < limiteEjemplos)
                ejemplos.push({ id: lead.id, nombre: lead.name, porque: aplicada.porque });
        }
        return { total, revisados: leads.length, ejemplos };
    }
    async preguntasQueLlegan(organizationId, clientId, limite = MAX_POR_TANDA) {
        const leads = await this.leads
            .createQueryBuilder('lead')
            .select(['lead.id', 'lead.metadata'])
            .where('lead.organization_id = :organizationId AND lead.client_id = :clientId', { organizationId, clientId })
            .orderBy('lead.created_at', 'DESC')
            .take(limite)
            .getMany();
        const reglas = await this.listar(organizationId, clientId);
        const buscados = reglas
            .flatMap((regla) => regla.condiciones ?? [])
            .map((condicion) => (0, evaluar_reglas_1.comparable)(condicion.valor))
            .filter(Boolean);
        const porPregunta = new Map();
        for (const lead of leads) {
            const metadata = (lead.metadata ?? {});
            const filas = Array.isArray(metadata.answers) ? metadata.answers : [];
            for (const fila of filas) {
                const pregunta = String(fila?.question ?? '').trim();
                const respuesta = String(fila?.answer ?? '').trim();
                if (!pregunta || !respuesta)
                    continue;
                const clave = (0, evaluar_reglas_1.comparable)(pregunta);
                const entrada = porPregunta.get(clave) ?? { pregunta, total: 0, respuestas: new Map() };
                entrada.total += 1;
                const claveRespuesta = (0, evaluar_reglas_1.comparable)(respuesta);
                const anterior = entrada.respuestas.get(claveRespuesta);
                entrada.respuestas.set(claveRespuesta, { respuesta: anterior?.respuesta ?? respuesta, total: (anterior?.total ?? 0) + 1 });
                porPregunta.set(clave, entrada);
            }
        }
        return [...porPregunta.values()]
            .map((entrada) => ({
            pregunta: entrada.pregunta,
            total: entrada.total,
            respuestas: [...entrada.respuestas.values()]
                .map((fila) => ({
                ...fila,
                tieneRegla: buscados.some((buscado) => (0, evaluar_reglas_1.comparable)(fila.respuesta).includes(buscado)),
            }))
                .sort((a, b) => b.total - a.total),
        }))
            .sort((a, b) => b.total - a.total);
    }
    aplicarAlLead(lead, aplicada) {
        lead.reglaAplicadaId = aplicada?.reglaId ?? null;
        lead.reglaAplicadaMotivo = aplicada ? aplicada.porque.slice(0, 300) : null;
        if (!aplicada)
            return;
        const acciones = aplicada.acciones ?? {};
        if (acciones.semaforo)
            lead.trafficLight = acciones.semaforo;
        if (acciones.calificacion)
            lead.fitStatus = acciones.calificacion;
        if (acciones.etapa)
            lead.status = acciones.etapa;
        if (acciones.responsable)
            lead.assignedTo = acciones.responsable;
        if (acciones.descartarMotivo) {
            lead.discardReason = acciones.descartarMotivo;
            lead.status = 'lost';
        }
        if (acciones.nota) {
            const anterior = lead.notes ? `${lead.notes}
` : '';
            lead.notes = `${anterior}${acciones.nota}`.slice(0, 5000);
        }
        if (acciones.guardarEnCampo) {
            lead.customFields = { ...(lead.customFields ?? {}), [acciones.guardarEnCampo]: aplicada.porque };
        }
    }
    async aplicarA(organizationId, clientId, leadIds, aplicarCambios) {
        const ids = [...new Set(leadIds)].slice(0, MAX_POR_TANDA);
        if (ids.length === 0)
            return { calificados: 0, sinRegla: 0, fallidos: 0 };
        const reglas = await this.vigentes(organizationId, clientId);
        const leads = await this.leads.find({ where: { organizationId, clientId, id: (0, typeorm_2.In)(ids) } });
        let calificados = 0;
        let sinRegla = 0;
        let fallidos = 0;
        for (const lead of leads) {
            try {
                const aplicada = (0, evaluar_reglas_1.primeraReglaQueCalza)(this.aLeadParaReglas(lead), reglas, 'manual');
                if (!aplicada) {
                    sinRegla += 1;
                    continue;
                }
                await aplicarCambios(lead, aplicada);
                calificados += 1;
            }
            catch (error) {
                fallidos += 1;
                this.logger.warn(`No se pudo aplicar reglas al lead ${lead.id}: ${error.message}`);
            }
        }
        return { calificados, sinRegla, fallidos };
    }
    async aplicarYGuardar(organizationId, clientId, leadIds) {
        return this.aplicarA(organizationId, clientId, leadIds, async (lead, aplicada) => {
            this.aplicarAlLead(lead, aplicada);
            await this.leads.save(lead);
        });
    }
};
exports.ReglasService = ReglasService;
exports.ReglasService = ReglasService = ReglasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(regla_de_calificacion_entity_1.ReglaDeCalificacion)),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ReglasService);
