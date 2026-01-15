import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../identity/decorators/current-user.decorator.js';
import { NotificationService } from '../services/notification.service.js';
import { SmsDeliveryReportService } from '../services/sms-delivery-report.service.js';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto.js';
import { NotificationQueryDto } from '../dto/notification-query.dto.js';
import type { NotificationChannel } from '../entities/notification.entity.js';

/**
 * Authenticated user payload from JWT
 */
interface AuthenticatedUser {
  userId: string;
  phone: string;
}

/**
 * Notification Controller
 * Handles notification preferences and history
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Get user's notification preferences
   */
  @Get('preferences')
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Retrieve the current user notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences',
  })
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    otpChannel: NotificationChannel;
    policyChannel: NotificationChannel;
    paymentChannel: NotificationChannel;
    reminderChannel: NotificationChannel;
    paymentRemindersEnabled: boolean;
    expiryRemindersEnabled: boolean;
    promotionsEnabled: boolean;
    reminderHour: number;
    expiryReminderDays: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    locale: string;
    whatsappNumber: string | null;
    email: string | null;
  }> {
    const preferences = await this.notificationService.getOrCreatePreferences(user.userId);

    return {
      otpChannel: preferences.otpChannel,
      policyChannel: preferences.policyChannel,
      paymentChannel: preferences.paymentChannel,
      reminderChannel: preferences.reminderChannel,
      paymentRemindersEnabled: preferences.paymentRemindersEnabled,
      expiryRemindersEnabled: preferences.expiryRemindersEnabled,
      promotionsEnabled: preferences.promotionsEnabled,
      reminderHour: preferences.reminderHour,
      expiryReminderDays: preferences.expiryReminderDays,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      locale: preferences.locale,
      whatsappNumber: preferences.whatsappNumber ?? null,
      email: preferences.email ?? null,
    };
  }

  /**
   * Update notification preferences
   */
  @Put('preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Update user notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated preferences',
  })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.notificationService.updatePreferences(user.userId, dto);

    return {
      success: true,
      message: 'Preferences updated successfully',
    };
  }

  /**
   * Get notification history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get notification history',
    description: 'Retrieve notification history for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification history',
  })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ): Promise<{
    notifications: Array<{
      id: string;
      channel: string;
      type: string;
      status: string;
      content: string;
      createdAt: Date;
      sentAt: Date | null;
      deliveredAt: Date | null;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { notifications, total } = await this.notificationService.getUserNotifications(
      user.userId,
      {
        limit,
        offset,
        types: query.types,
      },
    );

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        channel: n.channel,
        type: n.notificationType,
        status: n.status,
        content: n.content,
        createdAt: n.createdAt,
        sentAt: n.sentAt ?? null,
        deliveredAt: n.deliveredAt ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get notification statistics',
    description: 'Get notification statistics for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification statistics',
  })
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    byChannel: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const stats = await this.notificationService.getStats(user.userId);

    return {
      total: stats.total,
      sent: stats.sent,
      delivered: stats.delivered,
      failed: stats.failed,
      pending: stats.pending,
      byChannel: stats.byChannel as Record<string, number>,
      byType: stats.byType as Record<string, number>,
    };
  }

  /**
   * Unsubscribe from SMS notifications
   */
  @Post('unsubscribe/sms')
  @ApiOperation({
    summary: 'Unsubscribe from SMS',
    description: 'Unsubscribe from non-critical SMS notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Unsubscribed successfully',
  })
  async unsubscribeSms(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.notificationService.updatePreferences(user.userId, {
      smsUnsubscribed: true,
    });

    return {
      success: true,
      message: 'You have been unsubscribed from SMS notifications. Critical messages will still be sent.',
    };
  }

  /**
   * Unsubscribe from WhatsApp notifications
   */
  @Post('unsubscribe/whatsapp')
  @ApiOperation({
    summary: 'Unsubscribe from WhatsApp',
    description: 'Unsubscribe from non-critical WhatsApp notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Unsubscribed successfully',
  })
  async unsubscribeWhatsApp(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.notificationService.updatePreferences(user.userId, {
      whatsappUnsubscribed: true,
    });

    return {
      success: true,
      message: 'You have been unsubscribed from WhatsApp notifications. Critical messages will still be sent.',
    };
  }

  /**
   * Resubscribe to notifications
   */
  @Post('resubscribe')
  @ApiOperation({
    summary: 'Resubscribe to notifications',
    description: 'Resubscribe to all notification channels',
  })
  @ApiResponse({
    status: 200,
    description: 'Resubscribed successfully',
  })
  async resubscribe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    await this.notificationService.updatePreferences(user.userId, {
      smsUnsubscribed: false,
      whatsappUnsubscribed: false,
    });

    return {
      success: true,
      message: 'You have been resubscribed to all notifications.',
    };
  }
}

/**
 * Notification Webhook Controller
 * Handles callbacks from SMS/WhatsApp providers
 *
 * Per Africa's Talking best practices:
 * - Process delivery reports (Success, Failed, Rejected, Buffered)
 * - Store delivery status for auditing
 * - Handle provider-specific callback formats
 */
@ApiTags('Notification Webhooks')
@Controller('notifications/webhooks')
export class NotificationWebhookController {
  constructor(
    private readonly deliveryReportService: SmsDeliveryReportService,
  ) {}

  /**
   * SMS delivery callback (Africa's Talking)
   * AT sends POST requests with delivery status updates
   *
   * Per AT documentation, callback includes:
   * - id: Message ID (ATXid_xxx)
   * - status: Delivery status (Success, Failed, Rejected, Buffered, Sent, Submitted)
   * - phoneNumber: Recipient phone number
   * - networkCode: Carrier network code (63902=Safaricom, 63903=Airtel, etc.)
   * - failureReason: Reason for failure (if applicable)
   * - retryCount: Number of retry attempts
   */
  @Post('sms/delivery')
  @ApiOperation({
    summary: 'SMS delivery callback (Africa\'s Talking)',
    description: 'Webhook for Africa\'s Talking SMS delivery status updates',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery report processed successfully',
  })
  async smsDeliveryCallback(
    @Body() body: {
      id: string;
      status: string;
      phoneNumber: string;
      networkCode?: string;
      failureReason?: string;
      retryCount?: string;
    },
  ): Promise<{ success: boolean; reportId?: string }> {
    try {
      const report = await this.deliveryReportService.processATCallback(body);
      return { success: true, reportId: report.id };
    } catch (error) {
      // Log error but return success to prevent AT from retrying
      // The callback should be acknowledged even if processing fails
      console.error('Failed to process AT delivery callback:', error);
      return { success: true };
    }
  }

  /**
   * SMS delivery callback (Advantasms)
   */
  @Post('sms/delivery/advantasms')
  @ApiOperation({
    summary: 'SMS delivery callback (Advantasms)',
    description: 'Webhook for Advantasms SMS delivery status updates',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery report processed successfully',
  })
  async advantasmsDeliveryCallback(
    @Body() body: {
      messageID: string;
      status: string;
      mobile: string;
      deliveryTime?: string;
      failureReason?: string;
    },
  ): Promise<{ success: boolean; reportId?: string }> {
    try {
      const report = await this.deliveryReportService.processAdvantasmsCallback(body);
      return { success: true, reportId: report.id };
    } catch (error) {
      console.error('Failed to process Advantasms delivery callback:', error);
      return { success: true };
    }
  }

  /**
   * WhatsApp webhook (Meta)
   */
  @Post('whatsapp')
  @ApiOperation({
    summary: 'WhatsApp webhook',
    description: 'Webhook for WhatsApp status updates and incoming messages',
  })
  async whatsappWebhook(
    @Body() _body: Record<string, unknown>,
  ): Promise<{ success: boolean }> {
    // Process WhatsApp webhook
    // Handle message status updates, read receipts, etc.
    return { success: true };
  }

  /**
   * WhatsApp webhook verification (GET request)
   */
  @Get('whatsapp')
  @ApiOperation({
    summary: 'WhatsApp webhook verification',
    description: 'Verification endpoint for WhatsApp webhook setup',
  })
  async whatsappVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    // Verify token matches configured value
    const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'] ?? 'bodainsure-verify';

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return 'Verification failed';
  }
}
