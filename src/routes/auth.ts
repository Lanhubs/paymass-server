import { Router, type RequestHandler, type Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth';
import { generalRateLimit } from '../middleware/security';
import { handleValidationErrors, sanitizeInput } from '../middleware/validation';
import { body } from 'express-validator';
import { logger } from '../utils/logger.js';
import { GoogleAuthService } from '../services/googleAuthService';

const router = Router();

const registerHandler = [
  generalRateLimit,
  sanitizeInput,
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('firstName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('First name must be 2-50 characters and contain only letters'),
    body('lastName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Last name must be 2-50 characters and contain only letters'),
    body('phoneNumber')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required')
  ],
  handleValidationErrors,
  (async (req, res: Response) => {
    try {
      console.log(req.body)
      const { email, password, firstName, lastName, phoneNumber } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Registration attempt', {
        email: email?.trim(),
        clientIP,
        userAgent: userAgent.substring(0, 100)
      });

      const result = await AuthService.register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber?.trim()
      }, {
        ip: clientIP,
        userAgent: userAgent
      });

      logger.info('User registration successful', {
        userId: result.user.id,
        email: result.user.email,
        clientIP,
        userAgent: userAgent.substring(0, 100)
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Wallets created automatically.',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error: any) {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      logger.error('Registration error', {
        error: error.message,
        email: req.body.email?.trim(),
        clientIP
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  }) as RequestHandler
];

// Both /register and /signup point to the same handler
router.post('/register', ...registerHandler);

router.post('/login',
  generalRateLimit,
  sanitizeInput,
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  handleValidationErrors,
  (async (req, res: Response) => {
    try {
      const { email, password } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Login attempt', {
        email: email?.trim(),
        clientIP,
        userAgent: userAgent.substring(0, 100)
      });

      const result = await AuthService.login({
        email: email.trim(),
        password
      }, {
        ip: clientIP,
        userAgent: userAgent
      });

      logger.info('User login successful', {
        // userId: result.user.id,
        // email: result.user.email,
        clientIP,
        userAgent: userAgent.substring(0, 100)
      });

      res.status(201).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error: any) {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      logger.error('Login error', {
        error: error.message,
        email: req.body.email?.trim(),
        clientIP
      });

      res.status(401).json({
        success: false,
        message: error.message || 'Login failed'
      });
    }
  }) as RequestHandler
);

router.post('/refresh',
  generalRateLimit,
  sanitizeInput,
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  handleValidationErrors,
  (async (req, res: Response) => {
    try {
      const { refreshToken } = req.body;

      const result = await AuthService.refreshToken({ refreshToken });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error: any) {
      logger.error('Token refresh error', { error: error.message });

      res.status(401).json({
        success: false,
        message: error.message || 'Token refresh failed'
      });
    }
  }) as RequestHandler
);

router.post('/logout',
  generalRateLimit,
  sanitizeInput,
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  handleValidationErrors,
  (async (req, res: Response) => {
    try {
      const { refreshToken } = req.body;

      const result = await AuthService.logout(refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully',
        data: result
      });
    } catch (error: any) {
      logger.error('Logout error', { error: error.message });

      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }) as RequestHandler
);

// Google OAuth routes
router.get('/google',
  generalRateLimit,
  (async (req, res: Response) => {
    try {
      const googleAuthUrl = GoogleAuthService.getGoogleAuthUrl();
      
      res.json({
        success: true,
        message: 'Google OAuth URL generated',
        data: {
          authUrl: googleAuthUrl
        }
      });
    } catch (error: any) {
      logger.error('Google OAuth URL generation error', { error: error.message });

      res.status(500).json({
        success: false,
        message: 'Failed to generate Google OAuth URL'
      });
    }
  }) as RequestHandler
);

router.post('/google/callback',
  generalRateLimit,
  sanitizeInput,
  [
    body('code')
      .notEmpty()
      .withMessage('Authorization code is required')
  ],
  handleValidationErrors,
  (async (req, res: Response) => {
    try {
      const { code } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Google OAuth callback attempt', { 
        clientIP, 
        userAgent: userAgent.substring(0, 100)
      });

      const result = await AuthService.googleAuth({ code }, {
        ip: clientIP,
        userAgent: userAgent
      });

      logger.info('Google OAuth successful', {
        userId: result.user.id,
        email: result.user.email,
        clientIP,
        userAgent: userAgent.substring(0, 100)
      });

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: result
      });
    } catch (error: any) {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      logger.error('Google OAuth error', { 
        error: error.message,
        clientIP
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Google authentication failed'
      });
    }
  }) as RequestHandler
);

router.get('/me',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await AuthService.getUserProfile(req.user!.userId);

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      });
    } catch (error: any) {
      logger.error('Get profile error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile'
      });
    }
  }) as RequestHandler
);

// Transaction PIN endpoints
router.post('/setup-transaction-pin',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body('pin')
      .matches(/^\d{4,6}$/)
      .withMessage('PIN must be 4-6 digits')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pin } = req.body;
      const userId = req.user!.userId;

      logger.info('Transaction PIN setup attempt', { userId });

      const result = await AuthService.setupTransactionPin(userId, { pin });

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      logger.error('Transaction PIN setup error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to setup transaction PIN'
      });
    }
  }) as RequestHandler
);

router.post('/verify-transaction-pin',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body('pin')
      .matches(/^\d{4,6}$/)
      .withMessage('PIN must be 4-6 digits')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pin } = req.body;
      const userId = req.user!.userId;

      const result = await AuthService.verifyTransactionPin(userId, { pin });

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      logger.error('Transaction PIN verification error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(400).json({
        success: false,
        message: error.message || 'PIN verification failed'
      });
    }
  }) as RequestHandler
);

router.put('/update-transaction-pin',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body('currentPin')
      .matches(/^\d{4,6}$/)
      .withMessage('Current PIN must be 4-6 digits'),
    body('newPin')
      .matches(/^\d{4,6}$/)
      .withMessage('New PIN must be 4-6 digits')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPin, newPin } = req.body;
      const userId = req.user!.userId;

      logger.info('Transaction PIN update attempt', { userId });

      const result = await AuthService.updateTransactionPin(userId, { currentPin, newPin });

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      logger.error('Transaction PIN update error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update transaction PIN'
      });
    }
  }) as RequestHandler
);

router.get('/pin-status',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const result = await AuthService.checkPinStatus(userId);

      res.json({
        success: true,
        message: 'PIN status retrieved successfully',
        data: result
      });
    } catch (error: any) {
      logger.error('PIN status check error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check PIN status'
      });
    }
  }) as RequestHandler
);



export default router;