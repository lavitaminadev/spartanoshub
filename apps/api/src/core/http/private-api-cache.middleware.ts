import type { NextFunction, Request, Response } from 'express';

/**
 * Impide que Apache, Passenger, un proxy o el navegador reutilicen respuestas de la API entre
 * personas. La URL no identifica al inquilino: dos empresas consultan `/api/auth/me` o
 * `/api/crm/leads`, y la identidad viaja en Authorization/cookie. Cachear solo por URL puede
 * entregar a una empresa la respuesta de la anterior.
 */
export function privateApiCacheMiddleware(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.vary('Authorization');
  response.vary('Cookie');
  next();
}
