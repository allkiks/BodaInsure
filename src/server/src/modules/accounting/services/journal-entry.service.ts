import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Between } from 'typeorm';
import {
  JournalEntry,
  JournalEntryType,
  JournalEntryStatus,
} from '../entities/journal-entry.entity.js';
import { JournalEntryLine } from '../entities/journal-entry-line.entity.js';
import { GlAccountService } from './gl-account.service.js';

/**
 * Input for journal entry line
 */
export interface JournalEntryLineInput {
  accountCode: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

/**
 * Input for creating a journal entry
 */
export interface CreateJournalEntryInput {
  entryType: JournalEntryType;
  entryDate: Date;
  description: string;
  lines: JournalEntryLineInput[];
  sourceTransactionId?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  riderId?: string;
  createdBy?: string;
  autoPost?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Journal Entry Service
 * Manages journal entries for double-entry bookkeeping
 *
 * Per Accounting_Remediation.md - Epic 2
 */
@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    private readonly glAccountService: GlAccountService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create and optionally post a journal entry
   */
  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    // Validate debits = credits
    const totalDebit = input.lines.reduce(
      (sum, l) => sum + (l.debitAmount || 0),
      0,
    );
    const totalCredit = input.lines.reduce(
      (sum, l) => sum + (l.creditAmount || 0),
      0,
    );

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Journal entry not balanced: debits=${totalDebit} credits=${totalCredit}`,
      );
    }

    if (totalDebit === 0) {
      throw new BadRequestException('Journal entry must have non-zero amounts');
    }

    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalEntryLine);

      // Generate entry number
      const entryNumber = await this.generateEntryNumber(input.entryDate, manager);

      // Create entry
      const entry = entryRepo.create({
        entryNumber,
        entryDate: input.entryDate,
        entryType: input.entryType,
        description: input.description,
        status: JournalEntryStatus.DRAFT,
        totalDebit,
        totalCredit,
        sourceTransactionId: input.sourceTransactionId,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        riderId: input.riderId,
        createdBy: input.createdBy,
        metadata: input.metadata,
      });

      const savedEntry = await entryRepo.save(entry);

      // Create lines
      let lineNumber = 1;
      for (const lineInput of input.lines) {
        const account = await this.glAccountService.getByCode(lineInput.accountCode);

        const line = lineRepo.create({
          journalEntryId: savedEntry.id,
          glAccountId: account.id,
          lineNumber,
          debitAmount: lineInput.debitAmount || 0,
          creditAmount: lineInput.creditAmount || 0,
          description: lineInput.description,
        });

        await lineRepo.save(line);
        lineNumber++;
      }

      this.logger.log(`Created journal entry ${entryNumber} (${input.entryType})`);

      // Auto-post if requested
      if (input.autoPost) {
        return this.postEntryWithManager(savedEntry.id, manager);
      }

      return savedEntry;
    });
  }

  /**
   * Post a journal entry (update GL balances)
   */
  async postEntry(entryId: string): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      return this.postEntryWithManager(entryId, manager);
    });
  }

  /**
   * Post entry within an existing transaction
   */
  private async postEntryWithManager(
    entryId: string,
    manager: EntityManager,
  ): Promise<JournalEntry> {
    const entryRepo = manager.getRepository(JournalEntry);
    const lineRepo = manager.getRepository(JournalEntryLine);

    const entry = await entryRepo.findOne({
      where: { id: entryId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status === JournalEntryStatus.POSTED) {
      throw new BadRequestException('Entry already posted');
    }

    if (entry.status === JournalEntryStatus.REVERSED) {
      throw new BadRequestException('Cannot post reversed entry');
    }

    // Get lines
    const lines = await lineRepo.find({
      where: { journalEntryId: entryId },
    });

    // Update GL account balances
    for (const line of lines) {
      await this.glAccountService.updateBalance(
        line.glAccountId,
        Number(line.debitAmount),
        Number(line.creditAmount),
      );
    }

    // Mark as posted
    entry.status = JournalEntryStatus.POSTED;
    entry.postedAt = new Date();

    await entryRepo.save(entry);

    this.logger.log(`Posted journal entry ${entry.entryNumber}`);

    return entry;
  }

  /**
   * Reverse a posted journal entry
   */
  async reverseEntry(
    entryId: string,
    reason: string,
    reversedBy: string,
  ): Promise<JournalEntry> {
    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalEntryLine);

      const original = await entryRepo.findOne({
        where: { id: entryId },
        relations: ['lines'],
      });

      if (!original) {
        throw new NotFoundException('Journal entry not found');
      }

      if (original.status !== JournalEntryStatus.POSTED) {
        throw new BadRequestException('Can only reverse posted entries');
      }

      if (original.reversingEntryId) {
        throw new BadRequestException('Entry has already been reversed');
      }

      // Create reversing entry
      const reversingNumber = await this.generateEntryNumber(new Date(), manager);
      const reversing = entryRepo.create({
        entryNumber: reversingNumber,
        entryDate: new Date(),
        entryType: original.entryType,
        description: `REVERSAL: ${original.description}`,
        status: JournalEntryStatus.DRAFT,
        totalDebit: original.totalCredit, // Swap
        totalCredit: original.totalDebit,
        originalEntryId: original.id,
        createdBy: reversedBy,
        riderId: original.riderId,
        metadata: { reversalReason: reason, originalEntryNumber: original.entryNumber },
      });

      const savedReversing = await entryRepo.save(reversing);

      // Create reversed lines (swap debits/credits)
      const lines = await lineRepo.find({
        where: { journalEntryId: original.id },
      });
      for (const line of lines) {
        await lineRepo.save({
          journalEntryId: savedReversing.id,
          glAccountId: line.glAccountId,
          lineNumber: line.lineNumber,
          debitAmount: line.creditAmount, // Swap
          creditAmount: line.debitAmount,
          description: `REVERSAL: ${line.description || ''}`,
        });
      }

      // Post the reversal
      await this.postEntryWithManager(savedReversing.id, manager);

      // Mark original as reversed
      original.status = JournalEntryStatus.REVERSED;
      original.reversedBy = reversedBy;
      original.reversedAt = new Date();
      original.reversalReason = reason;
      original.reversingEntryId = savedReversing.id;

      await entryRepo.save(original);

      this.logger.log(
        `Reversed journal entry ${original.entryNumber} → ${reversingNumber}`,
      );

      return savedReversing;
    });
  }

  /**
   * Generate unique entry number
   */
  private async generateEntryNumber(
    date: Date,
    manager?: EntityManager,
  ): Promise<string> {
    const repo = manager
      ? manager.getRepository(JournalEntry)
      : this.journalEntryRepository;

    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count for today using raw SQL for accuracy with locks
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await repo.count({
      where: {
        entryDate: Between(startOfDay, endOfDay),
      },
    });

    return `JE-${dateStr}-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Get entry by ID
   */
  async getById(id: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id },
      relations: ['lines', 'lines.glAccount'],
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    return entry;
  }

  /**
   * Get entry by entry number
   */
  async getByEntryNumber(entryNumber: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { entryNumber },
      relations: ['lines', 'lines.glAccount'],
    });
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    return entry;
  }

  /**
   * Get entries by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    return this.journalEntryRepository
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.glAccount', 'glAccount')
      .where('je.entry_date >= :startDate', { startDate })
      .andWhere('je.entry_date <= :endDate', { endDate })
      .orderBy('je.entry_date', 'ASC')
      .addOrderBy('je.entry_number', 'ASC')
      .getMany();
  }

  /**
   * Get entries by rider ID
   */
  async getByRiderId(riderId: string): Promise<JournalEntry[]> {
    return this.journalEntryRepository.find({
      where: { riderId },
      relations: ['lines', 'lines.glAccount'],
      order: { entryDate: 'DESC', entryNumber: 'DESC' },
    });
  }

  /**
   * Get entries by type
   */
  async getByType(entryType: JournalEntryType): Promise<JournalEntry[]> {
    return this.journalEntryRepository.find({
      where: { entryType },
      relations: ['lines', 'lines.glAccount'],
      order: { entryDate: 'DESC', entryNumber: 'DESC' },
    });
  }

  /**
   * Get entries by source transaction ID
   */
  async getBySourceTransactionId(
    sourceTransactionId: string,
  ): Promise<JournalEntry[]> {
    return this.journalEntryRepository.find({
      where: { sourceTransactionId },
      relations: ['lines', 'lines.glAccount'],
      order: { entryDate: 'ASC', entryNumber: 'ASC' },
    });
  }
}
