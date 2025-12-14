import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletService } from './wallet.service.js';
import { Wallet, WalletStatus } from '../entities/wallet.entity.js';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepository: Repository<Wallet>;
  let dataSource: DataSource;

  const createMockWallet = (overrides: Partial<Wallet> = {}): Partial<Wallet> => ({
    id: 'wallet-123',
    userId: 'user-123',
    balance: 0,
    currency: 'KES',
    status: WalletStatus.ACTIVE,
    depositCompleted: false,
    dailyPaymentsCount: 0,
    dailyPaymentsCompleted: false,
    totalDeposited: 0,
    totalPaid: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    getBalanceInKes: () => Number(overrides.balance ?? 0) / 100,
    getRemainingDailyPayments: () => 30 - Number(overrides.dailyPaymentsCount ?? 0),
    ...overrides,
  });

  const mockWallet = createMockWallet();

  const mockWalletRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(Wallet), useValue: mockWalletRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateWallet', () => {
    it('should return existing wallet if found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      const result = await service.getOrCreateWallet('user-123');

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockWalletRepository.create).not.toHaveBeenCalled();
    });

    it('should create new wallet if not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(mockWallet);

      const result = await service.getOrCreateWallet('user-123');

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        status: WalletStatus.ACTIVE,
        balance: 0,
        totalDeposited: 0,
        totalPaid: 0,
        depositCompleted: false,
        dailyPaymentsCount: 0,
        dailyPaymentsCompleted: false,
        currency: 'KES',
      });
      expect(mockWalletRepository.save).toHaveBeenCalled();
    });
  });

  describe('canMakeDeposit', () => {
    it('should allow deposit for new user without wallet', async () => {
      // First call returns null (no wallet), then create is called
      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue(createMockWallet());
      mockWalletRepository.save.mockImplementation((w) => Promise.resolve(w));

      const result = await service.canMakeDeposit('user-123');

      expect(result.allowed).toBe(true);
    });

    it('should allow deposit when depositCompleted is false', async () => {
      mockWalletRepository.findOne.mockResolvedValue(createMockWallet({
        depositCompleted: false,
      }));

      const result = await service.canMakeDeposit('user-123');

      expect(result.allowed).toBe(true);
    });

    it('should deny deposit when already completed', async () => {
      mockWalletRepository.findOne.mockResolvedValue(createMockWallet({
        depositCompleted: true,
      }));

      const result = await service.canMakeDeposit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('already completed');
    });
  });

  describe('canMakeDailyPayment', () => {
    it('should deny daily payment if deposit not completed', async () => {
      mockWalletRepository.findOne.mockResolvedValue(createMockWallet({
        depositCompleted: false,
      }));

      const result = await service.canMakeDailyPayment('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Deposit must be completed first');
    });

    it('should deny daily payment if all 30 days completed', async () => {
      mockWalletRepository.findOne.mockResolvedValue(createMockWallet({
        depositCompleted: true,
        dailyPaymentsCount: 30,
        dailyPaymentsCompleted: true,
      }));

      const result = await service.canMakeDailyPayment('user-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('All daily payments already completed');
    });

    it('should allow daily payment with remaining days', async () => {
      const wallet = createMockWallet({
        depositCompleted: true,
        dailyPaymentsCount: 15,
      });
      // Override the getRemainingDailyPayments method
      wallet.getRemainingDailyPayments = () => 15;
      mockWalletRepository.findOne.mockResolvedValue(wallet);

      const result = await service.canMakeDailyPayment('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remainingDays).toBe(15);
    });
  });

  describe('getBalance', () => {
    it('should return wallet balance for existing wallet', async () => {
      const wallet = createMockWallet({
        balance: 104800, // cents
        depositCompleted: true,
        dailyPaymentsCount: 10,
      });
      wallet.getBalanceInKes = () => 1048;
      wallet.getRemainingDailyPayments = () => 20;
      mockWalletRepository.findOne.mockResolvedValue(wallet);

      const result = await service.getBalance('user-123');

      expect(result.balance).toBe(1048); // KES
      expect(result.depositCompleted).toBe(true);
      expect(result.dailyPaymentsCount).toBe(10);
      expect(result.dailyPaymentsRemaining).toBe(20);
      expect(result.dailyPaymentsCompleted).toBe(false);
    });

    it('should return zero balance for non-existent wallet', async () => {
      // When wallet not found, getOrCreateWallet creates one
      const newWallet = createMockWallet();
      newWallet.getBalanceInKes = () => 0;
      newWallet.getRemainingDailyPayments = () => 30;
      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue(newWallet);
      mockWalletRepository.save.mockImplementation((w) => Promise.resolve(w));

      const result = await service.getBalance('user-123');

      expect(result.balance).toBe(0);
      expect(result.depositCompleted).toBe(false);
      expect(result.dailyPaymentsCount).toBe(0);
    });
  });

  describe('getPaymentProgress', () => {
    it('should return correct progress for partial payments', async () => {
      const wallet = createMockWallet({
        depositCompleted: true,
        dailyPaymentsCount: 20,
        dailyPaymentsCompleted: false,
        totalDeposited: 278600, // 1048*100 + 87*100*20
      });
      wallet.getRemainingDailyPayments = () => 10;
      mockWalletRepository.findOne.mockResolvedValue(wallet);

      const result = await service.getPaymentProgress('user-123');

      expect(result.depositCompleted).toBe(true);
      expect(result.dailyPaymentsCount).toBe(20);
      expect(result.dailyPaymentsRemaining).toBe(10);
      expect(result.totalPaid).toBe(2788); // 1048 + (20 * 87)
      expect(result.progressPercentage).toBe(76); // Rounded
      expect(result.policy1Eligible).toBe(true);
      expect(result.policy2Eligible).toBe(false);
    });

    it('should return policy2 eligible when all payments done', async () => {
      const wallet = createMockWallet({
        depositCompleted: true,
        dailyPaymentsCount: 30,
        dailyPaymentsCompleted: true,
        totalDeposited: 365800,
      });
      wallet.getRemainingDailyPayments = () => 0;
      mockWalletRepository.findOne.mockResolvedValue(wallet);

      const result = await service.getPaymentProgress('user-123');

      expect(result.policy1Eligible).toBe(true);
      expect(result.policy2Eligible).toBe(true);
      expect(result.progressPercentage).toBe(100);
    });
  });
});
