import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { ApprovalRequest } from '../../../modules/approvals/approval-request.entity';
import { ApprovalRequestStatus, PendingKind } from '../../../modules/approvals/approval-request-status.enum';
import { User } from '../../../modules/users/user.entity';
import {
  CLAVE_ABANDONO, CLAVE_ALERTA, CLAVE_AVISO, PLAZOS_POR_DEFECTO, inactividadDe,
} from '../../../modules/crm/leads/inactividad-del-lead';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

/** Etapas cerradas: un lead vendido o descartado no está parado, está terminado. */
const CERRADAS = ['won', 'lost', 'attended', 'no_show'];

/**
 * Un correo por la mañana con lo que el CRM tiene que decirle a cada persona.
 *
 * Es el aviso que hace innecesarios a casi todos los demás. Un correo por cada lead parado, por
 * cada tarea y por cada novedad suma decenas al día, y el correo que se ignora enseña a ignorar
 * todos los demás —incluido el que importaba—. Uno solo, a primera hora, dice lo mismo y se lee.
 *
 * Se manda **solo a quien tiene algo que leer**. Un resumen que dice «no tienes nada» todos los
 * días es exactamente el correo que la gente aprende a borrar sin abrir, y arrastra en esa
 * costumbre a los días en que sí traía algo.
 */
@Injectable()
export class ResumenDiarioJob {
  private readonly logger = new Logger(ResumenDiarioJob.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(ApprovalRequest) private readonly tareas: Repository<ApprovalRequest>,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const ahora = new Date();
    const inicioDeHoy = new Date(ahora); inicioDeHoy.setHours(0, 0, 0, 0);
    const finDeHoy = new Date(ahora); finDeHoy.setHours(23, 59, 59, 999);
    const inicioDeAyer = new Date(inicioDeHoy.getTime() - 86_400_000);

    const activos = await this.usuarios.find({
      where: { isActive: true },
      select: { id: true, name: true, email: true, organizationId: true },
    });

    const encendidoPorOrganizacion = new Map<string, boolean>();
    let enviados = 0;

    for (const persona of activos) {
      // Una persona con datos raros no puede impedir el resumen del resto.
      try {
        if (!persona.email) continue;

        let encendido = encendidoPorOrganizacion.get(persona.organizationId);
        if (encendido === undefined) {
          encendido = Boolean(await this.parametros.get(
            'email.daily_digest_enabled', null, null, persona.organizationId,
          ));
          encendidoPorOrganizacion.set(persona.organizationId, encendido);
        }
        if (!encendido) continue;

        const cifras = await this.cifrasDe(persona, inicioDeHoy, finDeHoy, inicioDeAyer);

        // Nada que contar, no se escribe. Un resumen vacío diario es el correo que se aprende a
        // borrar sin abrir, y arrastra a los días en que sí traía algo.
        if (cifras.pendientes === 0 && cifras.parados === 0 && cifras.nuevos === 0) continue;

        await this.enviar(persona, cifras, ahora);
        enviados += 1;
      } catch (error) {
        this.logger.error(
          `No se pudo enviar el resumen a ${persona.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(`Resúmenes diarios enviados: ${enviados} de ${activos.length} personas`);
  }

  /** Lo que esta persona tiene hoy: tareas que vencen, leads parados y lo que entró ayer. */
  private async cifrasDe(
    persona: User,
    inicioDeHoy: Date,
    finDeHoy: Date,
    inicioDeAyer: Date,
  ): Promise<{ pendientes: number; parados: number; nuevos: number }> {
    const pendientes = await this.tareas.count({
      where: {
        organizationId: persona.organizationId,
        kind: PendingKind.TASK,
        assignedTo: persona.id,
        status: Not(In([ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED])),
        dueAt: Between(inicioDeHoy, finDeHoy),
      },
    });

    const nuevos = await this.leads.count({
      where: {
        organizationId: persona.organizationId,
        assignedTo: persona.id,
        createdAt: Between(inicioDeAyer, inicioDeHoy),
      },
    });

    /*
     * Los parados se cuentan en memoria y no con un `WHERE` sobre la fecha.
     *
     * El umbral es un ajuste de la organización y los tres niveles se comparan de mayor a menor;
     * repetir esa aritmética en SQL sería tenerla en dos sitios, y tenerla en dos sitios es
     * tenerla mal en uno. El conjunto ya viene acotado por responsable y por etapa abierta.
     */
    const plazos = await this.plazosDe(persona.organizationId);
    const abiertos = await this.leads.find({
      where: {
        organizationId: persona.organizationId,
        assignedTo: persona.id,
        status: Not(In(CERRADAS)),
      },
      select: { id: true, status: true, stageChangedAt: true, createdAt: true },
    });
    const parados = abiertos.filter((lead) => inactividadDe(lead, plazos).idleLevel !== null).length;

    return { pendientes, parados, nuevos };
  }

  private async plazosDe(organizationId: string) {
    const ajustes = await this.parametros.getManyForOrganization(
      [CLAVE_AVISO, CLAVE_ALERTA, CLAVE_ABANDONO],
      organizationId,
    );
    return {
      notice: Number(ajustes.get(CLAVE_AVISO) ?? PLAZOS_POR_DEFECTO.notice),
      warning: Number(ajustes.get(CLAVE_ALERTA) ?? PLAZOS_POR_DEFECTO.warning),
      critical: Number(ajustes.get(CLAVE_ABANDONO) ?? PLAZOS_POR_DEFECTO.critical),
    };
  }

  private async enviar(
    persona: User,
    cifras: { pendientes: number; parados: number; nuevos: number },
    hoy: Date,
  ): Promise<void> {
    const [asunto, cuerpo] = await Promise.all([
      this.parametros.get('email.daily_digest_subject', null, null, persona.organizationId),
      this.parametros.get('email.daily_digest_body', null, null, persona.organizationId),
    ]);

    const { subject, html } = componerCorreo(
      String(asunto ?? 'Tu CRM hoy'),
      String(cuerpo ?? 'Tienes {{pendientes}} tareas y {{parados}} leads sin avanzar.'),
      {
        responsable: persona.name,
        fecha: hoy.toLocaleDateString('es-CL', { dateStyle: 'long' }),
        ...cifras,
      },
      // El botón lleva al tablero, que es donde se actúa. Su dirección no sale de la plantilla:
      // una URL editable es una puerta abierta a que un correo con nuestra marca lleve a otro sitio.
      process.env.APP_PUBLIC_URL
        ? { texto: 'Abrir el CRM', url: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/crm/tablero` }
        : undefined,
    );

    await this.correo.send(persona.email, subject, html);
  }
}
