import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * Las reglas que califican un lead solo, y lo que dejan anotado en él.
 *
 * Hasta ahora calificar era a mano, lead por lead: quien atiende abre la ficha, lee lo que
 * contestó y elige un semáforo. Con cien leads al mes eso se hace tarde o no se hace, y los
 * buenos se enfrían en la misma columna que los que solo cotizaban.
 *
 * Las dos columnas en `leads` guardan qué regla lo calificó y con qué texto. Sin el texto, quien
 * mira el tablero ve un semáforo verde sin forma de saber qué lo puso ahí, y la primera vez que
 * una regla se equivoque nadie podrá señalar dónde.
 */
export class ReglasDeCalificacion1790000000154 implements MigrationInterface {
  name = 'ReglasDeCalificacion1790000000154';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_reglas_de_calificacion'))) {
      await queryRunner.query(`
        CREATE TABLE crm_reglas_de_calificacion (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          organization_id VARCHAR(36) NOT NULL,
          client_id VARCHAR(36) NOT NULL,
          nombre VARCHAR(120) NOT NULL,
          posicion INT NOT NULL DEFAULT 0,
          activa TINYINT(1) NOT NULL DEFAULT 1,
          -- Nace en manual: se prueba sobre unos pocos leads antes de dejarla correr sola.
          automatica TINYINT(1) NOT NULL DEFAULT 0,
          unir VARCHAR(10) NOT NULL DEFAULT 'todas',
          condiciones JSON NULL,
          acciones JSON NULL,
          created_by VARCHAR(36) NULL,
          archived_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          /*
            La única consulta que existe: las reglas vivas de una empresa, en orden. Se lee en
            cada lead que entra, así que el índice la resuelve entera sin tocar la tabla.
          */
          INDEX IDX_crm_reglas_org_client (organization_id, client_id, archived_at, posicion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await queryRunner.hasTable('leads'))) return;

    /*
     * Qué regla lo calificó y por qué.
     *
     * Van en columnas y no en la metadata del lead porque se muestran en cada tarjeta del
     * tablero: leerlas de un JSON obligaría a traer y abrir la metadata entera —que incluye las
     * respuestas del formulario— solo para pintar una línea de texto.
     */
    if (!(await hayColumna(queryRunner, 'leads', 'regla_aplicada_id'))) {
      await queryRunner.query('ALTER TABLE leads ADD COLUMN regla_aplicada_id VARCHAR(36) NULL');
    }
    if (!(await hayColumna(queryRunner, 'leads', 'regla_aplicada_motivo'))) {
      await queryRunner.query('ALTER TABLE leads ADD COLUMN regla_aplicada_motivo VARCHAR(300) NULL');
    }

    /*
     * Dos índices que las reglas necesitan y que la tabla no tenía.
     *
     * El primero: los leads de una empresa por fecha. Es lo que recorren el catálogo de
     * preguntas y la prueba de una regla, y sin él son un recorrido completo de la tabla que
     * crece con cada lead que entra.
     *
     * El segundo: qué calificó una regla. Es la pregunta que se hace cuando una se equivoca y
     * hay que deshacer lo que hizo; sin índice habría que revisar todos los leads para
     * encontrar los suyos.
     */
    if (!(await hayIndice(queryRunner, 'leads', 'IDX_leads_org_client_created'))) {
      await queryRunner.query('CREATE INDEX IDX_leads_org_client_created ON leads (organization_id, client_id, created_at)');
    }
    if (!(await hayIndice(queryRunner, 'leads', 'IDX_leads_regla_aplicada'))) {
      await queryRunner.query('CREATE INDEX IDX_leads_regla_aplicada ON leads (organization_id, regla_aplicada_id)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('leads')) {
      if (await hayIndice(queryRunner, 'leads', 'IDX_leads_regla_aplicada')) {
        await queryRunner.query('DROP INDEX IDX_leads_regla_aplicada ON leads');
      }
      if (await hayIndice(queryRunner, 'leads', 'IDX_leads_org_client_created')) {
        await queryRunner.query('DROP INDEX IDX_leads_org_client_created ON leads');
      }
      if (await hayColumna(queryRunner, 'leads', 'regla_aplicada_motivo')) {
        await queryRunner.query('ALTER TABLE leads DROP COLUMN regla_aplicada_motivo');
      }
      if (await hayColumna(queryRunner, 'leads', 'regla_aplicada_id')) {
        await queryRunner.query('ALTER TABLE leads DROP COLUMN regla_aplicada_id');
      }
    }
    // Las reglas se van con la tabla: lo que calificaron se conserva en el lead, que no se toca.
    await queryRunner.query('DROP TABLE IF EXISTS crm_reglas_de_calificacion');
  }
}
