import { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
export declare class OrganizationContextMiddleware implements NestMiddleware {
    use(_req: Request, _res: Response, next: NextFunction): void;
}
