import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessTemplate } from './process-template.entity';
import { ProcessTemplatesController } from './process-templates.controller';
import { ProcessTemplatesService } from './process-templates.service';

@Module({ imports: [TypeOrmModule.forFeature([ProcessTemplate])], controllers: [ProcessTemplatesController], providers: [ProcessTemplatesService], exports: [ProcessTemplatesService] })
export class ProcessTemplatesModule {}
