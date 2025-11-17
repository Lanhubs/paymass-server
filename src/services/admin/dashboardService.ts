import { PrismaClient, TransactionStatus, TransactionType } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export class AdminDashboardService {
  // 2. Main Dashboard Overview
  static async getDashboardOverview(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
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

      const [
        totalUsers,
        activeUsers,
        totalTransactions,
        pendingTransactions,
        failedTransactions,
        successfulTransactions,
        totalVolume,
        totalFees
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.transaction.count({ where: { createdAt: { gte: startDate } } }),
        prisma.transaction.count({
          where: {
            status: TransactionStatus.PENDING,
            createdAt: { gte: startDate }
          }
        }),
        prisma.transaction.count({
          where: {
            status: TransactionStatus.FAILED,
            createdAt: { gte: startDate }
          }
        }),
        prisma.transaction.count({
          where: {
            status: TransactionStatus.COMPLETED,
            createdAt: { gte: startDate }
          }
        }),
        prisma.transaction.aggregate({
          where: {
            status: TransactionStatus.COMPLETED,
            createdAt: { gte: startDate }
          },
          _sum: { amount: true, fiatAmount: true }
        }),
        prisma.transaction.aggregate({
          where: {
            status: TransactionStatus.COMPLETED,
            createdAt: { gte: startDate }
          },
          _sum: { fee: true }
        })
      ]);

      // Get top spending users
      const topUsers = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: startDate }
        },
        _sum: { amount: true, fiatAmount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
      });

      const topUsersWithDetails = await Promise.all(
        topUsers.map(async (item) => {
          const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          });
          return {
            user,
            totalSpent: item._sum.amount || 0,
            totalFiatSpent: item._sum.fiatAmount || 0,
            transactionCount: item._count
          };
        })
      );

      return {
        period,
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers
        },
        transactions: {
          total: totalTransactions,
          pending: pendingTransactions,
          failed: failedTransactions,
          successful: successfulTransactions,
          successRate: totalTransactions > 0
            ? ((successfulTransactions / totalTransactions) * 100).toFixed(2)
            : 0
        },
        volume: {
          totalCrypto: totalVolume._sum.amount || 0,
          totalFiat: totalVolume._sum.fiatAmount || 0,
          totalFees: totalFees._sum.fee || 0
        },
        topUsers: topUsersWithDetails
      };
    } catch (error) {
      logger.error('Failed to get dashboard overview', { error });
      throw error;
    }
  }

  // Get transaction trends
  static async getTransactionTrends(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const transactions = await prisma.transaction.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: true,
        _sum: { amount: true, fiatAmount: true, fee: true }
      });

      return transactions.map(t => ({
        date: t.createdAt,
        count: t._count,
        volume: t._sum.amount || 0,
        fiatVolume: t._sum.fiatAmount || 0,
        fees: t._sum.fee || 0
      }));
    } catch (error) {
      logger.error('Failed to get transaction trends', { error });
      throw error;
    }
  }
}
