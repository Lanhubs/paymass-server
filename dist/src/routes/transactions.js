import { Router } from 'express';
import { TransactionService } from '../services/transactionService.js';
import { authenticateToken } from '../middleware/auth.js';
import { generalRateLimit } from '../middleware/security.js';
import { handleValidationErrors, sanitizeInput } from '../middleware/validation.js';
import { body, query } from 'express-validator';
import { logger } from '../utils/logger.js';
const router = Router();
router.get('/history', generalRateLimit, authenticateToken, [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('currency')
        .optional()
        .isIn(['USDT', 'USDC'])
        .withMessage('Currency must be USDT or USDC'),
    query('type')
        .optional()
        .isIn(['SEND', 'RECEIVE', 'DEPOSIT', 'WITHDRAWAL'])
        .withMessage('Invalid transaction type')
], handleValidationErrors, (async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const currency = req.query.currency;
        const type = req.query.type;
        const history = await TransactionService.getTransactionHistory(req.user.userId, page, limit, currency, type);
        res.json({
            success: true,
            message: 'Transaction history retrieved successfully',
            data: history
        });
    }
    catch (error) {
        logger.error('Get transaction history error', {
            userId: req.user?.userId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction history'
        });
    }
}));
router.get('/:id', generalRateLimit, authenticateToken, (async (req, res) => {
    try {
        const transactionId = req.params.id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(transactionId ?? "")) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction ID format'
            });
        }
        const transaction = await TransactionService.getTransactionById(req.user.userId, transactionId ?? "");
        res.json({
            success: true,
            message: 'Transaction details retrieved successfully',
            data: transaction
        });
    }
    catch (error) {
        logger.error('Get transaction error', {
            userId: req.user?.userId,
            transactionId: req.params.id,
            error: error.message
        });
        const statusCode = error.message === 'Transaction not found' ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to retrieve transaction'
        });
    }
}));
router.post('/estimate-fee', generalRateLimit, authenticateToken, sanitizeInput, [
    body('currency')
        .isIn(['USDT', 'USDC'])
        .withMessage('Currency must be USDT or USDC'),
    body('amount')
        .isFloat({ min: 0.000001, max: 1000000 })
        .withMessage('Amount must be between 0.000001 and 1,000,000')
], handleValidationErrors, (async (req, res) => {
    try {
        const { currency, amount } = req.body;
        const fee = TransactionService.estimateTransactionFee(currency, parseFloat(amount));
        res.json({
            success: true,
            message: 'Transaction fee estimated successfully',
            data: {
                currency,
                amount: parseFloat(amount),
                estimatedFee: fee,
                total: parseFloat(amount) + fee
            }
        });
    }
    catch (error) {
        logger.error('Estimate fee error', {
            userId: req.user?.userId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to estimate transaction fee'
        });
    }
}));
router.post('/webhook/incoming', sanitizeInput, [
    body('walletAddress')
        .matches(/^0x[a-fA-F0-9]{40}$/)
        .withMessage('Invalid wallet address format'),
    body('fromAddress')
        .matches(/^0x[a-fA-F0-9]{40}$/)
        .withMessage('Invalid sender address format'),
    body('amount')
        .isFloat({ min: 0.000001 })
        .withMessage('Amount must be positive'),
    body('currency')
        .isIn(['USDT', 'USDC'])
        .withMessage('Currency must be USDT or USDC'),
    body('txHash')
        .matches(/^0x[a-fA-F0-9]{64}$/)
        .withMessage('Invalid transaction hash format')
], handleValidationErrors, async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { walletAddress, fromAddress, amount, currency, txHash } = req.body;
        await TransactionService.processIncomingTransaction(walletAddress, fromAddress, parseFloat(amount), currency, txHash);
        res.json({
            success: true,
            message: 'Incoming transaction processed successfully'
        });
    }
    catch (error) {
        logger.error('Process incoming transaction error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to process incoming transaction'
        });
    }
});
export default router;
//# sourceMappingURL=transactions.js.map