import { Injectable } from '@nestjs/common';
import { ReportFormat } from '../entities/report-definition.entity.js';

/**
 * Export options
 */
export interface ExportOptions {
  filename: string;
  format: ReportFormat;
  columns?: string[];
  columnLabels?: Record<string, string>;
  title?: string;
  includeTimestamp?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  data: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Export Service
 * Handles data export in various formats (CSV, Excel, PDF)
 */
@Injectable()
export class ExportService {
  /**
   * Export data to specified format
   */
  async export(
    rows: Record<string, unknown>[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    switch (options.format) {
      case ReportFormat.CSV:
        return this.exportToCsv(rows, options);
      case ReportFormat.JSON:
        return this.exportToJson(rows, options);
      case ReportFormat.EXCEL:
        return this.exportToExcel(rows, options);
      case ReportFormat.PDF:
        // PDF not yet implemented - fall back to Excel with a different extension
        // In production, use a library like pdfmake or puppeteer
        const excelResult = await this.exportToExcel(rows, options);
        return {
          ...excelResult,
          filename: excelResult.filename.replace('.xlsx', '.xlsx'), // Keep as xlsx for now
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to CSV
   */
  private async exportToCsv(
    rows: Record<string, unknown>[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    if (rows.length === 0) {
      const data = Buffer.from('');
      return {
        data,
        filename: `${options.filename}.csv`,
        mimeType: 'text/csv',
        size: data.length,
      };
    }

    const firstRow = rows[0];
    const columns = options.columns ?? (firstRow ? Object.keys(firstRow) : []);
    const labels = options.columnLabels ?? {};

    // Header row
    const header = columns.map((col) => this.escapeCsvValue(labels[col] ?? col)).join(',');

    // Data rows
    const dataRows = rows.map((row) =>
      columns.map((col) => this.escapeCsvValue(this.formatValue(row[col]))).join(','),
    );

    const csv = [header, ...dataRows].join('\n');
    const data = Buffer.from(csv, 'utf-8');

    return {
      data,
      filename: `${options.filename}.csv`,
      mimeType: 'text/csv',
      size: data.length,
    };
  }

  /**
   * Export to JSON
   */
  private async exportToJson(
    rows: Record<string, unknown>[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    const output = {
      title: options.title,
      generatedAt: new Date().toISOString(),
      recordCount: rows.length,
      data: rows,
    };

    const json = JSON.stringify(output, null, 2);
    const data = Buffer.from(json, 'utf-8');

    return {
      data,
      filename: `${options.filename}.json`,
      mimeType: 'application/json',
      size: data.length,
    };
  }

  /**
   * Export to Excel (simplified XLSX-like format using CSV for now)
   * In production, would use a library like exceljs
   */
  private async exportToExcel(
    rows: Record<string, unknown>[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    // For MVP, we generate tab-separated values that Excel can open
    // In production, use exceljs or similar library
    if (rows.length === 0) {
      const data = Buffer.from('');
      return {
        data,
        filename: `${options.filename}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: data.length,
      };
    }

    const firstRow = rows[0];
    const columns = options.columns ?? (firstRow ? Object.keys(firstRow) : []);
    const labels = options.columnLabels ?? {};

    // Header row
    const header = columns.map((col) => labels[col] ?? col).join('\t');

    // Data rows
    const dataRows = rows.map((row) =>
      columns.map((col) => this.formatValue(row[col])).join('\t'),
    );

    const tsv = [header, ...dataRows].join('\n');
    const data = Buffer.from(tsv, 'utf-8');

    // Note: In production, this should be proper XLSX format
    return {
      data,
      filename: `${options.filename}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: data.length,
    };
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format value for export
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV:
        return 'text/csv';
      case ReportFormat.JSON:
        return 'application/json';
      case ReportFormat.EXCEL:
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ReportFormat.PDF:
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get file extension for format
   */
  getFileExtension(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV:
        return 'csv';
      case ReportFormat.JSON:
        return 'json';
      case ReportFormat.EXCEL:
        return 'xlsx';
      case ReportFormat.PDF:
        return 'pdf';
      default:
        return 'dat';
    }
  }

  /**
   * Export data to buffer
   * Convenience method for scheduled reports
   */
  async exportToBuffer(
    data: { columns?: string[]; rows: Record<string, unknown>[] },
    format: ReportFormat | string,
    filename: string,
  ): Promise<Buffer> {
    const reportFormat = typeof format === 'string'
      ? (ReportFormat[format.toUpperCase() as keyof typeof ReportFormat] ?? ReportFormat.JSON)
      : format;

    const result = await this.export(data.rows, {
      filename,
      format: reportFormat,
      columns: data.columns,
    });

    return result.data;
  }
}
