import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Por dónde ocurre una actividad agendada, y dónde.
 *
 * Agendar una reunión sin decir si es por Meet o en la oficina obliga a escribirlo en la
 * descripción, que es texto libre: no se puede filtrar, no se puede poner en un recordatorio y
 * cada persona lo escribe distinto. Con el enlace pasa lo mismo, y ahí duele más —el recordatorio
 * de tres horas antes debería llevarlo, y no puede sacarlo de un párrafo—.
 *
 * Dos columnas y no una: el medio es un valor de una lista corta y el lugar es texto libre —un
 * enlace, una dirección, un número—. Juntarlos obligaría a interpretar la cadena para saber cuál
 * de las dos cosas es.
 *
 * Ambas admiten vacío: una llamada no tiene lugar, y una nota no tiene medio.
 */
export class MedioDeLaReunion1757100000000 implements MigrationInterface {
  name = 'MedioDeLaReunion1757100000000';

  private async falta(queryRunner: QueryRunner, columna: string): Promise<boolean> {
    const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'crm_interactions' AND column_name = ?
    `, [columna]);
    return Number(filas?.[0]?.n ?? 0) === 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.falta(queryRunner, 'medium')) {
      await queryRunner.query("ALTER TABLE crm_interactions ADD COLUMN medium VARCHAR(40) NULL");
    }
    if (await this.falta(queryRunner, 'location')) {
      await queryRunner.query('ALTER TABLE crm_interactions ADD COLUMN location VARCHAR(500) NULL');
    }
    /*
     * Lo ya registrado queda sin medio.
     *
     * Suponer que toda reunión antigua fue presencial sería inventar un dato que nadie escribió, y
     * quedaría indistinguible de los que sí se declaren a partir de ahora.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.falta(queryRunner, 'location'))) {
      await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN location');
    }
    if (!(await this.falta(queryRunner, 'medium'))) {
      await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN medium');
    }
  }
}
