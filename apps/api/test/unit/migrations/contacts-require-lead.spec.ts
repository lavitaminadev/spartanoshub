import { QueryRunner, Table, TableForeignKey } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ContactsRequireLead1726200000000 } from '../../../src/infrastructure/migrations/0077-contacts-require-lead';

function createQueryRunner(orphans = 0) {
  const existingForeignKey = new TableForeignKey({
    name: 'FK_existing_contact_lead',
    columnNames: ['lead_id'],
    referencedTableName: 'leads',
    referencedColumnNames: ['id'],
    onDelete: 'SET NULL',
  });
  const table = new Table({ name: 'crm_contacts' });
  table.foreignKeys = [existingForeignKey];

  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('SELECT COUNT(*) AS orphans')) return Promise.resolve([{ orphans }]);
    return Promise.resolve(undefined);
  });
  const queryRunner = {
    hasTable: vi.fn().mockResolvedValue(true),
    getTable: vi.fn().mockResolvedValue(table),
    query,
    dropForeignKey: vi.fn().mockResolvedValue(undefined),
    createForeignKey: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  return { queryRunner, existingForeignKey, query };
}

describe('ContactsRequireLead1726200000000', () => {
  it('replaces SET NULL before making lead_id required', async () => {
    const { queryRunner, existingForeignKey, query } = createQueryRunner();

    await new ContactsRequireLead1726200000000().up(queryRunner);

    expect(queryRunner.dropForeignKey).toHaveBeenCalledWith('crm_contacts', existingForeignKey);
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.name).toBe(existingForeignKey.name);
    expect(created.onDelete).toBe('RESTRICT');
    expect(created.columnNames).toEqual(['lead_id']);
    expect(query.mock.calls.some(([sql]) => sql.includes('MODIFY lead_id VARCHAR(36) NOT NULL'))).toBe(true);
    expect(vi.mocked(queryRunner.dropForeignKey).mock.invocationCallOrder[0])
      .toBeLessThan(query.mock.invocationCallOrder.at(-1)!);
  });

  it('does not alter constraints while orphan contacts remain', async () => {
    const { queryRunner } = createQueryRunner(2);

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('Quedan 2 contactos sin lead');
    expect(queryRunner.dropForeignKey).not.toHaveBeenCalled();
    expect(queryRunner.createForeignKey).not.toHaveBeenCalled();
  });

  it('restores SET NULL when the migration is reverted', async () => {
    const { queryRunner, query } = createQueryRunner();

    await new ContactsRequireLead1726200000000().down(queryRunner);

    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.onDelete).toBe('SET NULL');
    expect(query.mock.calls.some(([sql]) => sql.includes('MODIFY lead_id VARCHAR(36) NULL'))).toBe(true);
  });
});
