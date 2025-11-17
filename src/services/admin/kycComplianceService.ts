import { PrismaClient, VerificationStatus, VerificationType } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();

export interface KYCFilters {
  status?: VerificationStatus;
  type?: VerificationType;
  page?: number;
  limit?: number;
}

export class AdminKYCComplianceService {
  // 4.1 Pending KYC Reviews
  static async getPendingKYCReviews(filters: KYCFilters = {}) {
    try {
      const {
        status = VerificationStatus.PENDING,
        type,
        page = 1,
        limit = 20
      } = filters;

      const where: any = { status };
      if (type) where.type = type;

      const [verifications, total] = await Promise.all([
        prisma.verification.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                isVerified: true,
                ninVerified: true
              }
            }
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { submittedAt: 'desc' }
        }),
        prisma.verification.count({ where })
      ]);

      return {
        verifications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get pending KYC reviews', { error });
      throw error;
    }
  }

  // Get KYC Details
  static async getKYCDetails(verificationId: string) {
    try {
      const verification = await prisma.verification.findUnique({
        where: { id: verificationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              isVerified: true,
              ninVerified: true,
              createdAt: true
            }
          }
        }
      });

      if (!verification) {
        throw new Error('Verification not found');
      }

      return verification;
    } catch (error) {
      logger.error('Failed to get KYC details', { verificationId, error });
      throw error;
    }
  }

  // Approve KYC
  static async approveKYC(verificationId: string, adminId: string) {
    try {
      const verification = await prisma.verification.update({
        where: { id: verificationId },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedAt: new Date()
        },
        include: { user: true }
      });

      // Update user verification status based on type
      const updateData: any = {};
      if (verification.type === VerificationType.NIN) {
        updateData.ninVerified = true;
      }
      if (verification.type === VerificationType.EMAIL) {
        updateData.isVerified = true;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: verification.userId },
          data: updateData
        });
      }

      logger.info('KYC approved', {
        verificationId,
        userId: verification.userId,
        type: verification.type,
        adminId
      });

      return {
        success: true,
        message: 'KYC approved successfully',
        verification
      };
    } catch (error) {
      logger.error('Failed to approve KYC', { verificationId, error });
      throw error;
    }
  }

  // Reject KYC
  static async rejectKYC(verificationId: string, reason: string, adminId: string) {
    try {
      const verification = await prisma.verification.update({
        where: { id: verificationId },
        data: {
          status: VerificationStatus.REJECTED,
          reviewedAt: new Date(),
          verificationData: reason // Store rejection reason
        }
      });

      logger.info('KYC rejected', {
        verificationId,
        userId: verification.userId,
        reason,
        adminId
      });

      return {
        success: true,
        message: 'KYC rejected successfully',
        verification
      };
    } catch (error) {
      logger.error('Failed to reject KYC', { verificationId, error });
      throw error;
    }
  }

  // 4.2 Risk Monitoring - Get High Risk Users
  static async getHighRiskUsers() {
    try {
      // Users with multiple failed transactions
      const usersWithFailedTxs = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        _count: true,
        having: {
          userId: {
            _count: {
              gt: 5 // More than 5 failed transactions
            }
          }
        }
      });

      const highRiskUsers = await Promise.all(
        usersWithFailedTxs.map(async (item) => {
          const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              isActive: true,
              createdAt: true,
              lastLogin: true
            }
          });

          const recentSessions = await prisma.userSession.count({
            where: {
              userId: item.userId,
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          });

          return {
            user,
            failedTransactions: item._count,
            recentSessions,
            riskScore: this.calculateRiskScore(item._count, recentSessions)
          };
        })
      );

      return highRiskUsers.sort((a, b) => b.riskScore - a.riskScore);
    } catch (error) {
      logger.error('Failed to get high risk users', { error });
      throw error;
    }
  }

  // Calculate risk score (simple algorithm)
  private static calculateRiskScore(failedTxs: number, recentSessions: number): number {
    let score = 0;
    score += failedTxs * 10; // 10 points per failed transaction
    score += recentSessions > 10 ? 20 : 0; // 20 points for excessive sessions
    return Math.min(score, 100); // Cap at 100
  }

  // Get suspicious spending patterns
  static async getSuspiciousSpendingPatterns() {
    try {
      const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

      // Users with unusually high transaction volume
      const highVolumeUsers = await prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: recentDate },
          status: 'COMPLETED'
        },
        _sum: { amount: true },
        _count: true,
        having: {
          userId: {
            _count: {
              gt: 20 // More than 20 transactions in 24 hours
            }
          }
        }
      });

      const suspiciousUsers = await Promise.all(
        highVolumeUsers.map(async (item) => {
          const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true
            }
          });

          return {
            user,
            transactionCount: item._count,
            totalAmount: item._sum.amount || 0,
            period: '24h'
          };
        })
      );

      return suspiciousUsers;
    } catch (error) {
      logger.error('Failed to get suspicious spending patterns', { error });
      throw error;
    }
  }
}
