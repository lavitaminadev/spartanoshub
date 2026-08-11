export declare class RequestPasswordResetDto {
    email: string;
}
export declare class CompletePasswordResetDto {
    token: string;
    password: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
