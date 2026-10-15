import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * De qué brief salió cada pieza.
 *
 * Los dos módulos existían uno al lado del otro y no se tocaban: alguien escribía el brief, y
 * otra persona volvía a escribir lo mismo al crear la pieza. Nada unía el pedido con el trabajo,
 * así que no se podía responder «qué se hizo con este brief» ni «de dónde salió esta pieza».
 *
 * La columna admite nulo y seguirá admitiéndolo: una pieza puede nacer sin brief —un arreglo
 * pedido por teléfono, una corrección— y exigirlo convertiría un vínculo útil en un trámite.
 *
 * Sin llave foránea a propósito: un brief borrado no debe arrastrar la pieza que ya se produjo,
 * ni impedir que se borre. El índice sirve para listar las piezas de un brief.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class LaPiezaRecuerdaSuBrief1790000000180 implements MigrationInterface {
  name = 'LaPiezaRecuerdaSuBrief1790000000180';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pieces'))) return;
    if (!(await hayColumna(queryRunner, 'pieces', 'brief_id'))) {
      await queryRunner.query('ALTER TABLE pieces ADD COLUMN brief_id CHAR(36) NULL');
    }
    if (!(await hayIndice(queryRunner, 'pieces', 'IDX_pieces_brief'))) {
      await queryRunner.query('CREATE INDEX IDX_pieces_brief ON pieces (brief_id)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pieces'))) return;
    if (await hayIndice(queryRunner, 'pieces', 'IDX_pieces_brief')) {
      await queryRunner.query('DROP INDEX IDX_pieces_brief ON pieces');
    }
    if (await hayColumna(queryRunner, 'pieces', 'brief_id')) {
      await queryRunner.query('ALTER TABLE pieces DROP COLUMN brief_id');
    }
  }
}
