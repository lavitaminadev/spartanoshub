import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClientCapabilityService } from '../../core/client-scope/client-capability.service';
import { Public } from '../../core/auth/decorators/public.decorator';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { SuscriptoresService } from './suscriptores.service';
import { EstadoDeSuscripcion } from './suscriptor.entity';
import { paginaDeBaja, paginaDeConfirmarBaja } from './pagina-de-baja';

/** Lo que se necesita para importar una lista sin dejarla sin procedencia. */
class ImportarSuscriptoresDto {
  /** El CSV entero como texto. */
  contenido: string;
  /** De dónde salió: `google_forms`, `landing_verano`, `csv_evento_marzo`. */
  origen: string;
  /** El formulario, el archivo o la campaña concreta. */
  detalle?: string;
  /** El texto de la casilla que la persona aceptó, si lo hubo. */
  textoConsentimiento?: string;
  clientId?: string | null;
}

/**
 * La lista de correo comercial: quién está, de dónde salió y quién dijo que sí.
 *
 * Importar y ver la lista es de Dirección Comercial y Administración: es comunicación de la
 * empresa y la responsabilidad de que cada dirección tenga respaldo es de quien la usa.
 */
@ApiTags('marketing')
@Controller('marketing/suscriptores')
@ModuleScope('marketing')
export class SuscriptoresController {
  constructor(
    private readonly suscriptores: SuscriptoresService,
    private readonly capacidades: ClientCapabilityService,
  ) {}

  /**
   * La empresa a cuya lista queda encerrada la consulta, o `undefined` si puede verlas todas.
   *
   * Una cuenta de empresa ve la suya y ninguna otra, diga lo que diga la dirección. Si no tiene
   * empresa asignada se la rechaza en vez de darle la de la agencia por descarte: caer hacia la
   * lista propia de Espartanos ante un dato que falta es exactamente al revés de lo prudente.
   *
   * La capacidad se afirma también acá y no sólo en el menú: esconder una pantalla no es
   * cerrarla, y el resto del portal —Contactos, Interacciones— afirma la suya del mismo modo.
   */
  private async encierroDe(req: AuthenticatedRequest): Promise<string | undefined> {
    if (req.user.role !== UserRole.CLIENT) return undefined;
    if (!req.user.clientId) throw new ForbiddenException('La cuenta de empresa no tiene una empresa asociada');
    await this.capacidades.assert(req.organizationId || req.user.organizationId, req.user.clientId, 'marketing');
    return req.user.clientId;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Lista de suscriptores con su procedencia y estado' })
  async listar(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('empresa') empresa?: string,
    @Query('estado') estado?: string,
    @Query('origen') origen?: string,
    @Query('q') busqueda?: string,
  ) {
    return this.suscriptores.listar(req.organizationId || req.user.organizationId, {
      limite: limit ? Number(limit) : undefined,
      empresa,
      encerradoEn: await this.encierroDe(req),
      // Sólo los tres estados que existen: un valor inventado en la dirección no filtra nada.
      estado: Object.values(EstadoDeSuscripcion).includes(estado as EstadoDeSuscripcion) ? estado as EstadoDeSuscripcion : undefined,
      origen,
      busqueda,
    });
  }

  /**
   * Preguntar si a una dirección se le prohibió escribir, y desde cuándo.
   *
   * La lista de exclusión guarda huellas y no correos, para poder cumplir la prohibición sin
   * conservar la dirección de quien pidió que la borraran. Por eso no se puede listar: sólo
   * preguntar por una dirección que ya se conoce, que es justo lo que hace falta cuando alguien
   * llama diciendo «sigo recibiendo correos». Sin esto, esa respuesta estaba guardada donde nadie
   * podía consultarla.
   *
   * Sólo la agencia: es la que responde de la prohibición y la que atiende el reclamo. Una cuenta
   * de empresa preguntando por una dirección cualquiera sabría si esa persona está en el sistema.
   */
  @Get('exclusiones')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
  @ApiOperation({ summary: 'Si a una dirección se le pidió no escribir más' })
  async exclusiones(@Req() req: AuthenticatedRequest, @Query('correo') correo?: string) {
    const organizationId = req.organizationId || req.user.organizationId;
    const cuantas = await this.suscriptores.cuantasExclusiones(organizationId);
    if (!correo?.trim()) return { ...cuantas, consulta: null };
    return { ...cuantas, consulta: await this.suscriptores.consultarExclusion(organizationId, correo) };
  }

  /**
   * La lista de una empresa, para que la descargue y escriba por su cuenta.
   *
   * Sólo quien está suscrito ahora mismo: incluir a quien se dio de baja pondría esa dirección en
   * un archivo que sale del sistema, donde el enlace de baja ya no funciona y la baja no se puede
   * hacer cumplir. Queda anotado quién descargó y cuántas filas, porque desde ese momento esa
   * copia es responsabilidad de quien la tiene.
   */
  @Get('descargar')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Descargar los suscritos de una empresa' })
  async descargar(@Req() req: AuthenticatedRequest, @Query('empresa') empresa: string) {
    const organizationId = req.organizationId || req.user.organizationId;
    // Una cuenta de empresa descarga la suya y ninguna otra, diga lo que diga la dirección.
    const alcance = (await this.encierroDe(req)) || empresa || 'agencia';
    const filas = await this.suscriptores.paraDescargar(organizationId, alcance);
    return {
      empresa: alcance,
      total: filas.length,
      data: filas.map((fila) => ({
        email: fila.email,
        nombre: fila.name,
        aceptoEl: fila.consentAt,
        origen: fila.source,
        detalle: fila.sourceDetail,
      })),
    };
  }

  @Post('importar')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
  @ApiOperation({ summary: 'Importar una lista de correos declarando su origen' })
  importar(@Req() req: AuthenticatedRequest, @Body() dto: ImportarSuscriptoresDto) {
    return this.suscriptores.importarCsv(
      req.organizationId || req.user.organizationId,
      dto.contenido,
      dto.origen,
      dto.detalle,
      dto.textoConsentimiento,
      dto.clientId ?? null,
    );
  }

  /**
   * El enlace del correo: pregunta, no da de baja.
   *
   * **Pública y sin sesión a propósito.** Quien recibe un correo comercial no tiene por qué tener
   * cuenta en el sistema, y una baja que exige iniciar sesión no es una baja: es un obstáculo, y
   * los obstáculos a la baja son exactamente lo que la normativa persigue.
   *
   * Y no ejecuta nada, que es el cambio: los antivirus de correo y la previsualización de Outlook
   * abren los enlaces de un mensaje para revisarlos, así que con la baja colgada del GET se daba de
   * baja a gente que nunca hizo clic. Como la baja es definitiva —el artículo 28 B no admite
   * deshacerla sola— eso no se arregla después. El botón de la página hace el POST.
   *
   * Con límite de frecuencia porque el token va en un correo y acaba en sitios donde lo ven
   * terceros; sin límite, alguien podría probar tokens al azar.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('baja/:token')
  @ApiOperation({ summary: 'Confirmar la baja de la lista de correo' })
  async confirmarBaja(
    @Param('token') token: string,
    @Query('origen') origen: string | undefined,
    @Res() res: Response,
  ) {
    const quien = await this.suscriptores.aQuienPertenece(token).catch(() => null);
    res.type('html').send(paginaDeConfirmarBaja(quien, token, origen));
  }

  /**
   * La baja de verdad.
   *
   * Dos caminos llegan acá y los dos son intención expresa: el botón de la página, y el «Anular
   * suscripción» que Gmail y Yahoo muestran junto al remitente, que manda un POST a esta misma
   * dirección (RFC 8058). Que el cliente de correo lo haga sin abrir nada no es un problema: la
   * persona apretó su botón, y esa es la alternativa a que marque el mensaje como spam.
   *
   * Responde una página y no un dato: quien viene del botón abre el navegador, y ver
   * `{"ok":true}` parece roto justo cuando está ejerciendo un derecho. A Gmail le da igual el
   * cuerpo, así que la misma respuesta sirve para los dos.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('baja/:token')
  @ApiOperation({ summary: 'Darse de baja de la lista de correo' })
  async baja(
    @Param('token') token: string,
    // Sin DTO a propósito: el `ValidationPipe` rechaza lo que no declara, y el clic de Gmail manda
    // su propio campo (`List-Unsubscribe=One-Click`). Un cuerpo declarado devolvería 400 y la
    // persona seguiría suscrita creyendo que se dio de baja.
    @Body() cuerpo: Record<string, unknown> | undefined,
    @Query('alcance') alcanceEnLaUrl: string | undefined,
    @Query('origen') origenEnLaUrl: string | undefined,
    @Res() res: Response,
  ) {
    // El alcance puede venir del formulario o de la dirección: la cabecera de un clic no manda
    // formulario, y un enlace antiguo lo trae en la consulta.
    const alcance = String(cuerpo?.alcance ?? alcanceEnLaUrl ?? 'local') === 'todas' ? 'todas' : 'local';
    const origen = typeof cuerpo?.origen === 'string' ? cuerpo.origen : origenEnLaUrl;
    const resultado = await this.suscriptores.darDeBaja(token, alcance, origen).catch(() => null);
    res.type('html').send(paginaDeBaja(resultado, token, origen));
  }
}
