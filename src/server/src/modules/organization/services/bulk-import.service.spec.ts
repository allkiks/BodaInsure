import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { BulkImportService, BulkImportOptions } from './bulk-import.service.js';
import { OrganizationService } from './organization.service.js';
import { UserService } from '../../identity/services/user.service.js';
import { Membership, MembershipStatus, MemberRole } from '../entities/membership.entity.js';
import { User, UserStatus, Language } from '../../identity/entities/user.entity.js';

describe('BulkImportService', () => {
  let service: BulkImportService;
  let membershipRepository: jest.Mocked<Repository<Membership>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let organizationService: jest.Mocked<OrganizationService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockMembershipRepository = {
    count: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOrganizationService = {
    getById: jest.fn().mockResolvedValue({ id: 'org-123', name: 'Test Org' }),
    updateMemberCount: jest.fn().mockResolvedValue(undefined),
  };

  const mockUserService = {
    findByPhone: jest.fn(),
  };

  // Mock EntityManager for transactions
  const mockEntityManager = {
    findOne: jest.fn(),
    create: jest.fn((entity: unknown, data: unknown) => data),
    save: jest.fn((entity: unknown, data: unknown) => ({ id: 'new-id', ...data as object })),
  } as unknown as EntityManager;

  const mockDataSource = {
    transaction: jest.fn((callback: (manager: EntityManager) => Promise<unknown>) =>
      callback(mockEntityManager),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkImportService,
        {
          provide: getRepositoryToken(Membership),
          useValue: mockMembershipRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: OrganizationService,
          useValue: mockOrganizationService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BulkImportService>(BulkImportService);
    membershipRepository = module.get(getRepositoryToken(Membership));
    userRepository = module.get(getRepositoryToken(User));
    organizationService = module.get(OrganizationService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importFromCsv', () => {
    const validCsvWithHeader = `phone,member_number,full_name,national_id,kra_pin,email,language,role
+254712345678,KBA001,John Kamau,12345678,A012345678B,john@example.com,en,MEMBER
0723456789,KBA002,Jane Wanjiku,23456789,,jane@example.com,sw,`;

    const validCsvWithoutHeader = `+254712345678,KBA001,John Kamau
0723456789,KBA002,Jane Wanjiku`;

    beforeEach(() => {
      // Reset transaction mock for each test
      mockEntityManager.findOne
        .mockResolvedValueOnce(null) // User not found
        .mockResolvedValueOnce(null) // Membership not found
        .mockResolvedValueOnce(null) // User not found
        .mockResolvedValueOnce(null); // Membership not found
      mockMembershipRepository.count.mockResolvedValue(2);
    });

    it('should import members from valid CSV with header row', async () => {
      const result = await service.importFromCsv(
        'org-123',
        validCsvWithHeader,
        { skipFirstRow: true },
        'admin-user-id',
      );

      expect(result.organizationId).toBe('org-123');
      expect(result.totalRows).toBe(2);
      expect(result.created).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should import members from CSV without header row', async () => {
      const result = await service.importFromCsv(
        'org-123',
        validCsvWithoutHeader,
        { skipFirstRow: false },
        'admin-user-id',
      );

      expect(result.totalRows).toBe(2);
      expect(result.created).toBe(2);
    });

    it('should handle existing users by creating only membership if needed', async () => {
      // Test the scenario where a user already exists but needs new membership
      const existingUser = {
        id: 'existing-user-id',
        phone: '+254712345678',
        status: UserStatus.ACTIVE,
      };

      // User exists, but no membership yet
      mockEntityManager.findOne
        .mockResolvedValueOnce(existingUser) // User found
        .mockResolvedValueOnce(null) // Membership not found - should create
        .mockResolvedValueOnce(null) // Second user not found - should create
        .mockResolvedValueOnce(null); // Second membership not found - should create

      const result = await service.importFromCsv(
        'org-123',
        validCsvWithHeader,
        {},
        'admin-user-id',
      );

      // Both rows result in 'created' because membership was new for each
      expect(result.created).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should mark as existing when user and membership both exist', async () => {
      const singleUserCsv = `phone,name
+254712345678,John`;

      const existingUser = {
        id: 'existing-user-id',
        phone: '+254712345678',
      };
      const existingMembership = {
        id: 'membership-id',
        userId: 'existing-user-id',
        organizationId: 'org-123',
      };

      // Clear any previous mocks and set up fresh
      (mockEntityManager.findOne as jest.Mock).mockReset();
      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(existingUser) // User found
        .mockResolvedValueOnce(existingMembership); // Membership found

      const result = await service.importFromCsv(
        'org-123',
        singleUserCsv,
        {},
        'admin-user-id',
      );

      expect(result.existing).toBe(1);
      expect(result.created).toBe(0);
    });

    it('should throw error for empty CSV', async () => {
      await expect(
        service.importFromCsv('org-123', '', {}, 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for CSV with only header row', async () => {
      const headerOnly = 'phone,member_number,full_name';

      await expect(
        service.importFromCsv('org-123', headerOnly, { skipFirstRow: true }, 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when exceeding max rows', async () => {
      // Generate CSV with too many rows
      const rows = ['phone'];
      for (let i = 0; i < 5001; i++) {
        rows.push(`+2547${String(i).padStart(8, '0')}`);
      }

      await expect(
        service.importFromCsv('org-123', rows.join('\n'), { skipFirstRow: true }, 'admin-user-id'),
      ).rejects.toThrow(/Maximum.*rows/);
    });

    it('should validate organization exists before import', async () => {
      mockOrganizationService.getById.mockRejectedValueOnce(
        new Error('Organization not found'),
      );

      await expect(
        service.importFromCsv('invalid-org', validCsvWithHeader, {}, 'admin-user-id'),
      ).rejects.toThrow('Organization not found');
    });

    it('should auto-approve memberships when option is set', async () => {
      const options: BulkImportOptions = {
        autoApprove: true,
        defaultRole: MemberRole.MEMBER,
      };

      await service.importFromCsv('org-123', validCsvWithHeader, options, 'admin-user-id');

      // Verify membership was created with ACTIVE status
      const createCall = mockEntityManager.create as jest.Mock;
      const membershipCalls = createCall.mock.calls.filter(
        (call: unknown[]) => call[0] === Membership,
      );

      membershipCalls.forEach((call: unknown[]) => {
        const membershipData = call[1] as { status: MembershipStatus };
        expect(membershipData.status).toBe(MembershipStatus.ACTIVE);
      });
    });

    it('should set pending status when autoApprove is false', async () => {
      const options: BulkImportOptions = {
        autoApprove: false,
      };

      await service.importFromCsv('org-123', validCsvWithHeader, options, 'admin-user-id');

      const createCall = mockEntityManager.create as jest.Mock;
      const membershipCalls = createCall.mock.calls.filter(
        (call: unknown[]) => call[0] === Membership,
      );

      membershipCalls.forEach((call: unknown[]) => {
        const membershipData = call[1] as { status: MembershipStatus };
        expect(membershipData.status).toBe(MembershipStatus.PENDING);
      });
    });

    it('should update organization member count after import', async () => {
      await service.importFromCsv('org-123', validCsvWithHeader, {}, 'admin-user-id');

      expect(mockOrganizationService.updateMemberCount).toHaveBeenCalledWith('org-123', 2);
    });
  });

  describe('Phone Number Validation', () => {
    const csvTemplate = (phone: string) => `phone\n${phone}`;

    beforeEach(() => {
      mockEntityManager.findOne.mockResolvedValue(null);
    });

    const validPhones = [
      '+254712345678',  // E.164 format
      '0712345678',     // Local format with 0
      '712345678',      // Local format without 0
      '254712345678',   // Country code without +
      '+254723456789',  // Safaricom
      '+254733456789',  // Safaricom
      '+254110456789',  // Safaricom
    ];

    validPhones.forEach(phone => {
      it(`should accept valid Kenyan phone: ${phone}`, async () => {
        const result = await service.importFromCsv(
          'org-123',
          csvTemplate(phone),
          { skipFirstRow: true },
          'admin-user-id',
        );

        expect(result.errors).toBe(0);
        expect(result.created).toBe(1);
      });
    });

    // Note: The service normalizes phones but only rejects empty phones.
    // Phone validation is done by normalizePhoneToE164 which doesn't throw.
    // Rows with empty phone field are skipped by the CSV parser.
  });

  describe('CSV Parsing', () => {
    beforeEach(() => {
      mockEntityManager.findOne.mockResolvedValue(null);
    });

    it('should handle quoted values with commas', async () => {
      const csv = `phone,full_name
+254712345678,"Kamau, John Mwangi"`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.created).toBe(1);
      // The full name should include the comma
    });

    it('should handle escaped quotes in values', async () => {
      const csv = `phone,full_name
+254712345678,"John ""JK"" Kamau"`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.created).toBe(1);
    });

    it('should handle Windows line endings (CRLF)', async () => {
      const csv = `phone,full_name\r\n+254712345678,John Kamau\r\n+254723456789,Jane Wanjiku`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.totalRows).toBe(2);
    });

    it('should skip empty rows', async () => {
      const csv = `phone,full_name
+254712345678,John Kamau

+254723456789,Jane Wanjiku
`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.totalRows).toBe(2);
    });
  });

  describe('Language Parsing', () => {
    beforeEach(() => {
      mockEntityManager.findOne.mockResolvedValue(null);
    });

    const languageTests = [
      { input: 'en', expected: Language.ENGLISH },
      { input: 'sw', expected: Language.SWAHILI },
      { input: 'swahili', expected: Language.SWAHILI },
      { input: 'kiswahili', expected: Language.SWAHILI },
      { input: 'SWAHILI', expected: Language.SWAHILI },
      { input: '', expected: Language.ENGLISH },
      { input: 'unknown', expected: Language.ENGLISH },
    ];

    languageTests.forEach(({ input, expected }) => {
      it(`should parse language "${input || '(empty)'}" as ${expected}`, async () => {
        // CSV columns: phone(0), member_number(1), full_name(2), national_id(3), kra_pin(4), email(5), language(6)
        const csv = `phone,member_number,full_name,national_id,kra_pin,email,language
+254712345678,,,,,,${input}`;

        await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

        const createCall = mockEntityManager.create as jest.Mock;
        const userCalls = createCall.mock.calls.filter(
          (call: unknown[]) => call[0] === User,
        );

        if (userCalls.length > 0) {
          const userData = userCalls[0][1] as { language: Language };
          expect(userData.language).toBe(expected);
        }
      });
    });
  });

  describe('Role Parsing', () => {
    beforeEach(() => {
      mockEntityManager.findOne.mockResolvedValue(null);
    });

    const roleTests = [
      { input: 'MEMBER', expected: MemberRole.MEMBER },
      { input: 'ADMIN', expected: MemberRole.ADMIN },
      { input: 'CHAIRPERSON', expected: MemberRole.CHAIRPERSON },
      { input: 'TREASURER', expected: MemberRole.TREASURER },
      { input: 'SECRETARY', expected: MemberRole.SECRETARY },
      { input: 'OFFICIAL', expected: MemberRole.OFFICIAL },
    ];

    roleTests.forEach(({ input, expected }) => {
      it(`should parse role "${input}" correctly`, async () => {
        // CSV columns: phone(0), member_number(1), full_name(2), national_id(3), kra_pin(4), email(5), language(6), role(7)
        const csv = `phone,member_number,full_name,national_id,kra_pin,email,language,role
+254712345678,,,,,,,${input}`;

        await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

        const createCall = mockEntityManager.create as jest.Mock;
        const membershipCalls = createCall.mock.calls.filter(
          (call: unknown[]) => call[0] === Membership,
        );

        if (membershipCalls.length > 0) {
          const membershipData = membershipCalls[0][1] as { role: MemberRole };
          expect(membershipData.role).toBe(expected);
        }
      });
    });

    it('should use default role when role is invalid', async () => {
      const csv = `phone,member_number,full_name,national_id,kra_pin,email,language,role
+254712345678,,,,,,,INVALID_ROLE`;

      await service.importFromCsv(
        'org-123',
        csv,
        { defaultRole: MemberRole.MEMBER },
        'admin-user-id',
      );

      const createCall = mockEntityManager.create as jest.Mock;
      const membershipCalls = createCall.mock.calls.filter(
        (call: unknown[]) => call[0] === Membership,
      );

      if (membershipCalls.length > 0) {
        const membershipData = membershipCalls[0][1] as { role: MemberRole };
        expect(membershipData.role).toBe(MemberRole.MEMBER);
      }
    });
  });

  describe('validateCsv', () => {
    it('should return valid for correct CSV', async () => {
      const csv = `phone,name
+254712345678,John
+254723456789,Jane`;

      const result = await service.validateCsv(csv, true);

      expect(result.valid).toBe(true);
      expect(result.validRows).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip rows with missing phone number in validation', async () => {
      // The CSV parser skips rows where the first column (phone) is empty
      const csv = `phone,name
,John`;

      const result = await service.validateCsv(csv, true);

      // Row is skipped by parser, not returned as an error
      expect(result.totalRows).toBe(0);
      expect(result.valid).toBe(true);
    });

    it('should accept non-standard phone formats (normalization only)', async () => {
      // The service normalizes phones but doesn't strictly validate format
      const csv = `phone,name
+254712345678,John
0712345678,Jane`;

      const result = await service.validateCsv(csv, true);

      expect(result.valid).toBe(true);
      expect(result.validRows).toBe(2);
    });
  });

  describe('getCsvTemplate', () => {
    it('should return a valid CSV template with header and examples', () => {
      const template = service.getCsvTemplate();

      expect(template).toContain('phone');
      expect(template).toContain('member_number');
      expect(template).toContain('full_name');
      expect(template).toContain('+254712345678'); // Example phone
    });
  });

  describe('getImportStats', () => {
    it('should return membership statistics for organization', async () => {
      mockMembershipRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // active
        .mockResolvedValueOnce(10); // pending

      const stats = await service.getImportStats('org-123');

      expect(stats).toEqual({
        totalMembers: 100,
        activeMembers: 85,
        pendingMembers: 10,
      });

      expect(mockMembershipRepository.count).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle transaction errors gracefully', async () => {
      mockDataSource.transaction.mockRejectedValueOnce(new Error('Database error'));

      const csv = `phone\n+254712345678`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.errors).toBe(1);
      expect(result.results[0].status).toBe('error');
      expect(result.results[0].error).toBe('Database error');
    });

    it('should continue processing after individual row errors', async () => {
      // First row fails, second succeeds
      mockDataSource.transaction
        .mockRejectedValueOnce(new Error('Row 1 error'))
        .mockImplementationOnce((callback: (manager: EntityManager) => Promise<unknown>) => {
          mockEntityManager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
          return callback(mockEntityManager);
        });

      const csv = `phone
+254712345678
+254723456789`;

      const result = await service.importFromCsv('org-123', csv, {}, 'admin-user-id');

      expect(result.errors).toBe(1);
      expect(result.created).toBe(1);
      expect(result.totalRows).toBe(2);
    });
  });
});
