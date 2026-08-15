import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Piece } from '../production/piece.entity';
import { Client } from '../clients/client.entity';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { UdValuesService } from './ud-values.service';
import { BudgetAlertDto } from './dto/budget-alert.dto';

@Injectable()
export class DesignBudgetService {
  constructor(
    @InjectRepository(UDBudget) private budgetRepo: Repository<UDBudget>,
    @InjectRepository(UDMovement) private movementRepo: Repository<UDMovement>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private parameterResolver: ParameterResolver,
    private udValues: UdValuesService,
  ) {}

  async ensureMonthlyBudget(clientId: string, year: number, month: number, manager?: EntityManager): Promise<UDBudget> {
    const repo = manager?.getRepository(UDBudget) ?? this.budgetRepo;
    const existing = await repo.findOne({ where: { clientId, year, month } });
    if (existing) return existing;

    const contracted = await this.resolveMonthlyBudget(clientId);
    const budget = repo.create({
      clientId, year, month,
      contracted,
      reserved: 0,
      consumed: 0,
      status: 'open',
    });
    return repo.save(budget);
  }

  /** Unidades que consume una pieza según los valores que configuró la organización. */
  async calculateForPiece(pieceType: string, carouselSlides = 0, organizationId?: string | null): Promise<number> {
    return this.udValues.udFor(pieceType, carouselSlides, organizationId);
  }

  async reserveForPiece(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement> {
    const execute = async (manager: EntityManager) => {
      await manager.findOne(Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
      await manager.findOne(Client, { where: { id: piece.clientId }, lock: { mode: 'pessimistic_write' } });
      const movementRepo = manager.getRepository(UDMovement);
      const existingMovement = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RESERVATION },
      });
      if (existingMovement) return existingMovement;
      const date = piece.createdAt;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const ensuredBudget = await this.ensureMonthlyBudget(piece.clientId, year, month, manager);
      const budget = await manager.findOneOrFail(UDBudget, {
        where: { id: ensuredBudget.id },
        lock: { mode: 'pessimistic_write' },
      });
      const amount = piece.udAmount;

      const used = Number(budget.reserved) + Number(budget.consumed);
      const available = Number(budget.contracted) - used;
      if (amount > available) {
        const limitAction = await this.parameterResolver.get('ud.limit_action', piece.clientId, null, piece.organizationId);
        if ((limitAction ?? 'block') === 'block') {
          throw new BadRequestException(`UD insuficientes. Disponibles: ${available}, requeridas: ${amount}`);
        }
      }

      budget.reserved = Number(budget.reserved) + amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId: piece.id,
        type: UDMovementType.RESERVATION,
        amount,
        reason: `Reserva por asignación de pieza ${piece.title}`,
        actorId,
      });
      return manager.save(UDMovement, movement);
    };
    return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
  }

  async confirmConsumption(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement> {
    const execute = async (manager: EntityManager) => {
      await manager.findOne(Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
      const movementRepo = manager.getRepository(UDMovement);
      const existingMovement = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.CONSUMPTION },
      });
      if (existingMovement) return existingMovement;
      const reservation = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RESERVATION },
      });
      const budget = reservation
        ? await manager.findOne(UDBudget, { where: { id: reservation.udBudgetId } })
        : null;

      if (!reservation || !budget) {
        throw new BadRequestException('La pieza no tiene una reserva de UD vigente. Vuelve a asignarla antes de entregar.');
      }
      await manager.findOne(UDBudget, { where: { id: budget.id }, lock: { mode: 'pessimistic_write' } });
      const amount = piece.udAmount;

      if (amount > Number(budget.reserved)) {
        throw new BadRequestException(`UD reservadas insuficientes para confirmar. Reservadas: ${budget.reserved}, a consumir: ${amount}`);
      }

      budget.reserved = Number(budget.reserved) - amount;
      budget.consumed = Number(budget.consumed) + amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId: piece.id,
        type: UDMovementType.CONSUMPTION,
        amount,
        reason: `Consumo confirmado por entrega de pieza ${piece.title}`,
        actorId,
      });
      return manager.save(UDMovement, movement);
    };
    return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
  }

  /**
   * Devuelve al presupuesto las unidades de un trabajo que no se va a hacer.
   *
   * Sin esto, asignar una pieza y después cancelarla dejaba las unidades retenidas para siempre:
   * el cliente había pagado por trabajo que nadie hizo y su saldo del mes no lo reflejaba.
   *
   * La devolución se rige por `ud.reversal_mode`, que Dirección configura:
   *
   * - `automatic` — cancelar devuelve las unidades sin trámite.
   * - `manual` — cancelar no devuelve nada; hace falta un ajuste explícito de alguien con permiso.
   * - `none` — lo reservado no se devuelve nunca.
   *
   * Devuelve tanto lo reservado como lo ya consumido, porque una pieza entregada que se anula
   * también deja de corresponder a trabajo hecho. Es la razón de que se descuente de ambos
   * saldos y no solo del reservado.
   *
   * Un mes cerrado no se toca salvo que `ud.reversal_allows_closed_budget` lo permita: el saldo
   * de un mes ya facturado no debería moverse porque alguien canceló algo en el mes siguiente.
   * La devolución se rechaza con un mensaje que dice qué falta, en vez de alterar el cierre.
   *
   * Es idempotente: repetir la cancelación no devuelve dos veces.
   */
  async releaseForPiece(piece: Piece, reason: string, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement | null> {
    const mode = (await this.parameterResolver.get('ud.reversal_mode', piece.clientId, null, piece.organizationId)) ?? 'automatic';
    if (mode === 'none') return null;
    if (mode === 'manual') {
      throw new BadRequestException('La devolución de unidades requiere un ajuste manual: la configuración no la hace sola.');
    }

    const execute = async (manager: EntityManager) => {
      const movementRepo = manager.getRepository(UDMovement);
      const alreadyReleased = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RELEASE },
      });
      if (alreadyReleased) return alreadyReleased;

      const reservation = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.RESERVATION },
      });
      // Sin reserva no hay nada que devolver: la pieza nunca llegó a descontar del presupuesto.
      if (!reservation) return null;

      const budget = await manager.findOne(UDBudget, {
        where: { id: reservation.udBudgetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!budget) return null;

      if (budget.status !== 'open') {
        const permiteCerrado = await this.parameterResolver.get('ud.reversal_allows_closed_budget', piece.clientId, null, piece.organizationId);
        if (!permiteCerrado) {
          throw new BadRequestException(
            `El presupuesto de ${budget.month}/${budget.year} está cerrado y la configuración no permite devolver unidades sobre un mes cerrado.`,
          );
        }
      }

      // Se devuelve lo que la pieza movió realmente, no su valor actual: si alguien cambió el
      // valor del tipo de pieza después de reservarla, devolver el valor nuevo descuadraría el
      // presupuesto. El movimiento de reserva es el registro de lo que efectivamente se cobró.
      const amount = Number(reservation.amount);
      const consumed = await movementRepo.findOne({
        where: { pieceId: piece.id, type: UDMovementType.CONSUMPTION },
      });

      if (consumed) budget.consumed = Number(budget.consumed) - amount;
      else budget.reserved = Number(budget.reserved) - amount;
      await manager.save(UDBudget, budget);

      const movement = manager.create(UDMovement, {
        udBudgetId: budget.id,
        pieceId: piece.id,
        type: UDMovementType.RELEASE,
        amount,
        reason: reason.slice(0, 255),
        actorId,
      });
      return manager.save(UDMovement, movement);
    };
    return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
  }

  async isNearLimit(budget: UDBudget, thresholdPercent?: number): Promise<boolean> {
    const organizationId = await this.resolveOrganizationId(budget.clientId);
    const threshold = thresholdPercent ?? (await this.parameterResolver.get('ud.warning_threshold_percent', budget.clientId, null, organizationId)) ?? 80;
    const used = Number(budget.reserved) + Number(budget.consumed);
    const total = Number(budget.contracted);

    if (total <= 0) return false;

    return (used / total) >= (threshold / 100);
  }

  async checkBudgetAlert(clientId: string, clientName?: string): Promise<BudgetAlertDto> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const budget = await this.ensureMonthlyBudget(clientId, year, month);

    const used = Number(budget.reserved) + Number(budget.consumed);
    const total = Number(budget.contracted);
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    const organizationId = await this.resolveOrganizationId(clientId);
    const warningThreshold = Number(
      await this.parameterResolver.get('ud.warning_threshold_percent', clientId, null, organizationId) ?? 80,
    );

    let status: BudgetAlertDto['status'] = 'ok';
    if (used >= total) {
      status = 'blocked';
    } else if (percentage >= warningThreshold) {
      status = 'warning';
    }

    return { clientId, clientName, used, total, percentage, status };
  }

  private async resolveMonthlyBudget(clientId: string): Promise<number> {
    const fromParam = await this.parameterResolver.get('ud.default_monthly_budget', clientId);
    return Number(fromParam ?? 20);
  }

  private async resolveOrganizationId(clientId: string): Promise<string | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId }, select: { organizationId: true } });
    return client?.organizationId ?? null;
  }
}
