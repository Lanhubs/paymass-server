import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import offrampServices from "../services/offrampServices";
import { generalRateLimit } from "../middleware/security";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { UUID } from "crypto";
import { WalletService } from "../services/walletService";
import { Prisma, PrismaClient } from "@prisma/client";
import { transactionStatusTracker } from "../hooks/offramp-hooks";

const router = Router();
const prisma = new PrismaClient();

// Get exchange rates
router.post(
  "/rates",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { token, amount, currency } = req.body;

      if (!token || !amount || !currency) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: token, amount, currency",
        });
      }

      const rates = await offrampServices.fetchRates({
        token,
        amount: parseFloat(amount),
        currency,
      });
      res.json(rates);
    } catch (error: any) {
      logger.error(`Rate fetch error: ${error.message}`);
      res.status(500).json({
        success: false,

        message: error.message,
      });
    }
  }
);

// Initialize order
router.post(
  "/orders",
  generalRateLimit,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        amount,
        token,
        network,
        rate,
        recipient,
        reference,
        returnAddress,
        memo,
      } = req.body;
      // Validate required fields
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // Validate recipient object
      if (
        !recipient.institution ||
        !recipient.accountIdentifier ||
        !recipient.accountName ||
        !recipient.currency
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid recipient data",
        });
      }

      const order = await offrampServices.initializeOrder({
        amount,
        token,
        network,
        rate,
        recipient,
        reference,
        returnAddress,
        memo: memo || "",
        userId: req.user?.userId as UUID,
      });
      if (order) {
        const wallet = await prisma.wallet.findFirst({
          where: {
            userId: req.user?.userId as UUID,
            currency: token,
          },
        });
        if (wallet) {
          const transaction = await WalletService.transferAsset({
            userId: req.user?.userId as UUID,
            amount,
            assetId: wallet?.assetId || "",
            currency: token,
            toAddress: order.data.receiveAddress,
            description:
              memo || `Offramp order ${order.data.id} for ${amount} ${token}`,
            accountName: recipient.accountName,
            accountNumber: recipient.accountIdentifier,
            institution: recipient.institution,
          });
          res.json(transaction);
        } else {
          return res.status(404).json({
            success: false,
            message: "Wallet not found",
          });
        }
      }
    } catch (error: any) {
      logger.error(`Order initialization error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get order status
router.get(
  "/orders/:orderId",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is required",
        });
      }

      const order = await offrampServices.getOrderStatus(orderId);
      res.json(order);
    } catch (error: any) {
      logger.error(`Order status fetch error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get supported tokens
router.get(
  "/tokens",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const tokens = await offrampServices.getSupportedTokens();
      res.json(tokens);
    } catch (error: any) {
      logger.error(`Supported tokens fetch error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get supported currencies
router.get(
  "/currencies",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const currencies = await offrampServices.getSupportedCurrencies();
      res.json(currencies);
    } catch (error: any) {
      logger.error(`Supported currencies fetch error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Verify bank account
router.post(
  "/verify-account",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { accountNumber, bankName, accountName, bankCode } = req.body;

      if (!accountNumber || !bankName || !accountName) {
        return res.status(400).json({
          success: false,
          message: "Account number, bank name, and account name are required",
        });
      }

      const verification = await offrampServices.verifyAccountNumber({
        accountNumber,
        bankName,
        accountName,
        bankCode,
      });

      res.json(verification);
    } catch (error: any) {
      logger.error(`Account verification error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get supported banks
router.get(
  "/banks",
  generalRateLimit,
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const banks = await offrampServices.getBanks();
      res.json(banks);
    } catch (error: any) {
      logger.error(`Banks fetch error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post("/verify-offramp-transaction", transactionStatusTracker);

export default router;
