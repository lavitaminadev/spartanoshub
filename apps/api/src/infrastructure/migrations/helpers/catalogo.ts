import { QueryRunner } from 'typeorm';

/*
 * Lecturas del catálogo de la base, sin pasar por `getTable()`.
 *
 * `getTable()` sirve mientras la tabla no tenga columnas generadas. En cuanto tiene una, TypeORM
 * va a buscar su expresión a `typeorm_metadata`, una tabla que solo existe si alguna vez se
 * sincronizó el esquema. Sobre una base creada solo con migraciones no existe, y la lectura
 * revienta con «Table 'typeorm_metadata' doesn't exist» en una migración que no pedía nada raro.
 *
 * Estas preguntas van a `information_schema`, que está siempre y no depende de cómo se haya
 * creado el esquema.
 */

/** Si la tabla tiene esa columna. */
export async function hayColumna(queryRunner: QueryRunner, tabla: string, columna: string): Promise<boolean> {
  const filas: Array<{ total: number }> = await queryRunner.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, columna],
  );
  return Number(filas[0]?.total ?? 0) > 0;
}

/** Si la tabla tiene ese índice, venga de un CREATE INDEX o de un UNIQUE KEY del CREATE TABLE. */
export async function hayIndice(queryRunner: QueryRunner, tabla: string, indice: string): Promise<boolean> {
  const filas: Array<{ total: number }> = await queryRunner.query(
    `SELECT COUNT(*) AS total FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tabla, indice],
  );
  return Number(filas[0]?.total ?? 0) > 0;
}
