import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { type FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { EstadoDeSuscripcion, Suscriptor } from './suscriptor.entity';
import { type FilaImportada, interpretarCsv } from './importar-suscriptores';

/** Cómo quedó una importación, para poder decírselo a quien subió el archivo. */
export interface ResultadoDeImportacion {
  creados: number;
  actualizados: number;
  /** Ya estaban de baja: no se tocan ni se cuentan como actualizados. */
  respetadosDeBaja: number;
  descartados: Array<{ linea: number; motivo: string }>;
}

@Injectable()
export class SuscriptoresService {
  private readonly logger = new Logger(SuscriptoresService.name);

  constructor(
    @InjectRepository(Suscriptor) private readonly repo: Repository<Suscriptor>,
  ) {}

  /**
   * Token del enlace de baja.
   *
   * Aleatorio y no derivado del correo: si se pudiera calcular a partir de la dirección,
   * cualquiera podría dar de baja a otra persona probando direcciones.
   */
  private nuevoToken(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Importa una lista, respetando lo que cada persona ya había decidido.
   *
   * Tres reglas, en este orden:
   *
   * 1. **Quien está de baja no vuelve.** Volver a importar un archivo viejo no puede resucitar a
   *    quien pidió que no le escribieran; es el error que convierte una lista en una denuncia.
   * 2. **Sin consentimiento explícito en el archivo, entra en pendiente.** Se le puede preguntar
   *    una vez, no mandarle campañas.
   * 3. Quien ya estaba suscrito no se degrada por venir en un archivo sin la columna.
   *
   * @param origen - De dónde salió la lista. Obligatorio: una dirección sin procedencia no se
   *   puede defender ante nadie.
   * @param textoConsentimiento - Lo que decía la casilla del formulario. Se guarda entero porque
   *   dentro de dos años hay que poder mostrar qué leyó la persona, no una versión.
   */
  async importarCsv(
    organizationId: string,
    contenido: string,
    origen: string,
    detalle?: string,
    textoConsentimiento?: string,
    clientId?: string | null,
  ): Promise<ResultadoDeImportacion> {
    const { filas, descartadas } = interpretarCsv(contenido);
    const resultado: ResultadoDeImportacion = {
      creados: 0, actualizados: 0, respetadosDeBaja: 0, descartados: descartadas,
    };

    for (const fila of filas) {
      const existente = await this.repo.findOne({
        where: { organizationId, email: fila.email },
      });

      if (existente?.status === EstadoDeSuscripcion.BAJA) {
        resultado.respetadosDeBaja += 1;
        continue;
      }

      if (existente) {
        // El nombre se completa si faltaba, pero no se pisa: el de la ficha puede estar corregido
        // a mano y el del archivo venir como lo escribió la persona con prisa.
        existente.name = existente.name ?? fila.name ?? null;
        if (fila.acepta && existente.status !== EstadoDeSuscripcion.SUSCRITO) {
          this.aplicarConsentimiento(existente, fila, textoConsentimiento);
        }
        await this.repo.save(existente);
        resultado.actualizados += 1;
        continue;
      }

      const nuevo = this.repo.create({
        organizationId,
        clientId: clientId ?? null,
        email: fila.email,
        name: fila.name ?? null,
        source: origen,
        sourceDetail: detalle ?? null,
        status: EstadoDeSuscripcion.PENDIENTE,
        unsubscribeToken: this.nuevoToken(),
      });
      if (fila.acepta) this.aplicarConsentimiento(nuevo, fila, textoConsentimiento);
      await this.repo.save(nuevo);
      resultado.creados += 1;
    }

    this.logger.log(
      `Importación desde «${origen}»: ${resultado.creados} nuevos, ${resultado.actualizados} actualizados, `
      + `${resultado.respetadosDeBaja} de baja respetados, ${descartadas.length} descartados`,
    );
    return resultado;
  }

  /** Deja constancia de qué aceptó y cuándo. La respuesta cruda es la prueba. */
  private aplicarConsentimiento(
    suscriptor: Suscriptor,
    fila: FilaImportada,
    texto?: string,
  ): void {
    suscriptor.status = EstadoDeSuscripcion.SUSCRITO;
    suscriptor.consentAt = new Date();
    suscriptor.consentText = texto
      ?? (fila.respuestaCruda ? `Respuesta en el archivo: «${fila.respuestaCruda}»` : null);
  }

  /**
   * Da de baja por el token del enlace.
   *
   * No exige sesión a propósito: una baja que obliga a recordar una contraseña no es una baja.
   * Y es idempotente —darse de baja dos veces no falla— porque quien pulsa el enlace otra vez
   * merece la misma confirmación tranquilizadora, no un error.
   */
  async darDeBaja(token: string): Promise<{ email: string }> {
    const suscriptor = await this.repo.findOne({ where: { unsubscribeToken: token } });
    if (!suscriptor) throw new NotFoundException('Este enlace de baja no es válido');

    if (suscriptor.status !== EstadoDeSuscripcion.BAJA) {
      suscriptor.status = EstadoDeSuscripcion.BAJA;
      suscriptor.unsubscribedAt = new Date();
      await this.repo.save(suscriptor);
    }
    return { email: suscriptor.email };
  }

  /**
   * A quién se le puede escribir una campaña ahora mismo.
   *
   * La consulta filtra por estado en la base y no en memoria: es la única forma de que un fallo
   * al escribir el filtro no acabe enviando a toda la tabla.
   */
  async suscritos(organizationId: string, clientId?: string | null): Promise<Suscriptor[]> {
    const where: FindOptionsWhere<Suscriptor> = { organizationId, status: EstadoDeSuscripcion.SUSCRITO };
    // `undefined` significa «de cualquier empresa»; `null`, «las de la agencia». Son distintos.
    if (clientId !== undefined) where.clientId = clientId === null ? IsNull() : clientId;
    const candidatos = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    /*
     * La edad se filtra en memoria y el estado en la base.
     *
     * «Quién cumple 18 hoy» no se puede escribir como condición SQL sin repetir la aritmética
     * de años bisiestos en otro lenguaje, y tenerla en dos sitios es tenerla mal en uno. El
     * conjunto ya viene acotado por estado, así que son pocas filas.
     */
    return candidatos.filter((suscriptor) => suscriptor.puedeRecibirCampana());
  }

  /** La lista completa, para la pantalla. Incluye pendientes y bajas, con su procedencia. */
  listar(organizationId: string, limite = 200): Promise<Suscriptor[]> {
    return this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limite, 1), 1000),
    });
  }
}
