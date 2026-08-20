import {
  ValidationPipe as NestValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface FieldError { field: string; message: string }

/**
 * Aplana el árbol de errores hasta las hojas, nombrando cada campo por su ruta completa.
 *
 * `class-validator` deja las restricciones en el nivel donde fallan, no en la raíz: al validar
 * una lista de objetos, el error de la fila 40 cuelga de `rows[39].email` y la raíz `rows` no
 * trae ninguna. Leer solo la raíz devolvía «Validation failed» con el mensaje vacío, y quien
 * subía un archivo se quedaba sin saber qué corregir.
 */
function flatten(errors: ValidationError[], path = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = path ? `${path}.${error.property}` : error.property;
    const own = Object.values(error.constraints || {});
    const nested = error.children?.length ? flatten(error.children, field) : [];
    return [...own.map((message) => ({ field, message })), ...nested];
  });
}

export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (validationErrors: ValidationError[]) => {
        const errors = flatten(validationErrors);

        return new BadRequestException({
          message: 'Validation failed',
          errors,
        });
      },
    });
  }
}
