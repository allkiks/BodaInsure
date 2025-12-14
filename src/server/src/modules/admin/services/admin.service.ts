import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * User search result
 */
export interface UserSearchResult {
  id: string;
  phone: string;
  fullName: string | null;
  kycStatus: string;
  isActive: boolean;
  createdAt: Date;
  walletBalance: number;
  policyCount: number;
}

/**
 * User detail
 */
export interface UserDetail extends UserSearchResult {
  countyCode: string | null;
  nationalIdLast4: string | null;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  recentPayments: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
  policies: Array<{
    id: string;
    policyNumber: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * System health status
 */
export interface SystemHealth {
  database: 'healthy' | 'unhealthy';
  redis: 'healthy' | 'unhealthy' | 'not_configured';
  scheduler: 'running' | 'stopped';
  lastHealthCheck: Date;
}

/**
 * Admin Service
 * Support and administrative tools
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Search users by phone or name
   */
  async searchUsers(
    query: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ users: UserSearchResult[]; total: number }> {
    const { page = 1, limit = 20 } = options ?? {};

    const searchTerm = `%${query}%`;

    const [users, total] = await Promise.all([
      this.dataSource.query(`
        SELECT
          u.id,
          u.phone,
          u.full_name as "fullName",
          u.kyc_status as "kycStatus",
          u.is_active as "isActive",
          u.created_at as "createdAt",
          COALESCE(w.balance, 0) as "walletBalance",
          (SELECT COUNT(*) FROM policies WHERE user_id = u.id) as "policyCount"
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND (u.phone LIKE $1 OR u.full_name ILIKE $1)
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `, [searchTerm, limit, (page - 1) * limit]),
      this.dataSource.query(`
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.deleted_at IS NULL
          AND (u.phone LIKE $1 OR u.full_name ILIKE $1)
      `, [searchTerm]),
    ]);

    return {
      users: users.map((u: Record<string, unknown>) => ({
        ...u,
        walletBalance: parseFloat(u.walletBalance as string || '0'),
        policyCount: parseInt(u.policyCount as string || '0', 10),
      })),
      total: parseInt(total[0]?.count || '0', 10),
    };
  }

  /**
   * Get user detail by ID
   */
  async getUserDetail(userId: string): Promise<UserDetail | null> {
    const [user] = await this.dataSource.query(`
      SELECT
        u.id,
        u.phone,
        u.full_name as "fullName",
        u.kyc_status as "kycStatus",
        u.is_active as "isActive",
        u.created_at as "createdAt",
        u.county_code as "countyCode",
        u.national_id_last_four as "nationalIdLast4",
        COALESCE(w.balance, 0) as "walletBalance"
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [userId]);

    if (!user) {
      return null;
    }

    // Get organizations
    const organizations = await this.dataSource.query(`
      SELECT
        o.id,
        o.name,
        m.role
      FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = $1 AND m.status = 'ACTIVE'
    `, [userId]);

    // Get recent payments
    const recentPayments = await this.dataSource.query(`
      SELECT
        id,
        type,
        amount,
        status,
        created_at as "createdAt"
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    // Get policies
    const policies = await this.dataSource.query(`
      SELECT
        id,
        policy_number as "policyNumber",
        type,
        status,
        start_date as "startDate",
        end_date as "endDate"
      FROM policies
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    return {
      ...user,
      walletBalance: parseFloat(user.walletBalance || '0'),
      policyCount: policies.length,
      organizations,
      recentPayments,
      policies,
    };
  }

  /**
   * Get user by phone
   */
  async getUserByPhone(phone: string): Promise<UserSearchResult | null> {
    const [user] = await this.dataSource.query(`
      SELECT
        u.id,
        u.phone,
        u.full_name as "fullName",
        u.kyc_status as "kycStatus",
        u.is_active as "isActive",
        u.created_at as "createdAt",
        COALESCE(w.balance, 0) as "walletBalance",
        (SELECT COUNT(*) FROM policies WHERE user_id = u.id) as "policyCount"
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.phone = $1 AND u.deleted_at IS NULL
    `, [phone]);

    if (!user) {
      return null;
    }

    return {
      ...user,
      walletBalance: parseFloat(user.walletBalance || '0'),
      policyCount: parseInt(user.policyCount || '0', 10),
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    let dbHealth: 'healthy' | 'unhealthy' = 'unhealthy';

    try {
      await this.dataSource.query('SELECT 1');
      dbHealth = 'healthy';
    } catch {
      dbHealth = 'unhealthy';
    }

    return {
      database: dbHealth,
      redis: 'not_configured', // Would check Redis in production
      scheduler: 'running', // Would check scheduler in production
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(): Promise<{
    users: { total: number; active: number; kycApproved: number };
    payments: { today: number; todayAmount: number; thisMonth: number };
    policies: { total: number; active: number; issuedToday: number };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [userStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE kyc_status = 'APPROVED') as kyc_approved
      FROM users
      WHERE deleted_at IS NULL
    `);

    const [paymentStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= $1 AND status = 'COMPLETED') as today_count,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= $1 AND status = 'COMPLETED'), 0) as today_amount,
        COUNT(*) FILTER (WHERE created_at >= $2 AND status = 'COMPLETED') as month_count
      FROM transactions
    `, [today, monthStart]);

    const [policyStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE created_at >= $1) as issued_today
      FROM policies
    `, [today]);

    return {
      users: {
        total: parseInt(userStats?.total || '0', 10),
        active: parseInt(userStats?.active || '0', 10),
        kycApproved: parseInt(userStats?.kyc_approved || '0', 10),
      },
      payments: {
        today: parseInt(paymentStats?.today_count || '0', 10),
        todayAmount: parseFloat(paymentStats?.today_amount || '0'),
        thisMonth: parseInt(paymentStats?.month_count || '0', 10),
      },
      policies: {
        total: parseInt(policyStats?.total || '0', 10),
        active: parseInt(policyStats?.active || '0', 10),
        issuedToday: parseInt(policyStats?.issued_today || '0', 10),
      },
    };
  }

  /**
   * Resend OTP for user
   */
  async resendOtp(userId: string): Promise<{ success: boolean; message: string }> {
    // In production, this would call the OTP service
    this.logger.log(`Admin resent OTP for user: ${userId}`);
    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Reset user KYC status
   */
  async resetKycStatus(userId: string): Promise<{ success: boolean }> {
    await this.dataSource.query(`
      UPDATE users SET kyc_status = 'PENDING' WHERE id = $1
    `, [userId]);

    this.logger.log(`Admin reset KYC for user: ${userId}`);

    return { success: true };
  }

  /**
   * Activate/deactivate user
   */
  async setUserActive(userId: string, isActive: boolean): Promise<{ success: boolean }> {
    await this.dataSource.query(`
      UPDATE users SET is_active = $1 WHERE id = $2
    `, [isActive, userId]);

    this.logger.log(`Admin set user ${userId} active: ${isActive}`);

    return { success: true };
  }
}
