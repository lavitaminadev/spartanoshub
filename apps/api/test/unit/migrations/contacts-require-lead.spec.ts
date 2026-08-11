import { QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ContactsRequireLead1726200000000 } from '../../../src/infrastructure/migrations/0077-contacts-require-lead';

function createQueryRunner(orphans = 0, withForeignKey = true) {
  const existingForeignKey = new TableForeignKey({
    name: 'FK_existing_contact_lead',
    columnNames: ['lead_id'],
    referencedTableName: 'leads',
    referencedColumnNames: ['id'],
    onDelete: 'SET NULL',
  });
  const contactLeadColumn = new TableColumn({
    name: 'lead_id',
    type: 'varchar',
    length: '36',
    charset: 'latin1',
    collation: 'latin1_swedish_ci',
    isNullable: true,
    comment: 'Relacion con la persona',
  });
  const referencedLeadColumn = new TableColumn({
    name: 'id',
    type: 'char',
    length: '36',
    charset: 'ascii',
    collation: 'ascii_bin',
    isPrimary: true,
  });
  const contactsTable = new Table({ name: 'crm_contacts' });
  contactsTable.columns = [contactLeadColumn];
  contactsTable.foreignKeys = withForeignKey ? [existingForeignKey] : [];
  const leadsTable = new Table({ name: 'leads' });
  leadsTable.columns = [referencedLeadColumn];

  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('SELECT COUNT(*) AS orphans')) return Promise.resolve([{ orphans }]);
    return Promise.resolve(undefined);
  });
  const queryRunner = {
    hasTable: vi.fn().mockResolvedValue(true),
    getTable: vi.fn().mockImplementation((tableName: string) => Promise.resolve(
      tableName === 'crm_contacts' ? contactsTable : leadsTable,
    )),
    query,
    dropForeignKey: vi.fn().mockResolvedValue(undefined),
    changeColumn: vi.fn().mockResolvedValue(undefined),
    createForeignKey: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;

  return { queryRunner, existingForeignKey, contactLeadColumn, referencedLeadColumn };
}

describe('ContactsRequireLead1726200000000', () => {
  it('replaces SET NULL before making lead_id required', async () => {
    const { queryRunner, existingForeignKey, contactLeadColumn, referencedLeadColumn } = createQueryRunner();

    await new ContactsRequireLead1726200000000().up(queryRunner);

    expect(queryRunner.dropForeignKey).toHaveBeenCalledWith('crm_contacts', existingForeignKey);
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.name).toBe(existingForeignKey.name);
    expect(created.onDelete).toBe('RESTRICT');
    expect(created.columnNames).toEqual(['lead_id']);
    const [, previousColumn, requiredColumn] = vi.mocked(queryRunner.changeColumn).mock.calls[0];
    expect(previousColumn).toBe(contactLeadColumn);
    expect(requiredColumn).toMatchObject({
      name: 'lead_id',
      type: referencedLeadColumn.type,
      length: referencedLeadColumn.length,
      charset: referencedLeadColumn.charset,
      collation: referencedLeadColumn.collation,
      isNullable: false,
      comment: contactLeadColumn.comment,
    });
    expect(vi.mocked(queryRunner.dropForeignKey).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(queryRunner.changeColumn).mock.invocationCallOrder[0]);
  });

  it('does not alter constraints while orphan contacts remain', async () => {
    const { queryRunner } = createQueryRunner(2);

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('Quedan 2 contactos sin lead');
    expect(queryRunner.dropForeignKey).not.toHaveBeenCalled();
    expect(queryRunner.createForeignKey).not.toHaveBeenCalled();
  });

  it('restores SET NULL when the migration is reverted', async () => {
    const { queryRunner } = createQueryRunner();

    await new ContactsRequireLead1726200000000().down(queryRunner);

    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(created.onDelete).toBe('SET NULL');
    const nullableColumn = vi.mocked(queryRunner.changeColumn).mock.calls[0][2] as TableColumn;
    expect(nullableColumn.isNullable).toBe(true);
    expect(nullableColumn.collation).toBe('ascii_bin');
  });

  it('repairs a previous partial run that left lead_id without a foreign key', async () => {
    const { queryRunner } = createQueryRunner(0, false);

    await new ContactsRequireLead1726200000000().up(queryRunner);

    expect(queryRunner.dropForeignKey).not.toHaveBeenCalled();
    const requiredColumn = vi.mocked(queryRunner.changeColumn).mock.calls[0][2] as TableColumn;
    const created = vi.mocked(queryRunner.createForeignKey).mock.calls[0][1] as TableForeignKey;
    expect(requiredColumn).toMatchObject({
      type: 'char',
      charset: 'ascii',
      collation: 'ascii_bin',
      isNullable: false,
    });
    expect(created.name).toBe('FK_crm_contacts_lead');
    expect(created.onDelete).toBe('RESTRICT');
  });

  it('restores a compatible nullable column if recreating the foreign key fails', async () => {
    const { queryRunner } = createQueryRunner();
    vi.mocked(queryRunner.createForeignKey)
      .mockRejectedValueOnce(new Error('foreign key rejected'))
      .mockResolvedValueOnce(undefined);

    await expect(new ContactsRequireLead1726200000000().up(queryRunner))
      .rejects.toThrow('foreign key rejected');

    expect(queryRunner.changeColumn).toHaveBeenCalledTimes(2);
    const restoredColumn = vi.mocked(queryRunner.changeColumn).mock.calls[1][2] as TableColumn;
    const restoredForeignKey = vi.mocked(queryRunner.createForeignKey).mock.calls[1][1] as TableForeignKey;
    expect(restoredColumn).toMatchObject({ isNullable: true, collation: 'ascii_bin' });
    expect(restoredForeignKey.onDelete).toBe('SET NULL');
  });
});
