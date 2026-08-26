import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Permite que un formulario o una campaña midan contra su propio Pixel.
 *
 * Hasta ahora el Pixel era uno por empresa y lo compartían sus reservas, sus encuestas y su CRM.
 * Eso es correcto para una empresa con una sola marca, y deja de serlo en cuanto una lleva varios
 * proyectos: una inmobiliaria con tres torres las anuncia por separado, cada una con su cuenta
 * publicitaria, y mandar las tres al mismo conjunto de datos impide saber cuál convierte.
 *
 * **Nula significa heredar.** Una fila sin valor se comporta exactamente como hasta hoy: usa el
 * Pixel por defecto de su empresa. Por eso esta migración no cambia el envío de nada que ya
 * exista; solo abre la posibilidad de apartarse cuando alguien lo decida en pantalla.
 *
 * `reservation_forms` cubre reservas y encuestas porque son la misma entidad con distinto `mode`.
 */
export class MetaPixelPorAmbito1756200000110 implements MigrationInterface {
  name = 'MetaPixelPorAmbito1756200000110';

  /** Dónde se puede apartar del Pixel de la empresa. */
  private readonly objetivos = ['reservation_forms', 'crm_campaigns'];

  /**
   * `varchar` y no numérico: un identificador de Pixel es una cadena de dígitos que nunca se
   * opera, y guardarla como número arriesga perder ceros iniciales o desbordar.
   */
  private columna(): TableColumn {
    return new TableColumn({ name: 'meta_pixel_id', type: 'varchar', length: '40', isNullable: true });
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of this.objetivos) {
      if (!(await queryRunner.hasTable(tabla))) continue;
      if (await queryRunner.hasColumn(tabla, 'meta_pixel_id')) continue;
      await queryRunner.addColumn(tabla, this.columna());
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of this.objetivos) {
      if (!(await queryRunner.hasTable(tabla))) continue;
      if (!(await queryRunner.hasColumn(tabla, 'meta_pixel_id'))) continue;
      await queryRunner.dropColumn(tabla, 'meta_pixel_id');
    }
  }
}
