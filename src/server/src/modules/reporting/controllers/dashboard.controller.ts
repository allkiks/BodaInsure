import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service.js';
import { DashboardQueryDto } from '../dto/report.dto.js';

/**
 * Dashboard Controller
 * Real-time metrics and dashboard data
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get full dashboard summary
   */
  @Get()
  async getDashboard(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getDashboardSummary(query.organizationId);
  }

  /**
   * Get enrollment metrics
   */
  @Get('enrollment')
  async getEnrollmentMetrics(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getEnrollmentMetrics(query.organizationId);
  }

  /**
   * Get payment metrics
   */
  @Get('payments')
  async getPaymentMetrics(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getPaymentMetrics(query.organizationId);
  }

  /**
   * Get policy metrics
   */
  @Get('policies')
  async getPolicyMetrics(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getPolicyMetrics(query.organizationId);
  }

  /**
   * Get organization metrics
   */
  @Get('organizations')
  async getOrganizationMetrics() {
    return this.dashboardService.getOrganizationMetrics();
  }

  /**
   * Get enrollment time series
   */
  @Get('charts/enrollment')
  async getEnrollmentChart(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getEnrollmentTimeSeries(
      query.days ?? 30,
      query.organizationId,
    );
  }

  /**
   * Get payment time series
   */
  @Get('charts/payments')
  async getPaymentChart(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getPaymentTimeSeries(
      query.days ?? 30,
      query.organizationId,
    );
  }

  /**
   * Get policy issuance time series
   */
  @Get('charts/policies')
  async getPolicyChart(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getPolicyTimeSeries(
      query.days ?? 30,
      query.organizationId,
    );
  }
}
