import { PrismaClient, TransactionStatus, TransactionType } from '@prisma/client';
import { EncryptionService } from '../utils/encryption';
import { WalletService } from './walletService';
import { logger } from '../utils/logger';
import {blockradar} from '../utils/apis';

const prisma = new PrismaClient();

export interface SendTransactionRequest {
  fromWalletId: string;
  toAddress: string;
  amount: number;
  currency: 'SOL' | 'USDT' | 'USDC';
  description?: string;
}

export interface TransactionResponse {
  id: string;
  status: TransactionStatus;
  txHash?: string;
  fee: number;
  estimatedConfirmation?: string;
}

export interface TransactionHistory {
  transactions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class TransactionService {
  private static calculateTransactionFee(currency: string, amount: number): number {
    const baseFees = {
      SOL: 0.00025,
      USDT: 1.0,
      USDC: 1.0
    };

    const percentageFee = amount * 0.001;
    const baseFee = baseFees[currency as keyof typeof baseFees] || 1.0;

    return Math.max(percentageFee, baseFee);
  }

  static async processIncomingTransaction(
    walletAddress: string,
    fromAddress: string,
    amount: number,
    currency: string,
    txHash: string
  ): Promise<void> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: {
          address: walletAddress,
          currency,
          isActive: true
        },
        include: { user: true }
      });

      if (!wallet) {
        logger.warn('Incoming transaction for unknown wallet', { walletAddress, txHash });
        return;
      }

      const existingTx = await prisma.transaction.findFirst({
        where: { externalTxHash: txHash }
      });

      if (existingTx) {
        logger.info('Transaction already processed', { txHash });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            userId: wallet.userId,
            receiverWalletId: wallet.id,
            type: TransactionType.RECEIVE,
            status: TransactionStatus.COMPLETED,
            currency,
            amount,
            fee: 0,
            externalAddress: fromAddress,
            externalTxHash: txHash,
            description: `Received ${currency} from external wallet`,
            completedAt: new Date()
          }
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              increment: amount
            }
          }
        });
      });

      logger.info('Incoming transaction processed', {
        walletAddress,
        amount,
        currency,
        txHash,
        userId: wallet.userId
      });
    } catch (error) {
      logger.error('Failed to process incoming transaction', { error, txHash });
      throw error;
    }
  }

  static async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    currency?: string,
    type?: TransactionType
  ): Promise<TransactionHistory> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { userId, isActive: true },
        select: { address: true }
      });

      if (!wallet) {
        return {
          transactions: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        };
      }

      const response = await blockradar.get(`/addresses/${wallet.address}/transactions`, {
        params: { page, limit }
      });

      const transactions = response.data?.data || [];
      const total = response.data?.pagination?.total || transactions.length;

      const formattedTransactions = transactions.map((tx: any) => ({
        id: tx.id || tx.hash,
        type: tx.type || 'SEND',
        status: tx.status || 'COMPLETED',
        currency: tx.asset?.symbol || 'SOL',
        amount: parseFloat(tx.amount || '0'),
        fee: parseFloat(tx.fee || '0'),
        externalAddress: tx.to || tx.from,
        externalTxHash: tx.hash,
        createdAt: new Date(tx.createdAt || tx.timestamp || Date.now())
      }));

      return {
        transactions: formattedTransactions,
        pagination: { 
          page, 
          limit, 
          total, 
          totalPages: Math.ceil(total / limit) 
        }
      };

    } catch (error) {
      logger.error('BlockRadar failed, using local DB', { userId, error });
      
      const skip = (page - 1) * limit;
      const where: any = { userId };
      if (currency) where.currency = currency;
      if (type) where.type = type;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.transaction.count({ where })
      ]);

      return {
        transactions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      };
    }
  }

  static async getTransactionById(userId: string, transactionId: string) {
    try {
      const transaction = await prisma.transaction.findFirst({
        where: { id: transactionId, userId },
        include: {
          senderWallet: { select: { address: true, currency: true } },
          receiverWallet: { select: { address: true, currency: true } }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        currency: transaction.currency,
        amount: transaction.amount,
        fee: transaction.fee,
        description: transaction.description,
        externalAddress: transaction.externalAddress,
        externalTxHash: transaction.externalTxHash,
        senderWallet: transaction.senderWallet,
        receiverWallet: transaction.receiverWallet,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt
      };
    } catch (error) {
      logger.error('Failed to get transaction', { userId, transactionId, error });
      throw error;
    }
  }

  static async getWalletSummary(userId: string, currency?: string) {
    try {
      const where: any = { userId, isActive: true };
      if (currency) where.currency = currency;

      const wallets = await prisma.wallet.findMany({
        where,
        select: {
          id: true,
          currency: true,
          address: true,
          balance: true,
          updatedAt: true
        }
      });

      const walletsWithTransactions = await Promise.all(
        wallets.map(async (wallet) => {
          const recentTransactions = await prisma.transaction.findMany({
            where: {
              userId,
              OR: [
                { senderWalletId: wallet.id },
                { receiverWalletId: wallet.id }
              ]
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              type: true,
              status: true,
              amount: true,
              createdAt: true,
              externalTxHash: true
            }
          });

          return {
            ...wallet,
            balance: wallet.balance,
            recentTransactions: recentTransactions.map(tx => ({
              ...tx,
              amount: tx.amount
            }))
          };
        })
      );

      return walletsWithTransactions;
    } catch (error) {
      logger.error('Failed to get wallet summary', { userId, error });
      throw new Error('Failed to retrieve wallet summary');
    }
  }

  static estimateTransactionFee(currency: string, amount: number): number {
    return this.calculateTransactionFee(currency, amount);
  }
}