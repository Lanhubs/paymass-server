import { Router, type RequestHandler, type Response } from 'express';
import { WalletService } from '../services/walletService.js';
import { TransactionService } from '../services/transactionService.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { generalRateLimit } from '../middleware/security.js';
import { handleValidationErrors, sanitizeInput } from '../middleware/validation.js';
import { body, query } from 'express-validator';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';
import type { UUID } from 'crypto';

const prisma = new PrismaClient();
const router = Router();

router.get('/',
  generalRateLimit,
  authenticateToken,
  [
    query('network')
      .optional()
      .isIn(['Base', 'Ethereum', 'BNB', 'Solana', 'Lisk', 'Celo'])
      .withMessage('Network must be one of: Base, Ethereum, BNB, Solana, Lisk, Celo')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const network = req.query.network as string;
      const wallets = await WalletService.getUserWallets(req.user!.userId, network);

      res.json({
        success: true,
        message: 'Wallets retrieved successfully',
        data: wallets
      });
    } catch (error: any) {
      logger.error('Get wallets error', {
        userId: req.user?.userId,
        network: req.query.network,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallets'
      });
    }
  }) as RequestHandler
);

// New route: Get wallets grouped by network
router.get('/by-network',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletsByNetwork = await WalletService.getUserWalletsByNetwork(req.user!.userId);

      res.json({
        success: true,
        message: 'Wallets by network retrieved successfully',
        data: walletsByNetwork
      });
    } catch (error: any) {
      logger.error('Get wallets by network error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallets by network'
      });
    }
  }) as RequestHandler
);

// New route: Get network statistics
router.get('/networks/stats',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const networkStats = WalletService.getNetworkStats();

      res.json({
        success: true,
        message: 'Network statistics retrieved successfully',
        data: networkStats
      });
    } catch (error: any) {
      logger.error('Get network stats error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve network statistics'
      });
    }
  }) as RequestHandler
);

// New route: Get portfolio worth
router.get('/portfolio',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const portfolioWorth = await WalletService.calculatePortfolioWorth(req.user!.userId);

      res.json({
        success: true,
        message: 'Portfolio worth retrieved successfully',
        data: portfolioWorth
      });
    } catch (error: any) {
      logger.error('Get portfolio worth error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve portfolio worth'
      });
    }
  }) as RequestHandler
);

// Debug route: Force create wallets
router.post('/debug/create-wallets',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info('Debug: Force creating wallets for user', { userId: req.user!.userId });
      
      await WalletService.createUserWalletsWithBlockRadar(req.user!.userId);
      
      const wallets = await WalletService.getUserWallets(req.user!.userId);

      res.json({
        success: true,
        message: 'Wallets created successfully',
        data: {
          walletsCreated: wallets.length,
          wallets: wallets
        }
      });
    } catch (error: any) {
      logger.error('Debug wallet creation error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create wallets'
      });
    }
  }) as RequestHandler
);

// Debug route: Check network configurations
router.get('/debug/network-configs',
  generalRateLimit,
  authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const networkConfigs = WalletService.getAllNetworkConfigs();
      const networkStats = WalletService.getNetworkStats();

      res.json({
        success: true,
        message: 'Network configurations retrieved',
        data: {
          configs: networkConfigs,
          stats: networkStats
        }
      });
    } catch (error: any) {
      logger.error('Debug network configs error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve network configurations'
      });
    }
  }) as RequestHandler
);

// New route: Generate wallet for specific network
router.post('/generate/:network',
  generalRateLimit,
  authenticateToken,
  [
    body('network')
      .isIn(['Base', 'Ethereum', 'BNB', 'Solana', 'Lisk', 'Celo'])
      .withMessage('Network must be one of: Base, Ethereum, BNB, Solana, Lisk, Celo')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const network = req.params.network;
      const result = await WalletService.generateSingleNetworkWallet(req.user!.userId, network);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Failed to generate wallet'
        });
      }

      // Create wallets in database
      await prisma.$transaction(
        result.wallets.map(walletData => 
          prisma.wallet.create({ data: walletData })
        )
      );

      res.json({
        success: true,
        message: `${network} wallet generated successfully`,
        data: {
          network,
          walletsCreated: result.wallets.length,
          currencies: result.wallets.map(w => w.currency)
        }
      });
    } catch (error: any) {
      logger.error('Generate network wallet error', {
        userId: req.user?.userId,
        network: req.params.network,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate network wallet'
      });
    }
  }) as RequestHandler
);

router.get('/withdraw/network-fee',
  generalRateLimit,
  authenticateToken,
  [
    query('assetId')
      .notEmpty()
      .withMessage('Asset ID is required'),
    query('amount')
      .isFloat({ min: 0.000001 })
      .withMessage('Amount must be a positive number'),
    query('address')
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid Base address length')
      .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
      .withMessage('Invalid Base address format (must be base58)')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { assetId, amount, address } = req.query;

      const networkFee = await WalletService.getWithdrawalNetworkFee({
        assetId: assetId as string,
        amount: parseFloat(amount as string),
        address: address as string
      });

      res.json({
        success: true,
        message: 'Withdrawal network fee retrieved successfully',
        data: networkFee
      });
    } catch (error: any) {
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
  }) as RequestHandler
);

router.post('/withdraw',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body('toAddress')
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid address length')
      .custom((value, { req }) => {
        const network = req.body.network || 'Base';
        if (network === 'Solana') {
          // Solana address validation (base58, ~44 characters)
          if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
            throw new Error('Invalid Solana address format');
          }
        } else {
          // EVM address validation (0x + 40 hex characters)
          if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
            throw new Error('Invalid EVM address format');
          }
        }
        return true;
      }),
    body('amount')
      .isFloat({ min: 0.000001 })
      .withMessage('Amount must be a positive number'),
    body('currency')
      .isIn(['Base', 'ETH', 'BNB', 'SOL', 'LSK', 'CELO', 'USDT', 'USDC'])
      .withMessage('Currency must be one of: Base, ETH, BNB, SOL, LSK, CELO, USDT, USDC'),
    body('network')
      .optional()
      .isIn(['Base', 'Ethereum', 'BNB', 'Solana', 'Lisk', 'Celo'])
      .withMessage('Network must be one of: Base, Ethereum, BNB, Solana, Lisk, Celo')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { walletId, toAddress, amount, currency, network } = req.body;
      
      const whereClause: any = {
        id: walletId,
        userId: req.user!.userId,
        currency: currency,
        isActive: true
      };

      if (network) {
        whereClause.network = network;
      }

      const wallet = await prisma.wallet.findFirst({
        where: whereClause
      });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: 'Wallet not found or unauthorized'
        });
      }

      const withdrawalResult = await WalletService.withdrawFunds(
        req.user!.userId,
        wallet.assetId,
        toAddress,
        parseFloat(amount),
        currency,
        network
      );

      res.status(200).json({
        success: true,
        message: "Withdrawal initiated successfully",
        data: withdrawalResult
      });
    } catch (error: any) {
      logger.error('Withdraw error', {
        userId: req.user?.userId,
        network: req.body.network,
        currency: req.body.currency,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: error.message || 'Withdrawal failed'
      });
    }
  }) as RequestHandler
);

router.get('/summary',
  generalRateLimit,
  authenticateToken,
  [
    query('currency')
      .optional()
      .isIn(['Base', 'USDT', 'USDC'])
      .withMessage('Currency must be Base, USDT, or USDC')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currency = req.query.currency as string;

      const summary = await TransactionService.getWalletSummary(
        req.user!.userId,
        currency
      );

      res.json({
        success: true,
        message: 'Wallet summary retrieved successfully',
        data: summary
      });
    } catch (error: any) {
      logger.error('Get wallet summary error', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wallet summary'
      });
    }
  }) as RequestHandler
);

router.get('/balance',
  generalRateLimit,
  authenticateToken,
  [
    query('asset_id')
      .isUUID()
      .withMessage('Asset ID must be a valid UUID')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const assetId = req.query.asset_id as UUID;

      const wallet = await prisma.wallet.findFirst({
        where: {
          assetId,
          userId: req.user!.userId,
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
        assetId: wallet.assetId as UUID
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

    } catch (error: any) {
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
  }) as RequestHandler
);

router.post('/balances',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body('walletId')
      .isUUID()
      .withMessage('Wallet ID must be a valid UUID')
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {

      const wallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user!.userId as UUID,
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
          userId: req.user!.userId,
          address: wallet.address,
          isActive: true
        }
      });

      const updatedWallets = await Promise.all(
        userWallets.map(async (userWallet) => {
          const matchingBalance = blockRadarBalances.find(
            (balance: any) => balance.assetId === userWallet.assetId
          );

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
        })
      );

      res.json({
        success: true,
        message: 'Wallet balances retrieved and updated successfully',
        data: {
          wallets: updatedWallets,
          blockRadarBalances: blockRadarBalances
        }
      });

    } catch (error: any) {
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
  }) as RequestHandler
);

// Swap Routes - Based on BlockRadar API Documentation
router.post('/swap',
  generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
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
  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { addressId, inputAssetId, outputAssetId, inputAmount, slippage, recipientAddress } = req.body;

      // Verify wallet ownership by checking if user owns a wallet with this address
      const wallet = await prisma.wallet.findFirst({
        where: {
          address: addressId,
          userId: req.user!.userId,
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
        recipientAddress: recipientAddress as string,
        inputAmount: parseFloat(inputAmount as string),
        slippage: slippage ? parseFloat(slippage as string) : 1.0
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: req.user!.userId,
          senderWalletId: wallet.id,
          type: 'SWAP',
          status: 'PROCESSING',
          currency: 'SWAP',
          amount: parseFloat(inputAmount as string),
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
    } catch (error: any) {
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
  }) as RequestHandler
);


router.post("/get-swap-details", generalRateLimit,
  authenticateToken,
  sanitizeInput,
  [
    body("fromAssetId").notEmpty().withMessage("From asset ID is required"),
    body("toAssetId").notEmpty().withMessage("To asset ID is required"),
    body("amount").notEmpty().withMessage("Amount is required"),
    body("recipientAddress").optional().isFloat({ min: 0.1, max: 50 }).withMessage("receipient address is missing"),

  ],
  handleValidationErrors,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fromAssetId, toAssetId, amount, recipientAddress } = req.body;

      const swapDetails = await WalletService.getSwapDetails({

        fromAssetId,
        recipientAddress,
        toAssetId,
        userId: req.user!.userId as UUID,
        amount: parseFloat(amount as string)
      });

      res.json({
        success: true,
        message: "Swap details retrieved successfully",
        data: swapDetails
      });
    } catch (error: any) {
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
  }) as RequestHandler

)
export default router;