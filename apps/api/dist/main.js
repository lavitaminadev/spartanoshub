"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/load-environment");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const common_1 = require("@nestjs/common");
const environment_1 = require("./config/environment");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    (0, environment_1.validateEnvironment)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0));
    if (trustProxyHops > 0) {
        app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
    }
    app.use((0, compression_1.default)());
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://graph.facebook.com", "https://www.googleapis.com", "https://oauth2.googleapis.com"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    const allowedOrigins = (0, environment_1.parseCorsOrigins)();
    app.enableCors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin.replace(/\/$/, '')))
                return callback(null, true);
            return callback(new Error('Origin not allowed by CORS'), false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
        maxAge: 86400,
    });
    app.setGlobalPrefix('api');
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('VITAHUB API')
        .setDescription('Sistema de Gestión de Agencia - API REST')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    app.enableShutdownHooks();
    await app.listen(process.env.PORT || 3000);
    logger.log(`VITAHUB API running on port ${process.env.PORT || 3000}`);
}
bootstrap().catch((error) => {
    const logger = new common_1.Logger('Bootstrap');
    logger.error(`Fallo al iniciar la aplicacion: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
//# sourceMappingURL=main.js.map