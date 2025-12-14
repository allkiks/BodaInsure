import { Test, TestingModule } from '@nestjs/testing';
import { UssdService, UssdProvider, UssdRequest } from './ussd.service.js';
import { UserService } from '../../identity/services/user.service.js';
import { WalletService } from '../../payment/services/wallet.service.js';
import { PaymentService } from '../../payment/services/payment.service.js';
import { PolicyService } from '../../policy/services/policy.service.js';
import { Language } from '../../identity/entities/user.entity.js';
import { PolicyStatus } from '../../policy/entities/policy.entity.js';

describe('UssdService', () => {
  let service: UssdService;
  let userService: jest.Mocked<UserService>;
  let walletService: jest.Mocked<WalletService>;
  let paymentService: jest.Mocked<PaymentService>;
  let policyService: jest.Mocked<PolicyService>;

  // Mock user for registered phone
  const mockUser = {
    id: 'user-123',
    phone: '+254712345678',
    language: Language.ENGLISH,
  };

  // Mock payment progress
  const mockPaymentProgress = {
    depositCompleted: true,
    depositAmount: 1048,
    dailyPaymentsCount: 13,
    dailyPaymentsRemaining: 17,
    dailyPaymentsCompleted: false,
    dailyAmount: 87,
    totalPaid: 2179,
    totalRequired: 3658,
    progressPercentage: 60,
    policy1Eligible: true,
    policy2Eligible: false,
  };

  // Mock policy
  const mockPolicy = {
    id: 'policy-123',
    policyNumber: 'DEF/TPO/2024/123456',
    policyType: 'ONE_MONTH',
    status: PolicyStatus.ACTIVE,
    coverageStart: new Date('2024-12-01'),
    coverageEnd: new Date('2025-01-01'),
    daysUntilExpiry: 18,
    premiumAmount: 1048,
    isActive: true,
    documentAvailable: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UssdService,
        {
          provide: UserService,
          useValue: {
            findByPhone: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            getPaymentProgress: jest.fn(),
            canMakeDailyPayment: jest.fn(),
            canMakeDeposit: jest.fn(),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            initiatePayment: jest.fn(),
          },
        },
        {
          provide: PolicyService,
          useValue: {
            getActivePolicy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UssdService>(UssdService);
    userService = module.get(UserService);
    walletService = module.get(WalletService);
    paymentService = module.get(PaymentService);
    policyService = module.get(PolicyService);

    // Default mocks for registered user
    userService.findByPhone.mockResolvedValue(mockUser as any);
    walletService.getPaymentProgress.mockResolvedValue(mockPaymentProgress);
    walletService.canMakeDailyPayment.mockResolvedValue({
      allowed: true,
      remainingDays: 17,
    });
    walletService.canMakeDeposit.mockResolvedValue({
      allowed: false,
      reason: 'Deposit already completed',
    });
    policyService.getActivePolicy.mockResolvedValue(mockPolicy as any);
    paymentService.initiatePayment.mockResolvedValue({
      success: true,
      paymentRequestId: 'req-123',
      checkoutRequestId: 'checkout-123',
      amount: 87,
      message: 'Payment initiated',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (
    sessionId: string,
    phoneNumber: string,
    input: string,
    fullInput: string = input,
  ): UssdRequest => ({
    sessionId,
    phoneNumber,
    serviceCode: '*123#',
    input,
    fullInput,
    provider: UssdProvider.AFRICASTALKING,
  });

  describe('processRequest', () => {
    describe('new session', () => {
      it('should show main menu for new session', async () => {
        const request = createRequest('session-1', '254712345678', '');

        const response = await service.processRequest(request);

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Welcome to BodaInsure');
        expect(response.message).toContain('1. Check Balance');
        expect(response.message).toContain('2. Make Payment');
        expect(response.message).toContain('3. Policy Status');
        expect(response.message).toContain('4. Help');
        expect(userService.findByPhone).toHaveBeenCalledWith('254712345678');
      });

      it('should show Swahili menu for Swahili user', async () => {
        userService.findByPhone.mockResolvedValue({
          ...mockUser,
          language: Language.SWAHILI,
        } as any);

        const response = await service.processRequest(
          createRequest('session-sw', '254712345678', ''),
        );

        expect(response.message).toContain('Karibu BodaInsure');
        expect(response.message).toContain('Angalia Salio');
        expect(response.message).toContain('Fanya Malipo');
      });
    });

    describe('main menu navigation', () => {
      it('should show balance when selecting option 1', async () => {
        await service.processRequest(createRequest('session-2', '254712345678', ''));

        const response = await service.processRequest(
          createRequest('session-2', '254712345678', '1'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Your Balance');
        expect(response.message).toContain('Total Paid: KES 2,179');
        expect(response.message).toContain('Daily Payments: 13/30');
        expect(response.message).toContain('0. Back');
        expect(walletService.getPaymentProgress).toHaveBeenCalledWith('user-123');
      });

      it('should show payment menu when selecting option 2', async () => {
        await service.processRequest(createRequest('session-3', '254712345678', ''));

        const response = await service.processRequest(
          createRequest('session-3', '254712345678', '2'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Make Payment');
        expect(response.message).toContain('1. 1 day (KES 87)');
        expect(response.message).toContain('2. 7 days (KES 609)');
        expect(response.message).toContain('3. All remaining');
      });

      it('should show policy status when selecting option 3', async () => {
        await service.processRequest(createRequest('session-4', '254712345678', ''));

        const response = await service.processRequest(
          createRequest('session-4', '254712345678', '3'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Policy Status');
        expect(response.message).toContain('DEF/TPO/2024/123456');
        expect(response.message).toContain('Days left: 18');
        expect(policyService.getActivePolicy).toHaveBeenCalledWith('user-123');
      });

      it('should show help when selecting option 4', async () => {
        await service.processRequest(createRequest('session-5', '254712345678', ''));

        const response = await service.processRequest(
          createRequest('session-5', '254712345678', '4'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('BodaInsure Support');
        expect(response.message).toContain('Call:');
        expect(response.message).toContain('WhatsApp:');
        expect(response.message).toContain('Email:');
      });

      it('should show error for invalid option', async () => {
        await service.processRequest(createRequest('session-6', '254712345678', ''));

        const response = await service.processRequest(
          createRequest('session-6', '254712345678', '9'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Invalid option');
      });
    });

    describe('unregistered user', () => {
      beforeEach(() => {
        userService.findByPhone.mockResolvedValue(null);
      });

      it('should show not registered message for balance', async () => {
        await service.processRequest(createRequest('unreg-1', '254700000000', ''));

        const response = await service.processRequest(
          createRequest('unreg-1', '254700000000', '1'),
        );

        expect(response.message).toContain('not registered');
      });

      it('should show not registered message for payment', async () => {
        await service.processRequest(createRequest('unreg-2', '254700000000', ''));

        const response = await service.processRequest(
          createRequest('unreg-2', '254700000000', '2'),
        );

        expect(response.message).toContain('not registered');
      });

      it('should show not registered message for policy status', async () => {
        await service.processRequest(createRequest('unreg-3', '254700000000', ''));

        const response = await service.processRequest(
          createRequest('unreg-3', '254700000000', '3'),
        );

        expect(response.message).toContain('not registered');
      });
    });

    describe('payment flow', () => {
      it('should navigate through complete payment flow', async () => {
        const sessionId = 'session-pay-1';
        const phone = '254712345678';

        // 1. Initial menu
        await service.processRequest(createRequest(sessionId, phone, ''));

        // 2. Select payment
        await service.processRequest(createRequest(sessionId, phone, '2'));

        // 3. Select 1 day option
        const confirmScreen = await service.processRequest(
          createRequest(sessionId, phone, '1'),
        );

        expect(confirmScreen.message).toContain('Confirm Payment');
        expect(confirmScreen.message).toContain('KES 87');
        expect(confirmScreen.message).toContain('1. Confirm');

        // 4. Confirm payment
        const finalResponse = await service.processRequest(
          createRequest(sessionId, phone, '1'),
        );

        expect(finalResponse.endSession).toBe(true);
        expect(finalResponse.message).toContain('Payment initiated');
        expect(finalResponse.message).toContain('M-Pesa');
        expect(paymentService.initiatePayment).toHaveBeenCalled();
      });

      it('should allow canceling payment', async () => {
        const sessionId = 'session-pay-2';
        const phone = '254712345678';

        await service.processRequest(createRequest(sessionId, phone, ''));
        await service.processRequest(createRequest(sessionId, phone, '2'));
        await service.processRequest(createRequest(sessionId, phone, '1'));

        // Cancel with 0
        const response = await service.processRequest(
          createRequest(sessionId, phone, '0'),
        );

        expect(response.endSession).toBe(false);
        expect(response.message).toContain('Make Payment');
      });

      it('should handle 7 days payment option', async () => {
        const sessionId = 'session-pay-3';
        const phone = '254712345678';

        await service.processRequest(createRequest(sessionId, phone, ''));
        await service.processRequest(createRequest(sessionId, phone, '2'));

        const confirmScreen = await service.processRequest(
          createRequest(sessionId, phone, '2'),
        );

        expect(confirmScreen.message).toContain('KES 609');
      });

      it('should prompt for deposit if not completed', async () => {
        walletService.canMakeDailyPayment.mockResolvedValue({
          allowed: false,
          reason: 'Deposit must be completed first',
        });
        walletService.canMakeDeposit.mockResolvedValue({
          allowed: true,
        });

        const sessionId = 'session-deposit';
        const phone = '254712345678';

        await service.processRequest(createRequest(sessionId, phone, ''));

        const response = await service.processRequest(
          createRequest(sessionId, phone, '2'),
        );

        expect(response.message).toContain('deposit');
        expect(response.message).toContain('KES 1,048');
      });

      it('should show all payments complete message', async () => {
        walletService.canMakeDailyPayment.mockResolvedValue({
          allowed: false,
          reason: 'All daily payments already completed',
        });
        walletService.canMakeDeposit.mockResolvedValue({
          allowed: false,
          reason: 'Deposit already completed',
        });

        const sessionId = 'session-complete';
        const phone = '254712345678';

        await service.processRequest(createRequest(sessionId, phone, ''));

        const response = await service.processRequest(
          createRequest(sessionId, phone, '2'),
        );

        expect(response.message).toContain('completed');
        expect(response.message).toContain('11-month');
      });
    });

    describe('navigation - back to menu', () => {
      it('should go back from balance to main menu', async () => {
        const sessionId = 'session-nav-1';

        await service.processRequest(createRequest(sessionId, '254712345678', ''));
        await service.processRequest(createRequest(sessionId, '254712345678', '1'));

        const response = await service.processRequest(
          createRequest(sessionId, '254712345678', '0'),
        );

        expect(response.message).toContain('Welcome to BodaInsure');
      });

      it('should go back from payment menu to main menu', async () => {
        const sessionId = 'session-nav-2';

        await service.processRequest(createRequest(sessionId, '254712345678', ''));
        await service.processRequest(createRequest(sessionId, '254712345678', '2'));

        const response = await service.processRequest(
          createRequest(sessionId, '254712345678', '0'),
        );

        expect(response.message).toContain('Welcome to BodaInsure');
      });

      it('should go back from help to main menu', async () => {
        const sessionId = 'session-nav-3';

        await service.processRequest(createRequest(sessionId, '254712345678', ''));
        await service.processRequest(createRequest(sessionId, '254712345678', '4'));

        const response = await service.processRequest(
          createRequest(sessionId, '254712345678', '0'),
        );

        expect(response.message).toContain('Welcome to BodaInsure');
      });

      it('should go back from policy status to main menu', async () => {
        const sessionId = 'session-nav-4';

        await service.processRequest(createRequest(sessionId, '254712345678', ''));
        await service.processRequest(createRequest(sessionId, '254712345678', '3'));

        const response = await service.processRequest(
          createRequest(sessionId, '254712345678', '0'),
        );

        expect(response.message).toContain('Welcome to BodaInsure');
      });
    });

    describe('no active policy', () => {
      it('should show no policy message', async () => {
        policyService.getActivePolicy.mockResolvedValue(null);

        const sessionId = 'session-no-policy';

        await service.processRequest(createRequest(sessionId, '254712345678', ''));

        const response = await service.processRequest(
          createRequest(sessionId, '254712345678', '3'),
        );

        expect(response.message).toContain('No active policy');
        expect(response.message).toContain('option 2');
      });
    });

    describe('Advantasms provider', () => {
      it('should handle Advantasms input format', async () => {
        const request: UssdRequest = {
          sessionId: 'adv-session-1',
          phoneNumber: '254712345678',
          serviceCode: '*999#',
          input: '1',
          fullInput: '33*1',
          provider: UssdProvider.ADVANTASMS,
        };

        await service.processRequest({
          ...request,
          input: '',
          fullInput: '',
        });

        const response = await service.processRequest(request);

        expect(response.message).toContain('Your Balance');
      });
    });
  });

  describe('session management', () => {
    it('should track active session count', async () => {
      expect(service.getActiveSessionCount()).toBe(0);

      await service.processRequest({
        sessionId: 'count-1',
        phoneNumber: '254712345678',
        serviceCode: '*123#',
        input: '',
        fullInput: '',
        provider: UssdProvider.AFRICASTALKING,
      });

      expect(service.getActiveSessionCount()).toBe(1);

      await service.processRequest({
        sessionId: 'count-2',
        phoneNumber: '254712345679',
        serviceCode: '*123#',
        input: '',
        fullInput: '',
        provider: UssdProvider.AFRICASTALKING,
      });

      expect(service.getActiveSessionCount()).toBe(2);
    });

    it('should cleanup expired sessions', async () => {
      await service.processRequest({
        sessionId: 'cleanup-1',
        phoneNumber: '254712345678',
        serviceCode: '*123#',
        input: '',
        fullInput: '',
        provider: UssdProvider.AFRICASTALKING,
      });

      expect(service.getActiveSessionCount()).toBe(1);

      const cleaned = service.cleanupExpiredSessions();

      // Sessions shouldn't be expired immediately
      expect(cleaned).toBe(0);
    });

    it('should end session by ID', async () => {
      await service.processRequest({
        sessionId: 'end-1',
        phoneNumber: '254712345678',
        serviceCode: '*123#',
        input: '',
        fullInput: '',
        provider: UssdProvider.AFRICASTALKING,
      });

      expect(service.getActiveSessionCount()).toBe(1);

      service.endSessionById('end-1');

      expect(service.getActiveSessionCount()).toBe(0);
    });
  });

  describe('message truncation', () => {
    it('should truncate messages exceeding USSD limit', async () => {
      const request = {
        sessionId: 'truncate-1',
        phoneNumber: '254712345678',
        serviceCode: '*123#',
        input: '',
        fullInput: '',
        provider: UssdProvider.AFRICASTALKING,
      };

      const response = await service.processRequest(request);

      // USSD limit is 182 characters
      expect(response.message.length).toBeLessThanOrEqual(182);
    });
  });

  describe('phone number handling', () => {
    it('should handle different phone number formats', async () => {
      const formats = [
        '254712345678',
        '0712345678',
        '+254712345678',
        '712345678',
      ];

      for (const phone of formats) {
        const sessionId = `phone-${phone}`;
        const response = await service.processRequest({
          sessionId,
          phoneNumber: phone,
          serviceCode: '*123#',
          input: '',
          fullInput: '',
          provider: UssdProvider.AFRICASTALKING,
        });

        expect(response.message).toContain('Welcome to BodaInsure');
      }
    });
  });

  describe('error handling', () => {
    it('should handle wallet service errors gracefully', async () => {
      walletService.getPaymentProgress.mockRejectedValue(new Error('DB error'));

      await service.processRequest(createRequest('error-1', '254712345678', ''));

      const response = await service.processRequest(
        createRequest('error-1', '254712345678', '1'),
      );

      expect(response.message).toContain('error');
      expect(response.endSession).toBe(false);
    });

    it('should handle policy service errors gracefully', async () => {
      policyService.getActivePolicy.mockRejectedValue(new Error('DB error'));

      await service.processRequest(createRequest('error-2', '254712345678', ''));

      const response = await service.processRequest(
        createRequest('error-2', '254712345678', '3'),
      );

      expect(response.message).toContain('error');
      expect(response.endSession).toBe(false);
    });

    it('should handle payment service errors gracefully', async () => {
      paymentService.initiatePayment.mockRejectedValue(new Error('M-Pesa error'));

      const sessionId = 'error-pay';
      await service.processRequest(createRequest(sessionId, '254712345678', ''));
      await service.processRequest(createRequest(sessionId, '254712345678', '2'));
      await service.processRequest(createRequest(sessionId, '254712345678', '1'));

      const response = await service.processRequest(
        createRequest(sessionId, '254712345678', '1'),
      );

      expect(response.message).toContain('could not be initiated');
      expect(response.endSession).toBe(true);
    });

    it('should handle payment initiation failure', async () => {
      paymentService.initiatePayment.mockResolvedValue({
        success: false,
        message: 'Insufficient balance',
      });

      const sessionId = 'fail-pay';
      await service.processRequest(createRequest(sessionId, '254712345678', ''));
      await service.processRequest(createRequest(sessionId, '254712345678', '2'));
      await service.processRequest(createRequest(sessionId, '254712345678', '1'));

      const response = await service.processRequest(
        createRequest(sessionId, '254712345678', '1'),
      );

      expect(response.message).toContain('could not be initiated');
      expect(response.message).toContain('Insufficient balance');
      expect(response.endSession).toBe(true);
    });
  });
});

describe('UssdService - Edge Cases', () => {
  let service: UssdService;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UssdService,
        {
          provide: UserService,
          useValue: {
            findByPhone: jest.fn().mockResolvedValue({
              id: 'user-123',
              phone: '+254712345678',
              language: Language.ENGLISH,
            }),
          },
        },
        {
          provide: WalletService,
          useValue: {
            getPaymentProgress: jest.fn().mockResolvedValue({
              totalPaid: 2179,
              dailyPaymentsCount: 13,
              dailyPaymentsRemaining: 17,
            }),
            canMakeDailyPayment: jest.fn().mockResolvedValue({
              allowed: true,
              remainingDays: 17,
            }),
            canMakeDeposit: jest.fn().mockResolvedValue({ allowed: false }),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            initiatePayment: jest.fn().mockResolvedValue({
              success: true,
              message: 'Payment initiated',
            }),
          },
        },
        {
          provide: PolicyService,
          useValue: {
            getActivePolicy: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<UssdService>(UssdService);
    userService = module.get(UserService);
  });

  it('should handle empty input gracefully', async () => {
    const response = await service.processRequest({
      sessionId: 'empty-input',
      phoneNumber: '254712345678',
      serviceCode: '*123#',
      input: '',
      fullInput: '',
      provider: UssdProvider.AFRICASTALKING,
    });

    expect(response.endSession).toBe(false);
    expect(response.message).toBeTruthy();
  });

  it('should handle whitespace input', async () => {
    await service.processRequest({
      sessionId: 'whitespace',
      phoneNumber: '254712345678',
      serviceCode: '*123#',
      input: '',
      fullInput: '',
      provider: UssdProvider.AFRICASTALKING,
    });

    const response = await service.processRequest({
      sessionId: 'whitespace',
      phoneNumber: '254712345678',
      serviceCode: '*123#',
      input: '  1  ',
      fullInput: '  1  ',
      provider: UssdProvider.AFRICASTALKING,
    });

    expect(response.message).toContain('Your Balance');
  });

  it('should handle rapid successive requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `rapid-${i}`,
      phoneNumber: `2547123456${i.toString().padStart(2, '0')}`,
      serviceCode: '*123#',
      input: '',
      fullInput: '',
      provider: UssdProvider.AFRICASTALKING,
    }));

    const responses = await Promise.all(
      requests.map((req) => service.processRequest(req)),
    );

    expect(responses.every((r) => r.message.includes('Welcome'))).toBe(true);
    expect(service.getActiveSessionCount()).toBe(10);
  });
});
