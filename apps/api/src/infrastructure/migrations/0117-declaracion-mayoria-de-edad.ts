import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La declaración de mayoría de edad, donde se captura.
 *
 * Es la casilla del formulario: «confirmo ser mayor de 18 años». Sustituye a la fecha de
 * nacimiento como requisito —esa queda opcional, y solo sirve para felicitar— porque para lo que
 * importa legalmente basta con que la persona lo declare y quede registrado cuándo.
 *
 * Se guarda **cuándo** lo declaró y no un simple sí/no. Un booleano en `true` no responde la
 * única pregunta que se hace cuando alguien reclama: «¿desde cuándo?». Y un booleano no permite
 * distinguir «dijo que no» de «nunca se le preguntó», que es la distinción que decide si se le
 * puede escribir.
 *
 * Va en reservas y en la lista de correo. Las encuestas viajan dentro de las respuestas del
 * formulario de reserva, así que quedan cubiertas por la misma columna.
 */
export class DeclaracionMayoriaDeEdad1756900000000 implements MigrationInterface {
  name = 'DeclaracionMayoriaDeEdad1756900000000';

  private async falta(queryRunner: QueryRunner, tabla: string): Promise<boolean> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'adult_declared_at'
    `, [tabla]);
    return Number(columnas?.[0]?.n ?? 0) === 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['reservations', 'email_subscribers']) {
      if (await this.falta(queryRunner, tabla)) {
        await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN adult_declared_at TIMESTAMP NULL`);
      }
    }

    /*
     * Lo ya recogido queda sin declarar, y así se queda.
     *
     * Rellenarlo con la fecha de creación diría que esas personas declararon algo que nunca se
     * les preguntó, y sería una constancia falsa: exactamente lo contrario de para lo que existe
     * esta columna. Quedan como «no consta», que es la verdad.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['reservations', 'email_subscribers']) {
      if (!(await this.falta(queryRunner, tabla))) {
        await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN adult_declared_at`);
      }
    }
  }
}
