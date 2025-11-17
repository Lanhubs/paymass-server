import { PrismaClient, TransactionStatus, TransactionType, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export interface TransactionFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  userId?: string;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class AdminTransactionManagementService {
  // 5.1 All Transactions with Filters
  static async getAllTransactions(filters: TransactionFilters = {}) {
    try {
      const {
        status,
        type,
        userId,
        currency,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search,
        page = 1,
        limit = 50
      } = filters;

      const where: Prisma.TransactionWhereInput = {};

      if (status) where.status = status;
      if (type) where.type = type;
      if (userId) where.userId = userId;
      if (currency) where.currency = currency;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
      if (minAmount !== undefined || maxAmount !== undefined) {
        where.amount = {};
        if (minAmount !== undefined) where.amount.gte = minAmount;
        if (maxAmount !== undefined) where.amount.lte = maxAmount;
      }
      if (search) {
        where.OR = [
          { id: { contains: search } },
          { externalTxHash: { contains: search } },
          { externalRef: { contains: search } },
          { transactionId: { contains: search } },
          { accountNumber: { contains: search } }
        ];
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phoneNumber: true
              }
            },
            senderWallet: {
              select: {
                id: true,
                currency: true,
                network: true,
                address: true
              }
            },
            receiverWallet: {
              select: {
                id: true,
                currency: true,
                network: true,
                address: true
              }
            }
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.transaction.count({ where })
      ]);

      return {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get all transactions', { error });
      throw error;
    }
  }

  // 5.2 Transaction Details
  static async getTransactionDetails(transactionId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              accountNumber: true
            }
          },
          senderWallet: {
            select: {
              id: true,
              currency: true,
              network: true,
              address: true,
              balance: true
            }
          },
          receiverWallet: {
            select: {
              id: true,
              currency: true,
              network: true,
              address: true,
              balance: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction;
    } catch (error) {
      logger.error('Failed to get transaction details', { transactionId, error });
      throw error;
    }
  }

  // 5.3 Manual Controls - Approve Transaction
  static async approveTransaction(transactionId: string, adminId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        throw new Error('Only pending transactions can be approved');
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
          metadata: {
            ...(transaction.metadata as object || {}),
            approvedBy: adminId,
            approvedAt: new Date().toISOString()
          }
        }
      });

      logger.info('Transaction approved', { transactionId, adminId });

      return {
        success: true,
        message: 'Transaction approved successfully',
        transaction: updatedTransaction
      };
    } catch (error) {
      logger.error('Failed to approve transaction', { transactionId, error });
      throw error;
    }
  }

  // Cancel Transaction
  static async cancelTransaction(transactionId: string, reason: string, adminId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status === TransactionStatus.COMPLETED) {
        throw new Error('Cannot cancel completed transaction. Use reverse instead.');
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.CANCELLED,
          metadata: {
            ...(transaction.metadata as object || {}),
            cancelledBy: adminId,
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason
          }
        }
      });

      logger.info('Transaction cancelled', { transactionId, reason, adminId });

      return {
        success: true,
        message: 'Transaction cancelled successfully',
        transaction: updatedTransaction
      };
    } catch (error) {
      logger.error('Failed to cancel transaction', { transactionId, error });
      throw error;
    }
  }

  // Reverse Transaction
  static async reverseTransaction(transactionId: string, reason: string, adminId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          senderWallet: true,
          receiverWallet: true
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.COMPLETED) {
        throw new Error('Only completed transactions can be reversed');
      }

      // Create reversal transaction
      const reversalTx = await prisma.transaction.create({
        data: {
          userId: transaction.userId,
          senderWalletId: transaction.receiverWalletId,
          receiverWalletId: transaction.senderWalletId,
          type: transaction.type,
          status: TransactionStatus.COMPLETED,
          currency: transaction.currency,
          amount: transaction.amount,
          fee: 0, // No fee for reversal
          fiatAmount: transaction.fiatAmount,
          fiatCurrency: transaction.fiatCurrency,
          description: `Reversal of transaction ${transactionId}: ${reason}`,
          metadata: {
            originalTransactionId: transactionId,
            reversedBy: adminId,
            reversalReason: reason,
            reversedAt: new Date().toISOString()
          },
          completedAt: new Date()
        }
      });

      // Update original transaction
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          metadata: {
            ...(transaction.metadata as object || {}),
            reversed: true,
            reversalTransactionId: reversalTx.id,
            reversedBy: adminId,
            reversedAt: new Date().toISOString(),
            reversalReason: reason
          }
        }
      });

      // Update wallet balances
      if (transaction.senderWallet) {
        await prisma.wallet.update({
          where: { id: transaction.senderWallet.id },
          data: {
            balance: transaction.senderWallet.balance + transaction.amount + transaction.fee
          }
        });
      }

      if (transaction.receiverWallet) {
        await prisma.wallet.update({
          where: { id: transaction.receiverWallet.id },
          data: {
            balance: transaction.receiverWallet.balance - transaction.amount
          }
        });
      }

      logger.info('Transaction reversed', { transactionId, reversalTxId: reversalTx.id, reason, adminId });

      return {
        success: true,
        message: 'Transaction reversed successfully',
        originalTransaction: transaction,
        reversalTransaction: reversalTx
      };
    } catch (error) {
      logger.error('Failed to reverse transaction', { transactionId, error });
      throw error;
    }
  }

  // Retry Failed Transaction
  static async retryTransaction(transactionId: string, adminId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.FAILED) {
        throw new Error('Only failed transactions can be retried');
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.PENDING,
          metadata: {
            ...(transaction.metadata as object || {}),
            retriedBy: adminId,
            retriedAt: new Date().toISOString(),
            retryCount: ((transaction.metadata as any)?.retryCount || 0) + 1
          }
        }
      });

      logger.info('Transaction retry initiated', { transactionId, adminId });

      return {
        success: true,
        message: 'Transaction retry initiated',
        transaction: updatedTransaction
      };
    } catch (error) {
      logger.error('Failed to retry transaction', { transactionId, error });
      throw error;
    }
  }

  // Get Transaction Statistics
  static async getTransactionStatistics(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'daily':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'weekly':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'monthly':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      const [byStatus, byType, byCurrency] = await Promise.all([
        prisma.transaction.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { amount: true, fee: true }
        }),
        prisma.transaction.groupBy({
          by: ['type'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { amount: true, fee: true }
        }),
        prisma.transaction.groupBy({
          by: ['currency'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { amount: true, fee: true }
        })
      ]);

      return {
        period,
        byStatus,
        byType,
        byCurrency
      };
    } catch (error) {
      logger.error('Failed to get transaction statistics', { error });
      throw error;
    }
  }
}
