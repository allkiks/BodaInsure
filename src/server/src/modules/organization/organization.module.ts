import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Organization } from './entities/organization.entity.js';
import { Membership } from './entities/membership.entity.js';
import { Geography } from './entities/geography.entity.js';
import { User } from '../identity/entities/user.entity.js';

// Services
import { OrganizationService } from './services/organization.service.js';
import { MembershipService } from './services/membership.service.js';
import { GeographyService } from './services/geography.service.js';
import { BulkImportService } from './services/bulk-import.service.js';

// Controllers
import { OrganizationController } from './controllers/organization.controller.js';
import { MembershipController } from './controllers/membership.controller.js';
import { GeographyController } from './controllers/geography.controller.js';

// Modules
import { IdentityModule } from '../identity/identity.module.js';
import { CommonModule } from '../../common/common.module.js';

/**
 * Organization Module
 * Manages KBA/SACCO organizations, memberships, and Kenya geography
 *
 * Per GAP-013: Includes bulk member import functionality
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Membership, Geography, User]),
    forwardRef(() => IdentityModule),
    CommonModule,
  ],
  controllers: [
    OrganizationController,
    MembershipController,
    GeographyController,
  ],
  providers: [
    OrganizationService,
    MembershipService,
    GeographyService,
    BulkImportService,
  ],
  exports: [
    OrganizationService,
    MembershipService,
    GeographyService,
    BulkImportService,
  ],
})
export class OrganizationModule {}
