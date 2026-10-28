import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../../modules/users/user.entity';
import { UserRole } from '../../../modules/organizations/user-role.enum';
import { ServiceRequestsService } from '../../../modules/service-requests/service-requests.service';
import { EmailService } from '../../notifications/email.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';

/**
 * Avisa de las solicitudes de derechos que están por vencer o ya vencieron.
 *
 * `porVencer()` calculaba esto desde que existe y **no tenía ningún llamador**: el plazo se pasaba
 * sin que nadie se enterara, y pasarlo es el incumplimiento, no el retraso. La Ley 21.719 da un
 * plazo para responder, no una recomendación.
 *
 * **A quién se avisa, y por qué a ellos.** La solicitud no lleva empresa —llega a la organización,
 * no a un local—, así que resolverla es de la agencia. Van a las cuentas activas que pueden
 * atenderla: los mismos cargos que abren `GET /service-requests`, Administración y Desarrollo. No
 * se busca un destinatario por defecto ni se escribe a un buzón: a quien no puede resolverla, el
 * aviso sólo le enseña a ignorar correos.
 *
 * **Sale sólo si hay algo que decir.** Un correo diario que dice «ninguna por vencer» es el que la
 * gente aprende a borrar sin abrir, y arrastra en esa costumbre a los días en que sí traía algo.
 */
@Injectable()
export class SolicitudesPorVencerJob {
  private readonly logger = new Logger(SolicitudesPorVencerJob.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly solicitudes: ServiceRequestsService,
    private readonly email: EmailService,
  ) {}

  /**
   * Revisa una organización y manda un correo si hay plazos en riesgo.
   *
   * @returns Cuántas van por vencer, cuántas vencidas y a cuántas personas se avisó.
   */
  async ejecutar(organizationId: string): Promise<{ porVencer: number; vencidas: number; avisados: number }> {
    const { porVencer, vencidas } = await this.solicitudes.porVencer(organizationId);
    if (!porVencer.length && !vencidas.length) {
      this.logger.log('Ninguna solicitud de derechos en riesgo de plazo');
      return { porVencer: 0, vencidas: 0, avisados: 0 };
    }

    const destinatarios = await this.users.find({
      where: { organizationId, isActive: true, role: In([UserRole.ADMIN, UserRole.DEV]) },
      select: ['id', 'name', 'email'],
    });
    if (!destinatarios.length) {
      // Se dice en voz alta en vez de pasar en silencio: una organización sin nadie que pueda
      // resolver una solicitud de derechos es un problema de configuración, no un día tranquilo.
      this.logger.error(`${vencidas.length} vencidas y ${porVencer.length} por vencer, y ninguna cuenta activa puede resolverlas`);
      return { porVencer: porVencer.length, vencidas: vencidas.length, avisados: 0 };
    }

    const dia = (fecha: Date) => new Date(fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    /*
     * El cuerpo lleva el tipo, el plazo y el identificador. **No lleva los datos de quien pidió**:
     * el correo sale de un trámite sobre datos personales y no tiene por qué repartir el RUT ni el
     * teléfono de esa persona a cada bandeja. Quien lo atienda los ve en la pantalla, con su reja.
     */
    const linea = (fila: { id: string; type: string; plazo?: { vence: Date } }) =>
      `· ${fila.type} — ${fila.plazo ? `vence el ${dia(fila.plazo.vence)}` : 'sin plazo calculado'} (${fila.id.slice(0, 8)})`;

    const cuerpo = [
      vencidas.length ? `**${vencidas.length} solicitud(es) con el plazo vencido:**\n${vencidas.map(linea).join('\n')}` : '',
      porVencer.length ? `**${porVencer.length} por vencer:**\n${porVencer.map(linea).join('\n')}` : '',
      'Se atienden en Configuración → Solicitudes de derechos.',
    ].filter(Boolean).join('\n\n');

    let avisados = 0;
    for (const persona of destinatarios) {
      const { subject, html } = componerCorreo(
        vencidas.length
          ? `${vencidas.length} solicitud(es) de derechos con el plazo vencido`
          : `${porVencer.length} solicitud(es) de derechos por vencer`,
        cuerpo,
        { responsable: persona.name, fecha: new Date().toLocaleDateString('es-CL', { dateStyle: 'long' }) },
        // La dirección no sale de una plantilla editable: un correo con nuestra marca que lleva a
        // otro sitio es lo que esa libertad permite.
        process.env.APP_PUBLIC_URL
          ? { texto: 'Ver las solicitudes', url: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/settings` }
          : undefined,
      );
      if (await this.email.send(persona.email, subject, html)) avisados += 1;
    }

    this.logger.log(`Plazos de solicitudes: ${vencidas.length} vencidas, ${porVencer.length} por vencer, avisadas ${avisados} de ${destinatarios.length} personas`);
    return { porVencer: porVencer.length, vencidas: vencidas.length, avisados };
  }
  /**
   * Lo mismo para todas las organizaciones que tienen alguien activo.
   *
   * Es la entrada que usa el cron, igual que los demas trabajos. Las organizaciones salen de las
   * cuentas y no de una tabla aparte: una organizacion sin ninguna cuenta activa no tiene a quien
   * avisarle, asi que recorrerla no cambiaria nada.
   */
  async handle(): Promise<void> {
    const activos = await this.users.find({ where: { isActive: true }, select: { organizationId: true } });
    const organizaciones = [...new Set(activos.map((persona) => persona.organizationId).filter(Boolean))] as string[];
    for (const organizationId of organizaciones) {
      try {
        await this.ejecutar(organizationId);
      } catch (error) {
        // Una organizacion que falla no deja sin aviso a las demas: el plazo de cada una es suyo.
        this.logger.error(`No se pudo revisar los plazos de ${organizationId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}
