import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import offrampServices from '../services/offrampServices';
import { generalRateLimit } from '../middleware/security';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get exchange rates
router.get("/rates/:token/:amount/:currency", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const { token, amount, currency } = req.params;

            if (!token || !amount || !currency) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required parameters: token, amount, currency"
                });
            }

            const rates = await offrampServices.fetchRates({
                token,
                amount: parseFloat(amount),
                currency
            });

            res.json(rates);
        } catch (error: any) {
            logger.error(`Rate fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

// Initialize order
router.post("/orders", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const {
                amount,
                token,
                network,
                rate,
                recipient,
                reference,
                returnAddress
            } = req.body;

            // Validate required fields
            if (!amount || !token || !network || !rate || !recipient || !reference || !returnAddress) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields"
                });
            }

            // Validate recipient object
            if (!recipient.institution || !recipient.accountIdentifier || !recipient.accountName || !recipient.currency) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid recipient data"
                });
            }

            const order = await offrampServices.initializeOrder({
                amount,
                token,
                network,
                rate,
                recipient,
                reference,
                returnAddress
            });

            res.json(order);
        } catch (error: any) {
            logger.error(`Order initialization error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

// Get order status
router.get("/orders/:orderId", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: "Order ID is required"
                });
            }

            const order = await offrampServices.getOrderStatus(orderId);
            res.json(order);
        } catch (error: any) {
            logger.error(`Order status fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

// Get supported tokens
router.get("/tokens", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const tokens = await offrampServices.getSupportedTokens();
            res.json(tokens);
        } catch (error: any) {
            logger.error(`Supported tokens fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

// Get supported currencies
router.get("/currencies", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const currencies = await offrampServices.getSupportedCurrencies();
            res.json(currencies);
        } catch (error: any) {
            logger.error(`Supported currencies fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

// Verify bank account
router.post("/verify-account", generalRateLimit,
    authenticateToken, async (req: Request, res: Response) => {
        try {
            const { accountNumber, bankCode, bank } = req.body;

            if (!accountNumber || !bankCode) {
                return res.status(400).json({
                    success: false,
                    message: "Account number and bank code are required"
                });
            }

            const verification = await offrampServices.verifyAccountNumber({
                accountNumber,
                bankCode,
                bank: bank || ""
            });

            res.json(verification);
        } catch (error: any) {
            logger.error(`Account verification error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

export default router;