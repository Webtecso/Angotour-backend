export const ADMIN_ROLES = ['super_admin', 'operations', 'finance', 'safety', 'support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
