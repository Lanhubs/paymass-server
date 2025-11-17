import { Router } from "express";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { AdminAuthService } from "../services/admin/auth-service";
import { AdminDashboardService } from "../services/admin/dashboardService";
import { AdminUserManagementService } from "../services/admin/userManagementService";
import { AdminKYCComplianceService } from "../services/admin/kycComplianceService";
import { AdminTransactionManagementService } from "../services/admin/transactionManagementService";
import { AdminRevenueService } from "../services/admin/revenueService";
import { AdminSupportService } from "../services/admin/supportService";

const router = Router();

// ============================================
// 1. ADMIN AUTHENTICATION
// ============================================
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await AdminAuthService.login({ email, password });
    res.json(data);
  } catch (error) {
    console.error(error);
    res
      .status(401)
      .json({
        error: error instanceof Error ? error.message : "Authentication failed",
      });
  }
});

router.get(
  "/admin/profile",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId;
      const admin = await AdminAuthService.getAdmin(userId as string);
      res.json(admin);
    } catch (error) {
      res.status(404).json({ error: "Admin not found" });
    }
  }
);

// ============================================
// 2. DASHBOARD OVERVIEW
// ============================================
router.get(
  "/admin/dashboard/overview",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const period =
        (req.query.period as "daily" | "weekly" | "monthly") || "daily";
      const data = await AdminDashboardService.getDashboardOverview(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard overview" });
    }
  }
);

router.get(
  "/admin/dashboard/trends",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await AdminDashboardService.getTransactionTrends(days);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction trends" });
    }
  }
);

// ============================================
// 3. USER MANAGEMENT
// ============================================
router.get(
  "/admin/users",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const filters = {
        search: req.query.search as string,
        isActive:
          req.query.isActive === "true"
            ? true
            : req.query.isActive === "false"
            ? false
            : undefined,
        isVerified:
          req.query.isVerified === "true"
            ? true
            : req.query.isVerified === "false"
            ? false
            : undefined,
        ninVerified:
          req.query.ninVerified === "true"
            ? true
            : req.query.ninVerified === "false"
            ? false
            : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };
      const data = await AdminUserManagementService.getUserList(filters);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

router.get(
  "/admin/users/:userId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const data = await AdminUserManagementService.getUserDetails(userId);
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: "User not found" });
    }
  }
);

router.post(
  "/admin/users/:userId/freeze",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const data = await AdminUserManagementService.freezeAccount(
        userId,
        reason
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to freeze account" });
    }
  }
);

router.post(
  "/admin/users/:userId/unfreeze",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const data = await AdminUserManagementService.unfreezeAccount(userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to unfreeze account" });
    }
  }
);

router.post(
  "/admin/users/:userId/adjust-balance",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const { walletId, amount, reason } = req.body;
      const adminId = req.user?.userId || "";
      const data = await AdminUserManagementService.adjustBalance(
        userId,
        walletId,
        amount,
        reason,
        adminId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error ? error.message : "Failed to adjust balance",
        });
    }
  }
);

router.post(
  "/admin/users/:userId/reset-pin",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.user?.userId || "";
      const data = await AdminUserManagementService.resetUserPin(
        userId,
        adminId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to reset PIN" });
    }
  }
);

// ============================================
// 4. KYC & COMPLIANCE
// ============================================
router.get(
  "/admin/kyc/pending",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const filters = {
        status: req.query.status as any,
        type: req.query.type as any,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };
      const data = await AdminKYCComplianceService.getPendingKYCReviews(
        filters
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KYC reviews" });
    }
  }
);

router.get(
  "/admin/kyc/:verificationId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { verificationId } = req.params;
      const data = await AdminKYCComplianceService.getKYCDetails(
        verificationId
      );
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: "Verification not found" });
    }
  }
);

router.post(
  "/admin/kyc/:verificationId/approve",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { verificationId } = req.params;
      const adminId = req.user?.userId || "";
      const data = await AdminKYCComplianceService.approveKYC(
        verificationId,
        adminId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve KYC" });
    }
  }
);

router.post(
  "/admin/kyc/:verificationId/reject",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { verificationId } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.userId || "";
      const data = await AdminKYCComplianceService.rejectKYC(
        verificationId,
        reason,
        adminId
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject KYC" });
    }
  }
);

router.get(
  "/admin/compliance/high-risk-users",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = await AdminKYCComplianceService.getHighRiskUsers();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch high risk users" });
    }
  }
);

router.get(
  "/admin/compliance/suspicious-patterns",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data =
        await AdminKYCComplianceService.getSuspiciousSpendingPatterns();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suspicious patterns" });
    }
  }
);

// ============================================
// 5. TRANSACTION MANAGEMENT
// ============================================
router.get(
  "/admin/transactions",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const filters = {
        status: req.query.status as any,
        type: req.query.type as any,
        userId: req.query.userId as string,
        currency: req.query.currency as string,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        minAmount: req.query.minAmount
          ? parseFloat(req.query.minAmount as string)
          : undefined,
        maxAmount: req.query.maxAmount
          ? parseFloat(req.query.maxAmount as string)
          : undefined,
        search: req.query.search as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };
      const data = await AdminTransactionManagementService.getAllTransactions(
        filters
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  }
);

router.get(
  "/admin/transactions/:transactionId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionId } = req.params;
      const data =
        await AdminTransactionManagementService.getTransactionDetails(
          transactionId
        );
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: "Transaction not found" });
    }
  }
);

router.post(
  "/admin/transactions/:transactionId/approve",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionId } = req.params;
      const adminId = req.user?.userId || "";
      const data = await AdminTransactionManagementService.approveTransaction(
        transactionId,
        adminId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to approve transaction",
        });
    }
  }
);

router.post(
  "/admin/transactions/:transactionId/cancel",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.userId || "";
      const data = await AdminTransactionManagementService.cancelTransaction(
        transactionId,
        reason,
        adminId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to cancel transaction",
        });
    }
  }
);

router.post(
  "/admin/transactions/:transactionId/reverse",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const adminId = req.user?.userId || "";
      const data = await AdminTransactionManagementService.reverseTransaction(
        transactionId,
        reason,
        adminId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to reverse transaction",
        });
    }
  }
);

router.post(
  "/admin/transactions/:transactionId/retry",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transactionId } = req.params;
      const adminId = req.user?.userId || "";
      const data = await AdminTransactionManagementService.retryTransaction(
        transactionId,
        adminId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to retry transaction",
        });
    }
  }
);

router.get(
  "/admin/transactions/statistics",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const period =
        (req.query.period as "daily" | "weekly" | "monthly") || "daily";
      const data =
        await AdminTransactionManagementService.getTransactionStatistics(
          period
        );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction statistics" });
    }
  }
);

// ============================================
// 9. REVENUE & FEES
// ============================================
router.get(
  "/admin/revenue/fees",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const period =
        (req.query.period as "daily" | "weekly" | "monthly") || "daily";
      const data = await AdminRevenueService.getFeesOverview(period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fees overview" });
    }
  }
);

router.get(
  "/admin/revenue/report",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const data = await AdminRevenueService.getRevenueReport(
        startDate,
        endDate
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate revenue report" });
    }
  }
);

router.get(
  "/admin/revenue/daily",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await AdminRevenueService.getDailyRevenue(days);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily revenue" });
    }
  }
);

router.get(
  "/admin/revenue/top-users",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const period =
        (req.query.period as "daily" | "weekly" | "monthly") || "monthly";
      const data = await AdminRevenueService.getTopRevenueUsers(limit, period);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top revenue users" });
    }
  }
);

// ============================================
// 10. SUPPORT & OPERATIONS
// ============================================
router.post(
  "/admin/support/lookup",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = req.body;
      const data = await AdminSupportService.lookupTransaction(params);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup transaction" });
    }
  }
);

router.post(
  "/admin/support/recredit",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, walletId, amount, reason, originalTransactionId } =
        req.body;
      const adminId = req.user?.userId || "";
      const data = await AdminSupportService.recreditUser(
        userId,
        walletId,
        amount,
        reason,
        adminId,
        originalTransactionId
      );
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({
          error:
            error instanceof Error ? error.message : "Failed to re-credit user",
        });
    }
  }
);

router.get(
  "/admin/support/user-history/:userId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const data = await AdminSupportService.getUserSupportHistory(userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user support history" });
    }
  }
);

router.get(
  "/admin/support/search",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const query = req.query.q as string;
      const data = await AdminSupportService.quickUserSearch(query);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  }
);

router.get(
  "/admin/support/failed-transactions",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const data = await AdminSupportService.getFailedTransactions(limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch failed transactions" });
    }
  }
);

export default router;
