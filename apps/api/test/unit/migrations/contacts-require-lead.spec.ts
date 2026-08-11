import { QueryRunner, Table, TableForeignKey } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ContactsRequireLead1726200000000 } from '../../../src/infrastructure/migrations/0077-contacts-require-lead';

type RunnerOptions = {
  orphans?: number;
  withColumn?: boolean;
  withForeignKey?: boolean;
  columnType?: string;
  charset?: string | null;
  collation?: string | null;
};

function createQueryRunner(options: RunnerOptions = {}) {
  const {
    orphans = 0,
    withColumn = true,
    withForeignKey = true,
    columnType = 'uuid',
    charset = null,
    collation = null,
  } = options;
  const existingForeignKey = new TableForeignKey({
    name: 'FK_existing_contact_lead',
    columnNames: ['lead_id'],
    referencedTableName: 'leads',
    referencedColumnNames: ['id'],
    onDelete: 'SET NULL',
  });
  const contactsTable = new Table({ name: 'crm_contacts' });
  contactsTable.foreignKeys = withForeignKey ? [existingForeignKey] : [];

  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
      return Promise.resolve([{ columnType, charset, collation }]);
    }
    if (sql.includes('SELECT COUNT(*) AS orphans')) return Promise.resolve([{ orphans }]);
    return Promise.resolve(undefined);
  });
  const queryRunner = {
    hasTable: vi.fn().mockResolvedValue(true),
    hasColumn: vi.fn().mockResolvedValue(withColumn),
    getTable: vi.fn().mockResolvedValue(contactsTable),
    query,
    dropForeignKey: vi.fn().mockResolvedValue(undefined),
    createForeignKey: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  return { queryRunner, existingForeignKey, query };
}

function executedSql(queryRunner: QueryRunner): string[] {
  return vi.mocked(queryRunner.query).mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
}

describe('ContactsRequireLead1726200000000', () => {
  it('uses MODIFY with the native UUID type and never drops lead_id', async () => {
    const { queryRunner, existingForeignKey } = createQueryRunner();

    await new ContactsRequireLead1726200000000().up(queryRunner);

    const sql = executedSql(queryRunner);
    expect(sql).toContain('ALTER TABLE crm_contacts MODIFY lead_id uuid NOT NULL');
    expect(sql.some((statement) => /DROP (COLUMN )?`?lead_id/i.test(statement))).toBe(false);
    expect(queryRunner.dropForeignKey).toHaveBeenCalledWith('crm_contacts', existingForeignKey);
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.name).toBe(existingForeignKey.name);
    expect(created.onDelete).toBe('RESTRICT');
  });

  it('recreates a missing lead_id before reading or migrating contacts', async () => {
    const { queryRunner } = createQueryRunner({ withColumn: false, withForeignKey: false });

    await new ContactsRequireLead1726200000000().up(queryRunner);

    const sql = executedSql(queryRunner);
    const addIndex = sql.indexOf('ALTER TABLE crm_contacts ADD lead_id uuid NULL');
    const insertIndex = sql.findIndex((statement) => statement.startsWith('INSERT INTO leads'));
    expect(addIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeLessThan(insertIndex);
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.name).toBe('FK_crm_contacts_lead');
    expect(created.onDelete).toBe('RESTRICT');
  });

  it('preserves varchar charset and collation when the server does not use native UUID', async () => {
    const { queryRunner } = createQueryRunner({
      withColumn: false,
      columnType: 'varchar(36)',
      charset: 'utf8mb4',
      collation: 'utf8mb4_bin',
    });

    await new ContactsRequireLead1726200000000().up(queryRunner);

    const sql = executedSql(queryRunner);
    expect(sql).toContain(
      'ALTER TABLE crm_contacts ADD lead_id varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL',
    );
    expect(sql).toContain(
      'ALTER TABLE crm_contacts MODIFY lead_id varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL',
    );
  });

  it('does not alter constraints while orphan contacts remain', async () => {
    const { queryRunner } = createQueryRunner({ orphans: 2 });

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('Quedan 2 contactos sin lead');
    expect(queryRunner.dropForeignKey).not.toHaveBeenCalled();
    expect(queryRunner.createForeignKey).not.toHaveBeenCalled();
    expect(executedSql(queryRunner)).not.toContain('ALTER TABLE crm_contacts MODIFY lead_id uuid NOT NULL');
  });

  it('restores SET NULL when the migration is reverted', async () => {
    const { queryRunner } = createQueryRunner();

    await new ContactsRequireLead1726200000000().down(queryRunner);

    expect(executedSql(queryRunner)).toContain('ALTER TABLE crm_contacts MODIFY lead_id uuid NULL');
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.onDelete).toBe('SET NULL');
  });

  it('restores a compatible nullable column if recreating the foreign key fails', async () => {
    const { queryRunner } = createQueryRunner();
    vi.mocked(queryRunner.createForeignKey)
      .mockRejectedValueOnce(new Error('foreign key rejected'))
      .mockResolvedValueOnce(undefined);

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('foreign key rejected');

    const sql = executedSql(queryRunner);
    expect(sql).toContain('ALTER TABLE crm_contacts MODIFY lead_id uuid NOT NULL');
    expect(sql).toContain('ALTER TABLE crm_contacts MODIFY lead_id uuid NULL');
    const restoredForeignKey = vi.mocked(queryRunner.createForeignKey).mock.calls[1][1] as TableForeignKey;
    expect(restoredForeignKey.onDelete).toBe('SET NULL');
  });

  it('rejects an unexpected database type before interpolating it into SQL', async () => {
    const { queryRunner } = createQueryRunner({ columnType: 'uuid; DROP TABLE leads' });

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('Tipo SQL inesperado');
    expect(executedSql(queryRunner).some((statement) => statement.startsWith('ALTER TABLE'))).toBe(false);
  });
});
