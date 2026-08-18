import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Automation } from './automation.entity';
import { AutomationRun } from './automation-run.entity';
import { AutomationRunStep } from './automation-run-step.entity';
import { User } from '../users/user.entity';
import { assertValidGraph } from './automation-graph';
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, findTrigger } from './automation-catalog';
import type { SaveAutomationDto } from './dto/save-automation.dto';

/** Administración de automatizaciones: crear, editar, activar y consultar sus ejecuciones. */
@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
    @InjectRepository(AutomationRun) private readonly runs: Repository<AutomationRun>,
    @InjectRepository(AutomationRunStep) private readonly steps: Repository<AutomationRunStep>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Catálogo con el que el editor construye su paleta de nodos. */
  catalog() {
    return { triggers: AUTOMATION_TRIGGERS, actions: AUTOMATION_ACTIONS };
  }

  list(organizationId: string) {
    return this.automations.find({ where: { organizationId }, order: { updatedAt: 'DESC' } });
  }

  async get(id: string, organizationId: string): Promise<Automation> {
    const automation = await this.automations.findOne({ where: { id, organizationId } });
    if (!automation) throw new NotFoundException('Automatización no encontrada');
    return automation;
  }

  /**
   * Crea una automatización.
   *
   * Nace **desactivada** siempre, aunque el DTO pida lo contrario. Guardar y empezar a actuar
   * en el mismo gesto no da ocasión de revisar el flujo antes de que toque datos reales;
   * activarla es una decisión aparte y explícita.
   */
  async create(organizationId: string, dto: SaveAutomationDto, createdBy: string): Promise<Automation> {
    this.assertTrigger(dto.triggerType);
    assertValidGraph(dto.graph);
    await this.assertRunAsUser(organizationId, dto.runAsUserId);

    return this.automations.save(this.automations.create({
      organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      triggerType: dto.triggerType,
      graph: dto.graph,
      runAsUserId: dto.runAsUserId,
      isActive: false,
      version: 1,
      createdBy,
    }));
  }

  /**
   * Actualiza una automatización.
   *
   * La versión sube en cada guardado del grafo: las ejecuciones en curso siguen con la que
   * tenían, de modo que editar no altera lo que ya iba en camino.
   */
  async update(id: string, organizationId: string, dto: SaveAutomationDto): Promise<Automation> {
    const automation = await this.get(id, organizationId);
    this.assertTrigger(dto.triggerType);
    assertValidGraph(dto.graph);
    await this.assertRunAsUser(organizationId, dto.runAsUserId);

    automation.name = dto.name.trim();
    automation.description = dto.description?.trim() || null;
    automation.triggerType = dto.triggerType;
    automation.graph = dto.graph;
    automation.runAsUserId = dto.runAsUserId;
    automation.version += 1;
    return this.automations.save(automation);
  }

  /** Enciende o apaga la automatización sin tocar su definición. */
  async setActive(id: string, organizationId: string, isActive: boolean): Promise<Automation> {
    const automation = await this.get(id, organizationId);
    // Se revalida al encender: el catálogo pudo cambiar desde que se guardó y una acción que
    // ya no existe debe impedir la activación, no fallar en la primera ejecución real.
    if (isActive) assertValidGraph(automation.graph);
    automation.isActive = isActive;
    return this.automations.save(automation);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const automation = await this.get(id, organizationId);
    await this.automations.remove(automation);
  }

  /** Ejecuciones recientes, para diagnosticar desde la aplicación. */
  listRuns(id: string, organizationId: string, limit = 50) {
    return this.runs.find({
      where: { automationId: id, organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Pasos de una ejecución, en orden, con su entrada, su salida y su error. */
  async runDetail(runId: string, organizationId: string) {
    const run = await this.runs.findOne({ where: { id: runId, organizationId } });
    if (!run) throw new NotFoundException('Ejecución no encontrada');
    const steps = await this.steps.find({ where: { runId }, order: { createdAt: 'ASC' } });
    return { run, steps };
  }

  private assertTrigger(triggerType: string): void {
    if (!findTrigger(triggerType)) {
      throw new BadRequestException(`El disparador "${triggerType}" no existe`);
    }
  }

  /**
   * Verifica la identidad con la que actuará la automatización.
   *
   * Debe ser una persona activa de la organización. Una automatización que escribe con una
   * identidad inexistente deja efectos sin responsable en la bitácora, y una que apunta a
   * alguien dado de baja seguiría actuando con permisos que ya se revocaron.
   */
  private async assertRunAsUser(organizationId: string, runAsUserId: string): Promise<void> {
    const user = await this.users.findOne({
      where: { id: runAsUserId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('La identidad de ejecución debe ser una persona activa de la organización');
  }
}
