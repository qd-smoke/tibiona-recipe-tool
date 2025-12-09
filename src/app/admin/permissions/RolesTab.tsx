'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AppRole, AppRoleInput, PermissionCapabilities } from '@/types';
import {
  PERMISSION_TREE,
  PERMISSION_TREE_LEAF_IDS,
} from '@/constants/permissionSections';
import type { PermissionTreeNode } from '@/constants/permissionSections';
import { isAdminRole } from '@/constants/roles';

type EditableRole = AppRoleInput & {
  id?: number;
  localId: string;
  createdAt?: string;
  updatedAt?: string;
  isNew?: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type CapabilityField = 'visible' | 'editable';
type TriState = 'checked' | 'unchecked' | 'indeterminate';

const createLocalId = () => Math.random().toString(36).slice(2, 10);

const createCapabilityBaseline = (): PermissionCapabilities =>
  PERMISSION_TREE_LEAF_IDS.reduce<PermissionCapabilities>((acc, id) => {
    acc[id] = { visible: false, editable: false };
    return acc;
  }, {});

const createAdminCapabilities = (): PermissionCapabilities => {
  return PERMISSION_TREE_LEAF_IDS.reduce<PermissionCapabilities>((acc, id) => {
    acc[id] = { visible: true, editable: true };
    return acc;
  }, {});
};

const emptyRole = (): EditableRole => ({
  localId: `new-${createLocalId()}`,
  roleLabel: '',
  allowedSections: [],
  capabilities: createCapabilityBaseline(),
  isNew: true,
});

type RolesTabProps = {
  canEditRoles: boolean;
};

export function RolesTab({ canEditRoles }: RolesTabProps) {
  const [roles, setRoles] = useState<EditableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [_search, _setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveState>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch('/api/roles');
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (data?.ok) {
          const list: AppRole[] = data.data ?? [];
          setRoles(
            list.map((role) => ({
              ...role,
              localId: `r-${role.id}`,
            })),
          );
        } else {
          setMessage('Impossibile caricare i ruoli');
        }
      } catch {
        if (active) setMessage('Errore di rete');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateRole = (
    localId: string,
    updater: (role: EditableRole) => EditableRole,
  ) => {
    setRoles((prev) =>
      prev.map((role) => (role.localId === localId ? updater(role) : role)),
    );
  };

  const handleRoleChange = (localId: string, newRoleLabel: string) => {
    updateRole(localId, (role) => {
      const wasAdmin = isAdminRole(role.roleLabel);
      const isNowAdmin = isAdminRole(newRoleLabel);

      let newCapabilities = role.capabilities;

      // Se cambio a Admin, imposta tutti i capabilities a visible/editable
      if (!wasAdmin && isNowAdmin) {
        newCapabilities = createAdminCapabilities();
      }

      return {
        ...role,
        roleLabel: newRoleLabel,
        capabilities: newCapabilities,
      };
    });
  };

  const persistRole = async (role: EditableRole) => {
    if (!canEditRoles) {
      setMessage('Non hai i permessi per modificare i ruoli.');
      return;
    }
    if (!role.roleLabel) {
      setMessage('Nome ruolo è obbligatorio.');
      setSaveStatus((prev) => ({ ...prev, [role.localId]: 'error' }));
      return;
    }
    setSaveStatus((prev) => ({ ...prev, [role.localId]: 'saving' }));
    setMessage(null);
    const payload: AppRoleInput = {
      id: role.id,
      roleLabel: role.roleLabel,
      allowedSections: role.allowedSections ?? [],
      capabilities: role.capabilities ?? {},
    };

    // Debug logging
    const automatchInPayload =
      payload.capabilities['recipe.ingredients.automatch'];
    console.log('[RolesTab] Saving role:', {
      roleId: role.id,
      roleLabel: role.roleLabel,
      capabilitiesCount: Object.keys(payload.capabilities).length,
      capabilities: payload.capabilities,
      recipeCostsConfig: payload.capabilities['recipe.costs'],
      automatchCapability: automatchInPayload || 'NOT FOUND',
      payload,
    });

    try {
      const method = role.id ? 'PUT' : 'POST';
      const requestBody = { role: payload };
      console.log('[RolesTab] Sending request:', {
        method,
        url: '/api/roles',
        body: requestBody,
        bodyStringified: JSON.stringify(requestBody),
      });

      const res = await fetch('/api/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => null);

      console.log('[RolesTab] Server response:', {
        ok: data?.ok,
        error: data?.error,
        data: data?.data,
        savedCapabilities: data?.data?.capabilities,
        savedRecipeCosts: data?.data?.capabilities?.['recipe.costs'],
      });

      if (!data?.ok) {
        setMessage(data?.error || 'Errore durante il salvataggio');
        setSaveStatus((prev) => ({ ...prev, [role.localId]: 'error' }));
        return;
      }
      const savedRole: AppRole = data.data;

      console.log('[RolesTab] Saved role:', {
        savedRole,
        savedCapabilities: savedRole?.capabilities,
        savedRecipeCosts: savedRole?.capabilities?.['recipe.costs'],
      });
      if (savedRole) {
        // Update the role in state with the saved data
        setRoles((prev) =>
          prev.map((r) =>
            r.localId === role.localId
              ? {
                  ...savedRole,
                  localId: `r-${savedRole.id}`,
                  isNew: false,
                }
              : r,
          ),
        );
        setSaveStatus((prev) => ({ ...prev, [`r-${savedRole.id}`]: 'saved' }));
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [`r-${savedRole.id}`]: 'idle' }));
        }, 2000);
      } else {
        setSaveStatus((prev) => ({ ...prev, [role.localId]: 'saved' }));
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [role.localId]: 'idle' }));
        }, 2000);
      }
    } catch {
      setMessage('Errore di rete durante il salvataggio');
      setSaveStatus((prev) => ({ ...prev, [role.localId]: 'error' }));
    }
  };

  const handleAddRole = () => {
    if (!canEditRoles) {
      setMessage('Non hai i permessi per creare ruoli.');
      return;
    }
    setRoles((prev) => [emptyRole(), ...prev]);
    setMessage(null);
  };

  const filteredRoles = useMemo(() => {
    if (!_search.trim()) return roles;
    const q = _search.toLowerCase();
    return roles.filter((role) => role.roleLabel?.toLowerCase().includes(q));
  }, [roles, _search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-zinc-400">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-zinc-100">Gestione Ruoli</h2>
        {canEditRoles && (
          <button
            type="button"
            onClick={handleAddRole}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            + Nuovo Ruolo
          </button>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/20 p-3 text-sm text-red-200">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {filteredRoles.map((role) => (
          <RoleEditor
            key={role.localId}
            role={role}
            canEdit={canEditRoles}
            onRoleChange={handleRoleChange}
            onSave={persistRole}
            saveStatus={saveStatus[role.localId] || 'idle'}
          />
        ))}
      </div>
    </div>
  );
}

type RoleEditorProps = {
  role: EditableRole;
  canEdit: boolean;
  onRoleChange: (localId: string, newRoleLabel: string) => void;
  onSave: (role: EditableRole) => void;
  saveStatus: SaveState;
};

function RoleEditor({
  role,
  canEdit,
  onRoleChange,
  onSave,
  saveStatus,
}: RoleEditorProps) {
  const [localRole, setLocalRole] = React.useState(role);

  React.useEffect(() => {
    setLocalRole(role);
  }, [role]);

  const handleCapabilityBatchChange = (
    ids: string[],
    field: CapabilityField,
    value: boolean,
  ) => {
    const nextCapabilities = { ...(localRole.capabilities ?? {}) };
    ids.forEach((id) => {
      const current = nextCapabilities[id] ?? {
        visible: false,
        editable: false,
      };
      const nextState = { ...current, [field]: value };
      if (field === 'visible' && !value) {
        nextState.editable = false;
      }
      if (field === 'editable' && value) {
        nextState.visible = true;
      }
      nextCapabilities[id] = nextState;
    });
    setLocalRole({ ...localRole, capabilities: nextCapabilities });
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          type="text"
          value={localRole.roleLabel ?? ''}
          onChange={(e) => {
            const newLabel = e.target.value;
            setLocalRole({ ...localRole, roleLabel: newLabel });
            onRoleChange(role.localId, newLabel);
          }}
          disabled={!canEdit}
          placeholder="Nome ruolo (es. Operatore Finanza)"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => onSave(localRole)}
          disabled={!canEdit || saveStatus === 'saving'}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saveStatus === 'saving' ? 'Salvataggio...' : 'Salva'}
        </button>
      </div>

      {isAdminRole(localRole.roleLabel) && (
        <div className="mb-4 rounded-lg border border-blue-900/50 bg-blue-950/20 p-3">
          <p className="text-sm font-medium text-blue-200">Ruolo Admin</p>
          <p className="mt-1 text-xs text-blue-300/80">
            Gli utenti con ruolo Admin hanno automaticamente tutti i permessi
            abilitati.
          </p>
        </div>
      )}

      {!isAdminRole(localRole.roleLabel) && (
        <>
          <div className="mb-3 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-3">
            <p className="text-xs font-semibold text-zinc-200">
              Come configurare i permessi:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>Espandi le sezioni cliccando sulla freccia ▶</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>
                  <strong>Visibile</strong>: gli utenti con questo ruolo possono
                  vedere il campo/widget
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>
                  <strong>Modificabile</strong>: gli utenti con questo ruolo
                  possono modificare il campo/widget
                </span>
              </li>
            </ul>
          </div>
          <div className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 max-h-[600px] space-y-3 overflow-y-auto pr-2">
            {PERMISSION_TREE.map((node) => (
              <PermissionTreeBranch
                key={`${localRole.localId}-${node.id}`}
                node={node}
                role={localRole}
                canEditRole={canEdit}
                onToggle={handleCapabilityBatchChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type PermissionTreeBranchProps = {
  node: PermissionTreeNode;
  role: EditableRole;
  canEditRole: boolean;
  onToggle: (ids: string[], field: CapabilityField, value: boolean) => void;
  depth?: number;
};

const getLeafIdsForNode = (node: PermissionTreeNode): string[] => {
  if (!node.children || node.children.length === 0) {
    return [node.id];
  }
  return node.children.flatMap(getLeafIdsForNode);
};

const computeTriState = (
  capabilities: PermissionCapabilities | undefined | null,
  leafIds: string[],
  field: CapabilityField,
  nodeId?: string, // Optional: ID of the intermediate node itself
): TriState => {
  if (!capabilities) return 'unchecked';

  // First check if the node itself has a capability (for intermediate nodes)
  if (nodeId && capabilities[nodeId]) {
    const nodeValue = capabilities[nodeId][field] ?? false;
    // If node has explicit capability, use it as the base value
    // Then check if all configured children match
    if (leafIds.length > 0) {
      // Get only children that have explicit capabilities in DB
      const childValues = leafIds
        .map((id) => capabilities[id]?.[field])
        .filter((v) => v !== undefined); // Only check explicitly configured children

      if (childValues.length === 0) {
        // No children configured, use node value
        return nodeValue ? 'checked' : 'unchecked';
      }

      // Some children configured - check if they match the node value
      const allMatch = childValues.every((v) => v === nodeValue);
      return allMatch ? (nodeValue ? 'checked' : 'unchecked') : 'indeterminate';
    }
    return nodeValue ? 'checked' : 'unchecked';
  }

  // If no node capability, check only leaf children
  if (leafIds.length === 0) return 'unchecked';
  const values = leafIds.map((id) => capabilities[id]?.[field] ?? false);
  const allTrue = values.every((v) => v === true);
  const allFalse = values.every((v) => v === false);
  if (allTrue) return 'checked';
  if (allFalse) return 'unchecked';
  return 'indeterminate';
};

function PermissionTreeBranch({
  node,
  role,
  canEditRole,
  onToggle,
  depth = 0,
}: PermissionTreeBranchProps) {
  const leafIds = getLeafIdsForNode(node);
  const isLeaf = !node.children || node.children.length === 0;
  const visibilityState = computeTriState(
    role.capabilities,
    leafIds,
    'visible',
    isLeaf ? undefined : node.id, // Pass node.id for intermediate nodes
  );
  const editableState = computeTriState(
    role.capabilities,
    leafIds,
    'editable',
    isLeaf ? undefined : node.id, // Pass node.id for intermediate nodes
  );

  const handleVisibilityChange = (checked: boolean) => {
    // Include the parent node ID if it's not a leaf (has children)
    const idsToToggle = isLeaf ? leafIds : [node.id, ...leafIds];
    onToggle(idsToToggle, 'visible', checked);
  };
  const handleEditableChange = (checked: boolean) => {
    // Include the parent node ID if it's not a leaf (has children)
    const idsToToggle = isLeaf ? leafIds : [node.id, ...leafIds];
    onToggle(idsToToggle, 'editable', checked);
  };

  if (isLeaf) {
    return (
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/30 px-4 py-3 transition-colors hover:border-zinc-600/50 hover:bg-zinc-900/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{node.label}</p>
            {node.description ? (
              <p className="mt-1 text-xs text-zinc-400">{node.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <TriStateCheckbox
              state={visibilityState}
              label="Visibile"
              disabled={!canEditRole}
              onChange={handleVisibilityChange}
            />
            <TriStateCheckbox
              state={editableState}
              label="Modificabile"
              disabled={!canEditRole || visibilityState === 'unchecked'}
              onChange={handleEditableChange}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <details className="group rounded-lg border border-zinc-700/50 bg-zinc-900/20 transition-colors hover:border-zinc-600/50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-900/30 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-xs text-zinc-500 transition-transform group-open:rotate-90">
            ▶
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-200">{node.label}</p>
            {node.description ? (
              <p className="mt-1 text-xs text-zinc-400">{node.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <TriStateCheckbox
            state={visibilityState}
            label="Visibile"
            disabled={!canEditRole}
            onChange={handleVisibilityChange}
          />
          <TriStateCheckbox
            state={editableState}
            label="Modificabile"
            disabled={!canEditRole}
            onChange={handleEditableChange}
          />
        </div>
      </summary>
      <div className="mt-2 ml-2 space-y-2 border-l-2 border-zinc-800/50 pb-3 pl-4">
        {node.children?.map((child) => (
          <PermissionTreeBranch
            key={`${role.localId}-${child.id}`}
            node={child}
            role={role}
            canEditRole={canEditRole}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  );
}

type TriStateCheckboxProps = {
  state: TriState;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function TriStateCheckbox({
  state,
  label,
  disabled,
  onChange,
}: TriStateCheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === 'indeterminate';
    }
  }, [state]);

  const getStateColor = () => {
    if (disabled) return 'text-zinc-600';
    if (state === 'checked') return 'text-green-300';
    if (state === 'indeterminate') return 'text-yellow-300';
    return 'text-zinc-400';
  };

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 text-xs font-medium ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${getStateColor()}`}
    >
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed"
        checked={state === 'checked'}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        onPointerDownCapture={(event) => event.stopPropagation()}
      />
      <span className="select-none">{label}</span>
    </label>
  );
}
