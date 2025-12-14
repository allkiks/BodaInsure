import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GeographyService } from '../services/geography.service.js';
import { GeographyLevel } from '../entities/geography.entity.js';

/**
 * Geography Controller
 * Kenya administrative boundaries
 */
@Controller('geography')
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}

  /**
   * Get all counties
   */
  @Get('counties')
  async getCounties() {
    return this.geographyService.getCounties();
  }

  /**
   * Get sub-counties for a county
   */
  @Get('counties/:countyCode/sub-counties')
  async getSubCounties(@Param('countyCode') countyCode: string) {
    return this.geographyService.getSubCounties(countyCode);
  }

  /**
   * Get wards for a sub-county
   */
  @Get('sub-counties/:subCountyCode/wards')
  async getWards(@Param('subCountyCode') subCountyCode: string) {
    return this.geographyService.getWards(subCountyCode);
  }

  /**
   * Get geography by code
   */
  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    const geography = await this.geographyService.getByCode(code);
    if (!geography) {
      return null;
    }
    return {
      code: geography.code,
      name: geography.name,
      level: geography.level,
      parentCode: geography.parentCode,
      countyCode: geography.countyCode,
      countyName: geography.countyName,
      population: geography.population,
      latitude: geography.latitude,
      longitude: geography.longitude,
    };
  }

  /**
   * Search geography by name
   */
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('level') level?: GeographyLevel,
  ) {
    if (!query || query.length < 2) {
      return [];
    }
    return this.geographyService.search(query, level);
  }

  /**
   * Get county name by code
   */
  @Get('counties/:countyCode/name')
  async getCountyName(@Param('countyCode') countyCode: string) {
    const name = await this.geographyService.getCountyName(countyCode);
    return { countyCode, name };
  }

  /**
   * Get full hierarchy for a location
   */
  @Get('hierarchy/:code')
  async getHierarchy(@Param('code') code: string) {
    return this.geographyService.getHierarchy(code);
  }

  /**
   * Validate location codes
   */
  @Get('validate')
  async validateLocation(
    @Query('countyCode') countyCode?: string,
    @Query('subCountyCode') subCountyCode?: string,
    @Query('wardCode') wardCode?: string,
  ) {
    return this.geographyService.validateLocation(countyCode, subCountyCode, wardCode);
  }

  /**
   * Seed counties data (admin only)
   */
  @Post('seed/counties')
  @HttpCode(HttpStatus.OK)
  async seedCounties() {
    const created = await this.geographyService.seedCounties();
    return {
      message: created > 0 ? `Seeded ${created} counties` : 'Counties already seeded',
      created,
    };
  }
}
