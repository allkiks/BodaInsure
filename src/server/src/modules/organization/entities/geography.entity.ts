import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

/**
 * Geography level
 */
export enum GeographyLevel {
  COUNTRY = 'COUNTRY',
  COUNTY = 'COUNTY',
  SUB_COUNTY = 'SUB_COUNTY',
  WARD = 'WARD',
}

/**
 * Geography Entity
 * Kenya administrative boundaries
 *
 * Kenya has 47 counties, each with sub-counties and wards
 */
@Entity('geography')
@Index(['level', 'parentCode'])
@Index(['code'], { unique: true })
export class Geography {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique code for this area */
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  /** Name of the area */
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Geography level */
  @Column({
    type: 'enum',
    enum: GeographyLevel,
  })
  level!: GeographyLevel;

  /** Parent area code */
  @Column({ name: 'parent_code', type: 'varchar', length: 20, nullable: true })
  parentCode?: string;

  /** County code (for quick filtering) */
  @Column({ name: 'county_code', type: 'varchar', length: 10, nullable: true })
  @Index()
  countyCode?: string;

  /** County name (denormalized for convenience) */
  @Column({ name: 'county_name', type: 'varchar', length: 100, nullable: true })
  countyName?: string;

  /** Population (if known) */
  @Column({ type: 'integer', nullable: true })
  population?: number;

  /** Area in square kilometers */
  @Column({ name: 'area_sq_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaSqKm?: number;

  /** Center latitude */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  /** Center longitude */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  /** Active flag */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}

/**
 * Kenya Counties Data
 * All 47 counties with their codes
 */
export const KENYA_COUNTIES = [
  { code: '001', name: 'Mombasa' },
  { code: '002', name: 'Kwale' },
  { code: '003', name: 'Kilifi' },
  { code: '004', name: 'Tana River' },
  { code: '005', name: 'Lamu' },
  { code: '006', name: 'Taita Taveta' },
  { code: '007', name: 'Garissa' },
  { code: '008', name: 'Wajir' },
  { code: '009', name: 'Mandera' },
  { code: '010', name: 'Marsabit' },
  { code: '011', name: 'Isiolo' },
  { code: '012', name: 'Meru' },
  { code: '013', name: 'Tharaka Nithi' },
  { code: '014', name: 'Embu' },
  { code: '015', name: 'Kitui' },
  { code: '016', name: 'Machakos' },
  { code: '017', name: 'Makueni' },
  { code: '018', name: 'Nyandarua' },
  { code: '019', name: 'Nyeri' },
  { code: '020', name: 'Kirinyaga' },
  { code: '021', name: "Murang'a" },
  { code: '022', name: 'Kiambu' },
  { code: '023', name: 'Turkana' },
  { code: '024', name: 'West Pokot' },
  { code: '025', name: 'Samburu' },
  { code: '026', name: 'Trans Nzoia' },
  { code: '027', name: 'Uasin Gishu' },
  { code: '028', name: 'Elgeyo Marakwet' },
  { code: '029', name: 'Nandi' },
  { code: '030', name: 'Baringo' },
  { code: '031', name: 'Laikipia' },
  { code: '032', name: 'Nakuru' },
  { code: '033', name: 'Narok' },
  { code: '034', name: 'Kajiado' },
  { code: '035', name: 'Kericho' },
  { code: '036', name: 'Bomet' },
  { code: '037', name: 'Kakamega' },
  { code: '038', name: 'Vihiga' },
  { code: '039', name: 'Bungoma' },
  { code: '040', name: 'Busia' },
  { code: '041', name: 'Siaya' },
  { code: '042', name: 'Kisumu' },
  { code: '043', name: 'Homa Bay' },
  { code: '044', name: 'Migori' },
  { code: '045', name: 'Kisii' },
  { code: '046', name: 'Nyamira' },
  { code: '047', name: 'Nairobi' },
];
