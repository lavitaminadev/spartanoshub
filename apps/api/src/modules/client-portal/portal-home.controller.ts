import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleExempt } from '../../core/authorization/module-scope.decorator';
import { ClientCapabilityService } from '../../core/client-scope/client-capability.service';
import { CrmHomeService } from '../crm/leads/crm-home.service';
import { Reservation } from '../reservations/domain/reservation.entity';
import { UserRole } from '../organizations/user-role.enum';

/**
 * Lo que una empresa cliente tiene que atender hoy.
 *
 * El portal era un menú: dos tarjetas que decían qué servicios tiene contratados. Eso es
 * correcto la primera vez y no dice nada el día treinta, cuando la pregunta ya no es «qué tengo»
 * sino «qué hago». Esta respuesta la contesta con sus propios datos.
 *
 * **Cada bloque va detrás de su capacidad.** Una empresa sin CRM no recibe el bloque de leads ni
 * siquiera vacío: un cero de algo que no se contrató se lee como que el servicio está roto, no
 * como que no existe.
 *
 * Y a diferencia del inicio del equipo, acá **no se muestra la carga de Espartanos**. Lo suyo es
 * su propio pendiente, no cómo va la agencia.
 */
@ApiTags('Portal del cliente')
/*
 * Sin modulo unico: este resumen reune CRM y Reservas.
 *
 * Declarar  dejaria fuera a una empresa que solo tiene Reservas, y al reves. La
 * autorizacion la hace el propio controlador y es mas estrecha que la de un modulo: exige cargo
 * cliente, toma la empresa de la sesion sin aceptar parametro, y cada bloque va detras de su
 * capacidad contratada.
 */
@ModuleExempt('Resumen del portal: reune CRM y Reservas, y cada bloque va detras de su capacidad')
@Controller('portal')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class PortalHomeController {
  constructor(
    private readonly crmHome: CrmHomeService,
    private readonly capacidades: ClientCapabilityService,
    @InjectRepository(Reservation) private readonly reservas: Repository<Reservation>,
  ) {}

  /**
   * Resumen del día para la empresa que abre su portal.
   *
   * @returns Un bloque por servicio contratado. Las claves ausentes significan «no contratado»,
   *   que es distinto de «contratado y en cero»: la pantalla puede decir cosas diferentes.
   */
  @Get('inicio')
  @ApiOperation({ summary: 'Qué tiene que atender hoy esta empresa' })
  async inicio(@Req() req: AuthenticatedRequest) {
    /*
     * La empresa sale de la sesión y de ningún otro sitio.
     *
     * No hay parámetro que aceptar acá: el portal mira su propia casa, y ofrecer una forma de
     * pedir otra empresa sería crear el agujero que el resto del CRM cierra en cada endpoint.
     */
    if (req.user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Este resumen es del portal de una empresa cliente');
    }
    const clientId = req.user.clientId;
    if (!clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');

    const [tieneCrm, tieneReservas] = await Promise.all([
      this.capacidades.tiene(req.organizationId, clientId, 'crm'),
      this.capacidades.tiene(req.organizationId, clientId, 'reservations'),
    ]);

    const [crm, reservas] = await Promise.all([
      tieneCrm ? this.bloqueCrm(req.organizationId, clientId) : Promise.resolve(undefined),
      tieneReservas ? this.bloqueReservas(req.organizationId, clientId) : Promise.resolve(undefined),
    ]);

    return { crm, reservas };
  }

  /**
   * Sus leads: lo que llegó y lo que está esperando a alguien.
   *
   * Reusa el mismo cálculo que el inicio del equipo en vez de escribir otro. Si mañana cambia
   * cuántos días son «enfriándose», cambia en los dos sitios a la vez; con dos copias, el portal
   * y el equipo acabarían discutiendo sobre el mismo lead.
   */
  private async bloqueCrm(organizationId: string, clientId: string) {
    const home = await this.crmHome.home(organizationId, 7, { domain: 'commercial', clientId });
    return {
      leadsDelMes: home.month?.leads ?? 0,
      /*
       * Solo lo accionable, y solo la cifra.
       *
       * El aviso del equipo viaja con la lista de leads dentro, y ahí va `assignedToName`: quién
       * de la agencia lleva cada uno. Eso es reparto interno, no es asunto de la empresa, y
       * reenviarlo entero lo publicaba en el portal sin que nadie lo pidiera. Se copian las tres
       * claves que la pantalla usa y se descarta el resto.
       *
       * Varios avisos del inicio del equipo tampoco corresponden —`sin_asignar` habla de la
       * carga de Espartanos—, así que la lista es cerrada y no una exclusión.
       */
      pendientes: (home.alerts ?? [])
        .filter((aviso: { key: string }) => ['sin_contactar', 'calificados_sin_visita'].includes(aviso.key))
        .map((aviso: { key: string; count: number; level: string }) => ({
          key: aviso.key, count: aviso.count, level: aviso.level,
        })),
    };
  }

  /**
   * Su agenda: hoy y mañana, más lo que quedó sin confirmar.
   *
   * Dos días y no la semana porque el portal responde «qué hago», y lo del jueves no cambia lo
   * que hay que hacer esta mañana. Lo pendiente de confirmar va aparte y sin límite de fecha: una
   * reserva sin confirmar de la semana pasada sigue siendo trabajo sin hacer.
   */
  private async bloqueReservas(organizationId: string, clientId: string) {
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 2);

    const [proximas, sinConfirmar] = await Promise.all([
      this.reservas.count({
        where: {
          organizationId, clientId,
          startsAt: Between(desde, hasta),
          status: In(['pending', 'confirmed', 'rescheduled']),
        },
      }),
      this.reservas.count({ where: { organizationId, clientId, status: 'pending' } }),
    ]);

    return { proximasDosDias: proximas, sinConfirmar };
  }
}
