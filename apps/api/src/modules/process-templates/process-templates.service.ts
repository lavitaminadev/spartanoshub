import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessTemplate, type ProcessTemplateStep } from './process-template.entity';
import { PROCESS_TEMPLATE_DEFAULTS } from './process-template-defaults';
import { UpdateProcessTemplateDto } from './dto/update-process-template.dto';

@Injectable()
export class ProcessTemplatesService {
  constructor(@InjectRepository(ProcessTemplate) private readonly templates: Repository<ProcessTemplate>) {}

  async list(organizationId: string): Promise<ProcessTemplate[]> {
    await this.ensureDefaults(organizationId);
    return this.templates.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async getSteps(organizationId: string, code: string): Promise<ProcessTemplateStep[]> {
    await this.ensureDefaults(organizationId);
    const template = await this.templates.findOne({ where: { organizationId, code, isActive: true } });
    return template?.steps?.length ? template.steps : PROCESS_TEMPLATE_DEFAULTS[code]?.steps ?? [];
  }

  async update(id: string, organizationId: string, dto: UpdateProcessTemplateDto): Promise<ProcessTemplate> {
    const template = await this.templates.findOne({ where: { id, organizationId } });
    if (!template) throw new NotFoundException('Flujo no encontrado');
    if (dto.steps && (dto.steps.length < 1 || dto.steps.length > 40)) throw new BadRequestException('El flujo debe contener entre 1 y 40 etapas');
    if (dto.steps) {
      const keys = dto.steps.map((step) => step.key.trim().toLowerCase());
      if (new Set(keys).size !== keys.length) throw new BadRequestException('Las claves de las etapas deben ser únicas');
      template.steps = dto.steps.map((step) => ({ ...step, key: step.key.trim().toLowerCase(), label: step.label.trim() }));
    }
    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.description !== undefined) template.description = dto.description.trim() || undefined;
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    template.version += 1;
    return this.templates.save(template);
  }

  async reset(code: string, organizationId: string): Promise<ProcessTemplate> {
    const value = PROCESS_TEMPLATE_DEFAULTS[code];
    if (!value) throw new NotFoundException('No existe una plantilla base para este flujo');
    await this.ensureDefaults(organizationId);
    const template = await this.templates.findOneOrFail({ where: { organizationId, code } });
    Object.assign(template, value, { isActive: true, version: template.version + 1 });
    return this.templates.save(template);
  }

  private async ensureDefaults(organizationId: string): Promise<void> {
    const existing = new Set((await this.templates.find({ select: { code: true }, where: { organizationId } })).map((row) => row.code));
    const missing = Object.entries(PROCESS_TEMPLATE_DEFAULTS).filter(([code]) => !existing.has(code)).map(([code, value]) => this.templates.create({ organizationId, code, ...value }));
    if (missing.length) await this.templates.save(missing);
  }
}
