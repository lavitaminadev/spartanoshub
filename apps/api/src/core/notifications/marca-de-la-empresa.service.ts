import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { MarcaDelCorreo } from './plantilla-de-correo';

/**
 * El logo y el nombre con que firma cada empresa sus correos.
 *
 * Quien recibe un correo de reserva es cliente del local, no de la agencia: un recordatorio
 * firmado sólo por Espartanos se lee como de un desconocido que sabe a qué hora vas a cenar. El
 * logo de la empresa va junto al de la agencia, no en su lugar, porque la agencia responde por el
 * envío y su dirección está en el pie.
 *
 * Vive aparte y no dentro de quien compone el correo porque lo necesitan varios: la confirmación
 * la manda el servicio de reservas, el recordatorio y la encuesta posterior los mandan tareas
 * programadas. Con una copia en cada uno, el día que el logo cambie de sitio habría que
 * acordarse de los tres, y los correos empezarían a verse distintos entre sí sin que nadie lo
 * note hasta que un cliente lo diga.
 */
@Injectable()
export class MarcaDeLaEmpresaService {
  private readonly logger = new Logger(MarcaDeLaEmpresaService.name);
  /**
   * Cuánto se recuerda lo leído.
   *
   * El logo se cambia muy de vez en cuando y estos correos se componen uno por destinatario: sin
   * esto, una tanda de recordatorios haría una consulta por persona para traer el mismo dato.
   */
  private readonly vigencia = 5 * 60_000;
  private readonly recordadas = new Map<string, { valor: MarcaDelCorreo; vence: number }>();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * @param clientId - Empresa dueña del envío. Vacío devuelve nada, y entonces el correo sale
   *   con la marca de la agencia sola, que es lo que hacía antes de existir esto.
   * @returns La marca, o `undefined` si no hay empresa o la consulta falló. **Un fallo acá no
   *   puede impedir un correo**: sin logo el mensaje se ve peor, sin correo el cliente no se
   *   entera de su reserva.
   */
  async de(clientId?: string | null): Promise<MarcaDelCorreo | undefined> {
    if (!clientId) return undefined;
    const recordada = this.recordadas.get(clientId);
    if (recordada && recordada.vence > Date.now()) return recordada.valor;

    try {
      const filas = await this.dataSource.query(
        'SELECT name, logo_url FROM clients WHERE id = ? LIMIT 1',
        [clientId],
      ) as Array<{ name?: string | null; logo_url?: string | null }>;
      const valor: MarcaDelCorreo = { nombre: filas[0]?.name ?? null, logo: filas[0]?.logo_url ?? null };
      this.recordadas.set(clientId, { valor, vence: Date.now() + this.vigencia });
      return valor;
    } catch (error) {
      this.logger.warn(`No se pudo leer la marca de ${clientId}: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }

  /** Olvida lo recordado de una empresa, para cuando acaba de cambiar su logo. */
  olvidar(clientId: string): void {
    this.recordadas.delete(clientId);
  }
}
