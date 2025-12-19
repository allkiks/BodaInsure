import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DataSource } from 'typeorm';
import {
  ReportDefinition,
  ReportType,
  ReportFormat,
  ReportFrequency,
} from '../entities/report-definition.entity.js';
import {
  GeneratedReport,
  ReportStatus,
} from '../entities/generated-report.entity.js';

/**
 * Create report definition request
 */
export interface CreateReportDefinitionRequest {
  name: string;
  type: ReportType;
  description?: string;
  defaultFormat?: ReportFormat;
  availableFormats?: ReportFormat[];
  frequency?: ReportFrequency;
  config?: ReportDefinition['config'];
  requiredRoles?: string[];
  organizationId?: string;
}

/**
 * Generate report request
 */
export interface GenerateReportRequest {
  reportDefinitionId: string;
  format?: ReportFormat;
  parameters?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
}

/**
 * Report data result
 */
export interface ReportData {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Report Service
 * Manages report definitions and generation
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(ReportDefinition)
    private readonly definitionRepository: Repository<ReportDefinition>,
    @InjectRepository(GeneratedReport)
    private readonly reportRepository: Repository<GeneratedReport>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a report definition
   */
  async createDefinition(
    request: CreateReportDefinitionRequest,
    createdBy: string,
  ): Promise<ReportDefinition> {
    const definition = this.definitionRepository.create({
      ...request,
      createdBy,
      availableFormats: request.availableFormats ?? [ReportFormat.JSON, ReportFormat.CSV],
    });

    await this.definitionRepository.save(definition);

    this.logger.log(`Created report definition: ${definition.name}`);

    return definition;
  }

  /**
   * Get report definition by ID
   */
  async getDefinitionById(id: string): Promise<ReportDefinition> {
    const definition = await this.definitionRepository.findOne({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException(`Report definition not found: ${id}`);
    }

    return definition;
  }

  /**
   * List report definitions
   */
  async listDefinitions(options?: {
    type?: ReportType;
    organizationId?: string;
    includeInactive?: boolean;
  }): Promise<ReportDefinition[]> {
    const { type, organizationId, includeInactive = false } = options ?? {};

    const query = this.definitionRepository.createQueryBuilder('d');

    if (!includeInactive) {
      query.where('d.is_active = true');
    }

    if (type) {
      query.andWhere('d.type = :type', { type });
    }

    if (organizationId) {
      query.andWhere('(d.organization_id = :orgId OR d.organization_id IS NULL)', {
        orgId: organizationId,
      });
    } else {
      query.andWhere('d.organization_id IS NULL');
    }

    return query.orderBy('d.name', 'ASC').getMany();
  }

  /**
   * Update report definition
   */
  async updateDefinition(
    id: string,
    updates: Partial<CreateReportDefinitionRequest>,
  ): Promise<ReportDefinition> {
    const definition = await this.getDefinitionById(id);

    Object.assign(definition, updates);
    await this.definitionRepository.save(definition);

    return definition;
  }

  /**
   * Delete report definition
   */
  async deleteDefinition(id: string): Promise<void> {
    const definition = await this.getDefinitionById(id);
    definition.isActive = false;
    await this.definitionRepository.save(definition);
  }

  /**
   * Generate a report
   */
  async generateReport(
    request: GenerateReportRequest,
    userId: string,
  ): Promise<GeneratedReport> {
    const definition = await this.getDefinitionById(request.reportDefinitionId);

    const format = request.format ?? definition.defaultFormat;

    if (!definition.availableFormats.includes(format)) {
      throw new BadRequestException(
        `Format ${format} is not available for this report. Available: ${definition.availableFormats.join(', ')}`,
      );
    }

    // Create report record
    const report = this.reportRepository.create({
      reportDefinitionId: definition.id,
      name: definition.name,
      format,
      status: ReportStatus.PENDING,
      parameters: request.parameters,
      startDate: request.startDate,
      endDate: request.endDate,
      organizationId: request.organizationId,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.reportRepository.save(report);

    // Process report asynchronously
    this.processReport(report.id, definition).catch((error) => {
      this.logger.error(`Failed to process report ${report.id}: ${error.message}`);
    });

    return report;
  }

  /**
   * Process a report (internal)
   */
  private async processReport(
    reportId: string,
    definition: ReportDefinition,
  ): Promise<void> {
    const startTime = Date.now();
    const report = await this.reportRepository.findOne({ where: { id: reportId } });

    if (!report) {
      return;
    }

    try {
      report.status = ReportStatus.PROCESSING;
      await this.reportRepository.save(report);

      // Generate report data based on type
      const data = await this.generateReportData(definition, report);

      report.status = ReportStatus.COMPLETED;
      report.data = data as unknown as Record<string, unknown>;
      report.recordCount = data.rows?.length ?? 0;
      report.processingTimeMs = Date.now() - startTime;
      report.completedAt = new Date();

      await this.reportRepository.save(report);

      this.logger.log(`Completed report ${reportId} in ${report.processingTimeMs}ms`);
    } catch (error) {
      report.status = ReportStatus.FAILED;
      report.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      report.processingTimeMs = Date.now() - startTime;

      await this.reportRepository.save(report);

      this.logger.error(`Report ${reportId} failed: ${report.errorMessage}`);
    }
  }

  /**
   * Generate report data based on type
   */
  private async generateReportData(
    definition: ReportDefinition,
    report: GeneratedReport,
  ): Promise<ReportData> {
    switch (definition.type) {
      case ReportType.ENROLLMENT:
        return this.generateEnrollmentReport(report);
      case ReportType.PAYMENT:
        return this.generatePaymentReport(report);
      case ReportType.POLICY:
        return this.generatePolicyReport(report);
      case ReportType.ORGANIZATION:
        return this.generateOrganizationReport(report);
      case ReportType.FINANCIAL:
        return this.generateFinancialReport(report);
      default:
        throw new BadRequestException(`Unsupported report type: ${definition.type}`);
    }
  }

  /**
   * Generate enrollment report
   */
  private async generateEnrollmentReport(report: GeneratedReport): Promise<ReportData> {
    let query = `
      SELECT
        u.id,
        u.phone,
        u.full_name as "fullName",
        u.national_id_last_four as "nationalIdLast4",
        u.kyc_status as "kycStatus",
        u.county_code as "countyCode",
        u.is_active as "isActive",
        u.created_at as "createdAt"
      FROM users u
      WHERE u.deleted_at IS NULL
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (report.startDate) {
      query += ` AND u.created_at >= $${paramIndex++}`;
      params.push(report.startDate);
    }

    if (report.endDate) {
      query += ` AND u.created_at <= $${paramIndex++}`;
      params.push(report.endDate);
    }

    if (report.organizationId) {
      query += ` AND u.id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(report.organizationId);
    }

    query += ' ORDER BY u.created_at DESC';

    const rows = await this.dataSource.query(query, params);

    return {
      columns: ['id', 'phone', 'fullName', 'nationalIdLast4', 'kycStatus', 'countyCode', 'isActive', 'createdAt'],
      rows,
      totalCount: rows.length,
    };
  }

  /**
   * Generate payment report
   */
  private async generatePaymentReport(report: GeneratedReport): Promise<ReportData> {
    let query = `
      SELECT
        t.id,
        t.user_id as "userId",
        t.type,
        t.amount,
        t.status,
        t.mpesa_receipt as "mpesaReceipt",
        t.created_at as "createdAt",
        t.completed_at as "completedAt"
      FROM transactions t
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (report.startDate) {
      query += ` AND t.created_at >= $${paramIndex++}`;
      params.push(report.startDate);
    }

    if (report.endDate) {
      query += ` AND t.created_at <= $${paramIndex++}`;
      params.push(report.endDate);
    }

    if (report.organizationId) {
      query += ` AND t.user_id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(report.organizationId);
    }

    query += ' ORDER BY t.created_at DESC';

    const rows = await this.dataSource.query(query, params);

    return {
      columns: ['id', 'userId', 'type', 'amount', 'status', 'mpesaReceipt', 'createdAt', 'completedAt'],
      rows,
      totalCount: rows.length,
      metadata: {
        totalAmount: rows.reduce((sum: number, r: { amount: number }) => sum + (r.amount || 0), 0),
      },
    };
  }

  /**
   * Generate policy report
   */
  private async generatePolicyReport(report: GeneratedReport): Promise<ReportData> {
    let query = `
      SELECT
        p.id,
        p.policy_number as "policyNumber",
        p.user_id as "userId",
        p.type,
        p.status,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.vehicle_registration as "vehicleRegistration",
        p.created_at as "createdAt"
      FROM policies p
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (report.startDate) {
      query += ` AND p.created_at >= $${paramIndex++}`;
      params.push(report.startDate);
    }

    if (report.endDate) {
      query += ` AND p.created_at <= $${paramIndex++}`;
      params.push(report.endDate);
    }

    if (report.organizationId) {
      query += ` AND p.user_id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(report.organizationId);
    }

    query += ' ORDER BY p.created_at DESC';

    const rows = await this.dataSource.query(query, params);

    return {
      columns: ['id', 'policyNumber', 'userId', 'type', 'status', 'startDate', 'endDate', 'vehicleRegistration', 'createdAt'],
      rows,
      totalCount: rows.length,
    };
  }

  /**
   * Generate organization report
   */
  private async generateOrganizationReport(report: GeneratedReport): Promise<ReportData> {
    let query = `
      SELECT
        o.id,
        o.code,
        o.name,
        o.type,
        o.status,
        o.county_code as "countyCode",
        o.verified_members as "verifiedMembers",
        o.created_at as "createdAt"
      FROM organizations o
      WHERE o.deleted_at IS NULL
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (report.startDate) {
      query += ` AND o.created_at >= $${paramIndex++}`;
      params.push(report.startDate);
    }

    if (report.endDate) {
      query += ` AND o.created_at <= $${paramIndex++}`;
      params.push(report.endDate);
    }

    if (report.organizationId) {
      query += ` AND (o.id = $${paramIndex++} OR o.parent_id = $${paramIndex - 1})`;
      params.push(report.organizationId);
    }

    query += ' ORDER BY o.name ASC';

    const rows = await this.dataSource.query(query, params);

    return {
      columns: ['id', 'code', 'name', 'type', 'status', 'countyCode', 'verifiedMembers', 'createdAt'],
      rows,
      totalCount: rows.length,
    };
  }

  /**
   * Generate financial report
   */
  private async generateFinancialReport(report: GeneratedReport): Promise<ReportData> {
    let query = `
      SELECT
        DATE(t.created_at) as date,
        COUNT(*) as "transactionCount",
        SUM(t.amount) as "totalAmount",
        SUM(t.amount) FILTER (WHERE t.type = 'DEPOSIT') as "depositAmount",
        SUM(t.amount) FILTER (WHERE t.type = 'DAILY_PAYMENT') as "dailyPaymentAmount",
        COUNT(*) FILTER (WHERE t.status = 'COMPLETED') as "completedCount",
        COUNT(*) FILTER (WHERE t.status = 'FAILED') as "failedCount"
      FROM transactions t
      WHERE t.status = 'COMPLETED'
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (report.startDate) {
      query += ` AND t.created_at >= $${paramIndex++}`;
      params.push(report.startDate);
    }

    if (report.endDate) {
      query += ` AND t.created_at <= $${paramIndex++}`;
      params.push(report.endDate);
    }

    if (report.organizationId) {
      query += ` AND t.user_id IN (SELECT user_id FROM memberships WHERE organization_id = $${paramIndex++})`;
      params.push(report.organizationId);
    }

    query += ' GROUP BY DATE(t.created_at) ORDER BY date DESC';

    const rows = await this.dataSource.query(query, params);

    return {
      columns: ['date', 'transactionCount', 'totalAmount', 'depositAmount', 'dailyPaymentAmount', 'completedCount', 'failedCount'],
      rows,
      totalCount: rows.length,
      metadata: {
        grandTotal: rows.reduce((sum: number, r: { totalAmount: string }) => sum + parseFloat(r.totalAmount || '0'), 0),
      },
    };
  }

  /**
   * Get generated report by ID
   */
  async getReportById(id: string): Promise<GeneratedReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reportDefinition'],
    });

    if (!report) {
      throw new NotFoundException(`Report not found: ${id}`);
    }

    return report;
  }

  /**
   * List generated reports for a user
   */
  async listUserReports(
    userId: string,
    options?: {
      status?: ReportStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ reports: GeneratedReport[]; total: number }> {
    const { status, page = 1, limit = 20 } = options ?? {};

    const whereCondition: Record<string, unknown> = { userId };
    if (status) {
      whereCondition.status = status;
    }

    const [reports, total] = await this.reportRepository.findAndCount({
      where: whereCondition,
      relations: ['reportDefinition'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { reports, total };
  }

  /**
   * Clean up expired reports
   */
  async cleanupExpiredReports(): Promise<number> {
    const result = await this.reportRepository.update(
      {
        status: ReportStatus.COMPLETED,
        expiresAt: LessThan(new Date()),
      },
      {
        status: ReportStatus.EXPIRED,
        data: undefined,
        fileUrl: undefined,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} reports`);
    }

    return result.affected ?? 0;
  }

  /**
   * Seed default report definitions
   */
  async seedDefaultDefinitions(): Promise<number> {
    const defaults: CreateReportDefinitionRequest[] = [
      {
        name: 'Enrollment Summary',
        type: ReportType.ENROLLMENT,
        description: 'User enrollment and KYC status report',
        defaultFormat: ReportFormat.CSV,
        availableFormats: [ReportFormat.JSON, ReportFormat.CSV, ReportFormat.EXCEL],
      },
      {
        name: 'Payment Transactions',
        type: ReportType.PAYMENT,
        description: 'All payment transactions with M-Pesa details',
        defaultFormat: ReportFormat.CSV,
        availableFormats: [ReportFormat.JSON, ReportFormat.CSV, ReportFormat.EXCEL],
      },
      {
        name: 'Policy Status',
        type: ReportType.POLICY,
        description: 'Policy issuance and status report',
        defaultFormat: ReportFormat.CSV,
        availableFormats: [ReportFormat.JSON, ReportFormat.CSV, ReportFormat.EXCEL],
      },
      {
        name: 'Organization Summary',
        type: ReportType.ORGANIZATION,
        description: 'Organization membership and structure report',
        defaultFormat: ReportFormat.CSV,
        availableFormats: [ReportFormat.JSON, ReportFormat.CSV],
      },
      {
        name: 'Daily Financial Summary',
        type: ReportType.FINANCIAL,
        description: 'Daily transaction totals and breakdown',
        defaultFormat: ReportFormat.EXCEL,
        availableFormats: [ReportFormat.JSON, ReportFormat.CSV, ReportFormat.EXCEL],
        frequency: ReportFrequency.DAILY,
      },
    ];

    let created = 0;

    for (const def of defaults) {
      const existing = await this.definitionRepository.findOne({
        where: { name: def.name, organizationId: undefined as any },
      });

      if (!existing) {
        await this.definitionRepository.save(
          this.definitionRepository.create(def),
        );
        created++;
      }
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} default report definitions`);
    }

    return created;
  }
}
