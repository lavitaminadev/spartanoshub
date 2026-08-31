import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { sinCredenciales } from './sin-credenciales';

interface MetaPixelInfo { id?: string; name?: string; last_fired_time?: string }
interface MetaPixelStats { data?: Array<Record<string, unknown>> }

/**
 * Resultado de comprobar un par Pixel + token.
 *
 * No es un sí o un no: entre «la credencial es inválida» y «pude leer la ficha» hay un territorio
 * ancho —sin permiso de lectura, Meta caído, límite de peticiones— donde el token puede escribir
 * eventos perfectamente. Un booleano obligaba a tratar todo eso como credencial mala.
 */
export interface VerificacionDePixel {
  /** Se pudo leer la ficha: el par es correcto sin lugar a dudas. */
  verificado: boolean;
  /**
   * Hay que impedir guardar.
   *
   * Solo cuando Meta dice que la credencial no sirve. Un fallo de permiso o de red no lo es, y
   * bloquear por ellos deja sin poder configurar algo que funciona.
   */
  bloquea: boolean;
  /** Qué respondió Meta, para poder decírselo a quien está configurando. */
  motivo?: string;
}

/** Códigos con los que Meta dice que la credencial no sirve. */
const CREDENCIAL_INVALIDA = [190, 102];

@Injectable()
export class MetaPixelService {
  private readonly logger = new Logger(MetaPixelService.name);

  constructor(private readonly http: HttpService) {}

  /**
   * Comprueba un par Pixel + token leyendo la ficha del Pixel.
   *
   * **Lo que se comprueba no es lo que el token va a hacer.** Leer la ficha exige permiso sobre
   * la cuenta publicitaria; escribir eventos, no. Un token de la API de Conversiones generado en
   * Events Manager suele poder `POST /events` y no este `GET`, así que un fallo acá no prueba
   * que la credencial sea mala —y tratarlo como tal impedía guardar credenciales que funcionan—.
   *
   * Por eso distingue tres situaciones: verificado, no verificado pero admisible, e inválido de
   * verdad. Solo la última impide guardar.
   */
  async verificarPixel(pixelId: string, accessToken: string): Promise<VerificacionDePixel> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<MetaPixelInfo>(`https://graph.facebook.com/${version}/${pixelId}`, {
          params: { fields: 'id,name,last_fired_time' },
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return { verificado: !!data.id, bloquea: false };
    } catch (error) {
      const metaError = (error as { response?: { data?: { error?: { code?: number; message?: string } } } })
        ?.response?.data?.error;
      /*
       * El motivo se sanea antes de tocar nada.
       *
       * Meta repite el token en el mensaje cuando lo rechaza por malformado, así que este texto
       * puede traer la credencial entera. Va al registro del servidor y sube hasta la pantalla
       * de quien configura, de modo que sanearlo aquí —donde nace— lo cubre todo.
       */
      const motivo = sinCredenciales(
        metaError?.message ?? (error instanceof Error ? error.message : 'Error desconocido'),
      );
      this.logger.warn(`No se pudo verificar el Pixel ${pixelId}: ${motivo}`);
      /*
       * Sin respuesta de Meta no hay nada que juzgar.
       *
       * Un tiempo de espera agotado o una caída de su lado no dicen nada del token, y bloquear
       * por eso convierte una caída de Meta en un error de configuración de quien está usando
       * la pantalla.
       */
      return {
        verificado: false,
        bloquea: Boolean(metaError?.code && CREDENCIAL_INVALIDA.includes(metaError.code)),
        motivo,
      };
    }
  }

  /** @deprecated Usa `verificarPixel`: distingue una credencial inválida de un fallo de lectura. */
  async validatePixel(pixelId: string, accessToken: string): Promise<boolean> {
    return (await this.verificarPixel(pixelId, accessToken)).verificado;
  }

  async getPixelStats(pixelId: string, accessToken: string): Promise<MetaPixelStats | null> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<MetaPixelStats>(`https://graph.facebook.com/${version}/${pixelId}/stats`, {
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Meta pixel stats fetch failed for ${pixelId}: ${message}`);
      return null;
    }
  }
}
