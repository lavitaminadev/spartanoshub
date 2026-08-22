/**
 * @fileoverview Entorno de las pruebas de extremo a extremo.
 *
 * Se ejecuta antes que nada. Carga el `.env` del repositorio —sin él, la aplicación cae a sus
 * valores por defecto y falla al conectar con un usuario que no existe— y **fuerza la base de
 * pruebas**, que es la única salvaguarda real: estas pruebas vacían tablas, y apuntarlas por
 * descuido a la base de desarrollo borraría el trabajo de alguien.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../../../.env') });

/** Base dedicada. Se sobrescribe siempre, aunque el `.env` diga otra cosa. */
process.env.DB_DATABASE = process.env.E2E_DB_DATABASE || 'espartanos_test';
process.env.NODE_ENV = 'test';
// Las consultas de ochenta y siete tablas ahogan la salida y esconden el fallo que interesa.
process.env.DB_LOGGING = 'false';
/*
 * El banco abre una sesión por cada cuenta del escenario, seguidas.
 *
 * El límite real de acceso es de cinco por minuto y por origen, que es lo correcto contra un
 * probador de contraseñas y lo que se conserva en producción. Acá todas las peticiones vienen de
 * la misma máquina, así que con el valor real la sexta cuenta no llegaría ni a entrar.
 */
process.env.AUTH_THROTTLE_LIMIT = '500';
/*
 * Grupo de conexiones pequeño.
 *
 * Cada fichero de pruebas levanta su propia API, y todas comparten el mismo servidor de base de
 * datos junto con la de desarrollo. Con el tamaño de producción se agotan las conexiones y la
 * aplicación responde 503 a todo sin que nada esté mal.
 */
process.env.DB_CONNECTION_LIMIT = '3';
