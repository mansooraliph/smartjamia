import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Require one or more permission keys (`<module>:<action>`) for a route.
 * Built-in roles are checked against their constant permission set; custom
 * roles against their stored set. ALL listed permissions must be held.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
