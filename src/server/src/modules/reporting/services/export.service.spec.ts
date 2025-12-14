import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service.js';
import { ReportFormat } from '../entities/report-definition.entity.js';

describe('ExportService', () => {
  let service: ExportService;

  const mockRows = [
    { id: '1', name: 'John Doe', amount: 100 },
    { id: '2', name: 'Jane Smith', amount: 200 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportService],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  describe('export', () => {
    it('should export to CSV', async () => {
      const result = await service.export(mockRows, {
        filename: 'test',
        format: ReportFormat.CSV,
      });

      expect(result.filename).toBe('test.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.size).toBeGreaterThan(0);

      const content = result.data.toString('utf-8');
      expect(content).toContain('id,name,amount');
      expect(content).toContain('1,John Doe,100');
      expect(content).toContain('2,Jane Smith,200');
    });

    it('should export to JSON', async () => {
      const result = await service.export(mockRows, {
        filename: 'test',
        format: ReportFormat.JSON,
        title: 'Test Report',
      });

      expect(result.filename).toBe('test.json');
      expect(result.mimeType).toBe('application/json');

      const content = JSON.parse(result.data.toString('utf-8'));
      expect(content.title).toBe('Test Report');
      expect(content.recordCount).toBe(2);
      expect(content.data).toHaveLength(2);
    });

    it('should export to Excel (TSV)', async () => {
      const result = await service.export(mockRows, {
        filename: 'test',
        format: ReportFormat.EXCEL,
      });

      expect(result.filename).toBe('test.xlsx');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const content = result.data.toString('utf-8');
      expect(content).toContain('id\tname\tamount');
    });

    it('should handle empty rows', async () => {
      const result = await service.export([], {
        filename: 'empty',
        format: ReportFormat.CSV,
      });

      expect(result.size).toBe(0);
    });

    it('should use custom columns', async () => {
      const result = await service.export(mockRows, {
        filename: 'test',
        format: ReportFormat.CSV,
        columns: ['name', 'amount'],
      });

      const content = result.data.toString('utf-8');
      expect(content).toContain('name,amount');
      expect(content).not.toContain('id,');
    });

    it('should use custom column labels', async () => {
      const result = await service.export(mockRows, {
        filename: 'test',
        format: ReportFormat.CSV,
        columnLabels: { name: 'Full Name', amount: 'Total Amount' },
      });

      const content = result.data.toString('utf-8');
      expect(content).toContain('Full Name');
      expect(content).toContain('Total Amount');
    });

    it('should escape CSV values with commas', async () => {
      const rowsWithCommas = [
        { id: '1', name: 'Doe, John', amount: 100 },
      ];

      const result = await service.export(rowsWithCommas, {
        filename: 'test',
        format: ReportFormat.CSV,
      });

      const content = result.data.toString('utf-8');
      expect(content).toContain('"Doe, John"');
    });

    it('should escape CSV values with quotes', async () => {
      const rowsWithQuotes = [
        { id: '1', name: 'John "The Man" Doe', amount: 100 },
      ];

      const result = await service.export(rowsWithQuotes, {
        filename: 'test',
        format: ReportFormat.CSV,
      });

      const content = result.data.toString('utf-8');
      expect(content).toContain('"John ""The Man"" Doe"');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for CSV', () => {
      expect(service.getMimeType(ReportFormat.CSV)).toBe('text/csv');
    });

    it('should return correct MIME type for JSON', () => {
      expect(service.getMimeType(ReportFormat.JSON)).toBe('application/json');
    });

    it('should return correct MIME type for Excel', () => {
      expect(service.getMimeType(ReportFormat.EXCEL)).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('should return correct MIME type for PDF', () => {
      expect(service.getMimeType(ReportFormat.PDF)).toBe('application/pdf');
    });
  });

  describe('getFileExtension', () => {
    it('should return csv for CSV format', () => {
      expect(service.getFileExtension(ReportFormat.CSV)).toBe('csv');
    });

    it('should return json for JSON format', () => {
      expect(service.getFileExtension(ReportFormat.JSON)).toBe('json');
    });

    it('should return xlsx for Excel format', () => {
      expect(service.getFileExtension(ReportFormat.EXCEL)).toBe('xlsx');
    });

    it('should return pdf for PDF format', () => {
      expect(service.getFileExtension(ReportFormat.PDF)).toBe('pdf');
    });
  });
});
