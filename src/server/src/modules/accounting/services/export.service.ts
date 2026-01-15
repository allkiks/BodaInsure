import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { GlAccountService } from './gl-account.service.js';
import { JournalEntryService } from './journal-entry.service.js';
import { SettlementService } from './settlement.service.js';
import { FinancialReportingService } from './financial-reporting.service.js';
import { PartnerType } from '../entities/partner-settlement.entity.js';

/**
 * Export Service
 *
 * Generates CSV and Excel exports for accounting data.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly glAccountService: GlAccountService,
    private readonly journalEntryService: JournalEntryService,
    private readonly settlementService: SettlementService,
    private readonly reportingService: FinancialReportingService,
  ) {}

  // ===========================
  // CSV Export Methods
  // ===========================

  /**
   * Export Chart of Accounts to CSV
   */
  async exportChartOfAccountsCsv(): Promise<string> {
    const accounts = await this.glAccountService.getChartOfAccounts();

    const headers = ['Account Code', 'Account Name', 'Account Type', 'Normal Balance', 'Status', 'Balance (KES)', 'Description'];
    const rows = accounts.map(account => [
      account.accountCode,
      account.accountName,
      account.accountType,
      account.normalBalance,
      account.status,
      (Number(account.balance) / 100).toFixed(2),
      account.description || '',
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Export Trial Balance to CSV
   */
  async exportTrialBalanceCsv(): Promise<string> {
    const trialBalance = await this.glAccountService.getTrialBalance();

    const headers = ['Account Code', 'Account Name', 'Debit (KES)', 'Credit (KES)'];
    const rows = trialBalance.accounts.map(account => [
      account.accountCode,
      account.accountName,
      (Number(account.debitBalance) / 100).toFixed(2),
      (Number(account.creditBalance) / 100).toFixed(2),
    ]);

    // Add totals row
    rows.push([
      '',
      'TOTALS',
      (Number(trialBalance.totalDebits) / 100).toFixed(2),
      (Number(trialBalance.totalCredits) / 100).toFixed(2),
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Export Journal Entries to CSV
   */
  async exportJournalEntriesCsv(startDate: Date, endDate: Date): Promise<string> {
    const entries = await this.journalEntryService.getByDateRange(startDate, endDate);

    const headers = ['Entry Number', 'Date', 'Type', 'Status', 'Description', 'Total Debit (KES)', 'Rider ID', 'Source Transaction'];
    const rows: string[][] = entries.map(entry => [
      entry.entryNumber,
      entry.entryDate.toISOString().split('T')[0] ?? '',
      entry.entryType,
      entry.status,
      entry.description,
      (Number(entry.totalDebit) / 100).toFixed(2),
      entry.riderId ?? '',
      entry.sourceTransactionId ?? '',
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Export Settlements to CSV
   */
  async exportSettlementsCsv(partnerType?: PartnerType): Promise<string> {
    let settlements;
    if (partnerType) {
      settlements = await this.settlementService.getByPartner(partnerType);
    } else {
      const pending = await this.settlementService.getPendingSettlements();
      const approved = await this.settlementService.getApprovedSettlements();
      settlements = [...pending, ...approved];
    }

    const headers = ['Settlement Number', 'Partner', 'Type', 'Status', 'Amount (KES)', 'Period Start', 'Period End', 'Bank Reference', 'Created At'];
    const rows: string[][] = settlements.map(s => [
      s.settlementNumber,
      s.partnerType,
      s.settlementType,
      s.status,
      (Number(s.totalAmount) / 100).toFixed(2),
      s.periodStart.toISOString().split('T')[0] ?? '',
      s.periodEnd.toISOString().split('T')[0] ?? '',
      s.bankReference ?? '',
      s.createdAt.toISOString(),
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Export Balance Sheet to CSV
   */
  async exportBalanceSheetCsv(asOfDate?: Date): Promise<string> {
    const report = await this.reportingService.generateBalanceSheet(asOfDate || new Date());

    const rows: string[][] = [];

    // Assets
    rows.push(['ASSETS', '', '']);
    for (const account of report.assets.accounts) {
      rows.push(['', account.accountName, (account.balance / 100).toFixed(2)]);
    }
    rows.push(['', 'Total Assets', (report.assets.total / 100).toFixed(2)]);
    rows.push(['', '', '']);

    // Liabilities
    rows.push(['LIABILITIES', '', '']);
    for (const account of report.liabilities.accounts) {
      rows.push(['', account.accountName, (account.balance / 100).toFixed(2)]);
    }
    rows.push(['', 'Total Liabilities', (report.liabilities.total / 100).toFixed(2)]);
    rows.push(['', '', '']);

    // Equity
    rows.push(['EQUITY', '', '']);
    rows.push(['', 'Retained Earnings', (report.equity.retainedEarnings / 100).toFixed(2)]);
    rows.push(['', 'Total Equity', (report.equity.total / 100).toFixed(2)]);
    rows.push(['', '', '']);
    rows.push(['TOTAL LIABILITIES + EQUITY', '', (report.totalLiabilitiesAndEquity / 100).toFixed(2)]);

    const headers = ['Category', 'Account', 'Amount (KES)'];
    return this.generateCsv(headers, rows);
  }

  /**
   * Export Income Statement to CSV
   */
  async exportIncomeStatementCsv(periodStart: Date, periodEnd: Date): Promise<string> {
    const report = await this.reportingService.generateIncomeStatement(periodStart, periodEnd);

    const rows: string[][] = [];

    // Income
    rows.push(['INCOME', '', '']);
    for (const account of report.income.accounts) {
      rows.push(['', account.accountName, (account.balance / 100).toFixed(2)]);
    }
    rows.push(['TOTAL INCOME', '', (report.income.total / 100).toFixed(2)]);
    rows.push(['', '', '']);

    // Expenses
    rows.push(['EXPENSES', '', '']);
    for (const account of report.expenses.accounts) {
      rows.push(['', account.accountName, (account.balance / 100).toFixed(2)]);
    }
    rows.push(['TOTAL EXPENSES', '', (report.expenses.total / 100).toFixed(2)]);
    rows.push(['', '', '']);

    // Net Income
    rows.push(['NET INCOME', '', (report.netIncome / 100).toFixed(2)]);

    const headers = ['Category', 'Account', 'Amount (KES)'];
    return this.generateCsv(headers, rows);
  }

  // ===========================
  // Excel Export Methods
  // ===========================

  /**
   * Export Chart of Accounts to Excel
   */
  async exportChartOfAccountsExcel(): Promise<Buffer> {
    const accounts = await this.glAccountService.getChartOfAccounts();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chart of Accounts');

    // Add headers
    sheet.columns = [
      { header: 'Account Code', key: 'code', width: 15 },
      { header: 'Account Name', key: 'name', width: 35 },
      { header: 'Account Type', key: 'type', width: 15 },
      { header: 'Normal Balance', key: 'normalBalance', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Balance (KES)', key: 'balance', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
    ];

    this.styleHeaderRow(sheet);

    // Add data
    accounts.forEach(account => {
      sheet.addRow({
        code: account.accountCode,
        name: account.accountName,
        type: account.accountType,
        normalBalance: account.normalBalance,
        status: account.status,
        balance: Number(account.balance) / 100,
        description: account.description || '',
      });
    });

    // Format balance column as currency
    sheet.getColumn('balance').numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export Trial Balance to Excel
   */
  async exportTrialBalanceExcel(asOfDate?: Date): Promise<Buffer> {
    const trialBalance = await this.glAccountService.getTrialBalance();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trial Balance');

    // Add title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'BODAINSURE - Trial Balance';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `As of ${(asOfDate || new Date()).toISOString().split('T')[0]}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add headers at row 4
    sheet.getRow(4).values = ['Account Code', 'Account Name', 'Debit (KES)', 'Credit (KES)'];
    sheet.getRow(4).font = { bold: true };
    sheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    sheet.columns = [
      { width: 15 },
      { width: 35 },
      { width: 18 },
      { width: 18 },
    ];

    // Add data
    let rowNum = 5;
    trialBalance.accounts.forEach(account => {
      sheet.getRow(rowNum).values = [
        account.accountCode,
        account.accountName,
        Number(account.debitBalance) / 100,
        Number(account.creditBalance) / 100,
      ];
      rowNum++;
    });

    // Add totals
    sheet.getRow(rowNum).values = ['', 'TOTALS', Number(trialBalance.totalDebits) / 100, Number(trialBalance.totalCredits) / 100];
    sheet.getRow(rowNum).font = { bold: true };
    sheet.getRow(rowNum).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF0B3' },
    };

    // Format currency columns
    sheet.getColumn(3).numFmt = '#,##0.00';
    sheet.getColumn(4).numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export Journal Entries to Excel
   */
  async exportJournalEntriesExcel(startDate: Date, endDate: Date): Promise<Buffer> {
    const entries = await this.journalEntryService.getByDateRange(startDate, endDate);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Journal Entries');

    sheet.columns = [
      { header: 'Entry Number', key: 'entryNumber', width: 22 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Amount (KES)', key: 'amount', width: 18 },
      { header: 'Rider ID', key: 'riderId', width: 38 },
    ];

    this.styleHeaderRow(sheet);

    entries.forEach(entry => {
      sheet.addRow({
        entryNumber: entry.entryNumber,
        date: entry.entryDate,
        type: entry.entryType,
        status: entry.status,
        description: entry.description,
        amount: Number(entry.totalDebit) / 100,
        riderId: entry.riderId ?? '',
      });
    });

    sheet.getColumn('amount').numFmt = '#,##0.00';
    sheet.getColumn('date').numFmt = 'YYYY-MM-DD';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export Settlements to Excel
   */
  async exportSettlementsExcel(partnerType?: PartnerType): Promise<Buffer> {
    let settlements;
    if (partnerType) {
      settlements = await this.settlementService.getByPartner(partnerType);
    } else {
      const pending = await this.settlementService.getPendingSettlements();
      const approved = await this.settlementService.getApprovedSettlements();
      settlements = [...pending, ...approved];
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Settlements');

    sheet.columns = [
      { header: 'Settlement Number', key: 'number', width: 22 },
      { header: 'Partner', key: 'partner', width: 20 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Amount (KES)', key: 'amount', width: 18 },
      { header: 'Period Start', key: 'periodStart', width: 12 },
      { header: 'Period End', key: 'periodEnd', width: 12 },
      { header: 'Bank Reference', key: 'bankRef', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    this.styleHeaderRow(sheet);

    settlements.forEach(s => {
      sheet.addRow({
        number: s.settlementNumber,
        partner: s.partnerType,
        type: s.settlementType,
        status: s.status,
        amount: Number(s.totalAmount) / 100,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        bankRef: s.bankReference || '',
        createdAt: s.createdAt,
      });
    });

    sheet.getColumn('amount').numFmt = '#,##0.00';
    sheet.getColumn('periodStart').numFmt = 'YYYY-MM-DD';
    sheet.getColumn('periodEnd').numFmt = 'YYYY-MM-DD';
    sheet.getColumn('createdAt').numFmt = 'YYYY-MM-DD HH:MM';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export Balance Sheet to Excel
   */
  async exportBalanceSheetExcel(asOfDate?: Date): Promise<Buffer> {
    const report = await this.reportingService.generateBalanceSheet(asOfDate || new Date());
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Balance Sheet');

    // Title
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = 'BODAINSURE';
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:C2');
    sheet.getCell('A2').value = 'Statement of Financial Position';
    sheet.getCell('A2').font = { bold: true, size: 14 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:C3');
    sheet.getCell('A3').value = `As of ${(asOfDate || new Date()).toISOString().split('T')[0]}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    sheet.columns = [{ width: 10 }, { width: 35 }, { width: 20 }];

    let row = 5;

    // Assets
    sheet.getCell(`A${row}`).value = 'ASSETS';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    for (const account of report.assets.accounts) {
      sheet.getCell(`B${row}`).value = `  ${account.accountName}`;
      sheet.getCell(`C${row}`).value = account.balance / 100;
      sheet.getCell(`C${row}`).numFmt = '#,##0.00';
      row++;
    }

    sheet.getCell(`A${row}`).value = 'TOTAL ASSETS';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.assets.total / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };
    row += 2;

    // Liabilities
    sheet.getCell(`A${row}`).value = 'LIABILITIES';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    for (const account of report.liabilities.accounts) {
      sheet.getCell(`B${row}`).value = `  ${account.accountName}`;
      sheet.getCell(`C${row}`).value = account.balance / 100;
      sheet.getCell(`C${row}`).numFmt = '#,##0.00';
      row++;
    }

    sheet.getCell(`A${row}`).value = 'TOTAL LIABILITIES';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.liabilities.total / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };
    row += 2;

    // Equity
    sheet.getCell(`A${row}`).value = 'EQUITY';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    sheet.getCell(`B${row}`).value = '  Retained Earnings';
    sheet.getCell(`C${row}`).value = report.equity.retainedEarnings / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    row++;

    sheet.getCell(`A${row}`).value = 'TOTAL EQUITY';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.equity.total / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };
    row += 2;

    // Total L+E
    sheet.getCell(`A${row}`).value = 'TOTAL LIABILITIES + EQUITY';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.totalLiabilitiesAndEquity / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };
    sheet.getRow(row).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF0B3' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export Income Statement to Excel
   */
  async exportIncomeStatementExcel(periodStart: Date, periodEnd: Date): Promise<Buffer> {
    const report = await this.reportingService.generateIncomeStatement(periodStart, periodEnd);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Income Statement');

    // Title
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = 'BODAINSURE';
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:C2');
    sheet.getCell('A2').value = 'Income Statement';
    sheet.getCell('A2').font = { bold: true, size: 14 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:C3');
    sheet.getCell('A3').value = `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    sheet.columns = [{ width: 10 }, { width: 35 }, { width: 20 }];

    let row = 5;

    // Income
    sheet.getCell(`A${row}`).value = 'INCOME';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FF2E7D32' } };
    row++;

    for (const account of report.income.accounts) {
      sheet.getCell(`B${row}`).value = `  ${account.accountName}`;
      sheet.getCell(`C${row}`).value = account.balance / 100;
      sheet.getCell(`C${row}`).numFmt = '#,##0.00';
      sheet.getCell(`C${row}`).font = { color: { argb: 'FF2E7D32' } };
      row++;
    }

    sheet.getCell(`A${row}`).value = 'TOTAL INCOME';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.income.total / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true, color: { argb: 'FF2E7D32' } };
    row += 2;

    // Expenses
    sheet.getCell(`A${row}`).value = 'EXPENSES';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FFC62828' } };
    row++;

    for (const account of report.expenses.accounts) {
      sheet.getCell(`B${row}`).value = `  ${account.accountName}`;
      sheet.getCell(`C${row}`).value = account.balance / 100;
      sheet.getCell(`C${row}`).numFmt = '#,##0.00';
      sheet.getCell(`C${row}`).font = { color: { argb: 'FFC62828' } };
      row++;
    }

    sheet.getCell(`A${row}`).value = 'TOTAL EXPENSES';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = report.expenses.total / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true, color: { argb: 'FFC62828' } };
    row += 2;

    // Net Income
    sheet.getCell(`A${row}`).value = 'NET INCOME';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    sheet.getCell(`C${row}`).value = report.netIncome / 100;
    sheet.getCell(`C${row}`).numFmt = '#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true, size: 14, color: { argb: report.netIncome >= 0 ? 'FF2E7D32' : 'FFC62828' } };
    sheet.getRow(row).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: report.netIncome >= 0 ? 'FFE8F5E9' : 'FFFFEBEE' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===========================
  // Helper Methods
  // ===========================

  private generateCsv(headers: string[], rows: string[][]): string {
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headerLine = headers.map(escapeCsv).join(',');
    const dataLines = rows.map(row => row.map(escapeCsv).join(','));

    return [headerLine, ...dataLines].join('\n');
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center' };
  }
}
