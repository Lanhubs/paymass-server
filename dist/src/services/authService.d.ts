export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface GoogleAuthRequest {
    code: string;
}
export declare class AuthService {
    private static generateTokens;
    static register(userData: RegisterRequest, deviceInfo?: {
        ip: string;
        userAgent: string;
    }): Promise<{
        user: {
            id: string;
            createdAt: Date;
            accountNumber: string | null;
            email: string;
            firstName: string;
            lastName: string;
            phoneNumber: string | null;
            isVerified: boolean;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    static login(credentials: LoginRequest, deviceInfo?: {
        ip: string;
        userAgent: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    static refreshToken(refreshTokenRequest: RefreshTokenRequest): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phoneNumber: string | null;
            isVerified: boolean;
        };
    }>;
    static logout(refreshToken: string): Promise<{
        success: boolean;
        message: string;
    }>;
    static googleAuth(googleAuthRequest: GoogleAuthRequest, deviceInfo?: {
        ip: string;
        userAgent: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phoneNumber: string | null;
            profilePicture: string | null;
            isVerified: boolean;
            accountNumber: string | null;
            createdAt: Date;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    static getUserProfile(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        accountNumber: string | null;
        email: string;
        firstName: string;
        lastName: string;
        phoneNumber: string | null;
        profilePicture: string | null;
        isVerified: boolean;
        ninVerified: boolean;
    }>;
}
//# sourceMappingURL=authService.d.ts.map