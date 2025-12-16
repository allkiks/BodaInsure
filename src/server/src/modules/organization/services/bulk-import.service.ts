import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Membership, MembershipStatus, MemberRole } from '../entities/membership.entity.js';
import { OrganizationService } from './organization.service.js';
import { User, UserStatus, Language } from '../../identity/entities/user.entity.js';
import { normalizePhoneToE164 } from '../../../common/utils/phone.util.js';

/**
 * CSV row structure for bulk import
 */
export interface BulkImportRow {
  phone: string;
  memberNumber?: string;
  fullName?: string;
  nationalId?: string;
  kraPin?: string;
  email?: string;
  language?: string;
  role?: string;
}

/**
 * Import result for a single row
 */
export interface ImportRowResult {
  row: number;
  phone: string;
  status: 'created' | 'existing' | 'error';
  userId?: string;
  membershipId?: string;
  error?: string;
}

/**
 * Bulk import summary
 */
export interface BulkImportResult {
  organizationId: string;
  totalRows: number;
  created: number;
  existing: number;
  errors: number;
  results: ImportRowResult[];
}

/**
 * Import options
 */
export interface BulkImportOptions {
  skipFirstRow?: boolean; // Skip header row
  autoApprove?: boolean; // Auto-approve memberships
  defaultRole?: MemberRole;
  sendWelcomeSms?: boolean;
}

/**
 * Bulk Import Service
 * Per GAP-013: Bulk member import from CSV files
 *
 * Supports importing members to organizations from CSV files with:
 * - Phone number (required)
 * - Member number (optional)
 * - Full name (optional)
 * - National ID (optional)
 * - KRA PIN (optional)
 * - Email (optional)
 * - Language preference (optional)
 * - Role (optional, defaults to MEMBER)
 */
@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);
  private readonly MAX_ROWS_PER_IMPORT = 5000;

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly organizationService: OrganizationService,
    private readonly dataSource: DataSource,
  ) {}

  // Expose userRepository for subclasses
  protected get userRepository(): Repository<User> {
    return this.userRepo;
  }

  /**
   * Import members from CSV content
   * @param organizationId - Target organization
   * @param csvContent - CSV file content as string
   * @param options - Import options
   * @param importedBy - User ID performing the import
   */
  async importFromCsv(
    organizationId: string,
    csvContent: string,
    options: BulkImportOptions = {},
    importedBy: string,
  ): Promise<BulkImportResult> {
    // Validate organization exists
    await this.organizationService.getById(organizationId);

    // Parse CSV
    const rows = this.parseCsv(csvContent, options.skipFirstRow ?? true);

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty or contains no data rows');
    }

    if (rows.length > this.MAX_ROWS_PER_IMPORT) {
      throw new BadRequestException(
        `Maximum ${this.MAX_ROWS_PER_IMPORT} rows allowed per import. Found ${rows.length} rows.`,
      );
    }

    this.logger.log(
      `Starting bulk import: org=${organizationId} rows=${rows.length} by=${importedBy}`,
    );

    const result: BulkImportResult = {
      organizationId,
      totalRows: rows.length,
      created: 0,
      existing: 0,
      errors: 0,
      results: [],
    };

    // Process rows in batches to avoid memory issues
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchResults = await this.processBatch(
        organizationId,
        batch,
        i,
        options,
        importedBy,
      );

      for (const rowResult of batchResults) {
        result.results.push(rowResult);
        if (rowResult.status === 'created') result.created++;
        else if (rowResult.status === 'existing') result.existing++;
        else result.errors++;
      }
    }

    // Update organization member count
    await this.organizationService.updateMemberCount(
      organizationId,
      await this.membershipRepository.count({
        where: { organizationId, status: MembershipStatus.ACTIVE },
      }),
    );

    this.logger.log(
      `Bulk import complete: created=${result.created} existing=${result.existing} errors=${result.errors}`,
    );

    return result;
  }

  /**
   * Parse CSV content into rows
   */
  private parseCsv(content: string, skipFirstRow: boolean): BulkImportRow[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      return [];
    }

    const startIndex = skipFirstRow ? 1 : 0;
    const rows: BulkImportRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = this.parseCsvLine(line);

      if (values.length === 0 || !values[0]?.trim()) {
        continue; // Skip empty rows
      }

      rows.push({
        phone: values[0]?.trim() ?? '',
        memberNumber: values[1]?.trim() || undefined,
        fullName: values[2]?.trim() || undefined,
        nationalId: values[3]?.trim() || undefined,
        kraPin: values[4]?.trim() || undefined,
        email: values[5]?.trim() || undefined,
        language: values[6]?.trim() || undefined,
        role: values[7]?.trim() || undefined,
      });
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Process a batch of rows
   */
  private async processBatch(
    organizationId: string,
    rows: BulkImportRow[],
    startIndex: number,
    options: BulkImportOptions,
    importedBy: string,
  ): Promise<ImportRowResult[]> {
    const results: ImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = startIndex + i + 1; // 1-indexed for user display

      if (!row) continue;

      try {
        const result = await this.processRow(
          organizationId,
          row,
          rowNumber,
          options,
          importedBy,
        );
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          row: rowNumber,
          phone: row.phone,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Process a single import row
   */
  private async processRow(
    organizationId: string,
    row: BulkImportRow,
    rowNumber: number,
    options: BulkImportOptions,
    importedBy: string,
  ): Promise<ImportRowResult> {
    // Validate phone number
    if (!row.phone) {
      return {
        row: rowNumber,
        phone: '',
        status: 'error',
        error: 'Phone number is required',
      };
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneToE164(row.phone);
    } catch {
      return {
        row: rowNumber,
        phone: row.phone,
        status: 'error',
        error: 'Invalid phone number format',
      };
    }

    // Use transaction for atomic user + membership creation
    return this.dataSource.transaction(async (manager) => {
      // Check if user exists
      let user = await manager.findOne(User, {
        where: { phone: normalizedPhone },
      });

      if (!user) {
        // Create new user
        user = manager.create(User, {
          phone: normalizedPhone,
          fullName: row.fullName,
          nationalId: row.nationalId,
          kraPin: row.kraPin,
          email: row.email,
          status: UserStatus.PENDING,
          language: this.parseLanguage(row.language),
          termsAcceptedAt: new Date(),
          consentGivenAt: new Date(),
          failedLoginAttempts: 0,
          reminderOptOut: false,
        });

        user = await manager.save(User, user);

        this.logger.debug(`Created user: ${normalizedPhone.slice(-4)}`);
      }

      // Check if membership already exists
      const existingMembership = await manager.findOne(Membership, {
        where: { userId: user.id, organizationId },
      });

      if (existingMembership) {
        return {
          row: rowNumber,
          phone: normalizedPhone,
          status: 'existing' as const,
          userId: user.id,
          membershipId: existingMembership.id,
        };
      }

      // Create membership
      const membership = manager.create(Membership, {
        userId: user.id,
        organizationId,
        role: this.parseRole(row.role) ?? options.defaultRole ?? MemberRole.MEMBER,
        memberNumber: row.memberNumber,
        status: options.autoApprove ? MembershipStatus.ACTIVE : MembershipStatus.PENDING,
        joinedAt: options.autoApprove ? new Date() : undefined,
        approvedBy: options.autoApprove ? importedBy : undefined,
        approvedAt: options.autoApprove ? new Date() : undefined,
        isPrimary: false,
      });

      const savedMembership = await manager.save(Membership, membership);

      this.logger.debug(
        `Created membership: user=${user.id.slice(-8)} org=${organizationId.slice(-8)}`,
      );

      return {
        row: rowNumber,
        phone: normalizedPhone,
        status: 'created' as const,
        userId: user.id,
        membershipId: savedMembership.id,
      };
    });
  }

  /**
   * Parse language string to Language enum
   */
  private parseLanguage(lang?: string): Language {
    if (!lang) return Language.ENGLISH;

    const normalized = lang.toLowerCase().trim();
    if (normalized === 'sw' || normalized === 'swahili' || normalized === 'kiswahili') {
      return Language.SWAHILI;
    }
    return Language.ENGLISH;
  }

  /**
   * Parse role string to MemberRole enum
   */
  private parseRole(role?: string): MemberRole | undefined {
    if (!role) return undefined;

    const normalized = role.toUpperCase().trim();
    if (Object.values(MemberRole).includes(normalized as MemberRole)) {
      return normalized as MemberRole;
    }
    return undefined;
  }

  /**
   * Get CSV template for bulk import
   */
  getCsvTemplate(): string {
    return [
      'phone,member_number,full_name,national_id,kra_pin,email,language,role',
      '+254712345678,KBA001,John Doe,12345678,A012345678B,john@example.com,en,MEMBER',
      '0723456789,KBA002,Jane Doe,23456789,,jane@example.com,sw,',
    ].join('\n');
  }

  /**
   * Validate CSV content without importing
   */
  async validateCsv(
    csvContent: string,
    skipFirstRow = true,
  ): Promise<{
    valid: boolean;
    totalRows: number;
    validRows: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const rows = this.parseCsv(csvContent, skipFirstRow);
    const errors: Array<{ row: number; error: string }> = [];
    let validRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + (skipFirstRow ? 2 : 1);

      if (!row || !row.phone) {
        errors.push({ row: rowNumber, error: 'Phone number is required' });
        continue;
      }

      try {
        normalizePhoneToE164(row.phone);
        validRows++;
      } catch {
        errors.push({ row: rowNumber, error: 'Invalid phone number format' });
      }
    }

    return {
      valid: errors.length === 0,
      totalRows: rows.length,
      validRows,
      errors,
    };
  }

  /**
   * Get import history for an organization
   */
  async getImportStats(organizationId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    pendingMembers: number;
  }> {
    const [total, active, pending] = await Promise.all([
      this.membershipRepository.count({ where: { organizationId } }),
      this.membershipRepository.count({
        where: { organizationId, status: MembershipStatus.ACTIVE },
      }),
      this.membershipRepository.count({
        where: { organizationId, status: MembershipStatus.PENDING },
      }),
    ]);

    return {
      totalMembers: total,
      activeMembers: active,
      pendingMembers: pending,
    };
  }
}
