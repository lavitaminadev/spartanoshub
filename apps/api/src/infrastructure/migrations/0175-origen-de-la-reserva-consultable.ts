import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayIndice } from './helpers/catalogo';

/**
 * Índice para poder preguntar de qué campaña vino una reserva.
 *
 * Las columnas `utm_source`, `utm_campaign` y `utm_medium` existían desde hacía meses y ninguna
 * tenía índice: nunca se consultaron. Al exponerlas como filtro, cada búsqueda por campaña
 * recorrería la tabla entera.
 *
 * Empieza por `organization_id` y `client_id` porque toda consulta de reservas los lleva —el
 * aislamiento entre empresas no es opcional—, de modo que el índice sirve también cuando se filtra
 * por empresa sin indicar campaña. `starts_at` va al final para que el orden por fecha, que es
 * como se lee la lista, no necesite ordenar aparte.
 *
 * `utm_source` y `utm_medium` quedan fuera a propósito: son valores de muy baja cardinalidad
 * —«meta», «google», «directo»— y un índice sobre ellos descarta tan pocas filas que el motor
 * prefiere no usarlo. Se filtran sobre el conjunto que ya redujo este índice.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class OrigenDeLaReservaConsultable1790000000175 implements MigrationInterface {
  name = 'OrigenDeLaReservaConsultable1790000000175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (await hayIndice(queryRunner, 'reservations', 'IDX_reservations_org_client_campana')) return;
    await queryRunner.query(
      'CREATE INDEX IDX_reservations_org_client_campana ON reservations (organization_id, client_id, utm_campaign, starts_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (!(await hayIndice(queryRunner, 'reservations', 'IDX_reservations_org_client_campana'))) return;
    await queryRunner.query('DROP INDEX IDX_reservations_org_client_campana ON reservations');
  }
}
