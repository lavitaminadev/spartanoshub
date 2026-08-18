import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalRequestStatus, OPEN_STATUSES, PendingKind } from './approval-request-status.enum';
import { User } from '../users/user.entity';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

/**
 * Registros a los que se le puede colgar una tarea.
 *
 * Cerrado a propósito: una tarea que apunta a un tipo que nadie sabe mostrar queda invisible
 * para siempre. Abrirlo a un registro nuevo es agregarlo acá y darle dónde verse.
 */
export const TASK_ENTITY_TYPES = ['lead', 'opportunity', 'piece', 'session', 'work_request'] as const;
export type TaskEntityType = (typeof TASK_ENTITY_TYPES)[number];

/**
 * Tareas: pendientes con dueño y fecha, sobre cualquier registro del sistema.
 *
 * Comparten tabla con las aprobaciones porque comparten forma. Lo que las distingue es el
 * `kind` y cómo se cierran: una aprobación la decide el cliente, una tarea la completa quien
 * la tiene asignada.
 *
 * Todas las consultas de acá filtran por `kind` para no mezclar: la bandeja de aprobaciones no
 * debe llenarse de tareas internas ni al revés.
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(ApprovalRequest) private readonly repo: Repository<ApprovalRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Abre una tarea sobre un registro.
   *
   * @param requestedBy - Quien la crea. Queda registrado aunque se la asigne a otra persona.
   */
  async create(organizationId: string, requestedBy: string, dto: CreateTaskDto): Promise<ApprovalRequest> {
    if (!TASK_ENTITY_TYPES.includes(dto.entityType as TaskEntityType)) {
      throw new BadRequestException(`No se pueden crear tareas sobre un registro de tipo "${dto.entityType}"`);
    }
    if (dto.assignedTo) await this.assertActiveUser(organizationId, dto.assignedTo);

    return this.repo.save(this.repo.create({
      organizationId,
      kind: PendingKind.TASK,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
      entityType: dto.entityType,
      entityId: dto.entityId,
      clientId: dto.clientId,
      assignedTo: dto.assignedTo,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      requestedBy,
      status: ApprovalRequestStatus.PENDING,
    }));
  }

  /** Tareas de un registro, lo abierto primero y dentro de eso lo más vencido antes. */
  async listForEntity(organizationId: string, entityType: string, entityId: string): Promise<ApprovalRequest[]> {
    const tasks = await this.repo.find({
      where: { organizationId, kind: PendingKind.TASK, entityType, entityId },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
      take: 100,
    });

    // El orden final se resuelve acá y no en SQL: «abiertas primero» no es una columna, y
    // ordenarlo en base exigiría un CASE que oscurece la consulta para ahorrar microsegundos
    // sobre cien filas.
    return [
      ...tasks.filter((task) => this.isOpen(task)),
      ...tasks.filter((task) => !this.isOpen(task)),
    ];
  }

  /** Lo que una persona tiene pendiente, lo más vencido primero. */
  listMine(organizationId: string, userId: string, limit = 50): Promise<ApprovalRequest[]> {
    return this.repo.find({
      where: {
        organizationId,
        kind: PendingKind.TASK,
        assignedTo: userId,
        status: In([...OPEN_STATUSES]),
      },
      order: { dueAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Actualiza una tarea: se completa, se cancela o se reasigna.
   *
   * `approved` y `rejected` no se aceptan: son la decisión de una aprobación y usarlos acá
   * dejaría tareas en un estado que ninguna pantalla de tareas sabe mostrar.
   */
  async update(organizationId: string, id: string, dto: UpdateTaskDto): Promise<ApprovalRequest> {
    const task = await this.repo.findOne({ where: { id, organizationId, kind: PendingKind.TASK } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    if (dto.status) {
      const permitidos: ApprovalRequestStatus[] = [
        ApprovalRequestStatus.PENDING,
        ApprovalRequestStatus.DONE,
        ApprovalRequestStatus.CANCELLED,
      ];
      if (!permitidos.includes(dto.status)) {
        throw new BadRequestException('Una tarea se completa o se cancela; aprobar y rechazar son de una aprobación');
      }
      task.status = dto.status;
      // Se registra cuándo se cerró. Reabrirla lo limpia: si vuelve a estar pendiente, la
      // fecha de cierre anterior describe algo que ya no es cierto.
      task.decisionAt = dto.status === ApprovalRequestStatus.PENDING ? undefined : new Date();
    }

    if (dto.assignedTo !== undefined) {
      if (dto.assignedTo) await this.assertActiveUser(organizationId, dto.assignedTo);
      task.assignedTo = dto.assignedTo || undefined;
    }
    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description?.trim() || undefined;
    if (dto.dueAt !== undefined) task.dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dto.decisionNotes !== undefined) task.decisionNotes = dto.decisionNotes?.trim() || undefined;

    return this.repo.save(task);
  }

  /** Tareas vencidas y sin cerrar. Lo consume el disparador de automatizaciones. */
  findOverdue(limit: number): Promise<ApprovalRequest[]> {
    return this.repo.find({
      where: {
        kind: PendingKind.TASK,
        status: In([...OPEN_STATUSES]),
        dueAt: LessThan(new Date()),
        assignedTo: Not(IsNull()),
      },
      order: { dueAt: 'ASC' },
      take: limit,
    });
  }

  private isOpen(task: ApprovalRequest): boolean {
    return (OPEN_STATUSES as readonly string[]).includes(task.status);
  }

  /**
   * Asignar a alguien dado de baja deja el trabajo en manos de nadie y no avisa a nadie, así
   * que se comprueba antes de guardar.
   */
  private async assertActiveUser(organizationId: string, userId: string): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('La persona indicada no está activa');
  }
}
