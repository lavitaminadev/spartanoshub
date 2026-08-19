import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PieceStatus } from '../../../src/modules/production/piece-status.enum';
import { CorrectionOrigin } from '../../../src/modules/production/correction-origin.enum';

const mockPieceRepo = {
  save: vi.fn(),
  manager: {
    transaction: vi.fn((cb: any) => cb({ save: vi.fn(), create: vi.fn(), findOne: vi.fn() })),
  },
};

const mockVersionRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockCorrectionRepo = {
};

const mockDesignBudget = {
  calculateForPiece: vi.fn().mockResolvedValue(1),
  reserveForPiece: vi.fn(),
  confirmConsumption: vi.fn(),
};

const mockXp = {
  registerDelivery: vi.fn(),
  registerDesignerErrorPenalty: vi.fn(),
};
const mockBilling = { createCorrectionCharge: vi.fn() };

/**
 * Regla de rondas incluidas. Devuelve cobrable a partir de la cuarta, que es el valor por
 * defecto configurado; la prueba lo fija acá para no depender de la configuración.
 */
const mockPieceRules = {
  shouldGenerateInvoice: vi.fn(async (count: number) => count > 3),
  maxCorrections: vi.fn(async () => 3),
  canRequestCorrection: vi.fn(async () => ({ allowed: true })),
};

import { ProductionWorkflowService } from '../../../src/modules/production/production-workflow.service';

describe('ProductionWorkflowService', () => {
  let service: ProductionWorkflowService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductionWorkflowService(
      mockPieceRepo as any,
      mockVersionRepo as any,
      mockCorrectionRepo as any,
      mockDesignBudget as any,
      mockXp as any,
      mockBilling as any,
      mockPieceRules as any,
      createProcessHistoryDouble(),
    );
  });

  describe('submitVersion', () => {
    it('should create a piece version and update status to INTERNAL_REVIEW', async () => {
      const piece = { id: 'piece-1', status: PieceStatus.ASSIGNED };
      mockVersionRepo.findOne.mockResolvedValue(null);
      mockVersionRepo.create.mockReturnValue({
        pieceId: 'piece-1', versionNumber: 1, fileName: 'file.pdf',
        driveFileId: 'drive-123', createdBy: 'user-1',
      });
      mockVersionRepo.save.mockResolvedValue({
        id: 'version-1', versionNumber: 1, fileName: 'file.pdf',
        driveFileId: 'drive-123',
      });
      mockPieceRepo.save.mockResolvedValue({ ...piece, status: PieceStatus.INTERNAL_REVIEW });

      const result = await service.submitVersion(piece as any, 'file.pdf', 'drive-123', 'user-1');

      expect(result.versionNumber).toBe(1);
      expect(mockPieceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PieceStatus.INTERNAL_REVIEW }),
      );
    });
  });

  describe('rejectByClient', () => {
    it('should create a correction and set status to CORRECTION', async () => {
      const piece = { id: 'piece-1', clientCorrectionCount: 0, correctionCount: 0, status: PieceStatus.INTERNAL_REVIEW };
      const version = { id: 'version-1' };

      const mockManager = {
        create: vi.fn().mockReturnValue({ id: 'corr-1' }),
        save: vi.fn().mockResolvedValue({}),
      };
      mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

      await service.rejectByClient(piece as any, version as any, 'Needs changes', 'client-1');

      expect(piece.clientCorrectionCount).toBe(1);
      expect(piece.correctionCount).toBe(1);
      expect(piece.status).toBe(PieceStatus.CORRECTION);
      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ origin: CorrectionOrigin.CLIENT_REQUEST, description: 'Needs changes' }),
      );
    });

    /**
     * La cuarta ronda se marca cobrable, pero **la nota no se emite al rechazar**.
     *
     * Emitirla acá la creaba antes de saber cómo terminaba el trabajo: si después resultaba
     * que la ronda fue por un error del equipo, quedaba una nota que alguien tenía que anular
     * a mano. Se emite al aprobar, en `settleBillableCorrections`.
     */
    it('marca cobrable la cuarta ronda del cliente, sin emitir la nota todavía', async () => {
      const piece = { id: 'piece-1', organizationId: 'org-1', clientId: 'client-1', clientCorrectionCount: 3, correctionCount: 3, status: PieceStatus.CLIENT_VALIDATION };
      const version = { id: 'version-1' };
      const mockManager = {
        create: vi.fn().mockReturnValue({ id: 'corr-4' }),
        save: vi.fn().mockResolvedValue({ id: 'corr-4' }),
      };
      mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

      await service.rejectByClient(piece as any, version as any, 'Nuevo cambio', 'client-user');

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ billableExtra: true, chargeNoteRequired: true }),
      );
      expect(mockBilling.createCorrectionCharge).not.toHaveBeenCalled();
    });

    it('no marca cobrables las rondas incluidas', async () => {
      const piece = { id: 'piece-1', organizationId: 'org-1', clientId: 'client-1', clientCorrectionCount: 0, correctionCount: 0, status: PieceStatus.CLIENT_VALIDATION };
      const mockManager = {
        create: vi.fn().mockReturnValue({ id: 'corr-1' }),
        save: vi.fn().mockResolvedValue({ id: 'corr-1' }),
      };
      mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

      await service.rejectByClient(piece as any, { id: 'version-1' } as any, 'Primer cambio', 'client-user');

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ billableExtra: false, chargeNoteRequired: false }),
      );
    });
  });

  describe('settleBillableCorrections', () => {
    const piece = { id: 'piece-1', organizationId: 'org-1', clientId: 'client-1' } as never;

    it('emite una nota por cada ronda cobrable al aprobar', async () => {
      const manager = {
        find: vi.fn().mockResolvedValue([{ id: 'corr-4' }, { id: 'corr-5' }]),
        query: vi.fn().mockResolvedValue([]),
      };

      const emitidas = await service.settleBillableCorrections(piece, 'user-1', manager as never);

      expect(emitidas).toBe(2);
      expect(mockBilling.createCorrectionCharge).toHaveBeenCalledTimes(2);
    });

    /**
     * Aprobar dos veces, o reintentar tras un fallo parcial, no puede cobrar de nuevo: la nota
     * ya emitida es dinero que el cliente ya debe.
     */
    it('no vuelve a cobrar lo que ya tiene nota', async () => {
      const manager = {
        find: vi.fn().mockResolvedValue([{ id: 'corr-4' }, { id: 'corr-5' }]),
        query: vi.fn().mockResolvedValue([{ correction_id: 'corr-4' }]),
      };

      const emitidas = await service.settleBillableCorrections(piece, 'user-1', manager as never);

      expect(emitidas).toBe(1);
      expect(mockBilling.createCorrectionCharge).toHaveBeenCalledWith(
        expect.objectContaining({ correctionId: 'corr-5' }),
        manager,
      );
    });

    it('no consulta cobros si no hay nada cobrable', async () => {
      const manager = { find: vi.fn().mockResolvedValue([]), query: vi.fn() };

      const emitidas = await service.settleBillableCorrections(piece, 'user-1', manager as never);

      expect(emitidas).toBe(0);
      expect(manager.query).not.toHaveBeenCalled();
      expect(mockBilling.createCorrectionCharge).not.toHaveBeenCalled();
    });
  });

  describe('flagDesignerError', () => {
    it('should create a designer error correction and register penalty', async () => {
      const piece = { id: 'piece-1', correctionCount: 0, assignedTo: 'designer-1' };
      const version = { id: 'version-1' };

      const mockManager = {
        create: vi.fn().mockReturnValue({}),
        save: vi.fn().mockResolvedValue({}),
      };
      mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

      await service.flagDesignerError(piece as any, version as any, 'Wrong format', 'ad-1');

      expect(piece.correctionCount).toBe(1);
      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ origin: CorrectionOrigin.DESIGNER_ERROR, description: 'Wrong format' }),
      );
      expect(mockXp.registerDesignerErrorPenalty).toHaveBeenCalledWith(piece, 'designer-1', mockManager);
    });
  });
});
