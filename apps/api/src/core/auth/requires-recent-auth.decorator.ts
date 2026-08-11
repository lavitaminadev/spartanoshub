import { SetMetadata } from '@nestjs/common';

export const REQUIRES_RECENT_AUTH_KEY = 'requiresRecentAuth';

/**
 * Exige haber confirmado la contraseña hace poco para ejecutar este endpoint.
 *
 * Marca las operaciones cuyo daño no se deshace pidiendo perdón: borrar una cuenta, cambiarle
 * el cargo a alguien, tocar las credenciales de una integración. Un computador desbloqueado y
 * desatendido alcanza para todas ellas si lo único que se pide es una sesión abierta.
 *
 * No sustituye al permiso: se comprueba **además** del cargo y del módulo. Quien no puede hacer
 * la operación sigue sin poder hacerla por mucho que confirme su contraseña.
 *
 * El cliente recibe un 403 con `reauthRequired: true` para poder pedir la contraseña y
 * reintentar, en vez de mostrar un error genérico que no dice qué hacer.
 *
 * @param reason - Qué se está protegiendo. Aparece en el mensaje, para que la persona entienda
 * por qué se le pide la contraseña justo ahí.
 */
export const RequiresRecentAuth = (reason: string) => SetMetadata(REQUIRES_RECENT_AUTH_KEY, reason);
