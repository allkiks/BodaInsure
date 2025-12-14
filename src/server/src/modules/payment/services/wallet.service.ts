import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, WalletStatus } from '../entities/wallet.entity.js';
import { PAYMENT_CONFIG } from '../../../common/constants/index.js';

/**
 * Grace period configuration
 * Per GAP-010: 7-day grace period after 1-month policy expiry
 * ASSUMPTION: Grace period is 7 days after 1-month policy expiry.
 * SOURCE: Product discussion 2024-12-01 (per CLAUDE.md Section 12.3)
 * TICKET: BODA-234 - Confirm grace period rules
 */
const GRACE_PERIOD_DAYS = 7;

/**
 * Wallet Service
 * Manages user wallet balances and payment progress tracking
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get or create wallet for a user
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId,
        status: WalletStatus.ACTIVE,
        balance: 0,
        totalDeposited: 0,
        totalPaid: 0,
        depositCompleted: false,
        dailyPaymentsCount: 0,
        dailyPaymentsCompleted: false,
        currency: 'KES',
      });
      await this.walletRepository.save(wallet);
      this.logger.log(`Wallet created for user ${userId.slice(0, 8)}...`);
    }

    return wallet;
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId },
    });
  }

  /**
   * Get wallet balance in KES
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    currency: string;
    depositCompleted: boolean;
    dailyPaymentsCount: number;
    dailyPaymentsRemaining: number;
    dailyPaymentsCompleted: boolean;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: wallet.getBalanceInKes(),
      currency: wallet.currency,
      depositCompleted: wallet.depositCompleted,
      dailyPaymentsCount: wallet.dailyPaymentsCount,
      dailyPaymentsRemaining: wallet.getRemainingDailyPayments(),
      dailyPaymentsCompleted: wallet.dailyPaymentsCompleted,
    };
  }

  /**
   * Credit wallet (add funds)
   * Used when payment is completed
   */
  async creditWallet(
    userId: string,
    amountCents: number,
    description?: string,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);

      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.status !== WalletStatus.ACTIVE) {
        throw new ConflictException('Wallet is not active');
      }

      wallet.balance = Number(wallet.balance) + amountCents;
      wallet.totalDeposited = Number(wallet.totalDeposited) + amountCents;

      await walletRepo.save(wallet);

      this.logger.log(
        `Wallet credited: userId=${userId.slice(0, 8)}... amount=${amountCents / 100} KES ${description ?? ''}`,
      );

      return wallet;
    });
  }

  /**
   * Debit wallet (deduct funds for payment)
   * Used when applying payment to policy
   */
  async debitWallet(
    userId: string,
    amountCents: number,
    description?: string,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);

      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.status !== WalletStatus.ACTIVE) {
        throw new ConflictException('Wallet is not active');
      }

      if (Number(wallet.balance) < amountCents) {
        throw new ConflictException('Insufficient balance');
      }

      wallet.balance = Number(wallet.balance) - amountCents;
      wallet.totalPaid = Number(wallet.totalPaid) + amountCents;

      await walletRepo.save(wallet);

      this.logger.log(
        `Wallet debited: userId=${userId.slice(0, 8)}... amount=${amountCents / 100} KES ${description ?? ''}`,
      );

      return wallet;
    });
  }

  /**
   * Mark deposit as completed
   */
  async markDepositCompleted(userId: string): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.depositCompleted) {
      return wallet; // Already completed
    }

    wallet.depositCompleted = true;
    wallet.depositCompletedAt = new Date();

    await this.walletRepository.save(wallet);

    this.logger.log(`Deposit completed for user ${userId.slice(0, 8)}...`);

    return wallet;
  }

  /**
   * Record daily payment(s)
   */
  async recordDailyPayments(
    userId: string,
    daysCount: number = 1,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);

      const wallet = await walletRepo.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (!wallet.depositCompleted) {
        throw new ConflictException('Deposit must be completed first');
      }

      if (wallet.dailyPaymentsCompleted) {
        throw new ConflictException('All daily payments already completed');
      }

      // Calculate new count (cap at 30)
      const newCount = Math.min(
        wallet.dailyPaymentsCount + daysCount,
        PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS,
      );

      wallet.dailyPaymentsCount = newCount;
      wallet.lastDailyPaymentAt = new Date();

      // Check if all payments complete
      if (newCount >= PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS) {
        wallet.dailyPaymentsCompleted = true;
        wallet.dailyPaymentsCompletedAt = new Date();
        this.logger.log(`All daily payments completed for user ${userId.slice(0, 8)}...`);
      }

      await walletRepo.save(wallet);

      this.logger.log(
        `Daily payments recorded: userId=${userId.slice(0, 8)}... days=${daysCount} total=${newCount}/30`,
      );

      return wallet;
    });
  }

  /**
   * Get payment progress for user
   */
  async getPaymentProgress(userId: string): Promise<{
    depositCompleted: boolean;
    depositAmount: number;
    dailyPaymentsCount: number;
    dailyPaymentsRemaining: number;
    dailyPaymentsCompleted: boolean;
    dailyAmount: number;
    totalPaid: number;
    totalRequired: number;
    progressPercentage: number;
    policy1Eligible: boolean;
    policy2Eligible: boolean;
  }> {
    const wallet = await this.getOrCreateWallet(userId);

    const depositAmount = PAYMENT_CONFIG.DEPOSIT_AMOUNT;
    const dailyAmount = PAYMENT_CONFIG.DAILY_AMOUNT;
    const totalDailyRequired = PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS * dailyAmount;
    const totalRequired = depositAmount + totalDailyRequired;

    const depositPaid = wallet.depositCompleted ? depositAmount : 0;
    const dailyPaid = wallet.dailyPaymentsCount * dailyAmount;
    const totalPaid = depositPaid + dailyPaid;

    const progressPercentage = Math.round((totalPaid / totalRequired) * 100);

    return {
      depositCompleted: wallet.depositCompleted,
      depositAmount,
      dailyPaymentsCount: wallet.dailyPaymentsCount,
      dailyPaymentsRemaining: wallet.getRemainingDailyPayments(),
      dailyPaymentsCompleted: wallet.dailyPaymentsCompleted,
      dailyAmount,
      totalPaid,
      totalRequired,
      progressPercentage,
      policy1Eligible: wallet.depositCompleted,
      policy2Eligible: wallet.dailyPaymentsCompleted,
    };
  }

  /**
   * Check if user can make deposit
   */
  async canMakeDeposit(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.status !== WalletStatus.ACTIVE) {
      return { allowed: false, reason: 'Wallet is not active' };
    }

    if (wallet.depositCompleted) {
      return { allowed: false, reason: 'Deposit already completed' };
    }

    return { allowed: true };
  }

  /**
   * Check if user can make daily payment
   */
  async canMakeDailyPayment(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingDays?: number;
  }> {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.status !== WalletStatus.ACTIVE) {
      return { allowed: false, reason: 'Wallet is not active' };
    }

    if (!wallet.depositCompleted) {
      return { allowed: false, reason: 'Deposit must be completed first' };
    }

    if (wallet.dailyPaymentsCompleted) {
      return { allowed: false, reason: 'All daily payments already completed' };
    }

    return {
      allowed: true,
      remainingDays: wallet.getRemainingDailyPayments(),
    };
  }

  /**
   * Freeze wallet (for investigation)
   */
  async freezeWallet(userId: string, reason?: string): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.status = WalletStatus.FROZEN;
    await this.walletRepository.save(wallet);

    this.logger.warn(`Wallet frozen: userId=${userId.slice(0, 8)}... reason=${reason ?? 'not specified'}`);

    return wallet;
  }

  /**
   * Unfreeze wallet
   */
  async unfreezeWallet(userId: string): Promise<Wallet> {
    const wallet = await this.getWalletByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.status = WalletStatus.ACTIVE;
    await this.walletRepository.save(wallet);

    this.logger.log(`Wallet unfrozen: userId=${userId.slice(0, 8)}...`);

    return wallet;
  }

  /**
   * Get grace period status for a user
   * Per GAP-010 and CLAUDE.md Section 12.3
   *
   * Grace period applies when:
   * - Deposit is completed (1-month policy issued)
   * - Daily payments not yet completed
   * - 1-month policy has expired
   */
  async getGracePeriodStatus(
    userId: string,
    policyExpiryDate?: Date,
  ): Promise<{
    inGracePeriod: boolean;
    gracePeriodDays: number;
    gracePeriodEndsAt: Date | null;
    daysRemaining: number;
    canStillPay: boolean;
    message: string;
  }> {
    const wallet = await this.getOrCreateWallet(userId);

    // If daily payments are complete, no grace period needed
    if (wallet.dailyPaymentsCompleted) {
      return {
        inGracePeriod: false,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: null,
        daysRemaining: 0,
        canStillPay: false,
        message: 'All payments completed. 11-month policy earned.',
      };
    }

    // If deposit not completed, grace period doesn't apply
    if (!wallet.depositCompleted || !wallet.depositCompletedAt) {
      return {
        inGracePeriod: false,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: null,
        daysRemaining: 0,
        canStillPay: true,
        message: 'Complete deposit to start your coverage.',
      };
    }

    // Calculate 1-month policy expiry (deposit date + 1 month)
    const depositDate = wallet.depositCompletedAt;
    const policyExpiry = policyExpiryDate ?? new Date(depositDate);
    if (!policyExpiryDate) {
      policyExpiry.setMonth(policyExpiry.getMonth() + 1);
    }

    const now = new Date();
    const gracePeriodEnd = new Date(policyExpiry);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

    // Check if policy hasn't expired yet
    if (now < policyExpiry) {
      const daysUntilExpiry = Math.ceil(
        (policyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        inGracePeriod: false,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: gracePeriodEnd,
        daysRemaining: daysUntilExpiry + GRACE_PERIOD_DAYS,
        canStillPay: true,
        message: `${daysUntilExpiry} days until policy expires. Keep making daily payments.`,
      };
    }

    // Check if within grace period
    if (now <= gracePeriodEnd) {
      const daysRemaining = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        inGracePeriod: true,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        gracePeriodEndsAt: gracePeriodEnd,
        daysRemaining,
        canStillPay: true,
        message: `GRACE PERIOD: ${daysRemaining} days remaining to complete payments and avoid policy lapse.`,
      };
    }

    // Grace period expired - policy has lapsed
    return {
      inGracePeriod: false,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      gracePeriodEndsAt: gracePeriodEnd,
      daysRemaining: 0,
      canStillPay: false,
      message: 'Grace period expired. Policy has lapsed. Please contact support.',
    };
  }

  /**
   * Check if wallet is in lapsed state (grace period expired without completing payments)
   * Per GAP-010
   */
  async checkAndUpdateLapseStatus(
    userId: string,
    policyExpiryDate?: Date,
  ): Promise<{
    isLapsed: boolean;
    wallet: Wallet;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    const graceStatus = await this.getGracePeriodStatus(userId, policyExpiryDate);

    // If grace period expired and payments not complete, mark as lapsed
    if (!graceStatus.canStillPay && !wallet.dailyPaymentsCompleted) {
      if (wallet.status !== WalletStatus.LAPSED) {
        wallet.status = WalletStatus.LAPSED;
        await this.walletRepository.save(wallet);

        this.logger.warn(
          `Wallet lapsed: userId=${userId.slice(0, 8)}... ` +
          `dailyPayments=${wallet.dailyPaymentsCount}/${PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS}`
        );
      }
      return { isLapsed: true, wallet };
    }

    return { isLapsed: false, wallet };
  }

  /**
   * Get users in grace period (for reminder notifications)
   * Per GAP-010 and notification requirements
   */
  async getWalletsInGracePeriod(): Promise<Wallet[]> {
    // Find wallets that:
    // 1. Have completed deposit
    // 2. Have NOT completed all daily payments
    // 3. Are still active (not lapsed)
    const wallets = await this.walletRepository.find({
      where: {
        depositCompleted: true,
        dailyPaymentsCompleted: false,
        status: WalletStatus.ACTIVE,
      },
    });

    // Filter to those actually in grace period
    const walletsInGrace: Wallet[] = [];
    for (const wallet of wallets) {
      if (!wallet.depositCompletedAt) continue;

      const policyExpiry = new Date(wallet.depositCompletedAt);
      policyExpiry.setMonth(policyExpiry.getMonth() + 1);

      const now = new Date();
      const gracePeriodEnd = new Date(policyExpiry);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      if (now > policyExpiry && now <= gracePeriodEnd) {
        walletsInGrace.push(wallet);
      }
    }

    return walletsInGrace;
  }
}
