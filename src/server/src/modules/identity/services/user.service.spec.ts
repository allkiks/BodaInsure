import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService, CreateUserData } from './user.service';
import {
  User,
  UserStatus,
  UserRole,
  KycStatus,
  Language,
  Gender,
} from '../entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockPhone = '+254712345678';
  const mockUserId = 'user-uuid-123';

  const createMockUser = (overrides: Partial<User> = {}): User =>
    ({
      id: mockUserId,
      phone: mockPhone,
      status: UserStatus.ACTIVE,
      role: UserRole.RIDER,
      kycStatus: KycStatus.PENDING,
      language: Language.ENGLISH,
      failedLoginAttempts: 0,
      reminderOptOut: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserData: CreateUserData = {
      phone: '0712345678',
      language: Language.SWAHILI,
      termsAccepted: true,
    };

    it('should create a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((data) => ({
        id: mockUserId,
        ...data,
      }) as User);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.createUser(createUserData);

      expect(result.id).toBe(mockUserId);
      expect(result.phone).toBe('+254712345678');
      expect(result.status).toBe(UserStatus.PENDING);
      expect(result.role).toBe(UserRole.RIDER);
      expect(result.language).toBe(Language.SWAHILI);
    });

    it('should normalize phone number to E.164 format', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((data) => ({
        id: mockUserId,
        ...data,
      }) as User);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      await service.createUser({ phone: '0712345678', termsAccepted: true });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+254712345678' }),
      );
    });

    it('should set terms and consent timestamps when accepted', async () => {
      userRepository.findOne.mockResolvedValue(null);

      let createdUser: Partial<User> | null = null;
      userRepository.create.mockImplementation((data) => {
        createdUser = { id: mockUserId, ...data };
        return createdUser as User;
      });
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      await service.createUser({
        phone: mockPhone,
        termsAccepted: true,
      });

      expect(createdUser!.termsAcceptedAt).toBeDefined();
      expect(createdUser!.consentGivenAt).toBeDefined();
    });

    it('should throw ConflictException for duplicate phone', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());

      await expect(service.createUser(createUserData)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createUser(createUserData)).rejects.toThrow(
        'Phone number already registered',
      );
    });

    it('should default language to English if not provided', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((data) => ({
        id: mockUserId,
        ...data,
      }) as User);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      await service.createUser({ phone: mockPhone, termsAccepted: true });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ language: Language.ENGLISH }),
      );
    });
  });

  describe('findByPhone', () => {
    it('should find user by normalized phone number', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPhone('0712345678');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { phone: '+254712345678' },
      });
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByPhone('0712345678');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUserId);

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('activateUser', () => {
    it('should activate a pending user', async () => {
      const pendingUser = createMockUser({ status: UserStatus.PENDING });
      userRepository.findOne.mockResolvedValue(pendingUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.activateUser(mockUserId);

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(result.failedLoginAttempts).toBe(0);
      expect(result.lockedUntil).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.activateUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp and reset failed attempts', async () => {
      await service.updateLastLogin(mockUserId);

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          failedLoginAttempts: 0,
        }),
      );
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      const mockUser = createMockUser({ failedLoginAttempts: 1 });
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.recordFailedLogin(mockUserId);

      expect(result.isLocked).toBe(false);
      expect(mockUser.failedLoginAttempts).toBe(2);
    });

    it('should lock account after 5 failed attempts', async () => {
      const mockUser = createMockUser({ failedLoginAttempts: 4 });
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.recordFailedLogin(mockUserId);

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toBeDefined();
      expect(mockUser.status).toBe(UserStatus.LOCKED);
    });

    it('should return isLocked false if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.recordFailedLogin('non-existent');

      expect(result.isLocked).toBe(false);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.isAccountLocked('non-existent');

      expect(result.isLocked).toBe(false);
    });

    it('should return false if user is not locked', async () => {
      const mockUser = createMockUser({ status: UserStatus.ACTIVE });
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.isAccountLocked(mockUserId);

      expect(result.isLocked).toBe(false);
    });

    it('should return true if user is locked and lock not expired', async () => {
      const lockedUser = createMockUser({
        status: UserStatus.LOCKED,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      });
      userRepository.findOne.mockResolvedValue(lockedUser);

      const result = await service.isAccountLocked(mockUserId);

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should auto-unlock if lock has expired', async () => {
      const expiredLockUser = createMockUser({
        status: UserStatus.LOCKED,
        lockedUntil: new Date(Date.now() - 1000), // Expired
        failedLoginAttempts: 5,
      });
      userRepository.findOne.mockResolvedValue(expiredLockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.isAccountLocked(mockUserId);

      expect(result.isLocked).toBe(false);
      expect(expiredLockUser.status).toBe(UserStatus.ACTIVE);
      expect(expiredLockUser.failedLoginAttempts).toBe(0);
    });
  });

  describe('existsByPhone', () => {
    it('should return true if phone exists', async () => {
      userRepository.count.mockResolvedValue(1);

      const result = await service.existsByPhone('0712345678');

      expect(result).toBe(true);
    });

    it('should return false if phone does not exist', async () => {
      userRepository.count.mockResolvedValue(0);

      const result = await service.existsByPhone('0712345678');

      expect(result).toBe(false);
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status successfully', async () => {
      const mockUser = createMockUser({ kycStatus: KycStatus.PENDING });
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.updateKycStatus(mockUserId, KycStatus.VERIFIED);

      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateKycStatus('non-existent', KycStatus.VERIFIED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile fields', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));

      const result = await service.updateProfile(mockUserId, {
        fullName: 'John Kamau',
        email: 'john@example.com',
        nationalId: '12345678',
        gender: Gender.MALE,
      });

      expect(result.fullName).toBe('John Kamau');
      expect(result.email).toBe('john@example.com');
      expect(result.nationalId).toBe('12345678');
      expect(result.gender).toBe(Gender.MALE);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent', { fullName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user successfully', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((user) => Promise.resolve(user as User));
      userRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.softDeleteUser(mockUserId);

      expect(mockUser.status).toBe(UserStatus.DEACTIVATED);
      expect(userRepository.softDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.softDeleteUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
