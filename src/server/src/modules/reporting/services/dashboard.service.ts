import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Enrollment metrics
 */
export interface EnrollmentMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  kycPending: number;
  kycApproved: number;
  kycRejected: number;
  byCounty: Array<{ countyCode: string; count: number }>;
}

/**
 * Payment metrics
 */
export interface PaymentMetrics {
  totalTransactions: number;
  totalAmount: number;
  depositsToday: number;
  depositAmountToday: number;
  dailyPaymentsToday: number;
  dailyPaymentAmountToday: number;
  averagePaymentAmount: number;
  successRate: number;
  failedTransactions: number;
  pendingTransactions: number;
}

/**
 * Policy metrics
 */
export interface PolicyMetrics {
  totalPolicies: number;
  activePolicies: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  issuedToday: number;
  issuedThisWeek: number;
  issuedThisMonth: number;
  lapsedPolicies: number;
  averageDaysToCompletion: number;
}

/**
 * Organization metrics
 */
export interface OrganizationMetrics {
  totalOrganizations: number;
  activeOrganizations: number;
  totalMembers: number;
  topOrganizations: Array<{
    id: string;
    name: string;
    memberCount: number;
    policyCount: number;
  }>;
  byType: Record<string, number>;
}

/**
 * Dashboard summary
 */
export interface DashboardSummary {
  enrollment: EnrollmentMetrics;
  payments: PaymentMetrics;
  policies: PolicyMetrics;
  organizations: OrganizationMetrics;
  lastUpdated: Date;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/**
 * Dashboard Service
 * Provides real-time metrics and dashboard data
 */
@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get enrollment metrics
   */
  async getEnrollmentMetrics(organizationId?: string): Promise<EnrollmentMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Build base query with optional organization filter
    const orgFilter = organizationId
      ? `AND u.id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const [userStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_users,
        COUNT(*) FILTER (WHERE created_at >= $1) as new_today,
        COUNT(*) FILTER (WHERE created_at >= $2) as new_this_week,
        COUNT(*) FILTER (WHERE created_at >= $3) as new_this_month
      FROM users u
      WHERE deleted_at IS NULL ${orgFilter}
    `, [today, weekAgo, monthAgo]);

    const [kycStats] = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE kyc_status = 'PENDING') as kyc_pending,
        COUNT(*) FILTER (WHERE kyc_status = 'APPROVED') as kyc_approved,
        COUNT(*) FILTER (WHERE kyc_status = 'REJECTED') as kyc_rejected
      FROM users u
      WHERE deleted_at IS NULL ${orgFilter}
    `);

    // Note: county_code column doesn't exist in users table yet
    // This will return empty array until the column is added
    const byCounty: Array<{ countyCode: string; count: string }> = [];

    return {
      totalUsers: parseInt(userStats?.total_users || '0', 10),
      activeUsers: parseInt(userStats?.active_users || '0', 10),
      newUsersToday: parseInt(userStats?.new_today || '0', 10),
      newUsersThisWeek: parseInt(userStats?.new_this_week || '0', 10),
      newUsersThisMonth: parseInt(userStats?.new_this_month || '0', 10),
      kycPending: parseInt(kycStats?.kyc_pending || '0', 10),
      kycApproved: parseInt(kycStats?.kyc_approved || '0', 10),
      kycRejected: parseInt(kycStats?.kyc_rejected || '0', 10),
      byCounty: byCounty.map((r: { countyCode: string; count: string }) => ({
        countyCode: r.countyCode,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Get payment metrics
   */
  async getPaymentMetrics(organizationId?: string): Promise<PaymentMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build base query with optional organization filter
    const orgFilter = organizationId
      ? `AND t.user_id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const [stats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE type = 'DEPOSIT' AND created_at >= $1 AND status = 'COMPLETED') as deposits_today,
        COALESCE(SUM(amount) FILTER (WHERE type = 'DEPOSIT' AND created_at >= $1 AND status = 'COMPLETED'), 0) as deposit_amount_today,
        COUNT(*) FILTER (WHERE type = 'DAILY_PAYMENT' AND created_at >= $1 AND status = 'COMPLETED') as daily_payments_today,
        COALESCE(SUM(amount) FILTER (WHERE type = 'DAILY_PAYMENT' AND created_at >= $1 AND status = 'COMPLETED'), 0) as daily_amount_today,
        COALESCE(AVG(amount) FILTER (WHERE status = 'COMPLETED'), 0) as avg_amount,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
      FROM transactions t
      WHERE 1=1 ${orgFilter}
    `, [today]);

    const completed = parseInt(stats?.completed || '0', 10);
    const total = parseInt(stats?.total_transactions || '0', 10);
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      totalTransactions: total,
      totalAmount: parseFloat(stats?.total_amount || '0'),
      depositsToday: parseInt(stats?.deposits_today || '0', 10),
      depositAmountToday: parseFloat(stats?.deposit_amount_today || '0'),
      dailyPaymentsToday: parseInt(stats?.daily_payments_today || '0', 10),
      dailyPaymentAmountToday: parseFloat(stats?.daily_amount_today || '0'),
      averagePaymentAmount: parseFloat(stats?.avg_amount || '0'),
      successRate: Math.round(successRate * 100) / 100,
      failedTransactions: parseInt(stats?.failed || '0', 10),
      pendingTransactions: parseInt(stats?.pending || '0', 10),
    };
  }

  /**
   * Get policy metrics
   */
  async getPolicyMetrics(organizationId?: string): Promise<PolicyMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const monthFromNow = new Date(today);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const orgFilter = organizationId
      ? `AND p.user_id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const [stats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_policies,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_policies,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at BETWEEN $1 AND $2) as expiring_this_week,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at BETWEEN $1 AND $3) as expiring_this_month,
        COUNT(*) FILTER (WHERE created_at >= $1) as issued_today,
        COUNT(*) FILTER (WHERE created_at >= $4) as issued_this_week,
        COUNT(*) FILTER (WHERE created_at >= $5) as issued_this_month,
        COUNT(*) FILTER (WHERE status = 'LAPSED') as lapsed
      FROM policies p
      WHERE 1=1 ${orgFilter}
    `, [today, weekFromNow, monthFromNow, weekAgo, monthAgo]);

    // Note: user_journeys table doesn't exist yet
    // This will return 0 until the table is added
    const avgDays = { avg_days: '0' };

    return {
      totalPolicies: parseInt(stats?.total_policies || '0', 10),
      activePolicies: parseInt(stats?.active_policies || '0', 10),
      expiringThisWeek: parseInt(stats?.expiring_this_week || '0', 10),
      expiringThisMonth: parseInt(stats?.expiring_this_month || '0', 10),
      issuedToday: parseInt(stats?.issued_today || '0', 10),
      issuedThisWeek: parseInt(stats?.issued_this_week || '0', 10),
      issuedThisMonth: parseInt(stats?.issued_this_month || '0', 10),
      lapsedPolicies: parseInt(stats?.lapsed || '0', 10),
      averageDaysToCompletion: Math.round(parseFloat(avgDays?.avg_days || '0')),
    };
  }

  /**
   * Get organization metrics
   */
  async getOrganizationMetrics(): Promise<OrganizationMetrics> {
    const [stats] = await this.dataSource.query(`
      SELECT
        COUNT(*) as total_organizations,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_organizations,
        COALESCE(SUM(verified_members), 0) as total_members
      FROM organizations
      WHERE deleted_at IS NULL
    `);

    const byType = await this.dataSource.query(`
      SELECT type, COUNT(*) as count
      FROM organizations
      WHERE deleted_at IS NULL
      GROUP BY type
    `);

    const topOrganizations = await this.dataSource.query(`
      SELECT
        o.id,
        o.name,
        o.verified_members as "memberCount",
        COUNT(p.id) as "policyCount"
      FROM organizations o
      LEFT JOIN memberships m ON m.organization_id = o.id AND m.status = 'ACTIVE'
      LEFT JOIN policies p ON p.user_id = m.user_id AND p.status = 'ACTIVE'
      WHERE o.deleted_at IS NULL AND o.status = 'ACTIVE'
      GROUP BY o.id, o.name, o.verified_members
      ORDER BY o.verified_members DESC
      LIMIT 10
    `);

    const byTypeMap: Record<string, number> = {};
    for (const row of byType) {
      byTypeMap[row.type] = parseInt(row.count, 10);
    }

    return {
      totalOrganizations: parseInt(stats?.total_organizations || '0', 10),
      activeOrganizations: parseInt(stats?.active_organizations || '0', 10),
      totalMembers: parseInt(stats?.total_members || '0', 10),
      topOrganizations: topOrganizations.map((r: { id: string; name: string; memberCount: string; policyCount: string }) => ({
        id: r.id,
        name: r.name,
        memberCount: parseInt(r.memberCount || '0', 10),
        policyCount: parseInt(r.policyCount || '0', 10),
      })),
      byType: byTypeMap,
    };
  }

  /**
   * Get full dashboard summary
   */
  async getDashboardSummary(organizationId?: string): Promise<DashboardSummary> {
    const [enrollment, payments, policies, organizations] = await Promise.all([
      this.getEnrollmentMetrics(organizationId),
      this.getPaymentMetrics(organizationId),
      this.getPolicyMetrics(organizationId),
      this.getOrganizationMetrics(),
    ]);

    return {
      enrollment,
      payments,
      policies,
      organizations,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get enrollment time series
   */
  async getEnrollmentTimeSeries(
    days: number = 30,
    organizationId?: string,
  ): Promise<TimeSeriesPoint[]> {
    const orgFilter = organizationId
      ? `AND id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const results = await this.dataSource.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as value
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
        ${orgFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return results.map((r: { date: Date; value: string }) => ({
      date: r.date.toISOString().split('T')[0],
      value: parseInt(r.value, 10),
    }));
  }

  /**
   * Get payment time series
   */
  async getPaymentTimeSeries(
    days: number = 30,
    organizationId?: string,
  ): Promise<TimeSeriesPoint[]> {
    const orgFilter = organizationId
      ? `AND user_id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const results = await this.dataSource.query(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(amount), 0) as value
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND status = 'COMPLETED'
        ${orgFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return results.map((r: { date: Date; value: string }) => ({
      date: r.date.toISOString().split('T')[0],
      value: parseFloat(r.value),
    }));
  }

  /**
   * Get policy issuance time series
   */
  async getPolicyTimeSeries(
    days: number = 30,
    organizationId?: string,
  ): Promise<TimeSeriesPoint[]> {
    const orgFilter = organizationId
      ? `AND user_id IN (SELECT user_id FROM memberships WHERE organization_id = '${organizationId}')`
      : '';

    const results = await this.dataSource.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as value
      FROM policies
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        ${orgFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return results.map((r: { date: Date; value: string }) => ({
      date: r.date.toISOString().split('T')[0],
      value: parseInt(r.value, 10),
    }));
  }
}
