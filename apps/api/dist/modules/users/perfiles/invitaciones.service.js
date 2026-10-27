"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitacionesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const node_crypto_1 = require("node:crypto");
const typeorm_2 = require("typeorm");
const user_client_access_entity_1 = require("../../../core/client-scope/user-client-access.entity");
const permission_resolver_service_1 = require("../../../core/authorization/permission-resolver.service");
const notification_service_1 = require("../../../core/notifications/notification.service");
const email_service_1 = require("../../../core/notifications/email.service");
const plantilla_de_correo_1 = require("../../../core/notifications/plantilla-de-correo");
const administradores_de_empresa_service_1 = require("../administradores-de-empresa.service");
const client_entity_1 = require("../../clients/client.entity");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const user_entity_1 = require("../user.entity");
const concesion_1 = require("./concesion");
const invitacion_de_equipo_entity_1 = require("./invitacion-de-equipo.entity");
const perfil_asignacion_entity_1 = require("./perfil-asignacion.entity");
const perfiles_service_1 = require("./perfiles.service");
const VIGENCIA_DE_LA_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;
const SIN_PERSONA = '00000000-0000-0000-0000-000000000000';
const CLAVE_VALIDA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
function hashDelEnlace(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
let InvitacionesService = class InvitacionesService {
    constructor(invitaciones, usuarios, accesos, asignaciones, clientes, perfiles, correo, avisos, permisos, administradores) {
        this.invitaciones = invitaciones;
        this.usuarios = usuarios;
        this.accesos = accesos;
        this.asignaciones = asignaciones;
        this.clientes = clientes;
        this.perfiles = perfiles;
        this.correo = correo;
        this.avisos = avisos;
        this.permisos = permisos;
        this.administradores = administradores;
    }
    async invitar(ctx, entrada, quienInvita) {
        const email = entrada.email.trim().toLowerCase();
        const perfil = await this.perfiles.propio(ctx, entrada.perfilId);
        (0, concesion_1.asegurarQueNoConcedePorEncima)(await this.perfiles.topeDe(ctx), perfil.areas, perfil.datosProtegidos);
        const [usuario, empresa] = await Promise.all([
            this.usuarios.findOne({ where: { email }, select: { id: true, role: true, clientId: true, name: true } }),
            this.clientes.findOne({ where: { id: ctx.clientId, organizationId: ctx.organizationId }, select: { id: true, name: true } }),
        ]);
        if (!empresa)
            throw new common_1.NotFoundException('Empresa no encontrada');
        const filaEnLaEmpresa = await this.accesos.findOne({ where: { clientId: ctx.clientId, userId: usuario?.id ?? SIN_PERSONA } });
        if (usuario && (usuario.clientId === ctx.clientId || (filaEnLaEmpresa && !filaEnLaEmpresa.retiredAt))) {
            throw new common_1.ConflictException('Esa persona ya pertenece a tu equipo');
        }
        const antecedente = filaEnLaEmpresa?.retiredAt ? await this.antecedenteDe(filaEnLaEmpresa) : undefined;
        const vetado = filaEnLaEmpresa?.retiredOutcome === 'vetado';
        if (vetado && !entrada.confirmaVeto) {
            throw new common_1.ConflictException({
                message: `Esa persona fue vetada de tu equipo${antecedente ? ` el ${antecedente.retiradoEl.slice(0, 10)}${antecedente.retiradoPor ? ` por ${antecedente.retiradoPor}` : ''}${antecedente.motivo ? `: ${antecedente.motivo}` : ''}` : ''}. Para invitarla de nuevo hay que confirmarlo`,
                vetado: true,
                antecedente,
            });
        }
        const motivoReingreso = (entrada.motivoReingreso ?? '').trim().slice(0, 300);
        if (antecedente && motivoReingreso.length < 3) {
            throw new common_1.BadRequestException('Escribe el motivo del reingreso: queda como constancia');
        }
        const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        const venceEl = new Date(Date.now() + VIGENCIA_DE_LA_INVITACION_MS);
        await this.invitaciones.update({ clientId: ctx.clientId, email, aceptadaEl: (0, typeorm_2.IsNull)(), revocadaEl: (0, typeorm_2.IsNull)() }, { revocadaEl: new Date() });
        await this.invitaciones.save(this.invitaciones.create({
            organizationId: ctx.organizationId,
            clientId: ctx.clientId,
            email,
            perfilId: perfil.id,
            tokenHash: hashDelEnlace(token),
            invitadoPor: quienInvita,
            venceEl,
            levantaVeto: vetado,
            motivoReingreso: antecedente ? motivoReingreso : null,
        }));
        if (antecedente)
            void this.avisarReingreso(ctx, empresa.name, email, motivoReingreso, vetado, quienInvita);
        const enviable = !usuario || usuario.role === user_role_enum_1.UserRole.CLIENT;
        void (enviable ? this.enviarCorreo(email, empresa.name, token) : Promise.resolve());
        return { estado: 'pendiente', email, venceEl: venceEl.toISOString(), ...(antecedente ? { antecedente } : {}) };
    }
    async pendientes(ctx) {
        const filas = await this.invitaciones.find({
            where: { clientId: ctx.clientId, aceptadaEl: (0, typeorm_2.IsNull)(), revocadaEl: (0, typeorm_2.IsNull)() },
            order: { createdAt: 'DESC' },
        });
        const ahora = Date.now();
        return filas
            .filter((fila) => fila.venceEl.getTime() > ahora)
            .map((fila) => ({ id: fila.id, email: fila.email, perfilId: fila.perfilId, venceEl: fila.venceEl.toISOString() }));
    }
    async cancelar(ctx, id) {
        const fila = await this.invitaciones.findOne({ where: { id, clientId: ctx.clientId } });
        if (!fila)
            throw new common_1.NotFoundException('Invitación no encontrada');
        if (!fila.aceptadaEl && !fila.revocadaEl) {
            fila.revocadaEl = new Date();
            await this.invitaciones.save(fila);
        }
    }
    async vistaPrevia(token) {
        const { invitacion, empresa } = await this.vigente(token);
        const usuario = await this.usuarios.findOne({ where: { email: invitacion.email }, select: { id: true } });
        return { empresa: empresa.name, email: invitacion.email, requiereDatos: !usuario };
    }
    async aceptar(token, datos) {
        const { invitacion, empresa } = await this.vigente(token);
        const existente = await this.usuarios.findOne({ where: { email: invitacion.email } });
        if (existente && existente.role !== user_role_enum_1.UserRole.CLIENT) {
            invitacion.revocadaEl = new Date();
            await this.invitaciones.save(invitacion);
            throw new common_1.NotFoundException('La invitación no es válida o ya venció');
        }
        if (existente) {
            const fila = await this.accesos.findOne({ where: { userId: existente.id, clientId: invitacion.clientId } });
            const bloqueada = (!existente.isActive && Boolean(existente.clientId)) || (fila?.retiredOutcome === 'vetado' && !invitacion.levantaVeto);
            if (bloqueada) {
                invitacion.revocadaEl = new Date();
                await this.invitaciones.save(invitacion);
                throw new common_1.NotFoundException('La invitación no es válida o ya venció');
            }
        }
        let usuario = existente;
        let cuentaNueva = false;
        if (!usuario) {
            const name = datos.name?.trim();
            if (!name || name.length < 2)
                throw new common_1.BadRequestException('Escribe tu nombre');
            if (!datos.password || !CLAVE_VALIDA.test(datos.password)) {
                throw new common_1.BadRequestException('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número');
            }
            usuario = await this.usuarios.save(this.usuarios.create({
                email: invitacion.email,
                password: await bcrypt.hash(datos.password, Number(process.env.BCRYPT_ROUNDS || 10)),
                name,
                organizationId: invitacion.organizationId,
                role: user_role_enum_1.UserRole.CLIENT,
                clientId: invitacion.clientId,
                weeklyCapacityUd: 20,
                invitedAt: new Date(),
                mustChangePassword: false,
                mustCompleteProfile: true,
            }));
            cuentaNueva = true;
        }
        else {
            await this.sumarEmpresa(usuario, invitacion);
        }
        await this.asignaciones.save({
            ...((await this.asignaciones.findOne({ where: { clientId: invitacion.clientId, userId: usuario.id } })) ?? {}),
            organizationId: invitacion.organizationId,
            clientId: invitacion.clientId,
            userId: usuario.id,
            perfilId: invitacion.perfilId,
            asignadoPor: invitacion.invitadoPor,
        });
        invitacion.aceptadaEl = new Date();
        await this.invitaciones.save(invitacion);
        this.permisos.invalidateUser(usuario.id);
        if (!cuentaNueva) {
            await this.avisos.notifyUser(invitacion.organizationId, usuario.id, 'team_access_added', `Ahora también trabajas en ${empresa.name}`, `Te sumaron al equipo de ${empresa.name}. Sigues en la empresa en la que estabas: cambia de empresa desde el menú cuando quieras.`, { clientId: invitacion.clientId }).catch(() => undefined);
        }
        return { empresaId: empresa.id, empresa: empresa.name, cuentaNueva };
    }
    async sumarEmpresa(usuario, invitacion) {
        const fila = await this.accesos.findOne({ where: { userId: usuario.id, clientId: invitacion.clientId } });
        const reabierta = {
            retiredAt: null, retiredBy: null, retiredReason: null, retiredOutcome: null,
            ...(fila?.retiredAt ? { reenteredAt: new Date(), reenteredBy: invitacion.invitadoPor, reentryReason: invitacion.motivoReingreso ?? null, previousRetiredAt: fila.retiredAt } : {}),
        };
        if (!usuario.clientId) {
            usuario.clientId = invitacion.clientId;
            usuario.isActive = true;
            await this.usuarios.save(usuario);
            if (fila)
                await this.accesos.save({ ...fila, ...reabierta });
            return;
        }
        if (usuario.clientId === invitacion.clientId) {
            if (fila?.retiredAt)
                await this.accesos.save({ ...fila, ...reabierta });
            return;
        }
        if (fila) {
            await this.accesos.save({ ...fila, ...reabierta, reason: 'Invitación al equipo aceptada', grantedBy: invitacion.invitadoPor });
            return;
        }
        await this.accesos.save(this.accesos.create({
            organizationId: invitacion.organizationId,
            userId: usuario.id,
            clientId: invitacion.clientId,
            reason: 'Invitación al equipo aceptada',
            grantedBy: invitacion.invitadoPor,
        }));
    }
    async avisarReingreso(ctx, empresa, email, motivo, vetado, quienInvita) {
        try {
            const otros = (await this.administradores.quienesAdministran(ctx.organizationId, ctx.clientId)).filter((id) => id !== quienInvita);
            const titulo = vetado ? `Se levantó un veto en ${empresa}` : `Reingreso al equipo de ${empresa}`;
            const mensaje = `Se invitó de nuevo a ${email}, que ya había estado en el equipo. Motivo: ${motivo}.`;
            const datos = { clientId: ctx.clientId, invitadoPor: quienInvita };
            if (otros.length)
                await this.avisos.notifyMultiple(ctx.organizationId, otros, 'team_reentry', titulo, mensaje, datos);
            if (vetado) {
                for (const cargo of [user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR]) {
                    await this.avisos.notifyRole(ctx.organizationId, cargo, 'team_ban_lifted', titulo, mensaje, datos);
                }
            }
        }
        catch {
        }
    }
    async antecedenteDe(fila) {
        const quien = fila.retiredBy ? await this.usuarios.findOne({ where: { id: fila.retiredBy }, select: { id: true, name: true } }) : null;
        return {
            resultado: fila.retiredOutcome === 'vetado' ? 'vetado' : 'retirado',
            retiradoEl: new Date(fila.retiredAt).toISOString(),
            retiradoPor: quien?.name ?? null,
            motivo: fila.retiredReason ?? null,
        };
    }
    async vigente(token) {
        const invitacion = token ? await this.invitaciones.findOne({ where: { tokenHash: hashDelEnlace(token) } }) : null;
        const vencida = !invitacion || invitacion.aceptadaEl || invitacion.revocadaEl || invitacion.venceEl.getTime() <= Date.now();
        if (!invitacion || vencida)
            throw new common_1.NotFoundException('La invitación no es válida o ya venció');
        const empresa = await this.clientes.findOne({ where: { id: invitacion.clientId } });
        if (!empresa)
            throw new common_1.NotFoundException('La invitación no es válida o ya venció');
        return { invitacion, empresa };
    }
    async enviarCorreo(email, empresa, token) {
        try {
            const base = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
            const enlace = `${base}/invitacion/${token}`;
            const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(`Te invitaron al equipo de ${empresa}`, `Hola:\n\nTe invitaron a sumarte al equipo de ${empresa}. Si ya tienes cuenta, la empresa se agrega a ella; si no, podrás crearla.\n\nLa invitación vence en 7 días.`, { empresa }, { texto: 'Aceptar la invitación', url: enlace });
            await this.correo.send(email, subject, html);
        }
        catch {
        }
    }
};
exports.InvitacionesService = InvitacionesService;
exports.InvitacionesService = InvitacionesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invitacion_de_equipo_entity_1.InvitacionDeEquipo)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(user_client_access_entity_1.UserClientAccess)),
    __param(3, (0, typeorm_1.InjectRepository)(perfil_asignacion_entity_1.PerfilAsignacion)),
    __param(4, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        perfiles_service_1.PerfilesService,
        email_service_1.EmailService,
        notification_service_1.NotificationService,
        permission_resolver_service_1.PermissionResolverService,
        administradores_de_empresa_service_1.AdministradoresDeEmpresaService])
], InvitacionesService);
