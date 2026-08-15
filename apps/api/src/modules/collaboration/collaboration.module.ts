import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessComment } from './process-comment.entity';
import { ProcessCommentsService } from './process-comments.service';
import { PieceCommentsController, SessionCommentsController, WorkRequestCommentsController } from './process-comments.controller';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProcessComment]), AuditModule],
  controllers: [PieceCommentsController, SessionCommentsController, WorkRequestCommentsController],
  providers: [ProcessCommentsService],
  exports: [ProcessCommentsService],
})
export class CollaborationModule {}
