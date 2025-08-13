import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { EncryptionService } from '../utils/encryption.js';
import { WalletService } from './walletService.js';
import { GoogleAuthService } from './googleAuthService.js';
const prisma = new PrismaClient();
export class AuthService {
    static generateTokens(userId, email) {
        const accessToken = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '15m' } // Short-lived access token
        );
        const refreshToken = jwt.sign({ userId, email, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret', { expiresIn: '7d' } // Long-lived refresh token
        );
        return { accessToken, refreshToken };
    }
    static async register(userData, deviceInfo) {
        try {
            const existingUser = await prisma.user.findFirst({
                where: { email: userData.email }
            });
            if (existingUser) {
                throw new Error('User already exists with this email');
            }
            const hashedPassword = EncryptionService.hashPassword(userData.password);
            const user = await prisma.user.create({
                data: {
                    email: userData.email,
                    password: hashedPassword,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    phoneNumber: userData.phoneNumber,
                    accountNumber: WalletService.generateAccountNumber(),
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phoneNumber: true,
                    isVerified: true,
                    accountNumber: true,
                    createdAt: true
                }
            });
            // Generate wallets for the new user
            try {
                logger.info('User wallets created successfully', { userId: user.id });
                await WalletService.createUserWalletsWithBlockRadar(user.id);
            }
            catch (walletError) {
                logger.error('Failed to create user wallets during registration', {
                    userId: user.id,
                    error: walletError
                });
                // Don't fail registration if wallet creation fails, but log it
            }
            const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);
            // Store refresh token in database
            await prisma.userSession.create({
                data: {
                    userId: user.id,
                    token: accessToken,
                    refreshToken: refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    deviceInfo: deviceInfo?.userAgent || 'Registration',
                    ipAddress: deviceInfo?.ip || 'unknown',
                    userAgent: deviceInfo?.userAgent || 'unknown',
                    isActive: true
                }
            });
            logger.info('User registered successfully', { userId: user.id, email: user.email });
            return {
                user,
                accessToken,
                refreshToken
            };
        }
        catch (error) {
            logger.error('Registration failed', { error, email: userData.email });
            throw error;
        }
    }
    static async login(credentials, deviceInfo) {
        try {
            const user = await prisma.user.findUnique({
                where: { email: credentials.email }
            });
            if (!user || !user.password) {
                throw new Error('Invalid credentials');
            }
            const isValidPassword = EncryptionService.verifyPassword(credentials.password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid credentials');
            }
            if (!user.isActive) {
                throw new Error('Account is deactivated');
            }
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });
            const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);
            // Store refresh token in database
            await prisma.userSession.create({
                data: {
                    userId: user.id,
                    token: accessToken,
                    refreshToken: refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    deviceInfo: deviceInfo?.userAgent || 'Login',
                    ipAddress: deviceInfo?.ip || 'unknown',
                    userAgent: deviceInfo?.userAgent || 'unknown',
                    isActive: true
                }
            });
            logger.info('User logged in successfully', { userId: user.id, email: user.email });
            return {
                // user: {
                //   id: user.id,
                //   email: user.email,
                //   firstName: user.firstName,
                //   lastName: user.lastName,
                //   phoneNumber: user.phoneNumber,
                //   isVerified: user.isVerified,
                //   createdAt: user.createdAt
                // },
                accessToken,
                refreshToken
            };
        }
        catch (error) {
            logger.error('Login failed', { error, email: credentials.email });
            throw error;
        }
    }
    static async refreshToken(refreshTokenRequest) {
        try {
            const { refreshToken } = refreshTokenRequest;
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret');
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            // Check if refresh token exists in database and is active
            const session = await prisma.userSession.findFirst({
                where: {
                    refreshToken: refreshToken,
                    isActive: true,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    user: true
                }
            });
            if (!session) {
                throw new Error('Invalid or expired refresh token');
            }
            if (!session.user.isActive) {
                throw new Error('Account is deactivated');
            }
            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(session.user.id, session.user.email);
            // Update session with new tokens
            await prisma.userSession.update({
                where: { id: session.id },
                data: {
                    token: accessToken,
                    refreshToken: newRefreshToken,
                    lastUsedAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Extend expiry
                }
            });
            logger.info('Token refreshed successfully', { userId: session.user.id });
            return {
                accessToken,
                refreshToken: newRefreshToken,
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    firstName: session.user.firstName,
                    lastName: session.user.lastName,
                    phoneNumber: session.user.phoneNumber,
                    isVerified: session.user.isVerified
                }
            };
        }
        catch (error) {
            logger.error('Token refresh failed', { error });
            throw new Error('Invalid or expired refresh token');
        }
    }
    static async logout(refreshToken) {
        try {
            // Deactivate the session
            await prisma.userSession.updateMany({
                where: {
                    refreshToken: refreshToken,
                    isActive: true
                },
                data: {
                    isActive: false
                }
            });
            logger.info('User logged out successfully');
            return { success: true, message: 'Logged out successfully' };
        }
        catch (error) {
            logger.error('Logout failed', { error });
            throw new Error('Logout failed');
        }
    }
    static async googleAuth(googleAuthRequest, deviceInfo) {
        try {
            const { code } = googleAuthRequest;
            // Exchange code for access token
            const tokenResponse = await GoogleAuthService.exchangeCodeForToken(code);
            // Get user info from Google
            const googleUser = await GoogleAuthService.getUserInfo(tokenResponse.access_token);
            if (!googleUser.verified_email) {
                throw new Error('Google email not verified');
            }
            // Check if user already exists
            let user = await prisma.user.findUnique({
                where: { email: googleUser.email }
            });
            if (user) {
                // Update existing user with Google info if not already set
                if (!user.googleId) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            googleId: googleUser.id,
                            profilePicture: googleUser.picture,
                            isVerified: true, // Google emails are verified
                            lastLogin: new Date()
                        }
                    });
                }
                else {
                    // Just update last login
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { lastLogin: new Date() }
                    });
                }
            }
            else {
                // Create new user from Google info
                user = await prisma.user.create({
                    data: {
                        email: googleUser.email,
                        googleId: googleUser.id,
                        firstName: googleUser.given_name,
                        lastName: googleUser.family_name,
                        profilePicture: googleUser.picture,
                        isVerified: true, // Google emails are verified
                        accountNumber: WalletService.generateAccountNumber(),
                        password: null // No password for Google users
                    }
                });
                // Generate wallets for the new user
                try {
                    await WalletService.createUserWalletsWithBlockRadar(user.id);
                    logger.info('User wallets created successfully for Google user', { userId: user.id });
                }
                catch (walletError) {
                    logger.error('Failed to create user wallets during Google registration', {
                        userId: user.id,
                        error: walletError
                    });
                }
            }
            if (!user.isActive) {
                throw new Error('Account is deactivated');
            }
            const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);
            // Store refresh token in database
            await prisma.userSession.create({
                data: {
                    userId: user.id,
                    token: accessToken,
                    refreshToken: refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    deviceInfo: deviceInfo?.userAgent || 'Google OAuth',
                    ipAddress: deviceInfo?.ip || 'unknown',
                    userAgent: deviceInfo?.userAgent || 'unknown',
                    isActive: true
                }
            });
            logger.info('Google authentication successful', {
                userId: user.id,
                email: user.email,
                isNewUser: !user.googleId
            });
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    profilePicture: user.profilePicture,
                    isVerified: user.isVerified,
                    accountNumber: user.accountNumber,
                    createdAt: user.createdAt
                },
                accessToken,
                refreshToken
            };
        }
        catch (error) {
            logger.error('Google authentication failed', { error });
            throw error;
        }
    }
    static async getUserProfile(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phoneNumber: true,
                    profilePicture: true,
                    isVerified: true,
                    ninVerified: true,
                    accountNumber: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger.error('Failed to get user profile', { userId, error });
            throw error;
        }
    }
    // Transaction PIN Methods
    static async setupTransactionPin(userId, pinRequest) {
        try {
            const { pin } = pinRequest;
            // Validate PIN format (4-6 digits)
            if (!/^\d{4,6}$/.test(pin)) {
                throw new Error('PIN must be 4-6 digits');
            }
            // Check if user already has a PIN
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { transactionPin: true }
            });
            if (!user) {
                throw new Error('User not found');
            }
            if (user.transactionPin) {
                throw new Error('Transaction PIN already exists. Use update PIN instead.');
            }
            // Hash the PIN
            const hashedPin = EncryptionService.hashPassword(pin);
            // Update user with transaction PIN
            await prisma.user.update({
                where: { id: userId },
                data: {
                    transactionPin: hashedPin,
                    pinSetupAt: new Date()
                }
            });
            logger.info('Transaction PIN setup successfully', { userId });
            return {
                success: true,
                message: 'Transaction PIN setup successfully'
            };
        }
        catch (error) {
            logger.error('Transaction PIN setup failed', { userId, error });
            throw error;
        }
    }
    static async verifyTransactionPin(userId, pinRequest) {
        try {
            const { pin } = pinRequest;
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { transactionPin: true }
            });
            if (!user) {
                throw new Error('User not found');
            }
            if (!user.transactionPin) {
                throw new Error('Transaction PIN not set. Please setup your PIN first.');
            }
            const isValidPin = EncryptionService.verifyPassword(pin, user.transactionPin);
            if (!isValidPin) {
                // Log failed attempt
                logger.warn('Invalid transaction PIN attempt', { userId });
                throw new Error('Invalid transaction PIN');
            }
            logger.info('Transaction PIN verified successfully', { userId });
            return {
                success: true,
                message: 'Transaction PIN verified successfully'
            };
        }
        catch (error) {
            logger.error('Transaction PIN verification failed', { userId, error });
            throw error;
        }
    }
    static async updateTransactionPin(userId, pinRequest) {
        try {
            const { currentPin, newPin } = pinRequest;
            // Validate new PIN format
            if (!/^\d{4,6}$/.test(newPin)) {
                throw new Error('New PIN must be 4-6 digits');
            }
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { transactionPin: true }
            });
            if (!user) {
                throw new Error('User not found');
            }
            if (!user.transactionPin) {
                throw new Error('Transaction PIN not set. Please setup your PIN first.');
            }
            // Verify current PIN
            const isValidCurrentPin = EncryptionService.verifyPassword(currentPin, user.transactionPin);
            if (!isValidCurrentPin) {
                throw new Error('Current PIN is incorrect');
            }
            // Hash new PIN
            const hashedNewPin = EncryptionService.hashPassword(newPin);
            // Update user with new PIN
            await prisma.user.update({
                where: { id: userId },
                data: {
                    transactionPin: hashedNewPin,
                    pinUpdatedAt: new Date()
                }
            });
            logger.info('Transaction PIN updated successfully', { userId });
            return {
                success: true,
                message: 'Transaction PIN updated successfully'
            };
        }
        catch (error) {
            logger.error('Transaction PIN update failed', { userId, error });
            throw error;
        }
    }
    static async checkPinStatus(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    transactionPin: true,
                    pinSetupAt: true,
                    pinUpdatedAt: true
                }
            });
            if (!user) {
                throw new Error('User not found');
            }
            return {
                hasPinSetup: !!user.transactionPin,
                pinSetupAt: user.pinSetupAt,
                pinUpdatedAt: user.pinUpdatedAt
            };
        }
        catch (error) {
            logger.error('Failed to check PIN status', { userId, error });
            throw error;
        }
    }
}
//# sourceMappingURL=authService.js.map