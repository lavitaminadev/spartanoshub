import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UpdateApprovalStatusUseCase } from '../../../src/modules/approvals/update-approval-status.use-case';
import { ApprovalRequest } from '../../../src/modules/approvals/approval-request.entity';
import { ApprovalRequestStatus } from '../../../src/modules/approvals/approval-request-status.enum';
import { Piece } from '../../../src/modules/production/piece.entity';
import { PieceStatus } from '../../../src/modules/production/piece-status.enum';
import { PieceVersion } from '../../../src/modules/production/piece-version.entity';
import { Correction } from '../../../src/modules/production/correction.entity';
import { PieceRulesService } from '../../../src/modules/production/piece-rules.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('UpdateApprovalStatusUseCase', () => {
  const events = { emit: vi.fn() };
  let manager: any;
  let service: UpdateApprovalStatusUseCase;
  let workflow: { settleBillableCorrections: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = { findOne: vi.fn(), create: vi.fn((_target, value) => value), save: vi.fn(async (_target, value) => value) };
    const repo = { manager: { transaction: vi.fn((callback) => callback(manager)) } };
    // La liquidación de rondas cobrables vive en el flujo de producción; acá solo interesa que
    // se invoque al aprobar y no al rechazar.
    workflow = { settleBillableCorrections: vi.fn().mockResolvedValue(0) };
    service = new UpdateApprovalStatusUseCase(repo as any, new PieceRulesService(), workflow as any, events as any);
  });

  it('records the fourth client rejection as a billable correction', async () => {
    const approval = { id: 'approval-1', organizationId: 'org-1', clientId: 'client-1', entityType: 'piece', entityId: 'piece-1', status: ApprovalRequestStatus.PENDING };
    const piece = { id: 'piece-1', organizationId: 'org-1', clientId: 'client-1', status: PieceStatus.CLIENT_VALIDATION, correctionCount: 3, clientCorrectionCount: 3 };
    manager.findOne.mockImplementation(async (target: unknown) => {
      if (target === ApprovalRequest) return approval;
      if (target === Piece) return piece;
      if (target === PieceVersion) return { id: 'version-4', pieceId: 'piece-1', versionNumber: 4 };
      return null;
    });
    manager.save.mockImplementation(async (target: unknown, value: any) => target === Correction ? { id: 'correction-4', ...value } : value);

    await service.execute('approval-1', 'org-1', { userId: 'client-user', role: UserRole.CLIENT, clientId: 'client-1' }, ApprovalRequestStatus.REJECTED, 'Ajustar llamado a la acción');

    expect(piece.status).toBe(PieceStatus.CORRECTION);
    expect(piece.clientCorrectionCount).toBe(4);
    expect(manager.create).toHaveBeenCalledWith(Correction, expect.objectContaining({ billableExtra: true, chargeNoteRequired: true }));
    expect(events.emit).toHaveBeenCalledWith('piece.rejected', expect.objectContaining({ correctionId: 'correction-4' }));
    // La ronda queda marcada, pero la nota no se emite todavía: eso ocurre al aprobar.
    expect(workflow.settleBillableCorrections).not.toHaveBeenCalled();
  });

  /**
   * Aprobar es el momento en que se cobra, y no el rechazo.
   *
   * Emitir la nota en cada rechazo la creaba antes de saber cómo terminaba el trabajo: si
   * después resultaba que la ronda fue por un error del equipo, quedaba una nota emitida que
   * alguien tenía que anular a mano.
   */
  it('liquida las rondas cobrables al aprobar', async () => {
    const approval = { id: 'approval-1', organizationId: 'org-1', clientId: 'client-1', entityType: 'piece', entityId: 'piece-1', status: ApprovalRequestStatus.PENDING };
    const piece = { id: 'piece-1', organizationId: 'org-1', clientId: 'client-1', status: PieceStatus.CLIENT_VALIDATION, correctionCount: 4, clientCorrectionCount: 4 };
    manager.findOne.mockImplementation(async (target: unknown) => {
      if (target === ApprovalRequest) return approval;
      if (target === Piece) return piece;
      return null;
    });

    await service.execute('approval-1', 'org-1', { userId: 'client-user', role: UserRole.CLIENT, clientId: 'client-1' }, ApprovalRequestStatus.APPROVED);

    expect(piece.status).toBe(PieceStatus.APPROVED);
    expect(workflow.settleBillableCorrections).toHaveBeenCalledWith(piece, 'client-user', manager);
  });

  it('hides an approval that belongs to another client', async () => {
    manager.findOne.mockResolvedValue({ id: 'approval-1', organizationId: 'org-1', clientId: 'client-2', status: ApprovalRequestStatus.PENDING });

    await expect(service.execute('approval-1', 'org-1', { userId: 'client-user', role: UserRole.CLIENT, clientId: 'client-1' }, ApprovalRequestStatus.APPROVED)).rejects.toThrow(NotFoundException);
  });
});
