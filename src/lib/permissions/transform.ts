import type {
  CapabilityRule,
  PermissionCapabilities,
  PermissionProfile,
  PermissionProfileRecord,
  UserRole,
  AppRoleRecord,
} from '@/types';
import { isValidRole, OPERATOR_ROLE, isAdminRole } from '@/constants/roles';
import { PERMISSION_TREE_LEAF_IDS } from '@/constants/permissionSections';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeCapabilityValue = (value: unknown): CapabilityRule => {
  if (typeof value === 'boolean') {
    return { visible: value, editable: value };
  }

  if (
    value &&
    typeof value === 'object' &&
    ('visible' in (value as Record<string, unknown>) ||
      'editable' in (value as Record<string, unknown>))
  ) {
    const obj = value as Record<string, unknown>;
    return {
      visible: Boolean(obj.visible),
      editable: Boolean(obj.editable ?? obj.visible),
    };
  }

  return { visible: false, editable: false };
};

const LEGACY_CAPABILITY_ALIASES: Record<string, string> = {
  edit_permissions: 'admin.permissions',
};

const parseCapabilities = (
  value: string | null | undefined,
): PermissionCapabilities => {
  const parsed = parseJson<Record<string, unknown>>(value, {});
  const normalized = Object.entries(parsed).reduce<PermissionCapabilities>(
    (acc, [key, entry]) => {
      acc[key] = normalizeCapabilityValue(entry);
      return acc;
    },
    {},
  );

  Object.entries(LEGACY_CAPABILITY_ALIASES).forEach(
    ([legacyKey, targetKey]) => {
      if (normalized[targetKey]) return;
      if (parsed[legacyKey] === undefined) return;
      normalized[targetKey] = normalizeCapabilityValue(parsed[legacyKey]);
    },
  );

  return normalized;
};

export const toPermissionProfile = (
  record: PermissionProfileRecord,
  roleRecord: AppRoleRecord | null = null,
): PermissionProfile => {
  // Use roleLabel from role if exists, otherwise use user's roleLabel
  const roleLabel = roleRecord?.roleLabel || record.roleLabel || '';
  const role: UserRole = isValidRole(roleLabel) ? roleLabel : OPERATOR_ROLE;

  // Use role permissions if role exists, otherwise fallback to user's own permissions (for backward compatibility)
  const allowedSections = roleRecord
    ? parseJson<string[]>(roleRecord.allowedSections, [])
    : parseJson<string[]>(record.allowedSections || null, []);

  let capabilities = roleRecord
    ? parseCapabilities(roleRecord.capabilities)
    : parseCapabilities(record.capabilities || null);

  // If role is Admin, automatically apply all capabilities (even if DB has empty capabilities)
  if (isAdminRole(roleLabel)) {
    capabilities = PERMISSION_TREE_LEAF_IDS.reduce<PermissionCapabilities>(
      (acc, id) => {
        acc[id] = { visible: true, editable: true };
        return acc;
      },
      {},
    );
  } else {
    // For non-admin roles, if capabilities are empty, convert to empty object
    // but canView will handle it as default (show everything) when isOperatorViewActive is false
    // This allows operators without configured capabilities to see everything by default
    if (!capabilities || Object.keys(capabilities).length === 0) {
      // Keep as empty object - canView will return true (default) when isOperatorViewActive is false
      capabilities = {};
    }
  }

  return {
    ...record,
    roleLabel, // Use role's roleLabel if exists, otherwise user's roleLabel
    allowedSections,
    capabilities,
    mustChangePassword: record.mustChangePassword === 1,
    hasPassword: Boolean(record.passwordHash),
    role, // Derived role for type safety
  };
};

export const toAppRole = (record: AppRoleRecord): import('@/types').AppRole => {
  return {
    ...record,
    allowedSections: parseJson<string[]>(record.allowedSections, []),
    capabilities: parseCapabilities(record.capabilities),
  };
};

export const serializeCapabilities = (
  capabilities: PermissionCapabilities | undefined | null,
) => {
  if (!capabilities) return {};
  const sanitizedEntries = Object.entries(capabilities).reduce<
    Record<string, CapabilityRule>
  >((acc, [key, value]) => {
    const normalizedKey = LEGACY_CAPABILITY_ALIASES[key] ?? key;
    acc[normalizedKey] = {
      visible: Boolean(value?.visible),
      editable: Boolean(value?.editable),
    };
    return acc;
  }, {});
  return sanitizedEntries;
};
