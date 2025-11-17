import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export interface UserFilters {
  search?: string;
  isActive?: boolean;
  isVerified?: boolean;
  ninVerified?: boolean;
  page?: number;
  limit?: number;
}

export class AdminUserManagementService {
  // 3.1 User List with Search and Filters
  static async getUserList(filters: UserFilters = {}) {
    try {
      const {
        search,
        isActive,
        isVerified,
        ninVerified,
        page = 1,
        limit = 20
      } = filters;

      const where: Prisma.UserWhereInput = {};

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
          { accountNumber: { contains: search } }
        ];
      }

      if (isActive !== undefined) where.isActive = isActive;
      if (isVerified !== undefined) where.isVerified = isVerified;
      if (ninVerified !== undefined) where.ninVerified = ninVerified;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            accountNumber: true,
            isActive: true,
            isVerified: true,
            ninVerified: true,
            createdAt: true,
            lastLogin: true,
            _count: {
              select: {
                transactions: true,
                wallets: true
              }
            }
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user list', { error });
      throw error;
    }
  }

  // 3.2 User Details Page
  static async getUserDetails(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallets: {
            select: {
              id: true,
              currency: true,
              network: true,
              address: true,
              balance: true,
              isActive: true,
              createdAt: true
            }
          },
          transactions: {
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              status: true,
              currency: true,
              amount: true,
              fee: true,
              fiatAmount: true,
              fiatCurrency: true,
              createdAt: true,
              completedAt: true
            }
          },
          verifications: {
            orderBy: { submittedAt: 'desc' }
          },
          sessions: {
            where: { isActive: true },
            orderBy: { lastUsedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate user statistics
      const stats = await prisma.transaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED'
        },
        _sum: { amount: true, fiatAmount: true, fee: true },
        _count: true
      });

      // Calculate total wallet balance
      const totalBalance = user.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

      return {
        user: {
          ...user,
          password: undefined, // Remove sensitive data
          transactionPin: undefined
        },
        statistics: {
          totalTransactions: stats._count,
          totalSpent: stats._sum.amount || 0,
          totalFiatSpent: stats._sum.fiatAmount || 0,
          totalFees: stats._sum.fee || 0,
          totalBalance
        }
      };
    } catch (error) {
      logger.error('Failed to get user details', { userId, error });
      throw error;
    }
  }

  // 3.3 Admin Actions - Freeze Account
  static async freezeAccount(userId: string, reason?: string) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      // Deactivate all active sessions
      await prisma.userSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });

      logger.info('Account frozen', { userId, reason });

      return {
        success: true,
        message: 'Account frozen successfully',
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive
        }
      };
    } catch (error) {
      logger.error('Failed to freeze account', { userId, error });
      throw error;
    }
  }

  // Unfreeze Account
  static async unfreezeAccount(userId: string) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true }
      });

      logger.info('Account unfrozen', { userId });

      return {
        success: true,
        message: 'Account unfrozen successfully',
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive
        }
      };
    } catch (error) {
      logger.error('Failed to unfreeze account', { userId, error });
      throw error;
    }
  }

  // Manual Balance Adjustment
  static async adjustBalance(
    userId: string,
    walletId: string,
    amount: number,
    reason: string,
    adminId: string
  ) {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const newBalance = wallet.balance + amount;

      if (newBalance < 0) {
        throw new Error('Insufficient balance for debit');
      }

      const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance }
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId,
          senderWalletId: amount < 0 ? walletId : undefined,
          receiverWalletId: amount > 0 ? walletId : undefined,
          type: amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
          status: 'COMPLETED',
          currency: wallet.currency,
          amount: Math.abs(amount),
          description: `Admin adjustment: ${reason}`,
          metadata: {
            adminId,
            reason,
            previousBalance: wallet.balance,
            newBalance
          },
          completedAt: new Date()
        }
      });

      logger.info('Balance adjusted', {
        userId,
        walletId,
        amount,
        reason,
        adminId
      });

      return {
        success: true,
        message: 'Balance adjusted successfully',
        wallet: updatedWallet
      };
    } catch (error) {
      logger.error('Failed to adjust balance', { userId, walletId, error });
      throw error;
    }
  }

  // Reset User PIN
  static async resetUserPin(userId: string, adminId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          transactionPin: null,
          pinSetupAt: null,
          pinUpdatedAt: null
        }
      });

      logger.info('User PIN reset', { userId, adminId });

      return {
        success: true,
        message: 'User PIN reset successfully'
      };
    } catch (error) {
      logger.error('Failed to reset user PIN', { userId, error });
      throw error;
    }
  }
}
