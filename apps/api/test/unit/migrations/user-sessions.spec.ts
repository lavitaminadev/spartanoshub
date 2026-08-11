import { QueryRunner, Table } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { UserSessions1726300000000 } from '../../../src/infrastructure/migrations/0078-user-sessions';

function createQueryRunner(tableExists = false) {
  return {
    hasTable: vi.fn().mockResolvedValue(tableExists),
    createTable: vi.fn().mockResolvedValue(undefined),
    createIndex: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryRunner;
}

describe('UserSessions1726300000000', () => {
  it('uses native UUID columns for the session and its referenced identities', async () => {
    const queryRunner = createQueryRunner();

    await new UserSessions1726300000000().up(queryRunner);

    const table = vi.mocked(queryRunner.createTable).mock.calls[0][0] as Table;
    expect(table.findColumnByName('id')).toMatchObject({
      type: 'uuid',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'uuid',
    });
    expect(table.findColumnByName('user_id')).toMatchObject({ type: 'uuid' });
    expect(table.findColumnByName('organization_id')).toMatchObject({ type: 'uuid' });
    expect(table.foreignKeys[0]).toMatchObject({
      columnNames: ['user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
  });

  it('does not recreate an existing sessions table', async () => {
    const queryRunner = createQueryRunner(true);

    await new UserSessions1726300000000().up(queryRunner);

    expect(queryRunner.createTable).not.toHaveBeenCalled();
    expect(queryRunner.createIndex).not.toHaveBeenCalled();
  });
});
