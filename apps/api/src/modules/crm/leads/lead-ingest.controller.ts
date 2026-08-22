import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { LeadIngestService } from './lead-ingest.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestLeadDto } from './dto/ingest-lead.dto';
import { normalizarCuerpoEntrada } from './normalizar-cuerpo-entrada';

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
/*
  Este endpoint recibe el cuerpo **crudo** y lo valida por su cuenta, a diferencia del resto de
  la API, que lo declara como DTO y deja que el pipe global se encargue.

  Son dos razones que apuntan al mismo sitio. La primera: el cuerpo lo arma un sistema de
  terceros cuya forma no controlamos —un formulario de Meta manda `form_id`, `ad_id` y una
  entrada por cada pregunta, y esas preguntas las cambia quien crea el anuncio—, mientras que el
  pipe global rechaza todo campo no declarado. La segunda: los nombres alternativos hay que
  traducirlos **antes** de validar, y el pipe recibe el cuerpo antes de que eso ocurra.

  Con el pipe global, un lead con los nombres de Meta fallaba dos veces: primero por traer
  campos no declarados, y después porque `nombre` llegaba vacío.
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
    @Body() cuerpo: Record<string, unknown>,
  ) {
    const token = this.leerLlave(authorization);
    // Se traduce antes de validar, no después: los alias no se pueden resolver dentro del DTO.
    // Ver `normalizarCuerpoEntrada`.
    const dto = await this.validar(normalizarCuerpoEntrada(cuerpo ?? {}));

    if (!dto.telefono && !dto.email) {
      // Un lead sin forma de contactar no es un lead. Se rechaza acá y no más adentro para que
      // el mensaje diga qué falta, que es lo que se lee en la pantalla de Zapier.
      throw new BadRequestException('El lead necesita teléfono o correo. Mapea al menos uno en tu Zap.');
    }

    const { leadId, source, campaign } = await this.ingest.ingest(token, dto);
    // `campaign` viaja en la respuesta porque Make y Zapier muestran el cuerpo en su historial:
    // el aviso de campaña no registrada aparece al lado de la petición que lo provocó, que es
    // donde lo va a leer quien está armando el escenario.
    return { ok: true, leadId, source, campaign };
  }

  /**
   * Valida el cuerpo ya traducido.
   *
   * Se hace a mano y no con el `ValidationPipe` porque el pipe recibe el cuerpo crudo, y crudo
   * todavía trae los nombres de Meta. El mensaje conserva el formato del resto de la API para
   * que quien arma el escenario lea lo mismo que leería en cualquier otro error.
   */
  private async validar(cuerpo: Record<string, string>): Promise<IngestLeadDto> {
    const dto = plainToInstance(IngestLeadDto, cuerpo);
    const errores = await validate(dto, { whitelist: true });
    if (!errores.length) return dto;

    throw new BadRequestException({
      message: 'Validation failed',
      errors: errores.map((error) => ({
        field: error.property,
        message: Object.values(error.constraints ?? {}).join(', '),
      })),
    });
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
