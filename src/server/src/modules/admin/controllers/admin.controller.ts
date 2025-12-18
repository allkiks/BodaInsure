import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ROLES } from '../../../common/constants/index.js';

/**
 * Admin Controller
 * Administrative and support tools
 *
 * Security: All endpoints require PLATFORM_ADMIN role except health check
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get platform statistics
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  /**
   * Get system health
   * Note: Public endpoint for monitoring/load balancer health checks
   */
  @Public()
  @Get('health')
  async getHealth() {
    return this.adminService.getSystemHealth();
  }

  /**
   * Search users
   */
  @Get('users/search')
  async searchUsers(
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.length < 2) {
      return { users: [], total: 0 };
    }

    const { users, total } = await this.adminService.searchUsers(query, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return { users, total };
  }

  /**
   * Get user by phone
   */
  @Get('users/phone/:phone')
  async getUserByPhone(@Param('phone') phone: string) {
    return this.adminService.getUserByPhone(phone);
  }

  /**
   * Get user detail
   */
  @Get('users/:id')
  async getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  /**
   * Resend OTP for user
   */
  @Post('users/:id/resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.resendOtp(id);
  }

  /**
   * Reset user KYC status
   */
  @Post('users/:id/reset-kyc')
  @HttpCode(HttpStatus.OK)
  async resetKyc(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.resetKycStatus(id);
  }

  /**
   * Activate user
   */
  @Put('users/:id/activate')
  async activateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.setUserActive(id, true);
  }

  /**
   * Deactivate user
   */
  @Put('users/:id/deactivate')
  async deactivateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.setUserActive(id, false);
  }
}
