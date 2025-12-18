import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Wallet, WalletStatus } from '../../payment/entities/wallet.entity.js';
import { User, UserStatus } from '../../identity/entities/user.entity.js';
import { Policy, PolicyStatus } from '../../policy/entities/policy.entity.js';
import { ReminderService, UserPaymentData, UserPolicyData } from './reminder.service.js';
import { BatchSchedulerService } from '../../scheduler/services/batch-scheduler.service.js';
import { PAYMENT_CONFIG } from '../../../common/constants/index.js';

/**
 * Reminder Coordinator Service
 *
 * Bridges the scheduler with actual data from Payment and Policy modules.
 * Implements the data retrieval logic for:
 * - Payment reminders (users who need to make daily payments)
 * - Policy expiry reminders (policies expiring in 7, 3, 1 days)
 *
 * Per module_architecture.md and CLAUDE.md notification requirements:
 * - Daily payment reminders at 09:00 EAT
 * - Policy expiry reminders at 07:00 EAT
 */
@Injectable()
export class ReminderCoordinatorService implements OnModuleInit {
  private readonly logger = new Logger(ReminderCoordinatorService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    private readonly reminderService: ReminderService,
    private readonly batchSchedulerService: BatchSchedulerService,
  ) {}

  /**
   * Register handlers with the scheduler on module initialization
   */
  async onModuleInit(): Promise<void> {
    // Register payment reminder handler
    this.batchSchedulerService.registerReminderHandler(
      async () => this.processPaymentReminders(),
    );

    // Register policy expiry reminder handler
    this.batchSchedulerService.registerPolicyExpiryReminderHandler(
      async () => this.processPolicyExpiryReminders(),
    );

    this.logger.log('Payment and policy expiry reminder handlers registered with scheduler');
  }

  /**
   * Process payment reminders
   * Called by BatchSchedulerService at 09:00 EAT daily
   *
   * Finds users who:
   * 1. Have completed deposit (have 1-month policy)
   * 2. Have NOT completed all 30 daily payments
   * 3. Are not opted out of reminders
   * 4. Have active wallet status
   */
  async processPaymentReminders(): Promise<number> {
    this.logger.log('Starting payment reminders processing');

    try {
      // Get users needing payment reminders
      const usersNeedingReminders = await this.getUsersNeedingPaymentReminders();

      if (usersNeedingReminders.length === 0) {
        this.logger.log('No users need payment reminders today');
        return 0;
      }

      this.logger.log(`Found ${usersNeedingReminders.length} users for payment reminders`);

      // Process reminders using ReminderService
      const result = await this.reminderService.processPaymentReminders(usersNeedingReminders);

      this.logger.log(
        `Payment reminders completed: ${result.sent} sent, ` +
        `${result.skipped} skipped, ${result.failed} failed`,
      );

      return result.sent;
    } catch (error) {
      this.logger.error('Failed to process payment reminders', error);
      throw error;
    }
  }

  /**
   * Process policy expiry reminders
   * Called by BatchSchedulerService at 07:00 EAT daily
   *
   * Finds policies expiring in 7, 3, or 1 days
   */
  async processPolicyExpiryReminders(): Promise<number> {
    this.logger.log('Starting policy expiry reminders processing');

    try {
      // Get expiring policies for key reminder days
      const expiringPolicies = await this.getExpiringPolicies();

      if (expiringPolicies.length === 0) {
        this.logger.log('No policies expiring soon that need reminders');
        return 0;
      }

      this.logger.log(`Found ${expiringPolicies.length} expiring policies for reminders`);

      // Process expiry reminders using ReminderService
      const result = await this.reminderService.processPolicyExpiryReminders(expiringPolicies);

      this.logger.log(
        `Policy expiry reminders completed: ${result.sent} sent, ` +
        `${result.skipped} skipped, ${result.failed} failed`,
      );

      return result.sent;
    } catch (error) {
      this.logger.error('Failed to process policy expiry reminders', error);
      throw error;
    }
  }

  /**
   * Get users who need payment reminders
   *
   * Criteria:
   * - Wallet status is ACTIVE
   * - Deposit is completed (user has started the 30-day cycle)
   * - Daily payments NOT completed (still needs to pay)
   * - User has NOT opted out of reminders
   * - User account is ACTIVE
   */
  private async getUsersNeedingPaymentReminders(): Promise<UserPaymentData[]> {
    // Find wallets that need reminders
    const wallets = await this.walletRepository.find({
      where: {
        status: WalletStatus.ACTIVE,
        depositCompleted: true,
        dailyPaymentsCompleted: false,
      },
      relations: ['user'],
    });

    if (wallets.length === 0) {
      return [];
    }

    // Get user IDs to filter by
    const userIds = wallets.map(w => w.userId);

    // Get users who are active and not opted out
    const activeUsers = await this.userRepository.find({
      where: {
        id: In(userIds),
        status: UserStatus.ACTIVE,
        reminderOptOut: false,
      },
    });

    // Create a map for quick lookup
    const activeUserMap = new Map(activeUsers.map(u => [u.id, u]));

    // Build UserPaymentData for each eligible user
    const usersNeedingReminders: UserPaymentData[] = [];

    for (const wallet of wallets) {
      const user = activeUserMap.get(wallet.userId);
      if (!user) {
        continue; // User opted out or not active
      }

      usersNeedingReminders.push({
        userId: user.id,
        phone: user.phone,
        name: user.fullName ?? 'Customer',
        dailyAmount: PAYMENT_CONFIG.DAILY_AMOUNT / 100, // Convert from cents to KES
        daysPaid: wallet.dailyPaymentsCount,
        daysRemaining: wallet.getRemainingDailyPayments(),
        lastPaymentDate: wallet.lastDailyPaymentAt ?? null,
      });
    }

    return usersNeedingReminders;
  }

  /**
   * Get policies expiring soon that need reminders
   *
   * Sends reminders at these intervals:
   * - 7 days before expiry
   * - 3 days before expiry
   * - 1 day before expiry
   * - Day of expiry
   */
  private async getExpiringPolicies(): Promise<UserPolicyData[]> {
    const now = new Date();
    const reminderDays = [7, 3, 1, 0];

    const expiringPolicies: UserPolicyData[] = [];

    for (const days of reminderDays) {
      // Calculate the target date range (allow 1-hour window)
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDate);
      targetDateEnd.setHours(23, 59, 59, 999);

      // Find policies expiring on this exact day
      const policies = await this.policyRepository.find({
        where: {
          status: In([PolicyStatus.ACTIVE, PolicyStatus.EXPIRING]),
          expiresAt: Between(targetDate, targetDateEnd),
        },
      });

      if (policies.length === 0) {
        continue;
      }

      // Get user IDs
      const userIds = policies.map(p => p.userId);

      // Get users who are active and not opted out
      const users = await this.userRepository.find({
        where: {
          id: In(userIds),
          status: UserStatus.ACTIVE,
          reminderOptOut: false,
        },
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      // Build UserPolicyData for each policy
      for (const policy of policies) {
        const user = userMap.get(policy.userId);
        if (!user) {
          continue; // User opted out or not active
        }

        expiringPolicies.push({
          userId: user.id,
          phone: user.phone,
          policyNumber: policy.policyNumber ?? policy.id,
          expiryDate: policy.expiresAt!,
          daysRemaining: days,
        });
      }
    }

    return expiringPolicies;
  }

  /**
   * Get count of users who would receive payment reminders
   * For reporting/dashboard purposes
   */
  async getPaymentReminderCount(): Promise<number> {
    const users = await this.getUsersNeedingPaymentReminders();
    return users.length;
  }

  /**
   * Get count of policies that would receive expiry reminders
   * For reporting/dashboard purposes
   */
  async getPolicyExpiryReminderCount(): Promise<number> {
    const policies = await this.getExpiringPolicies();
    return policies.length;
  }

  /**
   * Send a test payment reminder to a specific user
   * For admin/testing purposes
   */
  async sendTestPaymentReminder(userId: string): Promise<boolean> {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!wallet || !user) {
      this.logger.warn(`Cannot send test reminder - user or wallet not found: ${userId}`);
      return false;
    }

    const userData: UserPaymentData = {
      userId: user.id,
      phone: user.phone,
      name: user.fullName ?? 'Customer',
      dailyAmount: PAYMENT_CONFIG.DAILY_AMOUNT / 100,
      daysPaid: wallet.dailyPaymentsCount,
      daysRemaining: wallet.getRemainingDailyPayments(),
      lastPaymentDate: wallet.lastDailyPaymentAt ?? null,
    };

    return this.reminderService.sendImmediatePaymentReminder(userData);
  }
}
