export declare function retryOnDeadlock<T>(operation: string, work: () => Promise<T>, attempts?: number): Promise<T>;
