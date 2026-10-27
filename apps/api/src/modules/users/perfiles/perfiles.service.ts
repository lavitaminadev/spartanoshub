import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  concederExigeAceptacion,
  PERFILES_SUGERIDOS,
  type JuegoDeAreas,
  type JuegoDeDatos,
  type OrganizationModuleKey,
} from '@espartanos/shared';
import { UserClientAccess } from '../../../core/client-scope/user-client-access.entity';
import { ConsentVersion } from '../../../core/data-protection/consent-version.entity';
import { DataConsent } from '../../../core/data-protection/consent.entity';
import { AdministradoresDeEmpresaService } from '../administradores-de-empresa.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PermissionResolverService } from '../../../core/authorization/permission-resolver.service';
import { Client } from '../../clients/client.entity';
import { normalizeClientCapabilities, type ClientCapabilityKey } from '../../clients/client-capabilities';
import { User } from '../user.entity';
import { UserRole } from '../../organizations/user-role.enum';
import { UserActionOverride } from '../../../core/authorization/user-action-override.entity';
import { AREAS, DATOS_PROTEGIDOS, datosEfectivos, definicionDeArea, nivelEnJuego, type NivelDeArea, type NivelDeDatosProtegidos } from '@espartanos/shared';
import { asegurarQueNoConcedePorEncima, datosSubieron, validarJuegos, type TopeDeConcesion } from './concesion';
import { InvitacionDeEquipo } from './invitacion-de-equipo.entity';
import { PerfilAsignacion } from './perfil-asignacion.entity';
import { PerfilDeEmpresa } from './perfil-de-empresa.entity';
import {
  TEXTO_DE_CONFIDENCIALIDAD,
  TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD,
} from './texto-de-confidencialidad';

/** Quién pide y sobre qué empresa. La empresa la fija el alcance, nunca el cuerpo de la petición. */
export interface ContextoDePerfiles {
  organizationId: string;
  clientId: string;
  actorId: string;
  /** La agencia no tiene perfil dentro de la empresa y por eso no tiene tope. */
  esAgencia: boolean;
  ip?: string;
}


/** Un área tal como la ve quien revisa accesos: con su nivel y de dónde le viene. */
export interface AreaDeUnaPersona {
  clave: string;
  nombre: string;
  modulo: OrganizationModuleKey;
  nivel: NivelDeArea;
  /** `perfil` si viene del grupo; `concedido` o `quitado` si alguien lo escribió para ella. */
  origen: 'perfil' | 'concedido' | 'quitado';
  motivo: string | null;
  porQuien: string | null;
  venceEl: string | null;
}

/** Lo que ve y puede hacer una persona en una empresa, dicho para que alguien lo revise. */
export interface VistaDeUnaPersona {
  userId: string;
  nombre: string;
  correo: string;
  perfil: { id: string; nombre: string } | null;
  sinPerfil: boolean;
  asignadoPor: string | null;
  areas: AreaDeUnaPersona[];
  datosProtegidos: Array<{ modulo: OrganizationModuleKey; nombre: string; nivel: NivelDeDatosProtegidos; incluyeSensibles: boolean }>;
  avisoDeExtrasGlobales: boolean;
}
export interface EntradaDePerfil {
  nombre: string;
  descripcion?: string | null;
  areas: JuegoDeAreas;
  datosProtegidos?: JuegoDeDatos;
  /** Id de la versión del texto de confidencialidad que quien concede aceptó. */
  aceptacion?: string;
  /** Cuántas personas dijo la pantalla que cambian; debe coincidir con las que lo usan ahora. */
  confirmaPersonas?: number;
}

/** Los módulos que una empresa enciende con un interruptor propio; el resto no se contrata aparte. */
const MODULOS_CONTRATABLES = new Set<string>(['reservations', 'crm', 'surveys', 'marketing']);

/**
 * Los perfiles de una empresa: componerlos, repartirlos y no conceder más de lo que se tiene.
 */
@Injectable()
export class PerfilesService {
  constructor(
    @InjectRepository(PerfilDeEmpresa) private readonly perfiles: Repository<PerfilDeEmpresa>,
    @InjectRepository(PerfilAsignacion) private readonly asignaciones: Repository<PerfilAsignacion>,
    @InjectRepository(Client) private readonly clientes: Repository<Client>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    @InjectRepository(UserClientAccess) private readonly accesos: Repository<UserClientAccess>,
    @InjectRepository(ConsentVersion) private readonly textos: Repository<ConsentVersion>,
    @InjectRepository(DataConsent) private readonly consentimientos: Repository<DataConsent>,
    private readonly auditoria: AuditService,
    private readonly permisos: PermissionResolverService,
    private readonly administradores: AdministradoresDeEmpresaService,
    @InjectRepository(InvitacionDeEquipo) private readonly invitaciones: Repository<InvitacionDeEquipo>,
    @InjectRepository(UserActionOverride) private readonly extras: Repository<UserActionOverride>,
  ) {}

  /** Lo que alcanza quien hace la petición en esa empresa, que es lo máximo que puede conceder. */
  async topeDe(ctx: ContextoDePerfiles): Promise<TopeDeConcesion> {
    if (ctx.esAgencia) return null;
    const propia = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId: ctx.actorId } });
    const perfil = propia ? await this.perfiles.findOne({ where: { id: propia.perfilId, clientId: ctx.clientId } }) : null;
    return { areas: perfil?.areas ?? {}, datos: perfil?.datosProtegidos ?? {} };
  }

  /** Los perfiles de la empresa, cada uno con cuántas personas lo usan. */
  async listar(ctx: ContextoDePerfiles): Promise<Array<PerfilDeEmpresa & { personas: number }>> {
    const perfiles = await this.perfiles.find({ where: { clientId: ctx.clientId }, order: { nombre: 'ASC' } });
    const filas = await this.asignaciones.find({ where: { clientId: ctx.clientId } });
    return perfiles.map((perfil) => ({ ...perfil, personas: filas.filter((fila) => fila.perfilId === perfil.id).length }));
  }

  /**
   * Quiénes reingresaron a la empresa tras un retiro, con lo que hace falta para decirlo en una
   * línea: cuándo, por qué motivo, quién los reinvitó y hasta cuándo estuvieron antes.
   */
  async reingresos(ctx: ContextoDePerfiles): Promise<Array<{ userId: string; reingresoEl: string; motivo: string | null; reinvitadoPor: string | null; antesHasta: string | null }>> {
    const filas = (await this.accesos.find({ where: { clientId: ctx.clientId, retiredAt: IsNull() } }))
      .filter((fila) => fila.reenteredAt);
    const quienes = filas.map((fila) => fila.reenteredBy).filter((id): id is string => Boolean(id));
    const nombres = new Map((quienes.length ? await this.usuarios.find({ where: { id: In(quienes) }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]));
    return filas.map((fila) => ({
      userId: fila.userId,
      reingresoEl: new Date(fila.reenteredAt as Date).toISOString(),
      motivo: fila.reentryReason ?? null,
      reinvitadoPor: (fila.reenteredBy && nombres.get(fila.reenteredBy)) || null,
      antesHasta: fila.previousRetiredAt ? new Date(fila.previousRetiredAt).toISOString() : null,
    }));
  }

  /**
   * Qué ve y qué puede hacer una persona en esta empresa, y de dónde le viene cada cosa.
   *
   * Es la pieza que convierte el modelo de perfiles en algo administrable. Sin ella, quien
   * reparte accesos no puede comprobar lo que repartió, y nadie puede contestar «¿por qué esta
   * persona ve esto?» sin leer tres tablas. La Ley 21.719 no pide una pantalla, pide poder
   * **demostrar** que el acceso está limitado: esto es esa demostración.
   *
   * Cada área dice su procedencia —el perfil, o una excepción escrita para esa persona— porque
   * ahí está la diferencia entre lo que se repartió a un grupo y lo que alguien concedió a
   * alguien. Lo segundo es lo que se revisa.
   */
  async queVe(ctx: ContextoDePerfiles, userId: string): Promise<VistaDeUnaPersona> {
    await this.exigirQuePertenezca(ctx, userId);

    const [persona, asignacion, extras] = await Promise.all([
      this.usuarios.findOne({ where: { id: userId }, select: { id: true, name: true, email: true } }),
      this.asignaciones.findOne({ where: { organizationId: ctx.organizationId, clientId: ctx.clientId, userId } }),
      this.extras.find({ where: { organizationId: ctx.organizationId, userId } }),
    ]);
    if (!persona) throw new NotFoundException('Esa persona no existe');

    const perfil = asignacion ? await this.perfiles.findOne({ where: { id: asignacion.perfilId } }) : null;
    const quienes = [asignacion?.asignadoPor, ...extras.map((e) => e.grantedBy)].filter((id): id is string => Boolean(id));
    const nombres = new Map((quienes.length
      ? await this.usuarios.find({ where: { id: In(quienes) }, select: { id: true, name: true } })
      : []).map((u) => [u.id, u.name]));

    const ahora = Date.now();
    const vigentes = extras.filter((extra) => !extra.expiresAt || extra.expiresAt.getTime() > ahora);
    const porClave = new Map(vigentes.filter((extra) => definicionDeArea(extra.action)).map((extra) => [extra.action, extra]));

    const areas = AREAS.map((area) => {
      const extra = porClave.get(area.clave);
      const delPerfil = nivelEnJuego(perfil?.areas ?? {}, area.clave);
      const nivel = extra ? (extra.allowed ? 'hacer' : 'ninguno') : delPerfil;
      return {
        clave: area.clave,
        nombre: area.nombre,
        modulo: area.modulo,
        nivel,
        // De dónde le viene: lo que se revisa es lo concedido a mano, no lo del grupo.
        origen: extra ? (extra.allowed ? 'concedido' : 'quitado') : 'perfil',
        motivo: extra?.reason ?? null,
        porQuien: (extra?.grantedBy && nombres.get(extra.grantedBy)) || null,
        venceEl: extra?.expiresAt ? extra.expiresAt.toISOString() : null,
      } satisfies AreaDeUnaPersona;
    }).filter((area) => area.nivel !== 'ninguno' || area.origen !== 'perfil');

    const datos = DATOS_PROTEGIDOS.map((entrada) => ({
      modulo: entrada.modulo,
      nombre: entrada.nombre,
      nivel: datosEfectivos(perfil?.datosProtegidos ?? {}, {}, entrada.modulo),
      incluyeSensibles: entrada.incluyeSensibles === true,
    }));

    return {
      userId: persona.id,
      nombre: persona.name,
      correo: persona.email,
      perfil: perfil ? { id: perfil.id, nombre: perfil.nombre } : null,
      // Sin perfil manda el permiso de módulo, que es el comportamiento anterior: conviene que
      // la pantalla lo diga en vez de mostrar una lista vacía que se lee como «no ve nada».
      sinPerfil: !perfil,
      asignadoPor: (asignacion?.asignadoPor && nombres.get(asignacion.asignadoPor)) || null,
      areas,
      datosProtegidos: datos,
      /*
       * Las excepciones no distinguen empresa.
       *
       * `user_action_override` guarda organización y persona, no empresa, de modo que una
       * excepción alcanza a esa persona en **todas** las empresas que atiende. Se dice aquí
       * porque quien revisa accesos tiene que saberlo: creer que concedió algo en un local y
       * haberlo concedido en los tres es el error que esta pantalla existe para evitar.
       */
      avisoDeExtrasGlobales: vigentes.length > 0,
    };
  }

  /** Que la persona pertenezca a esta empresa: no se explica a quien no es del equipo. */
  private async exigirQuePertenezca(ctx: ContextoDePerfiles, userId: string): Promise<void> {
    if (await this.perteneceAEmpresa(ctx.clientId, userId)) return;
    throw new NotFoundException('Esa persona no pertenece a tu equipo');
  }

  /** Qué perfil tiene cada persona de la empresa. */
  async asignacionesDeLaEmpresa(ctx: ContextoDePerfiles): Promise<Array<{ userId: string; perfilId: string }>> {
    const filas = await this.asignaciones.find({ where: { clientId: ctx.clientId } });
    return filas.map((fila) => ({ userId: fila.userId, perfilId: fila.perfilId }));
  }

  async crear(ctx: ContextoDePerfiles, entrada: EntradaDePerfil): Promise<PerfilDeEmpresa> {
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

  /**
   * Edita un perfil. Cambia lo que ven todas las personas que lo usan, por eso se exige que la
   * pantalla haya dicho cuántas son antes de guardar.
   *
   * @throws ConflictException - Con `personas`, si el número confirmado no es el de ahora.
   * @throws ForbiddenException - Si el perfil actual ya supera lo que tiene quien lo edita: no
   *   se toca lo que se está por encima de uno, ni para subirlo ni para recortarlo.
   */
  async actualizar(ctx: ContextoDePerfiles, id: string, entrada: EntradaDePerfil): Promise<PerfilDeEmpresa> {
    const perfil = await this.propio(ctx, id);
    const tope = await this.topeDe(ctx);
    asegurarQueNoConcedePorEncima(tope, perfil.areas, perfil.datosProtegidos);
    const contenido = await this.contenidoValido(ctx, entrada, tope);

    const personas = await this.asignaciones.count({ where: { perfilId: perfil.id } });
    if (personas > 0 && entrada.confirmaPersonas !== personas) {
      throw new ConflictException({
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

  /**
   * Borra un perfil. Si alguien lo usa, no se borra sin decir a quién pasan.
   *
   * @throws ConflictException - Con `personas`, si lo usan y no se indicó `reasignarA`.
   */
  async borrar(ctx: ContextoDePerfiles, id: string, reasignarA?: string): Promise<{ reasignadas: number }> {
    const perfil = await this.propio(ctx, id);
    const tope = await this.topeDe(ctx);
    asegurarQueNoConcedePorEncima(tope, perfil.areas, perfil.datosProtegidos);

    const usan = await this.asignaciones.find({ where: { perfilId: perfil.id } });
    if (usan.length > 0) {
      if (!reasignarA) {
        throw new ConflictException({
          message: `Lo usan ${usan.length} persona${usan.length === 1 ? '' : 's'}: elige a qué perfil pasan antes de borrarlo`,
          personas: usan.length,
        });
      }
      if (reasignarA === perfil.id) throw new BadRequestException('Elige otro perfil: ese es el que se borra');
      const destino = await this.propio(ctx, reasignarA);
      asegurarQueNoConcedePorEncima(tope, destino.areas, destino.datosProtegidos);
      await this.asignaciones.update({ perfilId: perfil.id }, { perfilId: destino.id, asignadoPor: ctx.actorId });
      for (const fila of usan) this.permisos.invalidateUser(fila.userId);
    }
    await this.perfiles.remove(perfil);
    await this.registrar(ctx, 'perfil_borrado', id, { nombre: perfil.nombre }, { reasignadoA: reasignarA ?? null, personas: usan.length });
    return { reasignadas: usan.length };
  }

  /**
   * Asigna un perfil a una persona de la empresa, o se lo quita con `null`.
   *
   * Ni el perfil que se da ni el que la persona ya tenía pueden superar lo que tiene quien
   * asigna: de otro modo bastaría con reasignar para rebajar a alguien que está por encima.
   */
  async asignar(ctx: ContextoDePerfiles, userId: string, perfilId: string | null): Promise<void> {
    if (!(await this.perteneceAEmpresa(ctx.clientId, userId))) throw new NotFoundException('Esa persona no está en el equipo de esta empresa');
    const tope = await this.topeDe(ctx);
    const actual = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId } });
    if (actual) {
      const previo = await this.perfiles.findOne({ where: { id: actual.perfilId } });
      if (previo) asegurarQueNoConcedePorEncima(tope, previo.areas, previo.datosProtegidos);
    }
    if (perfilId === null) {
      if (actual) await this.asignaciones.remove(actual);
    } else {
      const perfil = await this.propio(ctx, perfilId);
      asegurarQueNoConcedePorEncima(tope, perfil.areas, perfil.datosProtegidos);
      await this.asignaciones.save({ ...(actual ?? {}), organizationId: ctx.organizationId, clientId: ctx.clientId, userId, perfilId: perfil.id, asignadoPor: ctx.actorId });
    }
    this.permisos.invalidateUser(userId);
    await this.registrar(ctx, 'perfil_asignado', userId, { perfilId: actual?.perfilId ?? null }, { perfilId });
  }

  /**
   * Copia a la empresa los perfiles sugeridos de los módulos que tiene encendidos.
   *
   * Idempotente por nombre: si ya existe uno con ese nombre —suyo, quizá cambiado— no se toca.
   * Desde la copia los perfiles son de la empresa; esto nunca sobrescribe.
   *
   * @param modulos - Se limita a estos módulos; sin él, a todos los que la empresa tiene encendidos.
   */
  async sembrarSugeridos(organizationId: string, clientId: string, modulos?: OrganizationModuleKey[]): Promise<number> {
    const cliente = await this.clientes.findOne({ where: { id: clientId, organizationId } });
    if (!cliente) throw new NotFoundException('Empresa no encontrada');
    const encendidos = modulos ?? this.modulosEncendidos(cliente);
    const existentes = new Set((await this.perfiles.find({ where: { clientId }, select: { nombre: true } })).map((fila) => fila.nombre));
    let copiados = 0;
    for (const sugerido of PERFILES_SUGERIDOS) {
      if (!encendidos.includes(sugerido.modulo) || existentes.has(sugerido.nombre)) continue;
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

  /** El texto de confidencialidad vigente, con el id que la pantalla devuelve al aceptarlo. */
  async textoDeConfidencialidad(organizationId: string): Promise<{ id: string; version: number; titulo: string; texto: string }> {
    let fila = await this.textos.findOne({ where: { organizationId, title: TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD } });
    if (!fila) {
      const ultima = await this.textos.findOne({ where: { organizationId }, order: { version: 'DESC' } });
      // `active: false`: es un texto de acceso a datos, no los términos de uso que se piden al entrar.
      fila = await this.textos.save(this.textos.create({
        organizationId,
        version: (ultima?.version ?? 0) + 1,
        title: TITULO_DEL_TEXTO_DE_CONFIDENCIALIDAD,
        text: TEXTO_DE_CONFIDENCIALIDAD,
        active: false,
      }));
    }
    return { id: fila.id, version: fila.version, titulo: fila.title, texto: fila.text };
  }

  async perteneceAEmpresa(clientId: string, userId: string): Promise<boolean> {
    const usuario = await this.usuarios.findOne({ where: { id: userId }, select: { id: true, clientId: true } });
    if (!usuario) return false;
    if (usuario.clientId === clientId) return true;
    return (await this.accesos.count({ where: { clientId, userId, retiredAt: IsNull() } })) > 0;
  }

  /** Un perfil de esta empresa, o 404: no se confirma que exista uno de otra. */
  async propio(ctx: ContextoDePerfiles, id: string): Promise<PerfilDeEmpresa> {
    const perfil = await this.perfiles.findOne({ where: { id, clientId: ctx.clientId, organizationId: ctx.organizationId } });
    if (!perfil) throw new NotFoundException('Perfil no encontrado');
    return perfil;
  }

  /**
   * Retira a una persona del equipo de **esta** empresa, y de ninguna otra.
   *
   * No borra: marca la pertenencia con quién la retiró, cuándo y por qué, porque la fila es la
   * constancia de que esa persona estuvo y tuvo acceso. Se van el perfil, la administración y el
   * acceso a esta empresa; las demás se conservan. Si era la última, la cuenta se desactiva y no
   * se borra. El bloqueo es por empresa: nunca se apaga la cuenta para sacarla de una sola.
   *
   * @param motivo - Obligatorio: sin él la constancia no explica nada.
   * @param vetar - `vetado` en vez de `retirado`: volver a invitarla exige un acto deliberado.
   * @returns Si la cuenta quedó desactivada por no tener ya ninguna empresa.
   */
  async quitarDelEquipo(ctx: ContextoDePerfiles, userId: string, motivo: string, vetar = false): Promise<{ desactivada: boolean }> {
    const razon = (motivo ?? '').trim().slice(0, 300);
    if (razon.length < 3) throw new BadRequestException('Escribe el motivo: queda como constancia');
    if (userId === ctx.actorId) throw new BadRequestException('No puedes quitarte a ti mismo del equipo');
    const usuario = await this.usuarios.findOne({ where: { id: userId, organizationId: ctx.organizationId } });
    if (!usuario || !(await this.perteneceAEmpresa(ctx.clientId, userId))) {
      throw new NotFoundException('Esa persona no está en el equipo de esta empresa');
    }
    if (usuario.role !== UserRole.CLIENT) throw new ForbiddenException('Solo puedes administrar cuentas de tu empresa');

    const asignacion = await this.asignaciones.findOne({ where: { clientId: ctx.clientId, userId } });
    if (asignacion) {
      const perfil = await this.perfiles.findOne({ where: { id: asignacion.perfilId } });
      if (perfil) asegurarQueNoConcedePorEncima(await this.topeDe(ctx), perfil.areas, perfil.datosProtegidos);
    }
    // Primero la administración: si era la última, se rechaza aquí y no se ha tocado nada todavía.
    await this.administradores.definir(ctx.organizationId, userId, ctx.clientId, false, ctx.actorId, { esAgencia: ctx.esAgencia, motivo: razon, ip: ctx.ip });
    if (asignacion) await this.asignaciones.remove(asignacion);
    // Una invitación pendiente no puede devolverle el acceso a quien se acaba de retirar.
    await this.invitaciones.update({ clientId: ctx.clientId, email: usuario.email, aceptadaEl: IsNull(), revocadaEl: IsNull() }, { revocadaEl: new Date() });

    const marca = { retiredAt: new Date(), retiredBy: ctx.actorId, retiredReason: razon, retiredOutcome: vetar ? 'vetado' as const : 'retirado' as const };
    const fila = await this.accesos.findOne({ where: { userId, clientId: ctx.clientId } });
    await this.accesos.save(fila
      ? { ...fila, ...marca }
      : this.accesos.create({ organizationId: ctx.organizationId, userId, clientId: ctx.clientId, reason: 'Empresa de la cuenta', ...marca }));

    const otras = (await this.accesos.find({ where: { userId, retiredAt: IsNull() }, select: { clientId: true, id: true } }))
      .filter((otra) => otra.clientId !== ctx.clientId);
    const propiaEsEsta = usuario.clientId === ctx.clientId;
    const quedan = propiaEsEsta ? otras.map((otra) => otra.clientId) : [usuario.clientId, ...otras.map((otra) => otra.clientId)].filter(Boolean);

    let desactivada = false;
    // La empresa de la cuenta es la de la fila de usuario: pasa a ser otra de las que le quedan.
    if (propiaEsEsta) usuario.clientId = (quedan[0] ?? null) as string;
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

  private modulosEncendidos(cliente: Client): OrganizationModuleKey[] {
    const capacidades = normalizeClientCapabilities(cliente.capabilities);
    return (['reservations', 'crm', 'surveys', 'marketing'] as const).filter((clave) => capacidades[clave]);
  }

  /** Normaliza, valida contra el catálogo y pasa por la reja. */
  private async contenidoValido(ctx: ContextoDePerfiles, entrada: EntradaDePerfil, topePedido?: TopeDeConcesion) {
    const nombre = (entrada.nombre ?? '').trim().replace(/\s+/g, ' ');
    if (nombre.length < 2 || nombre.length > 80) throw new BadRequestException('El nombre del perfil debe tener entre 2 y 80 letras');
    const descripcion = entrada.descripcion?.trim().slice(0, 300) || null;
    // Un área en «ninguno» es lo mismo que no estar: se guarda sin ella para no tener dos formas de decir lo mismo.
    const areas = Object.fromEntries(Object.entries(entrada.areas ?? {}).filter(([, nivel]) => nivel !== 'ninguno')) as JuegoDeAreas;
    const datos = Object.fromEntries(Object.entries(entrada.datosProtegidos ?? {}).filter(([, nivel]) => nivel !== 'oculto')) as JuegoDeDatos;
    validarJuegos(areas, datos);
    await this.exigirModulosContratados(ctx, areas, datos);
    asegurarQueNoConcedePorEncima(topePedido === undefined ? await this.topeDe(ctx) : topePedido, areas, datos);
    return { nombre, descripcion, areas, datos };
  }

  /** La empresa tiene que haber contratado el módulo de lo que se reparte. */
  private async exigirModulosContratados(ctx: ContextoDePerfiles, areas: JuegoDeAreas, datos: JuegoDeDatos): Promise<void> {
    const cliente = await this.clientes.findOne({ where: { id: ctx.clientId, organizationId: ctx.organizationId } });
    if (!cliente) throw new NotFoundException('Empresa no encontrada');
    const capacidades = normalizeClientCapabilities(cliente.capabilities);
    const usados = new Set<string>([
      ...Object.keys(areas).map((clave) => clave.split('.')[0]),
      ...Object.keys(datos),
    ]);
    for (const modulo of usados) {
      if (MODULOS_CONTRATABLES.has(modulo) && !capacidades[modulo as ClientCapabilityKey]) {
        throw new BadRequestException(`Esta empresa no tiene contratado el módulo «${modulo}»`);
      }
    }
  }

  /**
   * Si el cambio sube un nivel de datos protegidos donde hay datos de categoría especial, quien
   * concede tiene que haber aceptado el texto vigente; la aceptación queda en `DataConsent`.
   */
  private async exigirAceptacion(ctx: ContextoDePerfiles, antes: JuegoDeDatos, despues: JuegoDeDatos, aceptacion?: string): Promise<void> {
    const modulos = (Object.keys(despues) as OrganizationModuleKey[])
      .filter((modulo) => datosSubieron(antes, despues, modulo) && concederExigeAceptacion(modulo, despues[modulo]!));
    if (modulos.length === 0) return;
    const texto = await this.textoDeConfidencialidad(ctx.organizationId);
    if (!aceptacion || aceptacion !== texto.id) {
      throw new ForbiddenException({
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

  private async guardarUnico(ctx: ContextoDePerfiles, guardar: () => Promise<PerfilDeEmpresa>): Promise<PerfilDeEmpresa> {
    try {
      return await guardar();
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ConflictException('Ya hay un perfil con ese nombre en esta empresa');
      throw error;
    }
  }

  private async invalidarA(perfilId: string): Promise<void> {
    const filas = await this.asignaciones.find({ where: { perfilId: In([perfilId]) }, select: { userId: true } });
    for (const fila of filas) this.permisos.invalidateUser(fila.userId);
  }

  private registrar(ctx: ContextoDePerfiles, accion: string, entidadId: string, antes: unknown, despues: unknown): Promise<unknown> {
    return this.auditoria.log({
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      entityType: 'Perfil',
      entityId: entidadId,
      action: accion,
      before: antes,
      after: { clientId: ctx.clientId, ...(despues as object) },
      ipAddress: ctx.ip,
    });
  }
}
