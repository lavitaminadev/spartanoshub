import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fecha de nacimiento, donde hace falta y solo donde hace falta.
 *
 * Sirve para dos cosas distintas que se resuelven con el mismo dato: felicitar el cumpleaños, y
 * no mandarle publicidad a un menor.
 *
 * Sobre lo segundo conviene ser honesto: una fecha que escribe la propia persona **no acredita**
 * su edad, porque cualquiera puede poner otro año. Lo que da es constancia de que se preguntó y
 * de qué se respondió, que es lo proporcionado para una lista de correo —una verificación real
 * exigiría un documento— y permite excluir por regla a quien se declara menor, en vez de dejarlo
 * al criterio de quien mire la lista.
 *
 * Va en las dos tablas y no en una compartida porque un lead y un suscriptor son personas en
 * relaciones distintas con la agencia, y la mitad de los leads nunca estarán en la lista de
 * correo.
 *
 * Solo la fecha, sin hora: nadie nace a una hora que importe acá, y guardar `TIMESTAMP` haría que
 * el cumpleaños cayera un día antes o después según la zona horaria de quien consulte.
 */
export class FechaDeNacimiento1756800000000 implements MigrationInterface {
  name = 'FechaDeNacimiento1756800000000';

  private async falta(queryRunner: QueryRunner, tabla: string): Promise<boolean> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'birth_date'
    `, [tabla]);
    return Number(columnas?.[0]?.n ?? 0) === 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.falta(queryRunner, 'email_subscribers')) {
      await queryRunner.query('ALTER TABLE email_subscribers ADD COLUMN birth_date DATE NULL');
      /*
       * El saludo pregunta «quién cumple hoy», o sea por mes y día ignorando el año.
       *
       * Un índice sobre la columna entera no serviría para esa consulta, así que no se crea: el
       * trabajo recorre los suscriptores de la organización, que son pocos, y un índice inútil
       * encarece cada escritura sin acelerar ninguna lectura.
       */
    }

    if (await this.falta(queryRunner, 'leads')) {
      await queryRunner.query('ALTER TABLE leads ADD COLUMN birth_date DATE NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.falta(queryRunner, 'email_subscribers'))) {
      await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN birth_date');
    }
    if (!(await this.falta(queryRunner, 'leads'))) {
      await queryRunner.query('ALTER TABLE leads DROP COLUMN birth_date');
    }
  }
}
