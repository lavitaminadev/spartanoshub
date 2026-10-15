import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Nombre con el que una campaña se marca en las reservas que trae.
 *
 * Hasta ahora el correo de campaña salía sin ninguna marca, así que una reserva llegada desde
 * una campaña era indistinguible de cualquier otra: los dos extremos existían —la campaña y la
 * reserva— y no había llave con la que unirlos. Lo que faltaba no era una consulta sino el dato.
 *
 * Se guarda el nombre y no se deduce al leer: el asunto se puede editar después de enviar, y
 * recalcularlo entonces desordenaría la atribución de lo ya mandado.
 *
 * Largo 180 para que coincida con `reservations.utm_campaign`, que es contra lo que se cruza:
 * con uno más corto la base truncaría el nombre a medias y el cruce dejaría de coincidir.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CampanaMarcadaEnLaReserva1790000000178 implements MigrationInterface {
  name = 'CampanaMarcadaEnLaReserva1790000000178';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    if (!(await hayColumna(queryRunner, 'email_campaigns', 'utm_campaign'))) {
      await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN utm_campaign VARCHAR(180) NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    if (await hayColumna(queryRunner, 'email_campaigns', 'utm_campaign')) {
      await queryRunner.query('ALTER TABLE email_campaigns DROP COLUMN utm_campaign');
    }
  }
}
