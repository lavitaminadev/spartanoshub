import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProcessCommentsService } from './process-comments.service';
import { CommentSubject, CommentVisibility } from './process-comment.entity';
import { AddCommentDto, EditCommentDto } from './dto/process-comment.dto';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

/**
 * Hilo de trabajo, compartido por las tres áreas.
 *
 * La lógica es una sola —permisos, edición, retención— pero cada área expone la suya bajo su
 * propio módulo. Eso es lo que hace que apagar Audiovisual esconda sus hilos sin tocar los de
 * Arte, y que el acceso a los comentarios de un área se conceda con el permiso de esa área y no
 * con uno transversal que abriría las tres de una vez.
 *
 * El hilo cuelga del trabajo, no existe suelto: se abre desde el detalle de esa pieza o esa
 * sesión. No hay un muro general donde se mezclen los de todos los trabajos.
 */
abstract class BaseCommentsController {
  protected abstract readonly subject: CommentSubject;

  constructor(protected readonly service: ProcessCommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Hilo del trabajo, con proceso y revision en secciones separadas' })
  thread(@Param('subjectId') subjectId: string, @Req() req: AuthenticatedRequest) {
    return this.service.thread(req.organizationId, this.subject, subjectId, { role: req.user.role as UserRole });
  }

  @Post()
  @ApiOperation({ summary: 'Agregar un comentario al hilo del trabajo' })
  add(@Param('subjectId') subjectId: string, @Body() dto: AddCommentDto, @Req() req: AuthenticatedRequest) {
    return this.service.add(
      req.organizationId, this.subject, subjectId, dto.body,
      dto.visibility ?? CommentVisibility.INTERNAL,
      { id: req.user.id, role: req.user.role as UserRole, name: req.user.name },
    );
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Corregir un comentario propio' })
  edit(@Param('commentId') commentId: string, @Body() dto: EditCommentDto, @Req() req: AuthenticatedRequest) {
    return this.service.edit(req.organizationId, commentId, dto.body, {
      id: req.user.id, role: req.user.role as UserRole, name: req.user.name,
    });
  }
}

@ApiTags('Produccion')
@Controller('production/pieces/:subjectId/comments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('production')
export class PieceCommentsController extends BaseCommentsController {
  protected readonly subject = CommentSubject.PIECE;
  constructor(service: ProcessCommentsService) { super(service); }
}

@ApiTags('Audiovisual')
@Controller('audiovisual/sessions/:subjectId/comments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('audiovisual')
export class SessionCommentsController extends BaseCommentsController {
  protected readonly subject = CommentSubject.SESSION;
  constructor(service: ProcessCommentsService) { super(service); }
}

@ApiTags('Intake')
@Controller('intake/requests/:subjectId/comments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('operations')
export class WorkRequestCommentsController extends BaseCommentsController {
  protected readonly subject = CommentSubject.WORK_REQUEST;
  constructor(service: ProcessCommentsService) { super(service); }
}

/**
 * Hilos del embudo comercial.
 *
 * Quedan bajo `ModuleScope('crm')` y no bajo el de producción: quién puede leer lo que se
 * dijo de un prospecto se decide con el permiso del CRM, igual que las tres áreas deciden el
 * suyo con el propio. Apagar el CRM esconde estos hilos sin tocar los de Arte.
 */
@ApiTags('CRM')
@Controller('crm/leads/:subjectId/comments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class LeadCommentsController extends BaseCommentsController {
  protected readonly subject = CommentSubject.LEAD;
  constructor(service: ProcessCommentsService) { super(service); }
}

@ApiTags('CRM')
@Controller('crm/opportunities/:subjectId/comments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class OpportunityCommentsController extends BaseCommentsController {
  protected readonly subject = CommentSubject.OPPORTUNITY;
  constructor(service: ProcessCommentsService) { super(service); }
}
