import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { OtpService, GenerateOtpResult, VerifyOtpResult } from './otp.service';
import { Otp, OtpPurpose, OtpStatus } from '../entities/otp.entity';
import { OTP_CONFIG } from '../../../common/constants';

describe('OtpService', () => {
  let service: OtpService;
  let otpRepository: jest.Mocked<Repository<Otp>>;

  const mockPhone = '+254712345678';
  const mockUserId = 'user-uuid-123';

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: getRepositoryToken(Otp),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    otpRepository = module.get(getRepositoryToken(Otp));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit OTP successfully', async () => {
      otpRepository.count.mockResolvedValue(0);
      otpRepository.update.mockResolvedValue({ affected: 0 } as any);
      otpRepository.create.mockImplementation((data) => ({
        id: 'otp-uuid-123',
        ...data,
        createdAt: new Date(),
      }) as Otp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.generateOtp(
        mockPhone,
        OtpPurpose.REGISTRATION,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.otp).toBeDefined();
      expect(result.otp).toMatch(/^\d{6}$/);
      expect(result.otpId).toBe('otp-uuid-123');
      expect(result.message).toBe('OTP generated successfully');
    });

    it('should invalidate existing pending OTPs before creating new one', async () => {
      otpRepository.count.mockResolvedValue(0);
      otpRepository.update.mockResolvedValue({ affected: 1 } as any);
      otpRepository.create.mockImplementation((data) => ({
        id: 'otp-uuid-123',
        ...data,
      }) as Otp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      await service.generateOtp(mockPhone, OtpPurpose.REGISTRATION);

      expect(otpRepository.update).toHaveBeenCalledWith(
        {
          phone: mockPhone,
          purpose: OtpPurpose.REGISTRATION,
          status: OtpStatus.PENDING,
        },
        { status: OtpStatus.EXPIRED },
      );
    });

    it('should reject when rate limit exceeded (3 per hour)', async () => {
      otpRepository.count.mockResolvedValue(3);
      otpRepository.findOne.mockResolvedValue({
        createdAt: new Date(),
      } as Otp);

      const result = await service.generateOtp(mockPhone, OtpPurpose.LOGIN);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many OTP requests');
      expect(result.retryAfter).toBeDefined();
    });

    it('should store OTP with correct expiry time', async () => {
      otpRepository.count.mockResolvedValue(0);
      otpRepository.update.mockResolvedValue({ affected: 0 } as any);

      let savedOtp: Partial<Otp> | null = null;
      otpRepository.create.mockImplementation((data) => {
        savedOtp = { id: 'otp-uuid-123', ...data };
        return savedOtp as Otp;
      });
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      await service.generateOtp(mockPhone, OtpPurpose.REGISTRATION);

      expect(savedOtp).toBeDefined();
      const expiresAt = savedOtp!.expiresAt as Date;
      const expectedExpiry = Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000;

      // Allow 5 second tolerance
      expect(Math.abs(expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
    });

    it('should hash OTP before storing', async () => {
      otpRepository.count.mockResolvedValue(0);
      otpRepository.update.mockResolvedValue({ affected: 0 } as any);

      let savedOtp: Partial<Otp> | null = null;
      otpRepository.create.mockImplementation((data) => {
        savedOtp = { id: 'otp-uuid-123', ...data };
        return savedOtp as Otp;
      });
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.generateOtp(mockPhone, OtpPurpose.REGISTRATION);

      // The plaintext OTP is returned
      expect(result.otp).toBeDefined();
      // But the stored value should be a hash (64 char hex)
      expect(savedOtp!.codeHash).toBeDefined();
      expect(savedOtp!.codeHash).toMatch(/^[a-f0-9]{64}$/);
      // Verify hash matches
      const expectedHash = crypto.createHash('sha256').update(result.otp!).digest('hex');
      expect(savedOtp!.codeHash).toBe(expectedHash);
    });
  });

  describe('verifyOtp', () => {
    const createMockOtp = (overrides: Partial<Otp> = {}): Otp => ({
      id: 'otp-uuid-123',
      phone: mockPhone,
      codeHash: crypto.createHash('sha256').update('123456').digest('hex'),
      purpose: OtpPurpose.REGISTRATION,
      status: OtpStatus.PENDING,
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: mockUserId,
      ...overrides,
    } as Otp);

    it('should verify correct OTP successfully', async () => {
      const mockOtp = createMockOtp();
      otpRepository.findOne.mockResolvedValue(mockOtp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.verifyOtp(
        mockPhone,
        '123456',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('OTP verified successfully');
      expect(mockOtp.status).toBe(OtpStatus.VERIFIED);
      expect(mockOtp.verifiedAt).toBeDefined();
    });

    it('should reject incorrect OTP and increment attempts', async () => {
      const mockOtp = createMockOtp();
      otpRepository.findOne.mockResolvedValue(mockOtp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.verifyOtp(
        mockPhone,
        '654321',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Incorrect verification code');
      expect(result.attemptsRemaining).toBe(OTP_CONFIG.MAX_ATTEMPTS - 1);
      expect(mockOtp.attempts).toBe(1);
    });

    it('should return correct attempts remaining after multiple failures', async () => {
      const mockOtp = createMockOtp({ attempts: 3 });
      otpRepository.findOne.mockResolvedValue(mockOtp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.verifyOtp(
        mockPhone,
        '654321',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(false);
      expect(result.attemptsRemaining).toBe(1); // 5 - 4 = 1
    });

    it('should reject when no pending OTP found', async () => {
      otpRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyOtp(
        mockPhone,
        '123456',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pending OTP found');
    });

    it('should reject and mark expired when OTP has expired', async () => {
      const expiredOtp = createMockOtp({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      otpRepository.findOne.mockResolvedValue(expiredOtp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.verifyOtp(
        mockPhone,
        '123456',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('expired');
      expect(expiredOtp.status).toBe(OtpStatus.EXPIRED);
    });

    it('should reject when max attempts exceeded', async () => {
      const exhaustedOtp = createMockOtp({ attempts: 5 });
      otpRepository.findOne.mockResolvedValue(exhaustedOtp);
      otpRepository.save.mockImplementation((otp) => Promise.resolve(otp as Otp));

      const result = await service.verifyOtp(
        mockPhone,
        '123456',
        OtpPurpose.REGISTRATION,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Maximum verification attempts exceeded');
      expect(result.attemptsRemaining).toBe(0);
      expect(exhaustedOtp.status).toBe(OtpStatus.EXHAUSTED);
    });
  });

  describe('canResendOtp', () => {
    it('should allow resend when no previous OTP exists', async () => {
      otpRepository.findOne.mockResolvedValue(null);

      const result = await service.canResendOtp(mockPhone, OtpPurpose.LOGIN);

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should block resend within cooldown period', async () => {
      const recentOtp = {
        createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      } as Otp;
      otpRepository.findOne.mockResolvedValue(recentOtp);

      const result = await service.canResendOtp(mockPhone, OtpPurpose.LOGIN);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(OTP_CONFIG.RESEND_COOLDOWN_SECONDS);
    });

    it('should allow resend after cooldown period', async () => {
      const oldOtp = {
        createdAt: new Date(Date.now() - (OTP_CONFIG.RESEND_COOLDOWN_SECONDS + 10) * 1000),
      } as Otp;
      otpRepository.findOne.mockResolvedValue(oldOtp);

      const result = await service.canResendOtp(mockPhone, OtpPurpose.LOGIN);

      expect(result.allowed).toBe(true);
    });
  });

  describe('cleanupExpiredOtps', () => {
    it('should delete OTPs older than 24 hours', async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
      };
      otpRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.cleanupExpiredOtps();

      expect(result).toBe(10);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'created_at < :cutoff',
        expect.any(Object),
      );
    });
  });
});
