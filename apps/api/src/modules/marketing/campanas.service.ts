import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campana, EstadoDeCampana } from './campana.entity';
import { SuscriptoresService } from './suscriptores.service';
import { EnviosDeCampanaService } from './envios-de-campana.service';
import { componerCorreo } from '../../core/notifications/plantilla-de-correo';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

/** Cómo quedó un envío, para decírselo a quien lo mandó sin que tenga que ir a buscarlo. */
export interface ResultadoDeEnvio {
  destinatarios: number;
  enviados: number;
  fallidos: number;
  /** Verdadero cuando quedó en cola: los correos salen en las siguientes pasadas del cron. */
  enCola?: boolean;
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
    private readonly envios: EnviosDeCampanaService,
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
   * Deja la campaña lista para salir. **No manda ningún correo.**
   *
   * Mandar aquí era el error. Doscientos correos no caben en una petición: el `curl` del cron
   * corta al minuto y Passenger antes, así que la lista se enviaba a medias y la campaña quedaba
   * en «enviando» para siempre —la misma guarda que impide el doble envío impedía reanudarla—.
   *
   * Ahora se encolan los destinatarios y el cron los despacha por tandas. Lo que se gana no es
   * sólo que quepa: un rebote reintenta a esa persona y no a la campaña, una ejecución que muere
   * a medias la recoge la siguiente pasada, y queda constancia de a quién le llegó.
   *
   * El estado se mueve a `ENVIANDO` con una condición sobre el anterior: si otra petición ganó la
   * carrera, aquí no se afecta ninguna fila y no se encola nada.
   */
  async enviar(id: string, organizationId: string): Promise<ResultadoDeEnvio> {
    const campana = await this.buscar(id, organizationId);
    if (campana.estado !== EstadoDeCampana.BORRADOR) {
      throw new ConflictException('Esta campaña ya se envió');
    }

    const destinatarios = await this.suscriptores.suscritos(organizationId, campana.clientId ?? null);
    if (!destinatarios.length) {
      throw new ConflictException('No hay nadie suscrito en esta lista ahora mismo');
    }

    const tomada = await this.repo.update(
      { id: campana.id, estado: EstadoDeCampana.BORRADOR },
      { estado: EstadoDeCampana.ENVIANDO },
    );
    if (!tomada.affected) throw new ConflictException('Esta campaña ya se está enviando');

    const encolados = await this.envios.encolar(campana, destinatarios);
    await this.repo.update(campana.id, { destinatarios: encolados });

    this.logger.log(`Campaña ${campana.id}: ${encolados} destinatarios en cola`);
    return { destinatarios: encolados, enviados: 0, fallidos: 0, enCola: true };
  }

  /** Cómo va una campaña que está saliendo. */
  async avance(id: string, organizationId: string) {
    const campana = await this.buscar(id, organizationId);
    return { estado: campana.estado, ...await this.envios.avanceDe(campana.id) };
  }

  private async buscar(id: string, organizationId: string): Promise<Campana> {
    const campana = await this.repo.findOne({ where: { id, organizationId } });
    if (!campana) throw new NotFoundException('Esta campaña no existe');
    return campana;
  }
}
