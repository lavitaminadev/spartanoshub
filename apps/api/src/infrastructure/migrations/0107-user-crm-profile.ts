import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Cuánto ve cada persona dentro de las empresas que alcanza.
 *
 * Hasta ahora eso lo decidía el cargo: administración y direcciones veían el embudo entero, y el
 * resto solo lo suyo. Sirve para la agencia, donde los cargos están claros, pero no para lo que
 * viene: cada empresa cliente tendrá su propia gente, y ahí «community manager» o «diseñador» no
 * significan nada. Lo que hay son dos formas de usar el CRM:
 *
 * - **Cuenta principal** — quien lleva el negocio. Ve todo lo de su empresa, configura y reparte.
 * - **Venta** — quien atiende. Ve lo suyo y lo que está libre, y no configura nada.
 *
 * Se guarda por persona y no por cargo porque son dos preguntas distintas: el cargo dice a qué
 * módulos entra, este campo dice cuánto abarca dentro de ellos. Un mismo cargo puede tener las
 * dos formas en dos empresas distintas, y forzarlo a coincidir obligaría a inventar un cargo por
 * cada combinación.
 *
 * Nulo significa «lo que diga el cargo», que es exactamente lo que hacía antes: así, ninguna
 * cuenta existente cambia de comportamiento al aplicarse esta migración.
 */
export class UserCrmProfile1756000002000 implements MigrationInterface {
  name = 'UserCrmProfile1756000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'crm_profile')) return;
    await queryRunner.addColumn('users', new TableColumn({
      name: 'crm_profile',
      type: 'varchar',
      length: '20',
      isNullable: true,
      comment: 'principal | venta. Nulo: lo decide el cargo.',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'crm_profile'))) return;
    await queryRunner.dropColumn('users', 'crm_profile');
  }
}
