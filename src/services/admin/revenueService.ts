import { PrismaClient, TransactionStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export class AdminRevenueService {
  // 9.1 Fees Overview
  static async getFeesOverview(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
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

      const feesByType = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: startDate }
        },
        _sum: { fee: true },
        _count: true
      });

      const totalFees = await prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: startDate }
        },
        _sum: { fee: true }
      });

      return {
        period,
        totalFees: totalFees._sum.fee || 0,
        feesByType: feesByType.map(item => ({
          type: item.type,
          totalFees: item._sum.fee || 0,
          transactionCount: item._count
        }))
      };
    } catch (error) {
      logger.error('Failed to get fees overview', { error });
      throw error;
    }
  }

  // 9.2 Revenue Reports
  static async getRevenueReport(startDate: Date, endDate: Date) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          type: true,
          currency: true,
          amount: true,
          fee: true,
          fiatAmount: true,
          fiatCurrency: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const summary = {
        totalTransactions: transactions.length,
        totalVolume: transactions.reduce((sum, tx) => sum + tx.amount, 0),
        totalFees: transactions.reduce((sum, tx) => sum + tx.fee, 0),
        totalFiatVolume: transactions.reduce((sum, tx) => sum + (tx.fiatAmount || 0), 0),
        byType: {} as Record<string, { count: number; volume: number; fees: number }>,
        byCurrency: {} as Record<string, { count: number; volume: number; fees: number }>
      };

      // Group by type
      transactions.forEach(tx => {
        if (!summary.byType[tx.type]) {
          summary.byType[tx.type] = { count: 0, volume: 0, fees: 0 };
        }
        summary.byType[tx.type].count++;
        summary.byType[tx.type].volume += tx.amount;
        summary.byType[tx.type].fees += tx.fee;
      });

      // Group by currency
      transactions.forEach(tx => {
        if (!summary.byCurrency[tx.currency]) {
          summary.byCurrency[tx.currency] = { count: 0, volume: 0, fees: 0 };
        }
        summary.byCurrency[tx.currency].count++;
        summary.byCurrency[tx.currency].volume += tx.amount;
        summary.byCurrency[tx.currency].fees += tx.fee;
      });

      return {
        period: {
          startDate,
          endDate
        },
        summary,
        transactions
      };
    } catch (error) {
      logger.error('Failed to get revenue report', { error });
      throw error;
    }
  }

  // Daily Revenue
  static async getDailyRevenue(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyRevenue = await prisma.$queryRaw<Array<{
        date: Date;
        transaction_count: bigint;
        total_volume: number;
        total_fees: number;
      }>>`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transaction_count,
          SUM(amount) as total_volume,
          SUM(fee) as total_fees
        FROM transactions
        WHERE status = 'COMPLETED'
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      return dailyRevenue.map(day => ({
        date: day.date,
        transactionCount: Number(day.transaction_count),
        totalVolume: day.total_volume || 0,
        totalFees: day.total_fees || 0
      }));
    } catch (error) {
      logger.error('Failed to get daily revenue', { error });
      throw error;
    }
  }

  // Top Revenue Generating Users
  static async getTopRevenueUsers(limit: number = 10, period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
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

      const topUsers = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: startDate }
        },
        _sum: { fee: true, amount: true },
        _count: true,
        orderBy: { _sum: { fee: 'desc' } },
        take: limit
      });

      const topUsersWithDetails = await Promise.all(
        topUsers.map(async (item) => {
          const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true
            }
          });

          return {
            user,
            totalFees: item._sum.fee || 0,
            totalVolume: item._sum.amount || 0,
            transactionCount: item._count
          };
        })
      );

      return topUsersWithDetails;
    } catch (error) {
      logger.error('Failed to get top revenue users', { error });
      throw error;
    }
  }
}
