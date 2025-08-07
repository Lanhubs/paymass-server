export declare class EncryptionService {
    private static readonly SECRET_KEY;
    private static readonly PASSWORD_SECRET;
    static encrypt(text: string): string;
    static decrypt(encryptedText: string): string;
    static generateSecureRandom(length?: number): string;
    /**
     * Hash password using crypto-js with salt
     */
    static hashPassword(password: string): string;
    /**
     * Verify password against hash using crypto-js
     */
    static verifyPassword(password: string, hashedPassword: string): boolean;
}
//# sourceMappingURL=encryption.d.ts.map