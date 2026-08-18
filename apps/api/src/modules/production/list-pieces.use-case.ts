import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceRulesService } from './piece-rules.service';
import { PieceStatus } from './piece-status.enum';

@Injectable()
export class ListPiecesUseCase {
  constructor(
    @InjectRepository(Piece) private repo: Repository<Piece>,
    private readonly pieceRules: PieceRulesService,
  ) {}

  async execute(
    organizationId: string,
    status?: PieceStatus,
    clientId?: string,
    assignedTo?: string,
    clientIds?: string[],
    page: number = 1,
    limit: number = 300,
  ) {
    const where: FindOptionsWhere<Piece> = { organizationId } as FindOptionsWhere<Piece>;
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (!clientId && clientIds !== undefined) where.clientId = In(clientIds);
    if (assignedTo) where.assignedTo = assignedTo;

    const pieces = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['client'],
      skip: (page - 1) * limit,
      take: limit,
    });

    // El límite se resuelve una vez para todo el lote: es configuración, no depende de la
    // pieza, y consultarlo por fila serían tantas lecturas como piezas tenga la página.
    const maxCorrections = await this.pieceRules.maxCorrections(organizationId);

    return pieces.map((piece) => ({
      id: piece.id,
      title: piece.title,
      type: piece.type,
      status: piece.status,
      udAmount: Number(piece.udAmount ?? 0),
      correctionCount: piece.correctionCount,
      clientCorrectionCount: piece.clientCorrectionCount,
      // Antes comparaba contra un 3 escrito acá, así que subir el límite configurado dejaba
      // esta pantalla marcando como cobrable lo que la aprobación consideraba incluido.
      chargeNoteRequired: piece.clientCorrectionCount > maxCorrections,
      maxCorrections,
      clientName: piece.client?.name || 'Sin cliente',
      assignedTo: piece.assignedTo,
      dueDate: piece.deadlineAt?.toISOString(),
      dependencyIds: piece.dependencyIds ?? [],
      createdAt: piece.createdAt.toISOString(),
      assignedAt: piece.assignedAt?.toISOString(),
      difficultyLevel: piece.difficultyLevel,
    }));
  }
}
