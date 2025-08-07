export interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
    id_token: string;
}
export interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}
export declare class GoogleAuthService {
    private static readonly GOOGLE_OAUTH_URL;
    private static readonly GOOGLE_USERINFO_URL;
    private static readonly CLIENT_ID;
    private static readonly CLIENT_SECRET;
    private static readonly REDIRECT_URI;
    /**
     * Generate Google OAuth URL for frontend
     */
    static getGoogleAuthUrl(): string;
    /**
     * Exchange authorization code for access token
     */
    static exchangeCodeForToken(code: string): Promise<GoogleTokenResponse>;
    /**
     * Get user info from Google using access token
     */
    static getUserInfo(accessToken: string): Promise<GoogleUserInfo>;
    /**
     * Verify Google ID token (optional additional security)
     */
    static verifyIdToken(idToken: string): Promise<any>;
}
//# sourceMappingURL=googleAuthService.d.ts.map