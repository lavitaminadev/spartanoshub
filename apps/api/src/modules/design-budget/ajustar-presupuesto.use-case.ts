import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { UDMovementType } from './ud-movement-type.enum';
import { Client } from '../clients/client.entity';

/**
 * Cambia cuántas UD tiene contratadas una empresa este mes.
 *
 * El motor entero funcionaba sin esto: el trabajo mensual creaba el presupuesto con el contrato
 * base, Producción reservaba y consumía, y las alertas avisaban al acercarse al tope. Lo que no
 * existía era la excepción, que es justo lo que ocurre en un mes cualquiera: se vendieron diez UD
 * más, o se acordó bajar el mes de vacaciones. Sin esta operación había que tocar la base a mano.
 *
 * **Deja movimiento.** Un presupuesto que cambia de tamaño sin dejar rastro hace que la suma de
 * los movimientos no cuadre con el total y que nadie pueda explicar por qué este mes eran treinta
 * y el anterior veinte.
 */
@Injectable()
export class AjustarPresupuestoUseCase {
  constructor(
    @InjectRepository(UDBudget) private readonly presupuestos: Repository<UDBudget>,
    @InjectRepository(Client) private readonly clientes: Repository<Client>,
  ) {}

  /**
   * @param contratadas - El nuevo total del mes, no la diferencia. Es lo que se acordó con la
   *   empresa, y pedirlo como total evita que dos ajustes seguidos se sumen por error.
   * @param motivo - Por qué cambió. Obligatorio: un ajuste sin explicación es indistinguible de
   *   un error de tecleo cuando alguien lo revisa tres meses después.
   */
  async execute(
    organizationId: string,
    clientId: string,
    year: number,
    month: number,
    contratadas: number,
    motivo: string,
    actorId?: string,
  ) {
    return this.presupuestos.manager.transaction(async (manager) => {
      const cliente = await manager.findOne(Client, { where: { id: clientId, organizationId } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const presupuesto = await manager.findOne(UDBudget, {
        where: { clientId, year, month },
        lock: { mode: 'pessimistic_write' },
      });
      if (!presupuesto) throw new NotFoundException('Ese mes todavía no tiene presupuesto abierto');

      /*
       * No se puede bajar por debajo de lo ya comprometido.
       *
       * Dejar el contrato en menos de lo reservado más lo consumido daría un disponible negativo:
       * el trabajo ya está hecho o encargado, y cambiar el número a posteriori no lo deshace.
       * Para bajar de verdad hay que soltar antes las piezas reservadas.
       */
      const comprometido = Number(presupuesto.reserved) + Number(presupuesto.consumed);
      if (contratadas < comprometido) {
        throw new BadRequestException(
          `Este mes ya tiene ${comprometido} UD entre reservadas y consumidas: no se puede dejar el contrato en ${contratadas}. Suelta antes las piezas reservadas que no se vayan a hacer.`,
        );
      }

      const antes = Number(presupuesto.contracted);
      if (antes === contratadas) return presupuesto;

      presupuesto.contracted = contratadas;
      const guardado = await manager.save(UDBudget, presupuesto);

      await manager.save(UDMovement, manager.create(UDMovement, {
        udBudgetId: guardado.id,
        // Positivo o negativo según hacia dónde se movió: la lista del portal ya lee ese signo.
        type: contratadas > antes ? UDMovementType.EXTRA : UDMovementType.ADJUSTMENT,
        amount: contratadas - antes,
        reason: motivo,
        actorId,
      }));

      return guardado;
    });
  }
}
