import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;
  email: string;
  role: string;
  schoolId?: string;
  schoolSlug?: string;
  type?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as CurrentUserPayload | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
