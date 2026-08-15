import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { PieceType, PIECE_TYPE_LABELS, PRINT_PIECE_TYPES } from '../../modules/production/piece-type.enum';
import { UD_DEFAULTS, udValueKey } from '../../modules/design-budget/ud-calculator';

/**
 * Catálogo de tipos de pieza por organización.
 *
 * Los tipos vivían en un `enum` de TypeScript: agregar uno exigía cambiar el repositorio y
 * desplegar. Como fila, el área propone un tipo desde la aplicación, alguien con atribución lo
 * aprueba, y desde ese momento aparece en los formularios de su área.
 *
 * La siembra deja a cada organización con el catálogo que ya usaba, en estado `active` y con los
 * valores del Documento Maestro. Si alguien alcanzó a configurar un valor por parámetro, ese gana
 * sobre el del maestro: es una decisión ya tomada y perderla obligaría a tomarla de nuevo.
 */
export class PieceTypeDefinitions1726900008000 implements MigrationInterface {
  name = 'PieceTypeDefinitions1726900008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('piece_type_definitions'))) {
      await queryRunner.createTable(new Table({
        name: 'piece_type_definitions',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'key', type: 'varchar', length: '50' },
          { name: 'label', type: 'varchar', length: '100' },
          { name: 'area', type: 'varchar', length: '20', default: "'design'" },
          { name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, isNullable: true },
          { name: 'xp_weight', type: 'decimal', precision: 5, scale: 2, default: 1 },
          { name: 'extra_per_unit', type: 'decimal', precision: 8, scale: 2, isNullable: true },
          { name: 'is_print', type: 'boolean', default: false },
          { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
          { name: 'requested_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'approved_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'approved_at', type: 'timestamp', isNullable: true },
          { name: 'notes', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      // La clave única por organización es lo que impide dos tipos con el mismo identificador,
      // que dejaría ambiguo a cuál apunta una pieza ya creada.
      await queryRunner.createIndex('piece_type_definitions', new TableIndex({
        name: 'UQ_piece_type_org_key', columnNames: ['organization_id', 'key'], isUnique: true,
      }));
    }

    const organizations: { id: string }[] = await queryRunner.query('SELECT id FROM organizations');
    if (!organizations.length) return;

    // Valores que alguien ya haya configurado por parámetro, para no perderlos en el traspaso.
    const configurados = new Map<string, number>();
    const filas: { key: string; scope_id: string; value_json: unknown }[] = await queryRunner.query(`
      SELECT d.key AS \`key\`, v.scope_id, v.value_json
      FROM parameter_values v
      JOIN parameter_definitions d ON d.id = v.definition_id
      WHERE v.scope_type = 'organization' AND d.key LIKE 'ud.value.%' AND v.valid_to IS NULL
    `).catch(() => []);
    for (const fila of filas) {
      const parsed = typeof fila.value_json === 'string' ? JSON.parse(fila.value_json) : fila.value_json;
      const valor = (parsed as { value?: unknown })?.value;
      if (valor !== null && valor !== undefined) configurados.set(`${fila.scope_id}:${fila.key}`, Number(valor));
    }

    const impresas = new Set<string>(PRINT_PIECE_TYPES);
    for (const organization of organizations) {
      for (const type of Object.values(PieceType)) {
        const configurado = configurados.get(`${organization.id}:${udValueKey(type)}`);
        const ud = configurado ?? UD_DEFAULTS[type] ?? null;

        await queryRunner.query(
          `INSERT IGNORE INTO piece_type_definitions
             (id, organization_id, \`key\`, label, area, ud_amount, xp_weight, extra_per_unit, is_print, status, approved_at, notes)
           VALUES (UUID(), ?, ?, ?, 'design', ?, 1, ?, ?, 'active', CURRENT_TIMESTAMP, ?)`,
          [
            organization.id,
            type,
            PIECE_TYPE_LABELS[type],
            ud,
            type === PieceType.CAROUSEL ? 0.4 : null,
            impresas.has(type) ? 1 : 0,
            ud === null ? 'Enumerado por Dirección de Arte; falta decidir su valor.' : 'Catálogo inicial del Documento Maestro 6.1.',
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('piece_type_definitions')) {
      await queryRunner.dropTable('piece_type_definitions');
    }
  }
}
