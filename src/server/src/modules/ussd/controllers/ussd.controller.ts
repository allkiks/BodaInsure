import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { UssdService, UssdProvider } from '../services/ussd.service.js';
import { maskPhone } from '../../../common/utils/phone.util.js';

/**
 * Africa's Talking USSD request (POST body)
 */
interface AfricasTalkingRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
  serviceCode: string;
}

/**
 * Advantasms USSD query parameters (GET)
 */
interface AdvantasmsQuery {
  SESSIONID: string;
  USSDCODE: string;
  MSISDN: string;
  INPUT: string;
}

/**
 * USSD Controller
 * Handles USSD requests from telco gateways
 *
 * Supports:
 * - Africa's Talking (POST /ussd/africastalking)
 * - Advantasms (GET /ussd/advantasms)
 *
 * Per ussd_sms_integration.md and feature_specification.md
 */
@Controller('ussd')
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  /**
   * Africa's Talking USSD callback
   * Receives POST with JSON body
   *
   * @param body - { sessionId, phoneNumber, text, serviceCode }
   * @param res - Express response for setting Content-Type
   */
  @Post('africastalking')
  @HttpCode(HttpStatus.OK)
  async handleAfricasTalking(
    @Body() body: AfricasTalkingRequest,
    @Res() res: Response,
  ): Promise<void> {
    const { sessionId, phoneNumber, text, serviceCode } = body;

    this.logger.debug(
      `AT USSD: session=${sessionId} phone=${maskPhone(phoneNumber)} text="${text}" service=${serviceCode}`,
    );

    // Normalize phone number (AT sends +254...)
    const normalizedPhone = phoneNumber.replace(/^\+/, '');

    // Parse input - AT sends empty string for initial dial, cumulative otherwise
    const inputArray = text === '' ? [] : text.split('*');
    const lastInput = inputArray.length > 0 ? inputArray[inputArray.length - 1] : '';

    const response = await this.ussdService.processRequest({
      sessionId,
      phoneNumber: normalizedPhone,
      serviceCode,
      input: lastInput,
      fullInput: text,
      provider: UssdProvider.AFRICASTALKING,
    });

    // Set proper Content-Type for USSD response
    res.setHeader('Content-Type', 'text/plain');

    // Africa's Talking format: CON = continue, END = end session
    const prefix = response.endSession ? 'END ' : 'CON ';
    res.send(prefix + response.message);
  }

  /**
   * Advantasms USSD callback
   * Receives GET with query parameters
   *
   * @param query - { SESSIONID, USSDCODE, MSISDN, INPUT }
   * @param res - Express response for setting Content-Type
   */
  @Get('advantasms')
  async handleAdvantasms(
    @Query() query: AdvantasmsQuery,
    @Res() res: Response,
  ): Promise<void> {
    const { SESSIONID, USSDCODE, MSISDN, INPUT } = query;

    // Decode URL-encoded input
    const decodedInput = decodeURIComponent(INPUT || '');

    this.logger.debug(
      `Advantasms USSD: session=${SESSIONID} msisdn=${maskPhone(MSISDN)} input="${decodedInput}" code=${USSDCODE}`,
    );

    // Parse input - Advantasms sends cumulative format (e.g., "33*1*87")
    // First element is often the shortcode identifier
    const inputArray = decodedInput ? decodedInput.split('*') : [];
    const lastInput = inputArray.length > 0 ? inputArray[inputArray.length - 1] : '';

    const response = await this.ussdService.processRequest({
      sessionId: SESSIONID,
      phoneNumber: MSISDN,
      serviceCode: USSDCODE,
      input: lastInput,
      fullInput: decodedInput,
      provider: UssdProvider.ADVANTASMS,
    });

    // Set proper Content-Type for USSD response
    res.setHeader('Content-Type', 'text/plain');

    // Advantasms also uses CON/END format
    const prefix = response.endSession ? 'END ' : 'CON ';
    res.send(prefix + response.message);
  }

  /**
   * Legacy endpoint for backwards compatibility
   * Assumes Africa's Talking format
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async processLegacy(
    @Body() body: AfricasTalkingRequest,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.debug('Legacy USSD endpoint called, routing to Africa\'s Talking handler');
    return this.handleAfricasTalking(body, res);
  }

  /**
   * Get USSD service status
   */
  @Get('status')
  getStatus() {
    return {
      activeSessions: this.ussdService.getActiveSessionCount(),
      status: 'online',
      endpoints: {
        africastalking: '/ussd/africastalking (POST)',
        advantasms: '/ussd/advantasms (GET)',
        legacy: '/ussd (POST)',
      },
    };
  }

  /**
   * Cleanup expired sessions (for scheduler)
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  cleanup() {
    const cleaned = this.ussdService.cleanupExpiredSessions();
    return { cleaned };
  }
}
