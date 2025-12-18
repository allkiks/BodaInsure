import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';
import { UserService } from '../services/user.service.js';
import { Language } from '../entities/user.entity.js';
import { DataExportService } from '../services/data-export.service.js';
import { UpdateProfileDto, UserProfileResponseDto } from '../dto/index.js';

/**
 * User Controller
 * Handles user profile management and data subject rights
 *
 * Per CLAUDE.md Section 6.3: Data Protection Act 2019 compliance
 */
@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly dataExportService: DataExportService,
  ) {}

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the authenticated user profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserProfileResponseDto,
  })
  async getProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<UserProfileResponseDto> {
    const fullUser = await this.userService.findById(user.userId);

    if (!fullUser) {
      throw new Error('User not found');
    }

    return {
      id: fullUser.id,
      phone: fullUser.phone,
      fullName: fullUser.fullName,
      email: fullUser.email,
      status: fullUser.status,
      role: fullUser.role,
      kycStatus: fullUser.kycStatus,
      language: fullUser.language,
      organizationId: fullUser.organizationId,
      reminderOptOut: fullUser.reminderOptOut,
      createdAt: fullUser.createdAt,
    };
  }

  /**
   * Update current user profile
   */
  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile',
    type: UserProfileResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const updatedUser = await this.userService.updateProfile(user.userId, {
      fullName: dto.fullName,
      email: dto.email,
    });

    return {
      id: updatedUser.id,
      phone: updatedUser.phone,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      status: updatedUser.status,
      role: updatedUser.role,
      kycStatus: updatedUser.kycStatus,
      language: updatedUser.language,
      organizationId: updatedUser.organizationId,
      reminderOptOut: updatedUser.reminderOptOut,
      createdAt: updatedUser.createdAt,
    };
  }

  /**
   * Update notification preferences
   */
  @Patch('me/preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Update user notification preferences (e.g., reminder opt-out)',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated preferences',
  })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { reminderOptOut?: boolean; language?: string },
  ): Promise<{ success: boolean; message: string }> {
    const fullUser = await this.userService.findById(user.userId);

    if (!fullUser) {
      throw new Error('User not found');
    }

    // Update reminder opt-out preference
    if (dto.reminderOptOut !== undefined) {
      fullUser.reminderOptOut = dto.reminderOptOut;
    }

    // Update language preference
    if (dto.language) {
      fullUser.language = dto.language === 'sw' ? Language.SWAHILI : Language.ENGLISH;
    }

    await this.userService.updateProfile(user.userId, {});

    return {
      success: true,
      message: 'Preferences updated successfully',
    };
  }

  /**
   * Export user data (GDPR/DPA compliance)
   * Per Data Protection Act 2019: Right to Access
   */
  @Get('me/data-export')
  @ApiOperation({
    summary: 'Export user data',
    description: 'Export all personal data (GDPR/DPA Right to Access)',
  })
  @ApiResponse({
    status: 200,
    description: 'User data export',
  })
  async exportData(@CurrentUser() user: JwtPayload): Promise<{
    exportedAt: Date;
    data: Record<string, unknown>;
  }> {
    const exportData = await this.dataExportService.exportUserData(user.userId);

    return {
      exportedAt: new Date(),
      data: exportData as unknown as Record<string, unknown>,
    };
  }

  /**
   * Request account deletion
   * Per Data Protection Act 2019: Right to Deletion
   */
  @Post('me/request-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request account deletion',
    description: 'Request deletion of user account (30-day grace period applies)',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion request acknowledged',
  })
  async requestDeletion(
    @CurrentUser() user: JwtPayload,
    @Body() body?: { reason?: string },
  ): Promise<{
    success: boolean;
    message: string;
    deletionScheduledFor: Date;
  }> {
    const result = await this.userService.scheduleDeletion(
      user.userId,
      body?.reason,
    );

    return {
      success: result.success,
      message: result.message,
      deletionScheduledFor: result.deletionScheduledFor,
    };
  }

  /**
   * Get account deletion status
   */
  @Get('me/deletion-status')
  @ApiOperation({
    summary: 'Get account deletion status',
    description: 'Check if account deletion is scheduled and get details',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion status',
  })
  async getDeletionStatus(@CurrentUser() user: JwtPayload): Promise<{
    isScheduled: boolean;
    deletionScheduledFor?: Date;
    daysRemaining?: number;
    reason?: string;
  }> {
    return this.userService.getDeletionStatus(user.userId);
  }

  /**
   * Cancel account deletion request
   * Per Data Protection Act 2019: User can cancel within grace period
   */
  @Post('me/cancel-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel account deletion',
    description: 'Cancel a scheduled account deletion within the grace period',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancellation result',
  })
  async cancelDeletion(@CurrentUser() user: JwtPayload): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.userService.cancelDeletion(user.userId);
  }
}
