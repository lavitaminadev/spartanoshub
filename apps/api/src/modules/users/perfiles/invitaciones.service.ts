import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { UserClientAccess } from '../../../core/client-scope/user-client-access.entity';
import { PermissionResolverService } from '../../../core/authorization/permission-resolver.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { EmailService } from '../../../core/notifications/email.service';
import { componerCorreo } from '../../../core/notifications/plantilla-de-correo';
import { AdministradoresDeEmpresaService } from '../administradores-de-empresa.service';
import { Client } from '../../clients/client.entity';
import { UserRole } from '../../organizations/user-role.enum';
import { User } from '../user.entity';
import { asegurarQueNoConcedePorEncima } from './concesion';
import { InvitacionDeEquipo } from './invitacion-de-equipo.entity';
import { PerfilAsignacion } from './perfil-asignacion.entity';
import { PerfilesService, type ContextoDePerfiles } from './perfiles.service';

const VIGENCIA_DE_LA_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;
/** Un id que no es de nadie: permite hacer la misma consulta exista o no la persona. */
const SIN_PERSONA = '00000000-0000-0000-0000-000000000000';
const CLAVE_VALIDA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

/** El paso anterior de esa persona por esta empresa. Es información de esta empresa y de nadie más. */
export interface AntecedenteEnLaEmpresa {
  resultado: 'retirado' | 'vetado';
  retiradoEl: string;
  retiradoPor: string | null;
  motivo: string | null;
}

export interface RespuestaDeInvitacion {
  estado: 'pendiente';
  email: string;
  venceEl: string;
  antecedente?: AntecedenteEnLaEmpresa;
}

export interface ResultadoDeAceptacion {
  empresaId: string;
  empresa: string;
  /** Si no tenía cuenta y se le creó una. Lo ve quien tiene el enlace, que es el dueño del correo. */
  cuentaNueva: boolean;
}

function hashDelEnlace(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Invitar al equipo de una empresa y aceptar la invitación.
 *
 * **Invitar responde igual exista o no la cuenta.** Quien invita es el administrador de una
 * empresa, y que un correo ya tenga cuenta en otra revelaría que esa persona trabaja en otro
 * sitio. Por eso la respuesta no depende de eso: mismas consultas, misma escritura, mismo
 * cuerpo, y el envío del correo va aparte y sin esperarse, de modo que ni el contenido ni el
 * tiempo distinguen los casos. Lo único que se contesta distinto es «ya pertenece a tu
 * equipo», que es información de su propia empresa.
 */
@Injectable()
export class InvitacionesService {
  constructor(
    @InjectRepository(InvitacionDeEquipo) private readonly invitaciones: Repository<InvitacionDeEquipo>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    @InjectRepository(UserClientAccess) private readonly accesos: Repository<UserClientAccess>,
    @InjectRepository(PerfilAsignacion) private readonly asignaciones: Repository<PerfilAsignacion>,
    @InjectRepository(Client) private readonly clientes: Repository<Client>,
    private readonly perfiles: PerfilesService,
    private readonly correo: EmailService,
    private readonly avisos: NotificationService,
    private readonly permisos: PermissionResolverService,
    private readonly administradores: AdministradoresDeEmpresaService,
  ) {}

  async invitar(ctx: ContextoDePerfiles, entrada: { email: string; perfilId: string; confirmaVeto?: boolean; motivoReingreso?: string }, quienInvita: string): Promise<RespuestaDeInvitacion> {
    const email = entrada.email.trim().toLowerCase();
    // Lo que se da en la invitación pasa por la misma reja que asignar un perfil.
    const perfil = await this.perfiles.propio(ctx, entrada.perfilId);
    asegurarQueNoConcedePorEncima(await this.perfiles.topeDe(ctx), perfil.areas, perfil.datosProtegidos);

    // Siempre las dos consultas, con o sin cuenta: así el tiempo no delata nada.
    const [usuario, empresa] = await Promise.all([
      this.usuarios.findOne({ where: { email }, select: { id: true, role: true, clientId: true, name: true } }),
      this.clientes.findOne({ where: { id: ctx.clientId, organizationId: ctx.organizationId }, select: { id: true, name: true } }),
    ]);
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    const filaEnLaEmpresa = await this.accesos.findOne({ where: { clientId: ctx.clientId, userId: usuario?.id ?? SIN_PERSONA } });
    if (usuario && (usuario.clientId === ctx.clientId || (filaEnLaEmpresa && !filaEnLaEmpresa.retiredAt))) {
      throw new ConflictException('Esa persona ya pertenece a tu equipo');
    }

    /*
     * Su paso anterior por esta empresa, si lo hubo.
     *
     * Es historia de esta empresa y se muestra: quien invita tiene que saber que esa persona estuvo
     * y por qué se fue. No dice nada de otras empresas. Quien fue vetado no vuelve con una
     * invitación corriente: hace falta confirmarlo, y eso queda dicho en la invitación.
     */
    const antecedente = filaEnLaEmpresa?.retiredAt ? await this.antecedenteDe(filaEnLaEmpresa) : undefined;
    const vetado = filaEnLaEmpresa?.retiredOutcome === 'vetado';
    if (vetado && !entrada.confirmaVeto) {
      throw new ConflictException({
        message: `Esa persona fue vetada de tu equipo${antecedente ? ` el ${antecedente.retiradoEl.slice(0, 10)}${antecedente.retiradoPor ? ` por ${antecedente.retiradoPor}` : ''}${antecedente.motivo ? `: ${antecedente.motivo}` : ''}` : ''}. Para invitarla de nuevo hay que confirmarlo`,
        vetado: true,
        antecedente,
      });
    }

    const motivoReingreso = (entrada.motivoReingreso ?? '').trim().slice(0, 300);
    if (antecedente && motivoReingreso.length < 3) {
      throw new BadRequestException('Escribe el motivo del reingreso: queda como constancia');
    }

    const token = randomBytes(32).toString('hex');
    const venceEl = new Date(Date.now() + VIGENCIA_DE_LA_INVITACION_MS);
    // Una invitación nueva a la misma dirección deja sin efecto la anterior.
    await this.invitaciones.update({ clientId: ctx.clientId, email, aceptadaEl: IsNull(), revocadaEl: IsNull() }, { revocadaEl: new Date() });
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

    /*
     * A una cuenta de la agencia no se le manda el enlace.
     *
     * Un administrador de empresa no puede sumar personal de la agencia a su equipo, pero decírselo
     * ahora sería confirmar que ese correo es de la agencia. La invitación queda pendiente igual
     * que cualquier otra y aceptarla no hace nada (ver `aceptar`); sólo se omite el correo, que
     * quien invita no puede observar.
     */
    if (antecedente) void this.avisarReingreso(ctx, empresa.name, email, motivoReingreso, vetado, quienInvita);

    const enviable = !usuario || usuario.role === UserRole.CLIENT;
    void (enviable ? this.enviarCorreo(email, empresa.name, token) : Promise.resolve());

    return { estado: 'pendiente', email, venceEl: venceEl.toISOString(), ...(antecedente ? { antecedente } : {}) };
  }

  /** Las invitaciones sin aceptar de la empresa. */
  async pendientes(ctx: ContextoDePerfiles): Promise<Array<{ id: string; email: string; perfilId: string; venceEl: string }>> {
    const filas = await this.invitaciones.find({
      where: { clientId: ctx.clientId, aceptadaEl: IsNull(), revocadaEl: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const ahora = Date.now();
    return filas
      .filter((fila) => fila.venceEl.getTime() > ahora)
      .map((fila) => ({ id: fila.id, email: fila.email, perfilId: fila.perfilId, venceEl: fila.venceEl.toISOString() }));
  }

  async cancelar(ctx: ContextoDePerfiles, id: string): Promise<void> {
    const fila = await this.invitaciones.findOne({ where: { id, clientId: ctx.clientId } });
    if (!fila) throw new NotFoundException('Invitación no encontrada');
    if (!fila.aceptadaEl && !fila.revocadaEl) {
      fila.revocadaEl = new Date();
      await this.invitaciones.save(fila);
    }
  }

  /** Lo que ve quien abre el enlace antes de aceptar. */
  async vistaPrevia(token: string): Promise<{ empresa: string; email: string; requiereDatos: boolean }> {
    const { invitacion, empresa } = await this.vigente(token);
    const usuario = await this.usuarios.findOne({ where: { email: invitacion.email }, select: { id: true } });
    return { empresa: empresa.name, email: invitacion.email, requiereDatos: !usuario };
  }

  /**
   * Acepta la invitación.
   *
   * Si el correo ya tenía cuenta se le **suma** la empresa y conserva las anteriores: el correo es
   * la identidad y no se crean dos cuentas. No se toca su empresa activa —cambiarle el contexto a
   * quien está trabajando es como se cancela la reserva equivocada—; recibe un aviso. Si no tenía,
   * se crea una cuenta de empresa con la clave que elige.
   *
   * Nunca cambia el cargo de una cuenta ni suma a nadie de la agencia: una cuenta interna hace
   * que la invitación se anule con el mismo error que una vencida.
   */
  async aceptar(token: string, datos: { name?: string; password?: string }): Promise<ResultadoDeAceptacion> {
    const { invitacion, empresa } = await this.vigente(token);
    const existente = await this.usuarios.findOne({ where: { email: invitacion.email } });

    if (existente && existente.role !== UserRole.CLIENT) {
      invitacion.revocadaEl = new Date();
      await this.invitaciones.save(invitacion);
      throw new NotFoundException('La invitación no es válida o ya venció');
    }

    if (existente) {
      const fila = await this.accesos.findOne({ where: { userId: existente.id, clientId: invitacion.clientId } });
      // Una cuenta apagada por la agencia, o vetada aquí sin que se haya confirmado, no entra por una invitación.
      const bloqueada = (!existente.isActive && Boolean(existente.clientId)) || (fila?.retiredOutcome === 'vetado' && !invitacion.levantaVeto);
      if (bloqueada) {
        invitacion.revocadaEl = new Date();
        await this.invitaciones.save(invitacion);
        throw new NotFoundException('La invitación no es válida o ya venció');
      }
    }

    let usuario = existente;
    let cuentaNueva = false;
    if (!usuario) {
      const name = datos.name?.trim();
      if (!name || name.length < 2) throw new BadRequestException('Escribe tu nombre');
      if (!datos.password || !CLAVE_VALIDA.test(datos.password)) {
        throw new BadRequestException('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número');
      }
      usuario = await this.usuarios.save(this.usuarios.create({
        email: invitacion.email,
        password: await bcrypt.hash(datos.password, Number(process.env.BCRYPT_ROUNDS || 10)),
        name,
        organizationId: invitacion.organizationId,
        role: UserRole.CLIENT,
        clientId: invitacion.clientId,
        weeklyCapacityUd: 20,
        invitedAt: new Date(),
        mustChangePassword: false,
        mustCompleteProfile: true,
      }));
      cuentaNueva = true;
    } else {
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
      await this.avisos.notifyUser(
        invitacion.organizationId,
        usuario.id,
        'team_access_added',
        `Ahora también trabajas en ${empresa.name}`,
        `Te sumaron al equipo de ${empresa.name}. Sigues en la empresa en la que estabas: cambia de empresa desde el menú cuando quieras.`,
        { clientId: invitacion.clientId },
      ).catch(() => undefined);
    }
    return { empresaId: empresa.id, empresa: empresa.name, cuentaNueva };
  }

  /**
   * Suma la empresa a una cuenta que ya existe sin tocar su empresa de siempre.
   *
   * Si había una pertenencia retirada se reabre la misma fila, nunca se crea otra cuenta ni se
   * restaura nada del paso anterior: el perfil lo da esta invitación y el anterior ya no existe.
   * Una cuenta que había quedado desactivada por perder su última empresa se reactiva con esta
   * como la propia.
   */
  private async sumarEmpresa(usuario: User, invitacion: InvitacionDeEquipo): Promise<void> {
    const fila = await this.accesos.findOne({ where: { userId: usuario.id, clientId: invitacion.clientId } });
    // El reingreso queda dicho; lo que se concede lo decide esta invitación, nunca lo que tuvo antes.
    const reabierta = {
      retiredAt: null, retiredBy: null, retiredReason: null, retiredOutcome: null,
      ...(fila?.retiredAt ? { reenteredAt: new Date(), reenteredBy: invitacion.invitadoPor, reentryReason: invitacion.motivoReingreso ?? null, previousRetiredAt: fila.retiredAt } : {}),
    };
    if (!usuario.clientId) {
      usuario.clientId = invitacion.clientId;
      usuario.isActive = true;
      await this.usuarios.save(usuario);
      if (fila) await this.accesos.save({ ...fila, ...reabierta });
      return;
    }
    if (usuario.clientId === invitacion.clientId) {
      if (fila?.retiredAt) await this.accesos.save({ ...fila, ...reabierta });
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

  /**
   * Avisa de un reingreso a quienes administran esa empresa, y de un veto levantado a la agencia.
   *
   * Un reingreso no puede ser invisible para el resto del equipo que administra. Un aviso que no
   * sale no deshace la invitación.
   */
  private async avisarReingreso(ctx: ContextoDePerfiles, empresa: string, email: string, motivo: string, vetado: boolean, quienInvita: string): Promise<void> {
    try {
      const otros = (await this.administradores.quienesAdministran(ctx.organizationId, ctx.clientId)).filter((id) => id !== quienInvita);
      const titulo = vetado ? `Se levantó un veto en ${empresa}` : `Reingreso al equipo de ${empresa}`;
      const mensaje = `Se invitó de nuevo a ${email}, que ya había estado en el equipo. Motivo: ${motivo}.`;
      const datos = { clientId: ctx.clientId, invitadoPor: quienInvita };
      if (otros.length) await this.avisos.notifyMultiple(ctx.organizationId, otros, 'team_reentry', titulo, mensaje, datos);
      if (vetado) {
        // La agencia responde como encargada de esos datos.
        for (const cargo of [UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR]) {
          await this.avisos.notifyRole(ctx.organizationId, cargo, 'team_ban_lifted', titulo, mensaje, datos);
        }
      }
    } catch {
      // Un aviso que no sale no deshace la invitación.
    }
  }

  private async antecedenteDe(fila: UserClientAccess): Promise<AntecedenteEnLaEmpresa> {
    const quien = fila.retiredBy ? await this.usuarios.findOne({ where: { id: fila.retiredBy }, select: { id: true, name: true } }) : null;
    return {
      resultado: fila.retiredOutcome === 'vetado' ? 'vetado' : 'retirado',
      retiradoEl: new Date(fila.retiredAt as Date).toISOString(),
      retiradoPor: quien?.name ?? null,
      motivo: fila.retiredReason ?? null,
    };
  }

  private async vigente(token: string): Promise<{ invitacion: InvitacionDeEquipo; empresa: Client }> {
    const invitacion = token ? await this.invitaciones.findOne({ where: { tokenHash: hashDelEnlace(token) } }) : null;
    const vencida = !invitacion || invitacion.aceptadaEl || invitacion.revocadaEl || invitacion.venceEl.getTime() <= Date.now();
    if (!invitacion || vencida) throw new NotFoundException('La invitación no es válida o ya venció');
    const empresa = await this.clientes.findOne({ where: { id: invitacion.clientId } });
    if (!empresa) throw new NotFoundException('La invitación no es válida o ya venció');
    return { invitacion, empresa };
  }

  private async enviarCorreo(email: string, empresa: string, token: string): Promise<void> {
    try {
      const base = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
      const enlace = `${base}/invitacion/${token}`;
      const { subject, html } = componerCorreo(
        `Te invitaron al equipo de ${empresa}`,
        `Hola:\n\nTe invitaron a sumarte al equipo de ${empresa}. Si ya tienes cuenta, la empresa se agrega a ella; si no, podrás crearla.\n\nLa invitación vence en 7 días.`,
        { empresa },
        { texto: 'Aceptar la invitación', url: enlace },
      );
      await this.correo.send(email, subject, html);
    } catch {
      // Un correo que no sale no se puede distinguir desde quien invita: queda pendiente y se reenvía.
    }
  }
}
