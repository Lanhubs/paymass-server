import { Router } from 'express';
import { WalletService } from '../services/walletService.js';
import { TransactionService } from '../services/transactionService.js';
import { authenticateToken } from '../middleware/auth.js';
import { generalRateLimit } from '../middleware/security.js';
import { handleValidationErrors, sanitizeInput } from '../middleware/validation.js';
import { body, query } from 'express-validator';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();
router.get('/', generalRateLimit, authenticateToken, (async (req, res) => {
    try {
        const wallets = await WalletService.getUserWallets(req.user.userId);
        res.json({
            success: true,
            message: 'Wallets retrieved successfully',
            data: wallets
        });
    }
    catch (error) {
        logger.error('Get wallets error', {
            userId: req.user?.userId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallets'
        });
    }
}));
router.get('/withdraw/network-fee', generalRateLimit, authenticateToken, [
    query('assetId')
        .notEmpty()
        .withMessage('Asset ID is required'),
    query('amount')
        .isFloat({ min: 0.000001 })
        .withMessage('Amount must be a positive number'),
    query('address')
        .isLength({ min: 32, max: 44 })
        .withMessage('Invalid Solana address length')
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana address format (must be base58)')
], handleValidationErrors, (async (req, res) => {
    try {
        const { assetId, amount, address } = req.query;
        const networkFee = await WalletService.getWithdrawalNetworkFee({
            assetId: assetId,
            amount: parseFloat(amount),
            address: address
        });
        res.json({
            success: true,
            message: 'Withdrawal network fee retrieved successfully',
            data: networkFee
        });
    }
    catch (error) {
        logger.error('Get withdrawal network fee error', {
            userId: req.user?.userId,
            assetId: req.query.assetId,
            amount: req.query.amount,
            address: req.query.address,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve withdrawal network fee'
        });
    }
}));
router.post('/withdraw', generalRateLimit, authenticateToken, sanitizeInput, [
    body('walletId')
        .isUUID()
        .withMessage('Wallet ID must be a valid UUID'),
    body('toAddress')
        .isLength({ min: 32, max: 44 })
        .withMessage('Invalid Solana address length')
        .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
        .withMessage('Invalid Solana address format (must be base58)'),
    body('amount')
        .isFloat({ min: 0.000001 })
        .withMessage('Amount must be a positive number'),
    body('currency')
        .isIn(['SOL', 'USDT', 'USDC'])
        .withMessage('Currency must be SOL, USDT, or USDC')
], handleValidationErrors, (async (req, res) => {
    try {
        const { walletId, toAddress, amount, currency } = req.body;
        const wallet = await prisma.wallet.findFirst({
            where: {
                id: walletId,
                userId: req.user.userId,
                currency: currency,
                isActive: true
            }
        });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found or unauthorized'
            });
        }
        const withdrawalResult = await WalletService.withdrawFunds(req.user.userId, wallet.assetId, toAddress, parseFloat(amount), currency);
        res.status(200).json({
            success: true,
            message: "Withdrawal initiated successfully",
            data: withdrawalResult
        });
    }
    catch (error) {
        logger.error('Withdraw error', {
            userId: req.user?.userId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Withdrawal failed'
        });
    }
}));
router.get('/summary', generalRateLimit, authenticateToken, [
    query('currency')
        .optional()
        .isIn(['SOL', 'USDT', 'USDC'])
        .withMessage('Currency must be SOL, USDT, or USDC')
], handleValidationErrors, (async (req, res) => {
    try {
        const currency = req.query.currency;
        const summary = await TransactionService.getWalletSummary(req.user.userId, currency);
        res.json({
            success: true,
            message: 'Wallet summary retrieved successfully',
            data: summary
        });
    }
    catch (error) {
        logger.error('Get wallet summary error', {
            userId: req.user?.userId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet summary'
        });
    }
}));
router.get('/balance', generalRateLimit, authenticateToken, [
    query('asset_id')
        .isUUID()
        .withMessage('Asset ID must be a valid UUID')
], handleValidationErrors, (async (req, res) => {
    try {
        const assetId = req.query.asset_id;
        const wallet = await prisma.wallet.findFirst({
            where: {
                assetId,
                userId: req.user.userId,
                isActive: true
            }
        });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found or unauthorized'
            });
        }
        const blockRadarBalance = await WalletService.getAssetBalance({
            addressId: wallet.address,
            assetId: wallet.assetId
        });
        const newBalance = parseFloat(blockRadarBalance.balance || '0');
        const updatedWallet = await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
                balance: newBalance,
                updatedAt: new Date()
            },
            select: {
                id: true,
                currency: true,
                address: true,
                balance: true,
                assetId: true,
                updatedAt: true
            }
        });
        res.json({
            success: true,
            message: 'Wallet balance retrieved and updated successfully',
            data: {
                wallet: updatedWallet,
                blockRadarBalance: blockRadarBalance
            }
        });
    }
    catch (error) {
        logger.error('Get wallet balance error', {
            userId: req.user?.userId,
            assetId: req.query.asset_id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet balance'
        });
    }
}));
router.post('/balances', generalRateLimit, authenticateToken, sanitizeInput, [
    body('walletId')
        .isUUID()
        .withMessage('Wallet ID must be a valid UUID')
], handleValidationErrors, (async (req, res) => {
    try {
        const wallet = await prisma.wallet.findFirst({
            where: {
                userId: req.user.userId,
                isActive: true
            }
        });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found or unauthorized'
            });
        }
        const blockRadarBalances = await WalletService.getAssetsBalances({
            addressId: wallet.address,
        });
        const userWallets = await prisma.wallet.findMany({
            where: {
                userId: req.user.userId,
                address: wallet.address,
                isActive: true
            }
        });
        const updatedWallets = await Promise.all(userWallets.map(async (userWallet) => {
            const matchingBalance = blockRadarBalances.find((balance) => balance.assetId === userWallet.assetId);
            const newBalance = matchingBalance ? parseFloat(matchingBalance.balance || '0') : 0;
            const updatedWallet = await prisma.wallet.update({
                where: { id: userWallet.id },
                data: {
                    balance: newBalance,
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                    currency: true,
                    address: true,
                    balance: true,
                    assetId: true,
                    updatedAt: true
                }
            });
            return updatedWallet;
        }));
        res.json({
            success: true,
            message: 'Wallet balances retrieved and updated successfully',
            data: {
                wallets: updatedWallets,
                blockRadarBalances: blockRadarBalances
            }
        });
    }
    catch (error) {
        logger.error('Get wallet balances error', {
            userId: req.user?.userId,
            walletId: req.body.walletId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet balances'
        });
    }
}));
// Swap Routes - Based on BlockRadar API Documentation
router.post('/swap', generalRateLimit, authenticateToken, sanitizeInput, [
    body('addressId')
        .notEmpty()
        .withMessage('Address ID is required'),
    body('inputAssetId')
        .isUUID()
        .withMessage('Input asset ID must be a valid UUID'),
    body('outputAssetId')
        .isUUID()
        .withMessage('Output asset ID must be a valid UUID'),
    body('inputAmount')
        .isFloat({ min: 0.000001 })
        .withMessage('Input amount must be a positive number'),
    body('slippage')
        .optional()
        .isFloat({ min: 0.1, max: 50 })
        .withMessage('Slippage must be between 0.1 and 50 percent')
], handleValidationErrors, (async (req, res) => {
    try {
        const { addressId, inputAssetId, outputAssetId, inputAmount, slippage, recipientAddress } = req.body;
        // Verify wallet ownership by checking if user owns a wallet with this address
        const wallet = await prisma.wallet.findFirst({
            where: {
                address: addressId,
                userId: req.user.userId,
                isActive: true
            }
        });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet address not found or unauthorized'
            });
        }
        const swapResult = await WalletService.executeSwap({
            addressId,
            inputAssetId,
            outputAssetId,
            recipientAddress: recipientAddress,
            inputAmount: parseFloat(inputAmount),
            slippage: slippage ? parseFloat(slippage) : 1.0
        });
        // Create transaction record
        await prisma.transaction.create({
            data: {
                userId: req.user.userId,
                senderWalletId: wallet.id,
                type: 'SWAP',
                status: 'PROCESSING',
                currency: 'SWAP',
                amount: parseFloat(inputAmount),
                fee: swapResult.fee || 0,
                externalTxHash: swapResult.txHash || swapResult.transactionHash,
                description: `Swap ${inputAmount} tokens from ${inputAssetId} to ${outputAssetId}`,
                metadata: {
                    addressId,
                    inputAssetId,
                    outputAssetId,
                    inputAmount,
                    slippage: slippage || 1.0,
                    swapResult
                }
            }
        });
        res.json({
            success: true,
            message: 'Swap executed successfully',
            data: swapResult
        });
    }
    catch (error) {
        logger.error('Execute swap error', {
            userId: req.user?.userId,
            addressId: req.body.addressId,
            inputAssetId: req.body.inputAssetId,
            outputAssetId: req.body.outputAssetId,
            inputAmount: req.body.inputAmount,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Swap execution failed'
        });
    }
}));
router.post("/get-swap-details", generalRateLimit, authenticateToken, sanitizeInput, [
    body("fromAssetId").notEmpty().withMessage("From asset ID is required"),
    body("toAssetId").notEmpty().withMessage("To asset ID is required"),
    body("amount").notEmpty().withMessage("Amount is required"),
    body("recipientAddress").optional().isFloat({ min: 0.1, max: 50 }).withMessage("receipient address is missing"),
], handleValidationErrors, (async (req, res) => {
    try {
        const { fromAssetId, toAssetId, amount, recipientAddress } = req.body;
        const swapDetails = await WalletService.getSwapDetails({
            fromAssetId,
            recipientAddress,
            toAssetId,
            userId: req.user.userId,
            amount: parseFloat(amount)
        });
        res.json({
            success: true,
            message: "Swap details retrieved successfully",
            data: swapDetails
        });
    }
    catch (error) {
        logger.error('Get swap details error', {
            userId: req.user?.userId,
            fromAssetId: req.body.fromAssetId,
            toAssetId: req.body.toAssetId,
            amount: req.body.amount,
            recipientAddress: req.body.recipientAddress,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve swap details'
        });
    }
}));
export default router;
//# sourceMappingURL=wallets.js.map