import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CommentVisibility } from '../process-comment.entity';

export class AddCommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;

  /** Interno por defecto: la anotación de trabajo es el caso común y el que no puede filtrarse. */
  @IsOptional() @IsEnum(CommentVisibility) visibility?: CommentVisibility;
}

export class EditCommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;
}
