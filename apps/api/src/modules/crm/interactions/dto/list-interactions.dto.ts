import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ListInteractionsDto extends PaginationDto {
  /**
   * Sube el tope de 100 a 500, solo para este listado.
   *
   * El calendario dibuja hasta seis semanas de una vez y pide exactamente el período visible.
   * Con el tope general, un mes con más de cien actividades se dibujaba incompleto sin decirlo
   * —y eso es justo lo que se venía a corregir—; peor aún, pedir más de cien devolvía 400 y la
   * pantalla entera dejaba de cargar.
   *
   * Subirlo aquí no abre una descarga sin límite: `from`/`to` acotan la consulta a lo que cabe en
   * la cuadrícula, y el alcance por empresa sigue aplicándose antes.
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) declare limit?: number;
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
