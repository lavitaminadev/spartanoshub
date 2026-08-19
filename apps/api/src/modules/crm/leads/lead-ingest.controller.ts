import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { LeadIngestService } from './lead-ingest.service';
import { IngestLeadDto } from './dto/ingest-lead.dto';

/**
 * Puerta de entrada de leads desde integraciones: Zapier, portales, formularios de terceros.
 *
 * **Meta no entra por acá.** Sus leads llegan directo a `/integrations/meta/webhook`, donde se
 * comprueba la firma `X-Hub-Signature-256` contra el secreto de la aplicación. Eso demuestra que
 * el lead viene de Meta; una llave compartida solo demuestra que quien llama la conoce. Pasar
 * Meta por una automatización intermedia cambiaría una garantía criptográfica por una llave, y
 * sumaría un salto que puede caerse.
 *
 * `@Public` porque quien llama es un sistema, no una persona con sesión: la autorización la da la
 * llave del origen, no un usuario.
 */
@Public()
@Controller('public/ingest/leads')
export class LeadIngestController {
  constructor(private readonly ingest: LeadIngestService) {}

  /**
   * Recibe un lead.
   *
   * El límite es alto porque una campaña puede disparar leads en ráfaga y frenarlos haría que
   * Zapier reintentara, duplicando. Aun así hay tope: una llave filtrada no debe poder llenar la
   * base a velocidad de máquina.
   *
   * Responde `200` con el identificador del lead. Zapier muestra ese cuerpo en su historial, así
   * que devolverlo permite comprobar de un vistazo que el Zap está entregando de verdad.
   */
  @Post()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async recibir(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: IngestLeadDto,
  ) {
    const token = this.leerLlave(authorization);
    if (!dto.telefono && !dto.email) {
      // Un lead sin forma de contactar no es un lead. Se rechaza acá y no más adentro para que
      // el mensaje diga qué falta, que es lo que se lee en la pantalla de Zapier.
      throw new BadRequestException('El lead necesita teléfono o correo. Mapea al menos uno en tu Zap.');
    }

    const { leadId, source } = await this.ingest.ingest(token, dto);
    return { ok: true, leadId, source };
  }

  /**
   * Extrae la llave de la cabecera `Authorization`.
   *
   * En cabecera y no en la dirección: un parámetro de consulta queda escrito en los registros del
   * servidor, en el historial del navegador y en la cabecera de referencia, de modo que una llave
   * puesta ahí se filtra sola con el tiempo. Zapier permite cabeceras, así que no hay razón para
   * aceptar la forma insegura.
   *
   * Se admite `Bearer …` y la llave pelada, porque olvidar el prefijo es el error más común al
   * configurar el primer Zap y no vale la pena que cueste media hora.
   */
  private leerLlave(authorization?: string): string {
    const valor = authorization?.trim();
    if (!valor) {
      throw new UnauthorizedException(
        'Falta la llave. Agrega la cabecera Authorization con el valor «Bearer tu-llave».',
      );
    }
    return valor.toLowerCase().startsWith('bearer ') ? valor.slice(7).trim() : valor;
  }
}
