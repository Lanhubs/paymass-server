import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export interface TransactionLookup {
  transactionId?: string;
  email?: string;
  phoneNumber?: string;
  accountNumber?: string;
}

export class AdminSupportService {
  // 10.2 Transaction Look-up
  static async lookupTransaction(params: TransactionLookup) {
    try {
      const { transactionId, email, phoneNumber, accountNumber } = params;

      if (transactionId) {
        // Direct transaction lookup
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
                currency: true,
                network: true,
                address: true
              }
            },
            receiverWallet: {
              select: {
                currency: true,
                network: true,
                address: true
              }
            }
          }
        });

        return transaction ? [transaction] : [];
      }

      // User-based lookup
      let user = null;
      if (email) {
        user = await prisma.user.findUnique({ where: { email } });
      } else if (phoneNumber) {
        user = await prisma.user.findFirst({ where: { phoneNumber } });
      } else if (accountNumber) {
        user = await prisma.user.findUnique({ where: { accountNumber } });
      }

      if (!user) {
        return [];
      }

      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id },
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
              currency: true,
              network: true,
              address: true
            }
          },
          receiverWallet: {
            select: {
              currency: true,
              network: true,
              address: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return transactions;
    } catch (error) {
      logger.error('Failed to lookup transaction', { params, error });
      throw error;
    }
  }

  // 10.3 Manual Issue Resolution - Re-credit User
  static async recreditUser(
    userId: string,
    walletId: string,
    amount: number,
    reason: string,
    adminId: string,
    originalTransactionId?: string
  ) {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const newBalance = wallet.balance + amount;

      const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance }
      });

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          receiverWalletId: walletId,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          currency: wallet.currency,
          amount,
          fee: 0,
          description: `Manual re-credit: ${reason}`,
          metadata: {
            adminId,
            reason,
            originalTransactionId,
            previousBalance: wallet.balance,
            newBalance,
            isRecredit: true
          },
          completedAt: new Date()
        }
      });

      logger.info('User re-credited', {
        userId,
        walletId,
        amount,
        reason,
        adminId,
        transactionId: transaction.id
      });

      return {
        success: true,
        message: 'User re-credited successfully',
        wallet: updatedWallet,
        transaction
      };
    } catch (error) {
      logger.error('Failed to re-credit user', { userId, walletId, error });
      throw error;
    }
  }

  // Get User Support History
  static async getUserSupportHistory(userId: string) {
    try {
      // Get all admin-related transactions
      const adminTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          metadata: {
            path: ['adminId'],
            not: Prisma.AnyNull
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get user's verification history
      const verifications = await prisma.verification.findMany({
        where: { userId },
        orderBy: { submittedAt: 'desc' }
      });

      // Get account status changes (from sessions)
      const sessions = await prisma.userSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return {
        adminTransactions,
        verifications,
        recentSessions: sessions
      };
    } catch (error) {
      logger.error('Failed to get user support history', { userId, error });
      throw error;
    }
  }

  // Quick User Search
  static async quickUserSearch(query: string) {
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { phoneNumber: { contains: query } },
            { accountNumber: { contains: query } }
          ]
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          accountNumber: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLogin: true
        },
        take: 10
      });

      return users;
    } catch (error) {
      logger.error('Failed to search users', { query, error });
      throw error;
    }
  }

  // Get Failed Transactions for Resolution
  static async getFailedTransactions(limit: number = 50) {
    try {
      const failedTransactions = await prisma.transaction.findMany({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
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
              currency: true,
              network: true,
              balance: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return failedTransactions;
    } catch (error) {
      logger.error('Failed to get failed transactions', { error });
      throw error;
    }
  }
}
