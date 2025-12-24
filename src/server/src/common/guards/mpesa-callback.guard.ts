import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Default Safaricom M-Pesa callback server IPs
 * These are the known IP ranges for Safaricom's callback servers
 * Reference: Safaricom Daraja API documentation
 */
const DEFAULT_SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.201',
  '196.201.214.202',
  '196.201.214.203',
  '196.201.214.204',
  '196.201.214.205',
  '196.201.214.206',
  '196.201.214.207',
];

/**
 * M-Pesa Callback Guard
 *
 * Security guard that validates incoming M-Pesa callbacks originate
 * from authorized Safaricom IP addresses.
 *
 * Per P0-001 in mpesa_remediation.md
 *
 * Configuration:
 * - MPESA_ALLOWED_IPS: Comma-separated list of allowed IPs (overrides defaults)
 * - MPESA_ALLOW_LOCALHOST_CALLBACK: Set to 'true' to allow localhost (dev only)
 */
@Injectable()
export class MpesaCallbackGuard implements CanActivate {
  private readonly logger = new Logger(MpesaCallbackGuard.name);
  private readonly allowedIps: Set<string>;
  private readonly allowLocalhost: boolean;

  constructor(private readonly configService: ConfigService) {
    // Load allowed IPs from config or use defaults
    const ipsConfig = this.configService.get<string>('MPESA_ALLOWED_IPS', '');

    if (ipsConfig && ipsConfig.trim()) {
      // Use configured IPs
      this.allowedIps = new Set(
        ipsConfig.split(',').map(ip => ip.trim()).filter(Boolean)
      );
      this.logger.log(`Loaded ${this.allowedIps.size} allowed IPs from configuration`);
    } else {
      // Use default Safaricom IPs
      this.allowedIps = new Set(DEFAULT_SAFARICOM_IPS);
      this.logger.log(`Using ${this.allowedIps.size} default Safaricom IPs`);
    }

    // Allow localhost only in development
    const allowLocalhostConfig = this.configService.get<string>('MPESA_ALLOW_LOCALHOST_CALLBACK', 'false');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    this.allowLocalhost = allowLocalhostConfig === 'true' && nodeEnv !== 'production';

    if (this.allowLocalhost) {
      this.logger.warn('Localhost callbacks allowed - THIS SHOULD NOT BE ENABLED IN PRODUCTION');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.extractClientIp(request);

    // Allow localhost in development mode
    if (this.allowLocalhost && this.isLocalhost(clientIp)) {
      this.logger.debug(`Localhost callback allowed: ${clientIp}`);
      return true;
    }

    // Check against whitelist
    if (!this.allowedIps.has(clientIp)) {
      // Log the rejected request with full details for security audit
      this.logger.warn(
        `M-Pesa callback REJECTED from unauthorized IP`,
        {
          clientIp,
          userAgent: request.headers['user-agent'],
          contentLength: request.headers['content-length'],
          path: request.path,
          timestamp: new Date().toISOString(),
        }
      );

      throw new ForbiddenException('Callback source not authorized');
    }

    this.logger.debug(`M-Pesa callback accepted from IP: ${clientIp}`);
    return true;
  }

  /**
   * Extract the real client IP from the request
   * Handles X-Forwarded-For for load balancers/proxies
   */
  private extractClientIp(request: Request): string {
    // Check X-Forwarded-For header (set by load balancers/proxies)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
      // The first one is the original client
      const ips = typeof forwardedFor === 'string'
        ? forwardedFor
        : forwardedFor[0];

      if (ips) {
        const firstIp = ips.split(',')[0]?.trim() ?? '';

        // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
        if (firstIp.startsWith('::ffff:')) {
          return firstIp.substring(7);
        }
        return firstIp;
      }
    }

    // Check X-Real-IP header (common with nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      const ip = typeof realIp === 'string' ? realIp : realIp[0];
      if (ip) {
        if (ip.startsWith('::ffff:')) {
          return ip.substring(7);
        }
        return ip;
      }
    }

    // Fall back to direct connection IP
    let ip = request.ip || request.socket?.remoteAddress || '';

    // Handle IPv6-mapped IPv4 addresses
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    return ip;
  }

  /**
   * Check if an IP is localhost
   */
  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' ||
           ip === '::1' ||
           ip === 'localhost' ||
           ip === '::ffff:127.0.0.1';
  }
}
