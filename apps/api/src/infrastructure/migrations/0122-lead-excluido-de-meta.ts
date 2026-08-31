import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca de un lead que no debe reportarse a Meta.
 *
 * Hay leads que existen y deben seguir existiendo, pero cuya señal no queremos enseñarle a la
 * plataforma: pruebas internas, duplicados de una misma persona, entradas de un formulario mal
 * configurado. Antes la única forma de callarlos era borrarlos, y borrar un lead no es gratis
 * —hay contactos, interacciones y oportunidades colgando de él, y la trazabilidad de lo que ya
 * se envió se pierde con la fila—.
 *
 * Es distinto de que el lead haya desaparecido: eso ya lo comprueba la cola justo antes de
 * enviar. Ésta es una decisión que alguien toma sobre un lead que se conserva.
 *
 * Se decide por lead y no por campaña, correo ni nombre: la misma persona puede entrar por dos
 * campañas y cada entrada es un lead con su propio identificador. Marcar uno no puede alcanzar
 * al otro.
 *
 * Nace en `FALSE` para todo lo existente. Lo contrario —excluir por defecto y tener que
 * autorizar— apagaría en silencio el reporte de todo el histórico.
 */
export class LeadExcluidoDeMeta1757400000000 implements MigrationInterface {
  name = 'LeadExcluidoDeMeta1757400000000';

  private async falta(queryRunner: QueryRunner): Promise<boolean> {
    const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND column_name = 'excluded_from_meta'
    `);
    return Number(filas?.[0]?.n ?? 0) === 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.falta(queryRunner))) return;

    await queryRunner.query(
      'ALTER TABLE leads ADD COLUMN excluded_from_meta TINYINT(1) NOT NULL DEFAULT 0',
    );

    /*
     * Sin índice a propósito.
     *
     * La columna no filtra ninguna consulta: se lee sobre un lead que ya se encontró por su
     * identificador. Un índice sobre un booleano casi siempre falso no ayuda a nadie y encarece
     * cada escritura de la tabla más caliente del CRM.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.falta(queryRunner)) return;
    await queryRunner.query('ALTER TABLE leads DROP COLUMN excluded_from_meta');
  }
}
