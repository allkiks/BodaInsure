import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Geography,
  GeographyLevel,
  KENYA_COUNTIES,
} from '../entities/geography.entity.js';

/**
 * Geography summary
 */
export interface GeographySummary {
  code: string;
  name: string;
  level: GeographyLevel;
  parentCode: string | null;
}

/**
 * Geography Service
 * Manages Kenya administrative boundaries
 */
@Injectable()
export class GeographyService {
  private readonly logger = new Logger(GeographyService.name);

  constructor(
    @InjectRepository(Geography)
    private readonly geographyRepository: Repository<Geography>,
  ) {}

  /**
   * Get all counties
   */
  async getCounties(): Promise<GeographySummary[]> {
    const counties = await this.geographyRepository.find({
      where: { level: GeographyLevel.COUNTY, isActive: true },
      order: { name: 'ASC' },
    });

    return counties.map((c) => ({
      code: c.code,
      name: c.name,
      level: c.level,
      parentCode: c.parentCode ?? null,
    }));
  }

  /**
   * Get sub-counties for a county
   */
  async getSubCounties(countyCode: string): Promise<GeographySummary[]> {
    const subCounties = await this.geographyRepository.find({
      where: {
        level: GeographyLevel.SUB_COUNTY,
        countyCode,
        isActive: true,
      },
      order: { name: 'ASC' },
    });

    return subCounties.map((s) => ({
      code: s.code,
      name: s.name,
      level: s.level,
      parentCode: s.parentCode ?? null,
    }));
  }

  /**
   * Get wards for a sub-county
   */
  async getWards(subCountyCode: string): Promise<GeographySummary[]> {
    const wards = await this.geographyRepository.find({
      where: {
        level: GeographyLevel.WARD,
        parentCode: subCountyCode,
        isActive: true,
      },
      order: { name: 'ASC' },
    });

    return wards.map((w) => ({
      code: w.code,
      name: w.name,
      level: w.level,
      parentCode: w.parentCode ?? null,
    }));
  }

  /**
   * Get geography by code
   */
  async getByCode(code: string): Promise<Geography | null> {
    return this.geographyRepository.findOne({
      where: { code, isActive: true },
    });
  }

  /**
   * Search geography by name
   */
  async search(query: string, level?: GeographyLevel): Promise<GeographySummary[]> {
    const qb = this.geographyRepository
      .createQueryBuilder('g')
      .where('g.name ILIKE :query', { query: `%${query}%` })
      .andWhere('g.is_active = true');

    if (level) {
      qb.andWhere('g.level = :level', { level });
    }

    const results = await qb
      .orderBy('g.level', 'ASC')
      .addOrderBy('g.name', 'ASC')
      .limit(50)
      .getMany();

    return results.map((r) => ({
      code: r.code,
      name: r.name,
      level: r.level,
      parentCode: r.parentCode ?? null,
    }));
  }

  /**
   * Get county name by code
   */
  async getCountyName(code: string): Promise<string | null> {
    const county = await this.geographyRepository.findOne({
      where: { code, level: GeographyLevel.COUNTY },
    });

    return county?.name ?? null;
  }

  /**
   * Seed counties data
   * Call this on first deployment or when updating geography data
   */
  async seedCounties(): Promise<number> {
    let created = 0;

    for (const county of KENYA_COUNTIES) {
      const existing = await this.geographyRepository.findOne({
        where: { code: county.code },
      });

      if (!existing) {
        await this.geographyRepository.save({
          code: county.code,
          name: county.name,
          level: GeographyLevel.COUNTY,
          countyCode: county.code,
          countyName: county.name,
          isActive: true,
        });
        created++;
      }
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} counties`);
    }

    return created;
  }

  /**
   * Get full geography hierarchy for a location
   */
  async getHierarchy(code: string): Promise<GeographySummary[]> {
    const hierarchy: GeographySummary[] = [];
    let current = await this.getByCode(code);

    while (current) {
      hierarchy.unshift({
        code: current.code,
        name: current.name,
        level: current.level,
        parentCode: current.parentCode ?? null,
      });

      if (current.parentCode) {
        current = await this.getByCode(current.parentCode);
      } else {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Validate location codes
   */
  async validateLocation(
    countyCode?: string,
    subCountyCode?: string,
    wardCode?: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (countyCode) {
      const county = await this.getByCode(countyCode);
      if (!county || county.level !== GeographyLevel.COUNTY) {
        errors.push(`Invalid county code: ${countyCode}`);
      }
    }

    if (subCountyCode) {
      const subCounty = await this.getByCode(subCountyCode);
      if (!subCounty || subCounty.level !== GeographyLevel.SUB_COUNTY) {
        errors.push(`Invalid sub-county code: ${subCountyCode}`);
      } else if (countyCode && subCounty.countyCode !== countyCode) {
        errors.push(`Sub-county ${subCountyCode} does not belong to county ${countyCode}`);
      }
    }

    if (wardCode) {
      const ward = await this.getByCode(wardCode);
      if (!ward || ward.level !== GeographyLevel.WARD) {
        errors.push(`Invalid ward code: ${wardCode}`);
      } else if (subCountyCode && ward.parentCode !== subCountyCode) {
        errors.push(`Ward ${wardCode} does not belong to sub-county ${subCountyCode}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
