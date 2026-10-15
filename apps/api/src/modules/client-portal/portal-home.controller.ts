import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleExempt } from '../../core/authorization/module-scope.decorator';
import { ClientCapabilityService } from '../../core/client-scope/client-capability.service';
import { CrmHomeService } from '../crm/leads/crm-home.service';
import { Reservation } from '../reservations/domain/reservation.entity';
import { Client } from '../clients/client.entity';
import { UDBudget } from '../design-budget/ud-budget.entity';
import { UDMovement } from '../design-budget/ud-movement.entity';
import { AdministradoresDeEmpresaService } from '../users/administradores-de-empresa.service';
import { normalizeClientCapabilities } from '../clients/client-capabilities';
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
    private readonly accesos: AccountAccessService,
    @InjectRepository(Client) private readonly clientes: Repository<Client>,
    @InjectRepository(UDBudget) private readonly presupuestos: Repository<UDBudget>,
    @InjectRepository(UDMovement) private readonly movimientos: Repository<UDMovement>,
    // Al final, como el resto: las pruebas construyen este controlador por posición.
    private readonly administradores: AdministradoresDeEmpresaService,
  ) {}

  /**
   * Resumen del día para la empresa que abre su portal.
   *
   * @returns Un bloque por servicio contratado. Las claves ausentes significan «no contratado»,
   *   que es distinto de «contratado y en cero»: la pantalla puede decir cosas diferentes.
   */
  /**
   * Las empresas que esta cuenta de portal atiende.
   *
   * Existe porque `GET /clients` pertenece al módulo Clientes, que es de la agencia: una cuenta de
   * portal lo pide y recibe un 403. La pantalla tomaba esa lista vacía como «tiene una sola
   * empresa» y caía a la de su sesión, así que quien atendía dos locales nunca veía el segundo ni
   * el selector para cambiar. Devuelve sólo id, nombre y servicios —lo justo para elegir— y nunca
   * más de lo que `allowedClientIds` concede.
   */
  @Get('empresas')
  @ApiOperation({ summary: 'Empresas que atiende esta cuenta de portal' })
  async empresas(@Req() req: AuthenticatedRequest) {
    if (req.user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Esta lista es del portal de una empresa cliente');
    }
    const permitidas = await this.accesos.allowedClientIds(req.organizationId, req.user);
    if (!permitidas?.length) return { data: [] };
    const filas = await this.clientes.find({
      where: { id: In(permitidas), organizationId: req.organizationId },
      select: { id: true, name: true, capabilities: true } as never,
      order: { name: 'ASC' },
    });
    // Se conserva el orden de `allowedClientIds`: la empresa de la cuenta va primero y es la que
    // se elige por defecto cuando no hay ninguna guardada.
    const porId = new Map(filas.map((fila) => [fila.id, fila]));
    return {
      data: permitidas
        .map((id) => porId.get(id))
        .filter((fila): fila is Client => Boolean(fila))
        .map((fila) => ({ id: fila.id, name: fila.name, capabilities: normalizeClientCapabilities(fila.capabilities) })),
    };
  }

  @Get('inicio')
  @ApiOperation({ summary: 'Qué tiene que atender hoy esta empresa' })
  async inicio(@Req() req: AuthenticatedRequest, @Query('clientId') pedida?: string) {
    /*
     * La empresa que se está mirando, o la de la sesión.
     *
     * Quien atiende varias empresas veía siempre las cifras de la propia aunque estuviera en otra.
     * La pedida se acepta solo si está entre las que el servidor le da a esa persona: escribir
     * otra en el navegador responde 404, igual que en el resto del CRM.
     */
    if (req.user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Este resumen es del portal de una empresa cliente');
    }
    if (pedida) await this.accesos.assertClient(req.organizationId, req.user, pedida);
    const clientId = pedida || req.user.clientId;
    if (!clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');

    const [tieneCrm, tieneReservas, tienePresupuesto] = await Promise.all([
      this.capacidades.tiene(req.organizationId, clientId, 'crm'),
      this.capacidades.tiene(req.organizationId, clientId, 'reservations'),
      this.capacidades.tiene(req.organizationId, clientId, 'budgetVisibility'),
    ]);

    const [crm, reservas, presupuesto] = await Promise.all([
      tieneCrm ? this.bloqueCrm(req.organizationId, clientId) : Promise.resolve(undefined),
      tieneReservas ? this.bloqueReservas(req.organizationId, clientId) : Promise.resolve(undefined),
      tienePresupuesto && await this.administraEstaEmpresa(req, clientId)
        ? this.bloquePresupuesto(clientId)
        : Promise.resolve(undefined),
    ]);

    return { crm, reservas, presupuesto };
  }

  /**
   * Si esta persona administra la empresa que se está mirando.
   *
   * El saldo lleva una reja más que CRM y Reservas, y es a propósito: aquéllos son el trabajo
   * del día, que hace todo el equipo del local, mientras que cuánto se contrató y cuánto queda
   * es la relación comercial entre la empresa y la agencia. Un garzón con cuenta de portal no
   * tiene por qué ver el presupuesto de su jefe.
   *
   * La capacidad contratada sigue mandando: ésta se suma, no la reemplaza.
   */
  private async administraEstaEmpresa(req: AuthenticatedRequest, clientId: string): Promise<boolean> {
    const suyas = await this.administradores.empresasQueAdministra(req.organizationId, req.user.id);
    return suyas.includes(clientId);
  }

  /**
   * Su presupuesto de diseño del mes: cuánto contrató, cuánto lleva y cuánto le queda.
   *
   * `budgetVisibility` existía como interruptor desde hacía tiempo —la ficha lo guardaba y el
   * panel lo ofrecía— pero nadie lo leía: la empresa no veía nada. Éste es el lector.
   *
   * Lo disponible se calcula igual que en `reserve-ud.use-case.ts`, que es quien decide si una
   * pieza cabe: contratado menos reservado menos consumido. Con otra fórmula, el portal diría
   * que quedan UD y el motor rechazaría la pieza a continuación.
   *
   * Lo reservado se muestra aparte y no se suma a lo consumido: es trabajo comprometido que
   * todavía puede soltarse, y mezclarlo haría leer como gastado algo que aún no lo está.
   *
   * @returns `undefined` si el mes no tiene presupuesto abierto. Es distinto de uno en cero: no
   *   hay nada que contar todavía, y un cero se leería como que se acabó.
   */
  private async bloquePresupuesto(clientId: string) {
    const ahora = new Date();
    const presupuesto = await this.presupuestos.findOne({
      where: { clientId, year: ahora.getFullYear(), month: ahora.getMonth() + 1 },
    });
    if (!presupuesto) return undefined;

    const contratado = Number(presupuesto.contracted);
    const reservado = Number(presupuesto.reserved);
    const consumido = Number(presupuesto.consumed);
    return {
      contratado,
      reservado,
      consumido,
      disponible: Math.round((contratado - reservado - consumido) * 100) / 100,
      mes: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`,
      cerrado: presupuesto.status !== 'open',
      movimientos: await this.movimientosDelMes(presupuesto.id),
    };
  }

  /**
   * En qué se fueron las UD del mes, pieza por pieza.
   *
   * Los tres totales dicen cuánto queda; esto dice en qué se gastó, que es lo que una empresa
   * pregunta a continuación. Incluye las devoluciones y los ajustes además de los consumos: una
   * lista que sólo sumara no cuadraría con el total y haría dudar del número de arriba.
   *
   * **Quién lo hizo no viaja.** Los movimientos guardan `actorId`, pero qué persona de
   * Espartanos movió qué es reparto interno, el mismo criterio por el que el bloque de CRM
   * descarta `assignedToName`. El motivo sí va: es lo que explica un ajuste que de otro modo
   * parecería arbitrario.
   */
  private async movimientosDelMes(presupuestoId: string) {
    const filas = await this.movimientos.find({
      where: { udBudgetId: presupuestoId },
      relations: { piece: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return filas.map((movimiento) => ({
      fecha: movimiento.createdAt,
      tipo: movimiento.type,
      /** Positivo descuenta del presupuesto; una devolución llega en negativo desde el motor. */
      unidades: Number(movimiento.amount),
      pieza: movimiento.piece?.title ?? null,
      motivo: movimiento.reason ?? null,
    }));
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
