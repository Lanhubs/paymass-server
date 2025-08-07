import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        next();
    }
    catch (error) {
        logger.error('Token verification failed', { error });
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};
//# sourceMappingURL=auth.js.map