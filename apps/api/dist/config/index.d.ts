export declare const config: {
    port: number;
    nodeEnv: string;
    corsOrigin: string;
    db: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    bcrypt: {
        rounds: number;
    };
    throttle: {
        ttl: number;
        limit: number;
    };
};
