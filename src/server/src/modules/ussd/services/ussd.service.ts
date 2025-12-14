import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../identity/services/user.service.js';
import { WalletService } from '../../payment/services/wallet.service.js';
import { PaymentService, InitiatePaymentRequest } from '../../payment/services/payment.service.js';
import { PolicyService } from '../../policy/services/policy.service.js';
import { Language } from '../../identity/entities/user.entity.js';
import { TransactionType } from '../../payment/entities/transaction.entity.js';
import { PAYMENT_CONFIG } from '../../../common/constants/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * USSD provider identifier
 */
export enum UssdProvider {
  AFRICASTALKING = 'africastalking',
  ADVANTASMS = 'advantasms',
}

/**
 * USSD session state
 */
export enum UssdState {
  MAIN_MENU = 'MAIN_MENU',
  CHECK_BALANCE = 'CHECK_BALANCE',
  MAKE_PAYMENT = 'MAKE_PAYMENT',
  PAYMENT_CONFIRM = 'PAYMENT_CONFIRM',
  POLICY_STATUS = 'POLICY_STATUS',
  HELP = 'HELP',
}

/**
 * USSD session
 */
export interface UssdSession {
  sessionId: string;
  phoneNumber: string;
  provider: UssdProvider;
  state: UssdState;
  data: Record<string, unknown>;
  createdAt: Date;
  lastActivityAt: Date;
  userId?: string;
  language: Language;
}

/**
 * USSD request
 */
export interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  input: string;
  fullInput: string;
  provider: UssdProvider;
}

/**
 * USSD response
 */
export interface UssdResponse {
  message: string;
  endSession: boolean;
}

/**
 * Payment option for USSD menu
 */
interface PaymentOption {
  key: string;
  days: number;
  amount: number;
  label: string;
}

/**
 * USSD character limit per screen
 */
const MAX_USSD_CHARS = 182;

/**
 * i18n translations for USSD menus
 * Per FEAT-USSD-001 AC4: Multi-language support (English/Swahili)
 */
const TRANSLATIONS: Record<Language, Record<string, string>> = {
  [Language.ENGLISH]: {
    welcome: 'Welcome to BodaInsure',
    checkBalance: 'Check Balance',
    makePayment: 'Make Payment',
    policyStatus: 'Policy Status',
    help: 'Help',
    back: 'Back',
    invalidOption: 'Invalid option. Please try again.',
    sessionTimeout: 'Session timed out. Please dial again.',
    yourBalance: 'Your Balance',
    totalPaid: 'Total Paid',
    dailyPayments: 'Daily Payments',
    remaining: 'Remaining',
    paymentMenu: 'Make Payment',
    dailyPayment: 'Daily payment',
    remainingDays: 'Remaining days',
    payForDays: 'Pay for how many days?',
    day: 'day',
    days: 'days',
    allRemaining: 'All remaining',
    confirmPayment: 'Confirm Payment',
    amount: 'Amount',
    phone: 'Phone',
    confirm: 'Confirm',
    cancel: 'Cancel',
    paymentInitiated: 'Payment initiated!',
    checkPhonePrompt: 'Check your phone for M-Pesa prompt and enter PIN.',
    noActivePolicy: 'No active policy found.',
    dialAgainPayment: 'Dial again and select option 2 to make a payment and get covered.',
    policyStatusLabel: 'Policy Status',
    policy: 'Policy',
    expires: 'Expires',
    daysLeft: 'Days left',
    support: 'BodaInsure Support',
    call: 'Call',
    whatsapp: 'WhatsApp',
    email: 'Email',
    notRegistered: 'Phone not registered. Please register first via the app.',
    depositFirst: 'Please complete your deposit payment first.',
    allPaymentsComplete: 'All daily payments completed! Your 11-month policy is active.',
    errorOccurred: 'An error occurred. Please try again.',
    paymentFailed: 'Payment could not be initiated. Please try again.',
  },
  [Language.SWAHILI]: {
    welcome: 'Karibu BodaInsure',
    checkBalance: 'Angalia Salio',
    makePayment: 'Fanya Malipo',
    policyStatus: 'Hali ya Bima',
    help: 'Msaada',
    back: 'Rudi',
    invalidOption: 'Chaguo batili. Tafadhali jaribu tena.',
    sessionTimeout: 'Muda umeisha. Tafadhali piga simu tena.',
    yourBalance: 'Salio Lako',
    totalPaid: 'Jumla Umelipa',
    dailyPayments: 'Malipo ya Kila Siku',
    remaining: 'Imebaki',
    paymentMenu: 'Fanya Malipo',
    dailyPayment: 'Malipo ya siku',
    remainingDays: 'Siku zilizobaki',
    payForDays: 'Lipa kwa siku ngapi?',
    day: 'siku',
    days: 'siku',
    allRemaining: 'Zote zilizobaki',
    confirmPayment: 'Thibitisha Malipo',
    amount: 'Kiasi',
    phone: 'Simu',
    confirm: 'Thibitisha',
    cancel: 'Ghairi',
    paymentInitiated: 'Malipo yameanzishwa!',
    checkPhonePrompt: 'Angalia simu yako kwa M-Pesa na ingiza PIN.',
    noActivePolicy: 'Hakuna bima inayofanya kazi.',
    dialAgainPayment: 'Piga tena na uchague 2 kufanya malipo na kupata bima.',
    policyStatusLabel: 'Hali ya Bima',
    policy: 'Bima',
    expires: 'Inaisha',
    daysLeft: 'Siku zimebaki',
    support: 'Msaada wa BodaInsure',
    call: 'Piga',
    whatsapp: 'WhatsApp',
    email: 'Barua pepe',
    notRegistered: 'Simu haijasajiliwa. Tafadhali sajili kwanza kupitia programu.',
    depositFirst: 'Tafadhali kamilisha malipo ya awali kwanza.',
    allPaymentsComplete: 'Malipo yote yamekamilika! Bima yako ya miezi 11 inafanya kazi.',
    errorOccurred: 'Hitilafu imetokea. Tafadhali jaribu tena.',
    paymentFailed: 'Malipo hayakuweza kuanzishwa. Tafadhali jaribu tena.',
  },
};

/**
 * USSD Service
 * Handles USSD session management and menu navigation
 * Designed for Kenya's feature phone users
 *
 * Per feature_specification.md:
 * - FEAT-USSD-001: Balance Check
 * - FEAT-USSD-002: Payment
 * - FEAT-USSD-003: Policy Status
 */
@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private readonly sessions: Map<string, UssdSession> = new Map();
  private readonly SESSION_TIMEOUT_MS = 180 * 1000; // 180 seconds per spec

  constructor(
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
    private readonly policyService: PolicyService,
  ) {}

  /**
   * Get translation string for session language
   */
  private t(session: UssdSession, key: string): string {
    return TRANSLATIONS[session.language]?.[key] ?? TRANSLATIONS[Language.ENGLISH][key] ?? key;
  }

  /**
   * Process USSD request
   */
  async processRequest(request: UssdRequest): Promise<UssdResponse> {
    const { sessionId, phoneNumber, provider, input } = request;

    let session = this.sessions.get(sessionId);

    // New session - look up user and show main menu
    if (!session) {
      session = await this.createSession(sessionId, phoneNumber, provider);
      this.logger.debug(`New USSD session: ${sessionId} for ${this.maskPhone(phoneNumber)}`);
      return this.showMainMenu(session);
    }

    // Check session timeout
    if (Date.now() - session.lastActivityAt.getTime() > this.SESSION_TIMEOUT_MS) {
      const lang = session.language;
      this.sessions.delete(sessionId);
      return this.endSession(TRANSLATIONS[lang].sessionTimeout);
    }

    // Update last activity
    session.lastActivityAt = new Date();

    // Process based on current state
    switch (session.state) {
      case UssdState.MAIN_MENU:
        return this.handleMainMenu(session, input);
      case UssdState.CHECK_BALANCE:
        return this.handleCheckBalanceNavigation(session, input);
      case UssdState.POLICY_STATUS:
        return this.handlePolicyStatusNavigation(session, input);
      case UssdState.MAKE_PAYMENT:
        return this.handlePaymentMenu(session, input);
      case UssdState.PAYMENT_CONFIRM:
        return this.handlePaymentConfirm(session, input);
      case UssdState.HELP:
        return this.handleHelpNavigation(session, input);
      default:
        return this.showMainMenu(session);
    }
  }

  /**
   * Create new session with user lookup
   * Fetches user from database to get userId and language preference
   */
  private async createSession(
    sessionId: string,
    phoneNumber: string,
    provider: UssdProvider,
  ): Promise<UssdSession> {
    // Look up user by phone number
    const user = await this.userService.findByPhone(phoneNumber);

    const session: UssdSession = {
      sessionId,
      phoneNumber,
      provider,
      state: UssdState.MAIN_MENU,
      data: {},
      createdAt: new Date(),
      lastActivityAt: new Date(),
      userId: user?.id,
      language: user?.language ?? Language.ENGLISH,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Show main menu
   * Per FEAT-USSD-001/002/003
   */
  private showMainMenu(session: UssdSession): UssdResponse {
    return this.continueSession(
      `${this.t(session, 'welcome')}

1. ${this.t(session, 'checkBalance')}
2. ${this.t(session, 'makePayment')}
3. ${this.t(session, 'policyStatus')}
4. ${this.t(session, 'help')}`,
    );
  }

  /**
   * Handle main menu selection
   */
  private async handleMainMenu(
    session: UssdSession,
    input: string,
  ): Promise<UssdResponse> {
    switch (input.trim()) {
      case '1':
        session.state = UssdState.CHECK_BALANCE;
        return this.showBalance(session);

      case '2':
        session.state = UssdState.MAKE_PAYMENT;
        return this.showPaymentMenu(session);

      case '3':
        session.state = UssdState.POLICY_STATUS;
        return this.showPolicyStatus(session);

      case '4':
        session.state = UssdState.HELP;
        return this.showHelp(session);

      default:
        return this.continueSession(
          `${this.t(session, 'invalidOption')}\n\n1. ${this.t(session, 'checkBalance')}\n2. ${this.t(session, 'makePayment')}\n3. ${this.t(session, 'policyStatus')}\n4. ${this.t(session, 'help')}`,
        );
    }
  }

  /**
   * Show balance
   * Per FEAT-USSD-001
   * Integrates with WalletService to fetch real wallet data
   */
  private async showBalance(session: UssdSession): Promise<UssdResponse> {
    // Check if user is registered
    if (!session.userId) {
      return this.continueSession(
        `${this.t(session, 'notRegistered')}\n\n0. ${this.t(session, 'back')}`,
      );
    }

    try {
      // Get payment progress from WalletService
      const progress = await this.walletService.getPaymentProgress(session.userId);

      const totalPaid = progress.totalPaid;
      const dailyPayments = progress.dailyPaymentsCount;
      const totalDays = PAYMENT_CONFIG.TOTAL_DAILY_PAYMENTS;
      const remaining = progress.dailyPaymentsRemaining * PAYMENT_CONFIG.DAILY_AMOUNT;

      return this.continueSession(
        `${this.t(session, 'yourBalance')}:

${this.t(session, 'totalPaid')}: KES ${totalPaid.toLocaleString()}
${this.t(session, 'dailyPayments')}: ${dailyPayments}/${totalDays}
${this.t(session, 'remaining')}: KES ${remaining.toLocaleString()}

0. ${this.t(session, 'back')}`,
      );
    } catch (error) {
      this.logger.error(`Error fetching balance: ${error}`);
      return this.continueSession(
        `${this.t(session, 'errorOccurred')}\n\n0. ${this.t(session, 'back')}`,
      );
    }
  }

  /**
   * Handle balance screen navigation
   */
  private handleCheckBalanceNavigation(
    session: UssdSession,
    input: string,
  ): UssdResponse | Promise<UssdResponse> {
    if (input === '0') {
      session.state = UssdState.MAIN_MENU;
      return this.showMainMenu(session);
    }
    return this.showBalance(session);
  }

  /**
   * Show payment menu with day options
   * Per FEAT-USSD-002
   * Integrates with WalletService to get actual remaining days
   */
  private async showPaymentMenu(session: UssdSession): Promise<UssdResponse> {
    // Check if user is registered
    if (!session.userId) {
      return this.continueSession(
        `${this.t(session, 'notRegistered')}\n\n0. ${this.t(session, 'back')}`,
      );
    }

    try {
      // Check if user can make daily payment
      const canPay = await this.walletService.canMakeDailyPayment(session.userId);

      if (!canPay.allowed) {
        // Check if deposit is needed first
        const canDeposit = await this.walletService.canMakeDeposit(session.userId);
        if (canDeposit.allowed) {
          // User needs to pay deposit first - initiate deposit
          session.data.isDeposit = true;
          session.data.selectedPayment = {
            key: 'deposit',
            days: 0,
            amount: PAYMENT_CONFIG.DEPOSIT_AMOUNT,
            label: `Deposit (KES ${PAYMENT_CONFIG.DEPOSIT_AMOUNT.toLocaleString()})`,
          };
          session.state = UssdState.PAYMENT_CONFIRM;

          const displayPhone = this.formatPhoneForDisplay(session.phoneNumber);
          return this.continueSession(
            `${this.t(session, 'depositFirst')}

${this.t(session, 'amount')}: KES ${PAYMENT_CONFIG.DEPOSIT_AMOUNT.toLocaleString()}
${this.t(session, 'phone')}: ${displayPhone}

1. ${this.t(session, 'confirm')}
0. ${this.t(session, 'cancel')}`,
          );
        }

        // All payments complete
        return this.continueSession(
          `${this.t(session, 'allPaymentsComplete')}\n\n0. ${this.t(session, 'back')}`,
        );
      }

      const remainingDays = canPay.remainingDays ?? 0;
      const dailyAmount = PAYMENT_CONFIG.DAILY_AMOUNT;
      const remainingAmount = remainingDays * dailyAmount;

      const options: PaymentOption[] = [
        { key: '1', days: 1, amount: dailyAmount, label: `1 ${this.t(session, 'day')} (KES ${dailyAmount})` },
        { key: '2', days: 7, amount: dailyAmount * 7, label: `7 ${this.t(session, 'days')} (KES ${(dailyAmount * 7).toLocaleString()})` },
        { key: '3', days: remainingDays, amount: remainingAmount, label: `${this.t(session, 'allRemaining')} (KES ${remainingAmount.toLocaleString()})` },
      ];

      // Store options in session for confirmation
      session.data.paymentOptions = options;
      session.data.remainingDays = remainingDays;
      session.data.isDeposit = false;

      return this.continueSession(
        `${this.t(session, 'paymentMenu')}
${this.t(session, 'dailyPayment')}: KES ${dailyAmount}
${this.t(session, 'remainingDays')}: ${remainingDays}

${this.t(session, 'payForDays')}
1. ${options[0].label}
2. ${options[1].label}
3. ${options[2].label}
0. ${this.t(session, 'back')}`,
      );
    } catch (error) {
      this.logger.error(`Error showing payment menu: ${error}`);
      return this.continueSession(
        `${this.t(session, 'errorOccurred')}\n\n0. ${this.t(session, 'back')}`,
      );
    }
  }

  /**
   * Handle payment menu selection
   */
  private async handlePaymentMenu(
    session: UssdSession,
    input: string,
  ): Promise<UssdResponse> {
    if (input === '0') {
      session.state = UssdState.MAIN_MENU;
      return this.showMainMenu(session);
    }

    const options = session.data.paymentOptions as PaymentOption[];
    const selected = options?.find((o) => o.key === input);

    if (!selected) {
      return this.continueSession(
        `${this.t(session, 'invalidOption')}\n\n1. 1 ${this.t(session, 'day')}\n2. 7 ${this.t(session, 'days')}\n3. ${this.t(session, 'allRemaining')}\n0. ${this.t(session, 'back')}`,
      );
    }

    // Store selected payment for confirmation
    session.data.selectedPayment = selected;
    session.state = UssdState.PAYMENT_CONFIRM;

    // Mask phone for display
    const displayPhone = this.formatPhoneForDisplay(session.phoneNumber);

    return this.continueSession(
      `${this.t(session, 'confirmPayment')}

${this.t(session, 'amount')}: KES ${selected.amount.toLocaleString()}
${this.t(session, 'phone')}: ${displayPhone}

1. ${this.t(session, 'confirm')}
0. ${this.t(session, 'cancel')}`,
    );
  }

  /**
   * Handle payment confirmation
   * Integrates with PaymentService to trigger M-Pesa STK Push
   */
  private async handlePaymentConfirm(
    session: UssdSession,
    input: string,
  ): Promise<UssdResponse> {
    if (input === '0') {
      session.state = UssdState.MAKE_PAYMENT;
      return this.showPaymentMenu(session);
    }

    if (input === '1') {
      const payment = session.data.selectedPayment as PaymentOption;
      const isDeposit = session.data.isDeposit as boolean;

      if (!payment || !session.userId) {
        session.state = UssdState.MAKE_PAYMENT;
        return this.showPaymentMenu(session);
      }

      try {
        // Initiate M-Pesa STK Push via PaymentService
        const paymentRequest: InitiatePaymentRequest = {
          userId: session.userId,
          phone: session.phoneNumber,
          type: isDeposit ? TransactionType.DEPOSIT : TransactionType.DAILY_PAYMENT,
          daysCount: payment.days,
          idempotencyKey: `ussd-${session.sessionId}-${uuidv4()}`,
        };

        const result = await this.paymentService.initiatePayment(paymentRequest);

        this.logger.log(
          `USSD payment initiated: phone=${this.maskPhone(session.phoneNumber)} amount=${payment.amount} days=${payment.days} success=${result.success}`,
        );

        // Clear session after payment initiation
        this.sessions.delete(session.sessionId);

        if (result.success) {
          return this.endSession(
            `${this.t(session, 'paymentInitiated')}

${this.t(session, 'checkPhonePrompt')}

${this.t(session, 'amount')}: KES ${payment.amount.toLocaleString()}`,
          );
        } else {
          return this.endSession(
            `${this.t(session, 'paymentFailed')}\n\n${result.message}`,
          );
        }
      } catch (error) {
        this.logger.error(`Error initiating payment: ${error}`);
        this.sessions.delete(session.sessionId);
        return this.endSession(this.t(session, 'paymentFailed'));
      }
    }

    return this.continueSession(
      `${this.t(session, 'invalidOption')}\n\n1. ${this.t(session, 'confirm')}\n0. ${this.t(session, 'cancel')}`,
    );
  }

  /**
   * Show policy status
   * Per FEAT-USSD-003
   * Integrates with PolicyService to fetch real policy data
   */
  private async showPolicyStatus(session: UssdSession): Promise<UssdResponse> {
    // Check if user is registered
    if (!session.userId) {
      return this.continueSession(
        `${this.t(session, 'notRegistered')}\n\n0. ${this.t(session, 'back')}`,
      );
    }

    try {
      // Get active policy from PolicyService
      const policy = await this.policyService.getActivePolicy(session.userId);

      if (!policy) {
        return this.continueSession(
          `${this.t(session, 'noActivePolicy')}

${this.t(session, 'dialAgainPayment')}

0. ${this.t(session, 'back')}`,
        );
      }

      const policyNumber = policy.policyNumber ?? 'Pending';
      const status = policy.status;
      const expiryDate = policy.coverageEnd
        ? this.formatDateForDisplay(policy.coverageEnd)
        : 'N/A';
      const daysLeft = policy.daysUntilExpiry ?? 0;

      // Status emoji based on status
      const statusEmoji = policy.isActive ? '✓' : '⚠';

      return this.continueSession(
        `${this.t(session, 'policyStatusLabel')}: ${status} ${statusEmoji}

${this.t(session, 'policy')}: ${policyNumber}
${this.t(session, 'expires')}: ${expiryDate}
${this.t(session, 'daysLeft')}: ${daysLeft}

0. ${this.t(session, 'back')}`,
      );
    } catch (error) {
      this.logger.error(`Error fetching policy status: ${error}`);
      return this.continueSession(
        `${this.t(session, 'errorOccurred')}\n\n0. ${this.t(session, 'back')}`,
      );
    }
  }

  /**
   * Handle policy status navigation
   */
  private handlePolicyStatusNavigation(
    session: UssdSession,
    input: string,
  ): UssdResponse | Promise<UssdResponse> {
    if (input === '0') {
      session.state = UssdState.MAIN_MENU;
      return this.showMainMenu(session);
    }
    return this.showPolicyStatus(session);
  }

  /**
   * Show help information
   */
  private showHelp(session: UssdSession): UssdResponse {
    return this.continueSession(
      `${this.t(session, 'support')}

${this.t(session, 'call')}: 0800-XXX-XXX
${this.t(session, 'whatsapp')}: 0712-XXX-XXX
${this.t(session, 'email')}: support@bodainsure.com

0. ${this.t(session, 'back')}`,
    );
  }

  /**
   * Handle help screen navigation
   */
  private handleHelpNavigation(
    session: UssdSession,
    input: string,
  ): UssdResponse {
    if (input === '0') {
      session.state = UssdState.MAIN_MENU;
      return this.showMainMenu(session);
    }
    return this.showHelp(session);
  }

  /**
   * Format date for USSD display (DD MMM YYYY)
   */
  private formatDateForDisplay(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Continue session with message
   */
  private continueSession(message: string): UssdResponse {
    // Truncate if exceeds USSD character limit
    const truncated = message.slice(0, MAX_USSD_CHARS);
    return { message: truncated, endSession: false };
  }

  /**
   * End session with message
   */
  private endSession(message: string): UssdResponse {
    const truncated = message.slice(0, MAX_USSD_CHARS);
    return { message: truncated, endSession: true };
  }

  /**
   * End session and cleanup
   */
  endSessionById(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired USSD sessions`);
    }

    return cleaned;
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Mask phone number for logging
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '****';
    return `***${phone.slice(-4)}`;
  }

  /**
   * Format phone for display (07XXXXXXXX format)
   */
  private formatPhoneForDisplay(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    // Convert 254... to 0...
    if (cleaned.startsWith('254')) {
      cleaned = '0' + cleaned.substring(3);
    }

    return cleaned;
  }
}
