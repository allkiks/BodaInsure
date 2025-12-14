import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service.js';
import { AdminController } from './controllers/admin.controller.js';

/**
 * Admin Module
 * Administrative and support tools
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
