import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aparta las tablas que ningún código escribe ni lee.
 *
 * - `lead_interactions` quedó de 2023. La reemplazó `crm_interactions` y nada volvió a escribirla,
 *   pero sigue en la lista con nombre de tabla viva: consultarla devuelve un resultado vacío que
 *   se lee como «nadie contactó a nadie» en vez de «esta tabla está muerta».
 * - `meta_pixels_respaldo_20260928` es la copia que alguien dejó antes de una corrección. Cumplió
 *   su función y se quedó.
 *
 * **Se renombran, no se borran.** Un `DROP` no se deshace, y aquí no hay nada que apure: lo que
 * molesta de estas tablas es que parecen vigentes, y el prefijo lo resuelve igual. Borrarlas es
 * una decisión aparte, que corresponde tomar cuando exista un respaldo fuera del hosting —hoy la
 * única copia vive en la misma cuenta que las contiene—.
 *
 * El prefijo `zz_` las manda al final de cualquier listado alfabético y `_retirada` dice por qué
 * están ahí sin que haya que preguntarle a nadie.
 *
 * Correrla dos veces no cambia el resultado: si el nombre nuevo ya existe, no toca nada.
 */
export class TablasQueYaNadieEscribe1790000000173 implements MigrationInterface {
  name = 'TablasQueYaNadieEscribe1790000000173';

  private static readonly RETIRADAS: ReadonlyArray<readonly [string, string]> = [
    ['lead_interactions', 'zz_lead_interactions_retirada'],
    ['meta_pixels_respaldo_20260928', 'zz_meta_pixels_respaldo_20260928_retirada'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [vigente, retirada] of TablasQueYaNadieEscribe1790000000173.RETIRADAS) {
      if (!(await queryRunner.hasTable(vigente))) continue;
      if (await queryRunner.hasTable(retirada)) continue;
      await queryRunner.query(`RENAME TABLE \`${vigente}\` TO \`${retirada}\``);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [vigente, retirada] of TablasQueYaNadieEscribe1790000000173.RETIRADAS) {
      if (!(await queryRunner.hasTable(retirada))) continue;
      if (await queryRunner.hasTable(vigente)) continue;
      await queryRunner.query(`RENAME TABLE \`${retirada}\` TO \`${vigente}\``);
    }
  }
}
