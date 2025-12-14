import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * User payload extracted from JWT
 */
export interface JwtPayload {
  userId: string;
  phone: string;
  iat?: number;
  exp?: number;
}

/**
 * Current User Decorator
 * Extracts the authenticated user from the request
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return this.userService.findById(user.userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload;

    if (data) {
      return user[data] as string;
    }

    return user;
  },
);
