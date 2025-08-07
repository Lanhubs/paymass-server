import CryptoJS from 'crypto-js';
export class EncryptionService {
    static SECRET_KEY = process.env.ENCRYPTION_SECRET || 'default-secret-key';
    static PASSWORD_SECRET = process.env.PASSWORD_SECRET || 'password-secret-key';
    static encrypt(text) {
        return CryptoJS.AES.encrypt(text, this.SECRET_KEY).toString();
    }
    static decrypt(encryptedText) {
        const bytes = CryptoJS.AES.decrypt(encryptedText, this.SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
    static generateSecureRandom(length = 32) {
        return CryptoJS.lib.WordArray.random(length).toString();
    }
    /**
     * Hash password using crypto-js with salt
     */
    static hashPassword(password) {
        // Generate a random salt
        const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
        // Hash password with salt using PBKDF2
        const hashedPassword = CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations: 10000
        }).toString();
        // Return salt + hash combined
        return salt + ':' + hashedPassword;
    }
    /**
     * Verify password against hash using crypto-js
     */
    static verifyPassword(password, hashedPassword) {
        try {
            // Split salt and hash
            const [salt, hash] = hashedPassword.split(':');
            if (!salt || !hash) {
                return false;
            }
            // Hash the provided password with the same salt
            const testHash = CryptoJS.PBKDF2(password, salt, {
                keySize: 256 / 32,
                iterations: 10000
            }).toString();
            // Compare hashes
            return testHash === hash;
        }
        catch (error) {
            return false;
        }
    }
}
//# sourceMappingURL=encryption.js.map