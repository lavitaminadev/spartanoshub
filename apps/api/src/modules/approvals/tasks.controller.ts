import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@shared/types/request';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

/**
 * Tareas: pendientes con dueño y fecha sobre cualquier registro.
 *
 * No lleva `@Roles`: una tarea es trabajo asignado, y cualquier cargo interno puede tener una,
 * abrirla o cerrarla. Lo que sí acota es el módulo —quien no alcanza el CRM no ve tareas de un
 * prospecto— y el alcance por cuenta que ya aplica cada pantalla.
 *
 * Va bajo `/tasks` y no bajo `/approvals` aunque compartan tabla: son dos bandejas distintas
 * para dos públicos distintos, y mezclarlas llenaría la del cliente de trabajo interno.
 */
@ApiTags('Tareas')
@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Lo que tengo pendiente, lo más vencido primero' })
  mine(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.tasks.listMine(req.organizationId, req.user.id, limit ? Number(limit) : undefined);
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Tareas de un registro' })
  forEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasks.listForEntity(req.organizationId, entityType, entityId);
  }

  @Post()
  @ApiOperation({ summary: 'Abrir una tarea sobre un registro' })
  create(@Body() dto: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    return this.tasks.create(req.organizationId, req.user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Completar, cancelar o reasignar una tarea' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: AuthenticatedRequest) {
    return this.tasks.update(req.organizationId, id, dto);
  }
}
