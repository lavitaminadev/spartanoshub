export declare class RegisterDeliveryDto {
    userId: string;
    pieceId: string;
    difficultyLevel: number;
    actualHours: number;
    expectedHours?: number;
    perfectNaming: boolean;
    hadDesignerErrorCorrection: boolean;
    delayJustification?: string;
}
