import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface ICurrentUser {
  id: string;
  phone: string;
  role: string;
  organizationId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof ICurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as ICurrentUser | undefined;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
