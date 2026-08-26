import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ListInteractionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /**
   * Rango de fechas de la actividad, no de cuándo se registró.
   *
   * El calendario lo necesita para poder mirar un mes concreto. Sin él solo podía pedir «las
   * últimas N» ordenadas por fecha descendente, y eso rompía la pantalla de dos formas: al
   * retroceder a un mes anterior no venía ninguna actividad de ese mes —porque las más
   * recientes agotaban el cupo— y un mes con más actividades que el límite se dibujaba
   * incompleto sin decirlo. Las dos se leen igual: «no hay nada agendado».
   *
   * Son extremos inclusivos y se comparan contra `interaction.date`.
   */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
