import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import { PolicyType } from '../entities/policy.entity.js';

/**
 * Data required to generate a policy PDF
 */
export interface PolicyPdfData {
  policyNumber: string;
  policyType: PolicyType;
  insuredName: string;
  nationalId: string;
  phone: string;
  vehicleRegistration: string;
  coverageStart: Date;
  coverageEnd: Date;
  premiumAmount: number; // In KES
  issuedAt: Date;
  underwriterName: string;
  agentName: string;
}

/**
 * Generated PDF result
 */
export interface GeneratedPdf {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  contentHash: string;
}

/**
 * PDF Generation Service
 * Generates policy certificate PDFs
 *
 * Per FEAT-POL-002
 */
@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);
  private readonly companyName: string;

  constructor(private readonly configService: ConfigService) {
    this.companyName = this.configService.get<string>(
      'COMPANY_NAME',
      'BodaInsure',
    );
  }

  /**
   * Generate a policy certificate PDF
   */
  async generatePolicyCertificate(data: PolicyPdfData): Promise<GeneratedPdf> {
    this.logger.log(`Generating PDF for policy: ${data.policyNumber}`);

    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Policy Certificate - ${data.policyNumber}`,
            Author: this.companyName,
            Subject: 'Third Party Motor Insurance Policy',
            Keywords: 'insurance, bodaboda, tpo, policy',
          },
        });

        // Collect PDF chunks
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
          const fileName = this.generateFileName(data.policyNumber, data.policyType);

          resolve({
            buffer,
            fileName,
            mimeType: 'application/pdf',
            fileSize: buffer.length,
            contentHash,
          });
        });
        doc.on('error', reject);

        // Generate the PDF content
        this.buildPolicyDocument(doc, data);

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build the policy document content
   */
  private buildPolicyDocument(doc: PDFKit.PDFDocument, data: PolicyPdfData): void {
    const pageWidth = doc.page.width - 100; // Account for margins

    // Header with company info
    this.addHeader(doc, pageWidth);

    // Title
    doc.moveDown(2);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('MOTOR THIRD PARTY INSURANCE CERTIFICATE', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica')
       .text(data.policyType === PolicyType.ONE_MONTH ? '(One Month Cover)' : '(Eleven Month Cover)', { align: 'center' });

    // Policy details box
    doc.moveDown(1.5);
    this.addPolicyDetailsBox(doc, data, pageWidth);

    // Insured details
    doc.moveDown(1.5);
    this.addInsuredDetails(doc, data);

    // Vehicle details
    doc.moveDown(1);
    this.addVehicleDetails(doc, data);

    // Coverage details
    doc.moveDown(1);
    this.addCoverageDetails(doc, data);

    // Important notices
    doc.moveDown(1.5);
    this.addImportantNotices(doc);

    // Footer with underwriter info
    this.addFooter(doc, data);
  }

  /**
   * Add header with logo and company info
   */
  private addHeader(doc: PDFKit.PDFDocument, pageWidth: number): void {
    // Company name (would be logo in production)
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#1a5f7a')
       .text(this.companyName.toUpperCase(), { align: 'center' });

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Affordable Insurance for Bodaboda Riders', { align: 'center' });

    doc.moveDown(0.5);

    // Horizontal line
    doc.strokeColor('#1a5f7a')
       .lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(50 + pageWidth, doc.y)
       .stroke();

    doc.fillColor('#000000'); // Reset color
  }

  /**
   * Add policy details box
   */
  private addPolicyDetailsBox(doc: PDFKit.PDFDocument, data: PolicyPdfData, pageWidth: number): void {
    const boxTop = doc.y;
    const boxHeight = 80;

    // Draw box
    doc.rect(50, boxTop, pageWidth, boxHeight)
       .fillAndStroke('#f5f5f5', '#cccccc');

    // Policy number
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('Policy Number:', 70, boxTop + 15);
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .text(data.policyNumber, 70, boxTop + 30);

    // Certificate number (same as policy for now)
    doc.font('Helvetica')
       .fontSize(10)
       .text('Certificate No:', 250, boxTop + 15);
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .text(data.policyNumber, 250, boxTop + 30);

    // Issue date
    doc.font('Helvetica')
       .fontSize(10)
       .text('Issue Date:', 420, boxTop + 15);
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .text(this.formatDate(data.issuedAt), 420, boxTop + 30);

    // Status
    doc.font('Helvetica')
       .fontSize(10)
       .text('Status:', 70, boxTop + 55);
    doc.font('Helvetica-Bold')
       .fillColor('#2e7d32')
       .text('ACTIVE', 120, boxTop + 55);

    doc.fillColor('#000000');
    doc.y = boxTop + boxHeight + 10;
  }

  /**
   * Add insured person details
   */
  private addInsuredDetails(doc: PDFKit.PDFDocument, data: PolicyPdfData): void {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('INSURED DETAILS');

    doc.moveDown(0.5);

    const labelX = 70;
    const valueX = 200;
    const startY = doc.y;

    doc.fontSize(10).font('Helvetica');

    doc.text('Full Name:', labelX, startY);
    doc.font('Helvetica-Bold').text(data.insuredName.toUpperCase(), valueX, startY);

    doc.font('Helvetica').text('National ID:', labelX, startY + 20);
    doc.font('Helvetica-Bold').text(this.maskId(data.nationalId), valueX, startY + 20);

    doc.font('Helvetica').text('Phone:', labelX, startY + 40);
    doc.font('Helvetica-Bold').text(this.maskPhone(data.phone), valueX, startY + 40);

    doc.y = startY + 60;
  }

  /**
   * Add vehicle details
   */
  private addVehicleDetails(doc: PDFKit.PDFDocument, data: PolicyPdfData): void {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('VEHICLE DETAILS');

    doc.moveDown(0.5);

    const labelX = 70;
    const valueX = 200;
    const startY = doc.y;

    doc.fontSize(10).font('Helvetica');

    doc.text('Registration No:', labelX, startY);
    doc.font('Helvetica-Bold').text(data.vehicleRegistration, valueX, startY);

    doc.font('Helvetica').text('Vehicle Type:', labelX, startY + 20);
    doc.font('Helvetica-Bold').text('MOTORCYCLE (BODABODA)', valueX, startY + 20);

    doc.font('Helvetica').text('Use:', labelX, startY + 40);
    doc.font('Helvetica-Bold').text('COMMERCIAL - PASSENGER HIRE', valueX, startY + 40);

    doc.y = startY + 60;
  }

  /**
   * Add coverage details
   */
  private addCoverageDetails(doc: PDFKit.PDFDocument, data: PolicyPdfData): void {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('COVERAGE DETAILS');

    doc.moveDown(0.5);

    const labelX = 70;
    const valueX = 200;
    const startY = doc.y;

    doc.fontSize(10).font('Helvetica');

    doc.text('Cover Type:', labelX, startY);
    doc.font('Helvetica-Bold').text('THIRD PARTY ONLY (TPO)', valueX, startY);

    doc.font('Helvetica').text('Period of Cover:', labelX, startY + 20);
    doc.font('Helvetica-Bold').text(
      `${this.formatDate(data.coverageStart)} to ${this.formatDate(data.coverageEnd)}`,
      valueX,
      startY + 20,
    );

    doc.font('Helvetica').text('Duration:', labelX, startY + 40);
    doc.font('Helvetica-Bold').text(
      data.policyType === PolicyType.ONE_MONTH ? '1 Month' : '11 Months',
      valueX,
      startY + 40,
    );

    doc.font('Helvetica').text('Premium Paid:', labelX, startY + 60);
    doc.font('Helvetica-Bold').text(`KES ${data.premiumAmount.toLocaleString()}`, valueX, startY + 60);

    // Coverage limits
    doc.moveDown(4);
    doc.font('Helvetica-Bold').text('LIMITS OF LIABILITY:');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9);
    doc.text('• Death or bodily injury to third parties: Unlimited', labelX);
    doc.text('• Damage to third party property: KES 3,000,000', labelX);
    doc.text('• Legal costs: As incurred with Insurer\'s consent', labelX);
  }

  /**
   * Add important notices
   */
  private addImportantNotices(doc: PDFKit.PDFDocument): void {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('IMPORTANT NOTICES:');

    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');

    const notices = [
      '1. This certificate must be carried at all times while operating the insured vehicle.',
      '2. Any accident must be reported to the police and underwriter within 48 hours.',
      '3. This policy does not cover the insured driver or damage to the insured vehicle.',
      '4. Operating the vehicle under influence of alcohol or drugs voids this cover.',
      '5. Only valid for the named vehicle registration number shown above.',
    ];

    notices.forEach((notice) => {
      doc.text(notice, 70, doc.y, { width: doc.page.width - 140 });
      doc.moveDown(0.3);
    });
  }

  /**
   * Add footer with underwriter info
   */
  private addFooter(doc: PDFKit.PDFDocument, data: PolicyPdfData): void {
    const footerTop = doc.page.height - 120;

    // Horizontal line
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .moveTo(50, footerTop)
       .lineTo(doc.page.width - 50, footerTop)
       .stroke();

    doc.fillColor('#666666')
       .fontSize(8)
       .font('Helvetica');

    // Underwriter info
    doc.text(`Underwritten by: ${data.underwriterName}`, 50, footerTop + 10);
    doc.text(`Through: ${data.agentName}`, 50, footerTop + 22);
    doc.text(`Platform: ${this.companyName}`, 50, footerTop + 34);

    // Verification info
    doc.text(
      'Verify this policy at: www.bodainsure.co.ke/verify',
      doc.page.width - 250,
      footerTop + 10,
    );
    doc.text(
      `Document ID: ${this.generateDocumentId(data.policyNumber)}`,
      doc.page.width - 250,
      footerTop + 22,
    );

    // IRA notice
    doc.fontSize(7)
       .fillColor('#999999')
       .text(
         'This policy is issued in accordance with the Insurance Act (Cap 487) and regulated by the Insurance Regulatory Authority of Kenya.',
         50,
         footerTop + 55,
         { width: doc.page.width - 100, align: 'center' },
       );
  }

  /**
   * Generate filename for the PDF
   */
  private generateFileName(policyNumber: string, policyType: PolicyType): string {
    const typeLabel = policyType === PolicyType.ONE_MONTH ? '1M' : '11M';
    const timestamp = Date.now();
    return `BodaInsure_Policy_${policyNumber}_${typeLabel}_${timestamp}.pdf`;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Mask national ID for privacy (show last 4 digits)
   */
  private maskId(id: string): string {
    if (id.length <= 4) return id;
    return '*'.repeat(id.length - 4) + id.slice(-4);
  }

  /**
   * Mask phone for privacy (show last 4 digits)
   */
  private maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return phone;
    return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
  }

  /**
   * Generate a unique document ID for verification
   */
  private generateDocumentId(policyNumber: string): string {
    const hash = crypto.createHash('md5')
                       .update(`${policyNumber}-${Date.now()}`)
                       .digest('hex')
                       .substring(0, 8)
                       .toUpperCase();
    return `DOC-${hash}`;
  }
}
