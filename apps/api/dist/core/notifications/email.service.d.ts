export declare class EmailService {
    private readonly logger;
    private readonly transporter?;
    private readonly from;
    private readonly replyTo?;
    constructor();
    send(to: string, subject: string, html: string): Promise<boolean>;
    sendCollectionEmail(clientName: string, clientEmail: string, invoiceNumber: string, amount: number, dueDate: string): Promise<boolean>;
    sendUdBudgetAlert(clientName: string, clientEmail: string, used: number, total: number): Promise<boolean>;
    sendPieceStuckAlert(designerEmail: string, pieceTitle: string, hoursStuck: number): Promise<boolean>;
    sendTemporaryPassword(name: string, recipient: string, password: string, loginUrl: string): Promise<boolean>;
    sendPasswordReset(name: string, recipient: string, resetUrl: string): Promise<boolean>;
}
