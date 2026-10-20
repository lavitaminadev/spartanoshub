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
exports.PerfilesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const user_client_access_entity_1 = require("../../../core/client-scope/user-client-access.entity");
const consent_version_entity_1 = require("../../../core/data-protection/consent-version.entity");
const consent_entity_1 = require("../../../core/data-protection/consent.entity");
const administradores_de_empresa_service_1 = require("../administradores-de-empresa.service");
const audit_service_1 = require("../../../core/audit/audit.service");
const permission_resolver_service_1 = require("../../../core/authorization/permission-resolver.service");
const client_entity_1 = require("../../clients/client.entity");
const client_capabilities_1 = require("../../clients/client-capabilities");
const user_entity_1 = require("../user.entity");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const concesion_1 = require("./concesion");
const invitacion_de_equipo_entity_1 = require("./invitacion-de-equipo.entity");
const perfil_asignacion_entity_1 = require("./perfil-asignacion.entity");
const perfil_de_empresa_entity_1 = require("./perfil-de-empresa.entity");
const texto_de_confidencialidad_1 = require("./texto-de-confidencialidad");
const MODULOS_CONTRATABLES = new Set(['reservations', 'crm', 'surveys', 'marketing']);
let PerfilesService = class PerfilesService {
    constructor(perfiles, asignaciones, clientes, usuarios, accesos, textos, consentimientos, auditoria, permisos, administradores, invitaciones) {
        this.perfiles = perfiles;
        this.asignaciones = asignaciones;
        this.clientes = clientes;
        this.usuarios = usuarios;
        this.accesos = accesos;
        this.textos = textos;
        this.consentimientos = consentimientos;
        this.auditoria = auditoria;
        this.permisos = permisos;
        this.administradores = administradores;
        this.invitaciones = invitaciones;
    }
    async topeDe(ctx) {
        if (ctx.esAgencia)
            return null;
        const propia = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId: ctx.actorId } });
        const perfil = propia ? await this.perfiles.findOne({ where: { id: propia.perfilId, clientId: ctx.clientId } }) : null;
        return { areas: perfil?.areas ?? {}, datos: perfil?.datosProtegidos ?? {} };
    }
    async listar(ctx) {
        const perfiles = await this.perfiles.find({ where: { clientId: ctx.clientId }, order: { nombre: 'ASC' } });
        const filas = await this.asignaciones.find({ where: { clientId: ctx.clientId } });
        return perfiles.map((perfil) => ({ ...perfil, personas: filas.filter((fila) => fila.perfilId === perfil.id).length }));
    }
    async reingresos(ctx) {
        const filas = (await this.accesos.find({ where: { clientId: ctx.clientId, retiredAt: (0, typeorm_2.IsNull)() } }))
            .filter((fila) => fila.reenteredAt);
        const quienes = filas.map((fila) => fila.reenteredBy).filter((id) => Boolean(id));
        const nombres = new Map((quienes.length ? await this.usuarios.find({ where: { id: (0, typeorm_2.In)(quienes) }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]));
        return filas.map((fila) => ({
            userId: fila.userId,
            reingresoEl: new Date(fila.reenteredAt).toISOString(),
            motivo: fila.reentryReason ?? null,
            reinvitadoPor: (fila.reenteredBy && nombres.get(fila.reenteredBy)) || null,
            antesHasta: fila.previousRetiredAt ? new Date(fila.previousRetiredAt).toISOString() : null,
        }));
    }
    async asignacionesDeLaEmpresa(ctx) {
        const filas = await this.asignaciones.find({ where: { clientId: ctx.clientId } });
        return filas.map((fila) => ({ userId: fila.userId, perfilId: fila.perfilId }));
    }
    async crear(ctx, entrada) {
        const contenido = await this.contenidoValido(ctx, entrada);
        await this.exigirAceptacion(ctx, {}, contenido.datos, entrada.aceptacion);
        const guardado = await this.guardarUnico(ctx, () => this.perfiles.save(this.perfiles.create({
            organizationId: ctx.organizationId,
            clientId: ctx.clientId,
            nombre: contenido.nombre,
            descripcion: contenido.descripcion,
            areas: contenido.areas,
            datosProtegidos: contenido.datos,
            creadoPor: ctx.actorId,
        })));
        await this.registrar(ctx, 'perfil_creado', guardado.id, undefined, { nombre: guardado.nombre, areas: guardado.areas, datos: guardado.datosProtegidos });
        return guardado;
    }
    async actualizar(ctx, id, entrada) {
        const perfil = await this.propio(ctx, id);
        const tope = await this.topeDe(ctx);
        (0, concesion_1.asegurarQueNoConcedePorEncima)(tope, perfil.areas, perfil.datosProtegidos);
        const contenido = await this.contenidoValido(ctx, entrada, tope);
        const personas = await this.asignaciones.count({ where: { perfilId: perfil.id } });
        if (personas > 0 && entrada.confirmaPersonas !== personas) {
            throw new common_1.ConflictException({
                message: `Este perfil lo usan ${personas} persona${personas === 1 ? '' : 's'}: guardar cambia lo que ven`,
                personas,
            });
        }
        await this.exigirAceptacion(ctx, perfil.datosProtegidos, contenido.datos, entrada.aceptacion);
        const antes = { nombre: perfil.nombre, areas: perfil.areas, datos: perfil.datosProtegidos };
        perfil.nombre = contenido.nombre;
        perfil.descripcion = contenido.descripcion;
        perfil.areas = contenido.areas;
        perfil.datosProtegidos = contenido.datos;
        const guardado = await this.guardarUnico(ctx, () => this.perfiles.save(perfil));
        await this.invalidarA(guardado.id);
        await this.registrar(ctx, 'perfil_editado', guardado.id, antes, { nombre: guardado.nombre, areas: guardado.areas, datos: guardado.datosProtegidos, personas });
        return guardado;
    }
    async borrar(ctx, id, reasignarA) {
        const perfil = await this.propio(ctx, id);
        const tope = await this.topeDe(ctx);
        (0, concesion_1.asegurarQueNoConcedePorEncima)(tope, perfil.areas, perfil.datosProtegidos);
        const usan = await this.asignaciones.find({ where: { perfilId: perfil.id } });
        if (usan.length > 0) {
            if (!reasignarA) {
                throw new common_1.ConflictException({
                    message: `Lo usan ${usan.length} persona${usan.length === 1 ? '' : 's'}: elige a qué perfil pasan antes de borrarlo`,
                    personas: usan.length,
                });
            }
            if (reasignarA === perfil.id)
                throw new common_1.BadRequestException('Elige otro perfil: ese es el que se borra');
            const destino = await this.propio(ctx, reasignarA);
            (0, concesion_1.asegurarQueNoConcedePorEncima)(tope, destino.areas, destino.datosProtegidos);
            await this.asignaciones.update({ perfilId: perfil.id }, { perfilId: destino.id, asignadoPor: ctx.actorId });
            for (const fila of usan)
                this.permisos.invalidateUser(fila.userId);
        }
        await this.perfiles.remove(perfil);
        await this.registrar(ctx, 'perfil_borrado', id, { nombre: perfil.nombre }, { reasignadoA: reasignarA ?? null, personas: usan.length });
        return { reasignadas: usan.length };
    }
    async asignar(ctx, userId, perfilId) {
        if (!(await this.perteneceAEmpresa(ctx.clientId, userId)))
            throw new common_1.NotFoundException('Esa persona no está en el equipo de esta empresa');
        const tope = await this.topeDe(ctx);
        const actual = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId } });
        if (actual) {
            const previo = await this.perfiles.findOne({ where: { id: actual.perfilId } });
            if (previo)
                (0, concesion_1.asegurarQueNoConcedePorEncima)(tope, previo.areas, previo.datosProtegidos);
        }
        if (perfilId === null) {
            if (actual)
                await this.asignaciones.remove(actual);
        }
        else {
            const perfil = await this.propio(ctx, perfilId);
            (0, concesion_1.asegurarQueNoConcedePorEncima)(tope, perfil.areas, perfil.datosProtegidos);
            await this.asignaciones.save({ ...(actual ?? {}), organizationId: ctx.organizationId, clientId: ctx.clientId, userId, perfilId: perfil.id, asignadoPor: ctx.actorId });
        }
        this.permisos.invalidateUser(userId);
        await this.registrar(ctx, 'perfil_asignado', userId, { perfilId: actual?.perfilId ?? null }, { perfilId });
    }
    async sembrarSugeridos(organizationId, clientId, modulos) {
        const cliente = await this.clientes.findOne({ where: { id: clientId, organizationId } });
        if (!cliente)
            throw new common_1.NotFoundException('Empresa no encontrada');
        const encendidos = modulos ?? this.modulosEncendidos(cliente);
        const existentes = new Set((await this.perfiles.find({ where: { clientId }, select: { nombre: true } })).map((fila) => fila.nombre));
        let copiados = 0;
        for (const sugerido of shared_1.PERFILES_SUGERIDOS) {
            if (!encendidos.includes(sugerido.modulo) || existentes.has(sugerido.nombre))
                continue;
            await this.perfiles.save(this.perfiles.create({
                organizationId,
                clientId,
                nombre: sugerido.nombre,
                descripcion: sugerido.descripcion,
                areas: { ...sugerido.areas },
                datosProtegidos: { ...sugerido.datosProtegidos },
            }));
            copiados += 1;
        }
        return copiados;
    }
    async textoDeConfidencialidad(organizationId) {
        let fila = await this.textos.findOne({ where: { organizationId, title: texto_de_confidencialidad_1.TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD } });
        if (!fila) {
            const ultima = await this.textos.findOne({ where: { organizationId }, order: { version: 'DESC' } });
            fila = await this.textos.save(this.textos.create({
                organizationId,
                version: (ultima?.version ?? 0) + 1,
                title: texto_de_confidencialidad_1.TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD,
                text: texto_de_confidencialidad_1.TEXTO_DE_CONFIDENCIALIDAD,
                active: false,
            }));
        }
        return { id: fila.id, version: fila.version, titulo: fila.title, texto: fila.text };
    }
    async perteneceAEmpresa(clientId, userId) {
        const usuario = await this.usuarios.findOne({ where: { id: userId }, select: { id: true, clientId: true } });
        if (!usuario)
            return false;
        if (usuario.clientId === clientId)
            return true;
        return (await this.accesos.count({ where: { clientId, userId, retiredAt: (0, typeorm_2.IsNull)() } })) > 0;
    }
    async propio(ctx, id) {
        const perfil = await this.perfiles.findOne({ where: { id, clientId: ctx.clientId, organizationId: ctx.organizationId } });
        if (!perfil)
            throw new common_1.NotFoundException('Perfil no encontrado');
        return perfil;
    }
    async quitarDelEquipo(ctx, userId, motivo, vetar = false) {
        const razon = (motivo ?? '').trim().slice(0, 300);
        if (razon.length < 3)
            throw new common_1.BadRequestException('Escribe el motivo: queda como constancia');
        if (userId === ctx.actorId)
            throw new common_1.BadRequestException('No puedes quitarte a ti mismo del equipo');
        const usuario = await this.usuarios.findOne({ where: { id: userId, organizationId: ctx.organizationId } });
        if (!usuario || !(await this.perteneceAEmpresa(ctx.clientId, userId))) {
            throw new common_1.NotFoundException('Esa persona no está en el equipo de esta empresa');
        }
        if (usuario.role !== user_role_enum_1.UserRole.CLIENT)
            throw new common_1.ForbiddenException('Solo puedes administrar cuentas de tu empresa');
        const asignacion = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId } });
        if (asignacion) {
            const perfil = await this.perfiles.findOne({ where: { id: asignacion.perfilId } });
            if (perfil)
                (0, concesion_1.asegurarQueNoConcedePorEncima)(await this.topeDe(ctx), perfil.areas, perfil.datosProtegidos);
            await this.asignaciones.remove(asignacion);
        }
        await this.administradores.definir(ctx.organizationId, userId, ctx.clientId, false, ctx.actorId);
        await this.invitaciones.update({ clientId: ctx.clientId, email: usuario.email, aceptadaEl: (0, typeorm_2.IsNull)(), revocadaEl: (0, typeorm_2.IsNull)() }, { revocadaEl: new Date() });
        const marca = { retiredAt: new Date(), retiredBy: ctx.actorId, retiredReason: razon, retiredOutcome: vetar ? 'vetado' : 'retirado' };
        const fila = await this.accesos.findOne({ where: { userId, clientId: ctx.clientId } });
        await this.accesos.save(fila
            ? { ...fila, ...marca }
            : this.accesos.create({ organizationId: ctx.organizationId, userId, clientId: ctx.clientId, reason: 'Empresa de la cuenta', ...marca }));
        const otras = (await this.accesos.find({ where: { userId, retiredAt: (0, typeorm_2.IsNull)() }, select: { clientId: true, id: true } }))
            .filter((otra) => otra.clientId !== ctx.clientId);
        const propiaEsEsta = usuario.clientId === ctx.clientId;
        const quedan = propiaEsEsta ? otras.map((otra) => otra.clientId) : [usuario.clientId, ...otras.map((otra) => otra.clientId)].filter(Boolean);
        let desactivada = false;
        if (propiaEsEsta)
            usuario.clientId = (quedan[0] ?? null);
        if (quedan.length === 0) {
            usuario.isActive = false;
            usuario.passwordChangedAt = new Date();
            usuario.refreshToken = null;
            desactivada = true;
        }
        await this.usuarios.save(usuario);
        this.permisos.invalidateUser(userId);
        await this.registrar(ctx, 'equipo_retirado', userId, { clientId: ctx.clientId }, { desactivada, motivo: razon, resultado: marca.retiredOutcome });
        return { desactivada };
    }
    modulosEncendidos(cliente) {
        const capacidades = (0, client_capabilities_1.normalizeClientCapabilities)(cliente.capabilities);
        return ['reservations', 'crm', 'surveys', 'marketing'].filter((clave) => capacidades[clave]);
    }
    async contenidoValido(ctx, entrada, topePedido) {
        const nombre = (entrada.nombre ?? '').trim().replace(/\s+/g, ' ');
        if (nombre.length < 2 || nombre.length > 80)
            throw new common_1.BadRequestException('El nombre del perfil debe tener entre 2 y 80 letras');
        const descripcion = entrada.descripcion?.trim().slice(0, 300) || null;
        const areas = Object.fromEntries(Object.entries(entrada.areas ?? {}).filter(([, nivel]) => nivel !== 'ninguno'));
        const datos = Object.fromEntries(Object.entries(entrada.datosProtegidos ?? {}).filter(([, nivel]) => nivel !== 'oculto'));
        (0, concesion_1.validarJuegos)(areas, datos);
        await this.exigirModulosContratados(ctx, areas, datos);
        (0, concesion_1.asegurarQueNoConcedePorEncima)(topePedido === undefined ? await this.topeDe(ctx) : topePedido, areas, datos);
        return { nombre, descripcion, areas, datos };
    }
    async exigirModulosContratados(ctx, areas, datos) {
        const cliente = await this.clientes.findOne({ where: { id: ctx.clientId, organizationId: ctx.organizationId } });
        if (!cliente)
            throw new common_1.NotFoundException('Empresa no encontrada');
        const capacidades = (0, client_capabilities_1.normalizeClientCapabilities)(cliente.capabilities);
        const usados = new Set([
            ...Object.keys(areas).map((clave) => clave.split('.')[0]),
            ...Object.keys(datos),
        ]);
        for (const modulo of usados) {
            if (MODULOS_CONTRATABLES.has(modulo) && !capacidades[modulo]) {
                throw new common_1.BadRequestException(`Esta empresa no tiene contratado el módulo «${modulo}»`);
            }
        }
    }
    async exigirAceptacion(ctx, antes, despues, aceptacion) {
        const modulos = Object.keys(despues)
            .filter((modulo) => (0, concesion_1.datosSubieron)(antes, despues, modulo) && (0, shared_1.concederExigeAceptacion)(modulo, despues[modulo]));
        if (modulos.length === 0)
            return;
        const texto = await this.textoDeConfidencialidad(ctx.organizationId);
        if (!aceptacion || aceptacion !== texto.id) {
            throw new common_1.ForbiddenException({
                message: 'Para dar acceso a estos datos hay que aceptar el texto de confidencialidad',
                requiereAceptacion: true,
                modulos,
            });
        }
        for (const modulo of modulos) {
            await this.consentimientos.save(this.consentimientos.create({
                userId: ctx.actorId,
                action: `confidencialidad_datos:${modulo}:${texto.id}`,
                granted: true,
                ipAddress: ctx.ip ?? null,
            }));
        }
    }
    async guardarUnico(ctx, guardar) {
        try {
            return await guardar();
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                throw new common_1.ConflictException('Ya hay un perfil con ese nombre en esta empresa');
            throw error;
        }
    }
    async invalidarA(perfilId) {
        const filas = await this.asignaciones.find({ where: { perfilId: (0, typeorm_2.In)([perfilId]) }, select: { userId: true } });
        for (const fila of filas)
            this.permisos.invalidateUser(fila.userId);
    }
    registrar(ctx, accion, entidadId, antes, despues) {
        return this.auditoria.log({
            organizationId: ctx.organizationId,
            actorId: ctx.actorId,
            entityType: 'Perfil',
            entityId: entidadId,
            action: accion,
            before: antes,
            after: { clientId: ctx.clientId, ...despues },
            ipAddress: ctx.ip,
        });
    }
};
exports.PerfilesService = PerfilesService;
exports.PerfilesService = PerfilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(perfil_de_empresa_entity_1.PerfilDeEmpresa)),
    __param(1, (0, typeorm_1.InjectRepository)(perfil_asignacion_entity_1.PerfilAsignacion)),
    __param(2, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_1.InjectRepository)(user_client_access_entity_1.UserClientAccess)),
    __param(5, (0, typeorm_1.InjectRepository)(consent_version_entity_1.ConsentVersion)),
    __param(6, (0, typeorm_1.InjectRepository)(consent_entity_1.DataConsent)),
    __param(10, (0, typeorm_1.InjectRepository)(invitacion_de_equipo_entity_1.InvitacionDeEquipo)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService,
        permission_resolver_service_1.PermissionResolverService,
        administradores_de_empresa_service_1.AdministradoresDeEmpresaService,
        typeorm_2.Repository])
], PerfilesService);
