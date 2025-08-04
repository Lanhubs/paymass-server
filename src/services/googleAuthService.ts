import axios from 'axios';
import { logger } from '../utils/logger.js';

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

export class GoogleAuthService {
  private static readonly GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
  private static readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

  private static readonly CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  private static readonly CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  private static readonly REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  /**
   * Generate Google OAuth URL for frontend
   */
  static getGoogleAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID || '',
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
    try {
      const response = await axios.post(this.GOOGLE_OAUTH_URL, {
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.REDIRECT_URI
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.status !== 200) {
        throw new Error('Failed to exchange code for token');
      }

      return response.data;
    } catch (error) {
      logger.error('Google token exchange failed', { error });
      throw new Error('Failed to authenticate with Google');
    }
  }

  /**
   * Get user info from Google using access token
   */
  static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get(this.GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (response.status !== 200) {
        throw new Error('Failed to get user info from Google');
      }

      return response.data;
    } catch (error) {
      logger.error('Google user info fetch failed', { error });
      throw new Error('Failed to get user information from Google');
    }
  }

  /**
   * Verify Google ID token (optional additional security)
   */
  static async verifyIdToken(idToken: string): Promise<any> {
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

      if (response.status !== 200) {
        throw new Error('Invalid ID token');
      }

      const tokenInfo = response.data;

      // Verify the token is for our app
      if (tokenInfo.aud !== this.CLIENT_ID) {
        throw new Error('Token audience mismatch');
      }

      return tokenInfo;
    } catch (error) {
      logger.error('Google ID token verification failed', { error });
      throw new Error('Invalid Google ID token');
    }
  }
}