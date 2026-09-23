import { Inject, forwardRef, BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, Query, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../authorization/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { AccountAccessService } from '../client-scope/account-access.service';
import { EmailService } from '../notifications/email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { componerCorreo } from '../notifications/plantilla-de-correo';
import { MUESTRA } from './muestra-de-correo';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';
import { ModuleExempt, ModuleScope } from '../authorization/module-scope.decorator';
import { PermissionResolverService } from '../authorization/permission-resolver.service';
import { ClientCapabilityService } from '../client-scope/client-capability.service';
import { RequiresPermission } from '../authorization/requires-permission.decorator';
import { CronRun } from '../cron/cron-run.entity';
import { HORAS_SIN_CORRER_PARA_ALARMA, REQUISITOS_POR_AVISO } from './requisitos-de-correo';

/** Claves que maneja la pantalla de Correos. */
const ES_CLAVE_DE_CORREO = (clave: string) => clave.startsWith('email.');

/**
 * A qué módulo pertenece cada plantilla de correo.
 *
 * Todas pedían permiso de Reservas, así que quien tenía sólo CRM no veía la pantalla —ni siquiera
 * las plantillas del CRM, que son suyas—. Cada correo responde ahora al módulo del que habla: el
 * de la encuesta a Encuestas, el del lead al CRM, y el resto a Reservas.
 */
const MODULO_DE_CORREO: Array<[string, 'reservations' | 'surveys' | 'crm']> = [
  ['email.post_visit_survey', 'surveys'],
  ['email.survey', 'surveys'],
  ['email.lead', 'crm'],
  ['email.crm', 'crm'],
];

function moduloDeCorreo(clave: string): 'reservations' | 'surveys' | 'crm' {
  return MODULO_DE_CORREO.find(([prefijo]) => clave.startsWith(prefijo))?.[1] ?? 'reservations';
}
import { REQUIRED_LIFECYCLE_KEYS } from '../../modules/organizations/organization-features';
import { isModuleLifecycleVisible, moduleLifecycleSettingKey, type ModuleLifecycleStatus } from '@espartanos/shared';

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('settings')
/*
 * Dirección Comercial entra porque las plantillas de correo del CRM son suyas: el texto que
 * recibe un prospecto es comunicación comercial, y quien responde por ella tiene que poder
 * corregirla sin pedírselo a nadie. Todo cambio queda auditado igual.
 */
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
@ModuleScope('settings')
export class OrganizationSettingsController {
  constructor(
    private readonly settings: OrganizationSettingsService,
    @Inject(forwardRef(() => PermissionResolverService)) private readonly permisos: PermissionResolverService,
    private readonly accountAccess: AccountAccessService,
    private readonly capacidades: ClientCapabilityService,
    private readonly correo: EmailService,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    @InjectRepository(CronRun) private readonly corridas: Repository<CronRun>,
  ) {}

  /**
   * Ajustes efectivos, opcionalmente los de una empresa.
   *
   * Con empresa se ve lo que ella tenga escrito y, para lo demás, lo general. Es lo que
   * permite que una plantilla de correo sea distinta por cliente sin escribirla entera.
   *
   * **La empresa no entra acá.** Estos ajustes los administra Espartanos; `clientId` dice de
   * qué empresa se está editando la plantilla, no quién la edita.
   */
  @Get()
  @ApiOperation({ summary: 'Obtener configuración efectiva, opcionalmente de una empresa' })
  async list(@Req() request: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const organizationId = request.organizationId || request.user.organizationId;
    await this.accountAccess.assertClient(organizationId, request.user, clientId);
    return this.settings.list(organizationId, clientId ?? null);
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar y auditar configuración de la organización' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationSettingsDto,
    @Query('clientId') clientId?: string,
  ) {
    const valores = dto.values ?? {};
    const touchesModuleLifecycle = Object.keys(valores).some((key) => key.startsWith('modules.lifecycle.'));
    if (touchesModuleLifecycle && request.user.role !== UserRole.DEV) {
      throw new ForbiddenException('Solo desarrollo puede cambiar el ciclo de vida de módulos.');
    }

    /*
      Hay dos módulos que no se pueden esconder, y uno de ellos es éste.

      `settings` gobierna este mismo endpoint: dejarlo en un estado no visible devuelve 403 a
      todo el mundo —incluido desarrollo— y no queda forma de deshacerlo sin entrar a la base de
      datos. Pasó en producción. `dashboard` es la pantalla de aterrizaje de todo cargo interno,
      y sin ella el inicio de sesión termina en «sin autorización».

      Se rechaza el cambio completo y no solo esa clave: guardar la mitad de lo que se pidió
      dejaría la pantalla mostrando un estado que nadie eligió.
    */
    const sinSalida = REQUIRED_LIFECYCLE_KEYS
      .filter((module) => {
        const valor = valores[moduleLifecycleSettingKey(module)];
        return typeof valor === 'string' && !isModuleLifecycleVisible(valor as ModuleLifecycleStatus);
      });

    if (sinSalida.length) {
      throw new BadRequestException(
        `No se puede esconder ${sinSalida.join(' ni ')}: son la puerta de entrada y el sitio donde se deshace este cambio. ` +
        'Déjalos en activo, piloto o mantenimiento.',
      );
    }
    const organizationId = request.organizationId || request.user.organizationId;
    // La misma comprobación que al leer: escribir la plantilla de una empresa exige alcanzarla.
    await this.accountAccess.assertClient(organizationId, request.user, clientId);

    return this.settings.update(
      organizationId,
      request.user.id,
      dto.values,
      clientId ?? null,
    );
  }

  /**
   * Quiénes pueden recibir una prueba.
   *
   * Son las personas del equipo, y solo ellas. La pantalla necesita la lista para ofrecerla;
   * sin un desplegable habría que escribir la dirección a mano, que es justo lo que no se
   * permite.
   */
  /**
   * Plantillas de correo, sin el resto de la configuración.
   *
   * La configuración general sigue reservada a desarrollo; los correos que recibe quien reserva
   * los escribe quien administra las reservas. Por eso se gobiernan con el permiso de Reservas y
   * sólo alcanzan las claves `email.*`.
   */
  /* El módulo depende de la plantilla, no del endpoint: se comprueba adentro, plantilla por plantilla. */
  @ModuleExempt('Cada plantilla exige el permiso de su propio módulo, comprobado en el método')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DEV)
  @Get('correos')
  @ApiOperation({ summary: 'Plantillas de correo efectivas, opcionalmente de una empresa' })
  async correos(@Req() request: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const organizationId = request.organizationId || request.user.organizationId;
    await this.accountAccess.assertClient(organizationId, request.user, clientId);
    // Sólo las plantillas de los módulos que esta persona puede editar: las demás no se muestran.
    const puede = await this.modulosQuePuedeEditar(request, clientId);
    if (puede.size === 0) throw new ForbiddenException('No hay plantillas que puedas editar en esta empresa');
    const ajustes = await this.settings.list(organizationId, clientId ?? null) as Array<{ key: string }>;
    return ajustes.filter((ajuste) => ES_CLAVE_DE_CORREO(ajuste.key) && puede.has(moduloDeCorreo(ajuste.key)));
  }

  /**
   * Los módulos de correo que esta persona puede editar.
   *
   * Se calcula con los permisos efectivos, que es lo mismo que gobierna el menú: así la pantalla
   * y lo que el servidor acepta no pueden decir cosas distintas.
   */
  private async modulosQuePuedeEditar(request: AuthenticatedRequest, clientId?: string): Promise<Set<'reservations' | 'surveys' | 'crm'>> {
    const organizationId = request.organizationId || request.user.organizationId;
    /*
     * Lo que la empresa tiene contratado, cuando se está escribiendo la plantilla de una.
     *
     * El permiso dice qué puede hacer una persona; la contratación, si esa empresa usa ese
     * servicio. Sin esta segunda reja se podía guardar la plantilla de la encuesta de una
     * empresa que no tiene Encuestas: un correo que nunca se enviaría, escrito para nadie.
     */
    const contratados = clientId
      ? { reservations: await this.capacidades.tiene(organizationId, clientId, 'reservations'), surveys: await this.capacidades.tiene(organizationId, clientId, 'surveys'), crm: await this.capacidades.tiene(organizationId, clientId, 'crm') }
      : null;
    const puede = new Set<'reservations' | 'surveys' | 'crm'>();
    for (const modulo of ['reservations', 'surveys', 'crm'] as const) {
      if (contratados && contratados[modulo] !== true) continue;
      if (await this.permisos.can(organizationId, request.user.id, request.user.role as UserRole, modulo, 'edit')) puede.add(modulo);
    }
    return puede;
  }

  /* El módulo depende de la plantilla, no del endpoint: se comprueba adentro, plantilla por plantilla. */
  @ModuleExempt('Cada plantilla exige el permiso de su propio módulo, comprobado en el método')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.DEV)
  @Put('correos')
  @ApiOperation({ summary: 'Guardar plantillas de correo' })
  async guardarCorreos(@Req() request: AuthenticatedRequest, @Body() dto: UpdateOrganizationSettingsDto, @Query('clientId') clientId?: string) {
    const valores = dto.values ?? {};
    const ajenas = Object.keys(valores).filter((clave) => !ES_CLAVE_DE_CORREO(clave));
    if (ajenas.length) throw new ForbiddenException(`Desde Correos sólo se guardan plantillas de correo: ${ajenas.join(', ')}`);
    // Cada plantilla exige el permiso de su módulo: con CRM no se reescribe lo que recibe quien reserva.
    const puede = await this.modulosQuePuedeEditar(request, clientId);
    const sinPermiso = Object.keys(valores).filter((clave) => !puede.has(moduloDeCorreo(clave)));
    if (sinPermiso.length) throw new ForbiddenException(`No puedes editar estas plantillas: ${sinPermiso.join(', ')}`);
    const organizationId = request.organizationId || request.user.organizationId;
    await this.accountAccess.assertClient(organizationId, request.user, clientId);
    return this.settings.update(organizationId, request.user.id, valores, clientId ?? null);
  }

  /**
   * Si el servidor de correo está listo para enviar, y qué falta si no.
   *
   * Qué falta lo ve sólo quien puede resolverlo. Los nombres de las variables describen cómo está
   * montado el servidor, y quien administra reservas no tiene acceso a él: le basta saber que aún
   * no está activo.
   */
  @Get('estado-del-correo')
  @RequiresPermission('reservations', 'edit')
  @ApiOperation({ summary: 'Estado del envío de correos' })
  estadoDelCorreo(@Req() request: AuthenticatedRequest) {
    const estado = this.correo.estado();
    return request.user.role === UserRole.DEV ? estado : { ...estado, faltan: [] };
  }

  /**
   * Qué le falta a cada aviso para salir de verdad.
   *
   * El interruptor es sólo una de las condiciones. Devolver esto junto a las plantillas es lo que
   * permite que la pantalla distinga «encendido» de «encendido y saliendo», que es la diferencia
   * que hasta ahora no se veía en ninguna parte.
   */
  @Get('correos/requisitos')
  @RequiresPermission('reservations', 'edit')
  @ApiOperation({ summary: 'Condiciones que necesita cada aviso además de su interruptor' })
  async requisitosDeCorreo() {
    const corridas = new Map((await this.corridas.find()).map((fila) => [fila.task, fila]));
    const limite = Date.now() - HORAS_SIN_CORRER_PARA_ALARMA * 3_600_000;
    const casilla = this.correo.estado().habilitado;

    const tareas = Object.fromEntries([...new Set(
      Object.values(REQUISITOS_POR_AVISO).flatMap((lista) => lista.map((requisito) => requisito.tarea).filter(Boolean) as string[]),
    )].map((tarea) => {
      const corrida = corridas.get(tarea);
      return [tarea, {
        ultima: corrida?.lastRunAt ?? null,
        // Sin rastro y con rastro viejo son el mismo problema para quien mira: no está corriendo.
        corriendo: Boolean(corrida && corrida.ok && corrida.lastRunAt.getTime() > limite),
      }];
    }));

    return { casilla, tareas, avisos: REQUISITOS_POR_AVISO };
  }

  @Get('destinatarios-de-prueba')
  @RequiresPermission('reservations', 'edit')
  @ApiOperation({ summary: 'Personas del equipo a las que se puede enviar una prueba' })
  async destinatariosDePrueba(@Req() request: AuthenticatedRequest) {
    const organizationId = request.organizationId || request.user.organizationId;
    const equipo = await this.usuarios.find({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, email: true },
      order: { name: 'ASC' },
    });
    // Quien no tiene correo no puede recibir nada; ofrecerlo sería un error garantizado.
    return equipo.filter((persona) => persona.email?.trim());
  }

  /**
   * Manda una plantilla a alguien del equipo para verla antes de guardarla.
   *
   * Editar un correo a ciegas y descubrir cómo quedó cuando ya le llegó a un cliente es la forma
   * más cara de corregir una errata. Con esto se ve antes: el mismo armazón, las mismas
   * variables, el mismo aspecto.
   *
   * **El destinatario se elige por identificador, nunca por dirección escrita a mano.** Un campo
   * libre convertiría esta pantalla en un formulario para mandar correo con la marca de la
   * agencia a cualquier dirección del mundo, desde una cuenta del dominio propio. Con el
   * identificador, la dirección la pone el servidor desde la ficha de esa persona: quien manda
   * la prueba no elige el texto de la dirección, solo a cuál de sus compañeros llega.
   *
   * Sin destinatario va a quien la pide, que es el caso normal.
   *
   * Las variables se rellenan con valores de muestra: la plantilla no sabe de qué lead o de qué
   * reserva se trata, y dejarlas vacías mostraría un texto con huecos que no se parece al real.
   */
  /**
   * Cómo queda el correo, sin mandarlo.
   *
   * Escribir texto plano y descubrir el resultado sólo al recibir una prueba convertía cada
   * retoque en un correo más en la bandeja de alguien. Es el mismo armazón y las mismas
   * variables de muestra que usa el envío, así que lo que se ve es lo que llega.
   */
  @Post('correos/vista-previa')
  @RequiresPermission('reservations', 'edit')
  @ApiOperation({ summary: 'Componer una plantilla para verla, sin enviarla' })
  vistaPreviaDeCorreo(@Body() dto: { asunto?: string; cuerpo?: string }) {
    return componerCorreo(String(dto?.asunto ?? ''), String(dto?.cuerpo ?? ''), MUESTRA);
  }

  @Post('probar')
  @RequiresPermission('reservations', 'edit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Enviar una plantilla de correo a alguien del equipo' })
  async probar(
    @Req() request: AuthenticatedRequest,
    @Body() dto: { asunto?: string; cuerpo?: string; destinatarioId?: string },
  ) {
    const destino = await this.direccionDelDestinatario(request, dto?.destinatarioId);

    const { subject, html } = componerCorreo(
      String(dto?.asunto ?? 'Prueba'),
      String(dto?.cuerpo ?? ''),
      MUESTRA,
    );

    const enviado = await this.correo.send(destino, `[Prueba] ${subject}`, html);
    return {
      enviado,
      destino,
      // Se dice explícitamente porque es la causa más frecuente de «no me llegó»: el aviso puede
      // estar encendido y el servidor de correo apagado.
      motivo: enviado ? null : 'El envío de correo está apagado en el servidor (SMTP_ENABLED)',
    };
  }

  /**
   * Dirección a la que va la prueba.
   *
   * La organización acota la búsqueda por la misma razón que en el resto del sistema: conocer un
   * identificador no puede alcanzar a alguien de otra organización, ni siquiera para mandarle un
   * correo de prueba.
   */
  private async direccionDelDestinatario(
    request: AuthenticatedRequest,
    destinatarioId?: string,
  ): Promise<string> {
    if (!destinatarioId) {
      const propio = request.user.email;
      if (!propio) throw new BadRequestException('Tu usuario no tiene correo, así que no hay dónde enviarlo');
      return propio;
    }

    const organizationId = request.organizationId || request.user.organizationId;
    const persona = await this.usuarios.findOne({
      where: { id: destinatarioId, organizationId, isActive: true },
      select: { id: true, email: true },
    });
    if (!persona) throw new BadRequestException('Esa persona no está en tu equipo');
    if (!persona.email?.trim()) throw new BadRequestException('Esa persona no tiene correo registrado');

    return persona.email;
  }
}
