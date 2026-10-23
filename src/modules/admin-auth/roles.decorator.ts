import { SetMetadata } from '@nestjs/common';
import { AdminRole } from './admin-roles';

export const ROLES_KEY = 'admin_roles';
/** Uso: @Roles('finance', 'operations'). O super_admin passa sempre. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
