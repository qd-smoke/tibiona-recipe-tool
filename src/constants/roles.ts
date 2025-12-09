export const ADMIN_ROLE = 'admin';
export const OPERATOR_ROLE = 'operator';

export type UserRole = typeof ADMIN_ROLE | typeof OPERATOR_ROLE;

export const ROLE_OPTIONS = [
  { value: ADMIN_ROLE, label: 'Admin' },
  { value: OPERATOR_ROLE, label: 'Operatore' },
] as const;

export const isValidRole = (role: string): role is UserRole => {
  return role === ADMIN_ROLE || role === OPERATOR_ROLE;
};

export const isAdminRole = (role: string | null | undefined): boolean => {
  return role === ADMIN_ROLE;
};
