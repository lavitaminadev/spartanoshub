import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campana, EstadoDeCampana } from './campana.entity';
import { SuscriptoresService } from './suscriptores.service';
import { EmailService } from '../../core/notifications/email.service';
import { componerCorreo } from '../../core/notifications/plantilla-de-correo';
import { enlaceDeBaja } from '../../core/notifications/enlace-de-baja';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

/** Cómo quedó un envío, para decírselo a quien lo mandó sin que tenga que ir a buscarlo. */
export interface ResultadoDeEnvio {
  destinatarios: number;
  enviados: number;
  fallidos: number;
}

/**
 * Campañas: escribir a la lista de una empresa.
 *
 * Todo lo que hay aquí existe para que no salga un correo que no debía. La lista de destinatarios
 * no se arma acá sino en `suscritos()`, que filtra por estado en la base y por edad en la ficha:
 * tenerla en dos sitios sería tenerla mal en uno el día que cambie. Y cada correo lleva su enlace
 * de baja —individual, porque el token es de cada ficha—, sin interruptor que lo apague.
 */
@Injectable()
export class CampanasService {
  private readonly logger = new Logger(CampanasService.name);

  constructor(
    @InjectRepository(Campana) private readonly repo: Repository<Campana>,
    private readonly suscriptores: SuscriptoresService,
    private readonly correo: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  /** `agencia` y vacío significan la lista sin empresa; en la base eso es `null`. */
  private empresaDe(empresa?: string | null): string | null {
    return !empresa || empresa === 'agencia' ? null : empresa;
  }

  async listar(organizationId: string, encerradoEn?: string): Promise<Campana[]> {
    return this.repo.find({
      where: { organizationId, ...(encerradoEn ? { clientId: encerradoEn } : {}) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async crear(datos: {
    organizationId: string;
    clientId?: string | null;
    asunto: string;
    cuerpo: string;
    createdBy?: string | null;
  }): Promise<Campana> {
    const asunto = datos.asunto?.trim();
    const cuerpo = datos.cuerpo?.trim();
    if (!asunto || !cuerpo) throw new BadRequestException('La campaña necesita asunto y texto');

    return this.repo.save(this.repo.create({
      organizationId: datos.organizationId,
      clientId: this.empresaDe(datos.clientId),
      asunto,
      cuerpo,
      estado: EstadoDeCampana.BORRADOR,
      createdBy: datos.createdBy ?? null,
    }));
  }

  /** Editar sólo mientras es borrador: cambiar el texto de algo ya enviado falsea la constancia. */
  async editar(id: string, organizationId: string, cambios: { asunto?: string; cuerpo?: string }): Promise<Campana> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Esta campaña ya se envió: su texto es la constancia de lo que salió');
    }
    if (cambios.asunto !== undefined) campana.asunto = cambios.asunto.trim();
    if (cambios.cuerpo !== undefined) campana.cuerpo = cambios.cuerpo.trim();
    if (!campana.asunto || !campana.cuerpo) throw new BadRequestException('La campaña necesita asunto y texto');
    return this.repo.save(campana);
  }

  async borrar(id: string, organizationId: string): Promise<void> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Una campaña enviada no se borra: es la constancia de lo que salió');
    }
    await this.repo.remove(campana);
  }

  /**
   * El correo compuesto, para mirarlo antes de mandarlo.
   *
   * Usa la misma función que el envío, así que lo que se ve es lo que sale. Y **con el pie de
   * baja puesto**: es lo que distingue una campaña de cualquier otro correo, y una vista previa
   * que lo omitiera enseñaría algo que no existe. El enlace es de muestra —el real lleva el token
   * de cada persona— y por eso no lleva a ninguna parte.
   */
  vistaPrevia(asunto: string, cuerpo: string): { subject: string; html: string; text: string } {
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return componerCorreo(
      asunto ?? '',
      cuerpo ?? '',
      { nombre: 'Ana' },
      undefined,
      undefined,
      undefined,
      `${base}/api/marketing/suscriptores/baja/de-muestra`,
    );
  }

  /** A cuántos le llegaría si se enviara ahora. Lo que se muestra antes de apretar el botón. */
  async destinatarios(organizationId: string, empresa?: string | null): Promise<number> {
    const lista = await this.suscriptores.suscritos(organizationId, this.empresaDe(empresa));
    return lista.length;
  }

  /**
   * Manda la campaña, una vez.
   *
   * El estado se mueve a `ENVIANDO` **antes** de escribir el primer correo y con una condición
   * sobre el estado anterior: es lo que impide que dos clics, dos pestañas o un reintento del
   * navegador manden la misma campaña dos veces. De los errores de este sistema, ése es el que no
   * se puede deshacer —un correo enviado no vuelve— así que se paga con una escritura de más.
   *
   * Un fallo con una dirección no detiene al resto: se cuenta y se sigue. La cuenta de enviados
   * queda guardada, de modo que «salieron 180 de 200» es una respuesta que se puede dar.
   */
  async enviar(id: string, organizationId: string): Promise<ResultadoDeEnvio> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Esta campaña ya se envió');
    }

    // Condicionado al estado anterior: si otra petición ganó la carrera, aquí no se afecta ninguna
    // fila y este envío se detiene sin haber escrito un solo correo.
    const tomada = await this.repo.update(
      { id: campana.id, estado: EstadoDeCampana.BORRADOR },
      { estado: EstadoDeCampana.ENVIANDO },
    );
    if (!tomada.affected) throw new ConflictException('Esta campaña ya se está enviando');

    const destinatarios = await this.suscriptores.suscritos(organizationId, campana.clientId ?? null);
    let enviados = 0;

    for (const suscriptor of destinatarios) {
      try {
        /*
         * Sin token no se escribe.
         *
         * El enlace de baja es individual —se resuelve por el token de la ficha— así que una ficha
         * sin token no puede recibir un correo del que se pueda dar de baja. Antes que mandarlo sin
         * salida, no se manda: es una fila a arreglar, no una persona a la que escribir igual.
         */
        if (!suscriptor.unsubscribeToken) {
          this.logger.warn(`Suscriptor ${suscriptor.id} sin token de baja: no se le envía la campaña`);
          continue;
        }

        const baja = await enlaceDeBaja(this.parametros, 'email.campaign', suscriptor.unsubscribeToken, suscriptor);
        const { subject, html } = componerCorreo(
          campana.asunto,
          campana.cuerpo,
          // Sin nombre se escribe igual y sin el hueco: «Hola ,» delata que no se sabía a quién.
          { nombre: suscriptor.name ?? '' },
          undefined,
          undefined,
          undefined,
          baja,
        );

        const salio = await this.correo.send(suscriptor.email, subject, html, baja ? { bajaUrl: baja } : undefined);
        if (salio) enviados += 1;
      } catch (error) {
        this.logger.error(`No se pudo enviar la campaña ${campana.id} a ${suscriptor.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    await this.repo.update(campana.id, {
      estado: EstadoDeCampana.ENVIADA,
      destinatarios: destinatarios.length,
      enviados,
      sentAt: new Date(),
    });

    this.logger.log(`Campaña ${campana.id}: ${enviados} de ${destinatarios.length} enviados`);
    return { destinatarios: destinatarios.length, enviados, fallidos: destinatarios.length - enviados };
  }

  private async buscar(id: string, organizationId: string): Promise<Campana> {
    const campana = await this.repo.findOne({ where: { id, organizationId } });
    if (!campana) throw new NotFoundException('Esta campaña no existe');
    return campana;
  }
}
