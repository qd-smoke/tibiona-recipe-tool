'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  PermissionProfile,
  PermissionProfileInput,
  AppRole,
} from '@/types';
import { BRAND_OPTIONS } from '@/constants/permissionSections';
import { useSetToast } from '@/state/ToastProvider';

type EditableUser = PermissionProfileInput & {
  id?: number;
  localId: string;
  createdAt?: string;
  updatedAt?: string;
  isNew?: boolean;
  hasPassword?: boolean;
  newPassword?: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const createLocalId = () => Math.random().toString(36).slice(2, 10);

const emptyUser = (): EditableUser => ({
  localId: `new-${createLocalId()}`,
  username: '',
  displayName: '',
  brand: BRAND_OPTIONS[0].id,
  roleLabel: '',
  roleId: null,
  avatarUrl: '',
  defaultSection: '',
  notes: '',
  isNew: true,
  hasPassword: false,
  newPassword: '',
  mustChangePassword: true,
});

const normalizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, '');

type UsersTabProps = {
  canEditUsers: boolean;
};

export function UsersTab({ canEditUsers }: UsersTabProps) {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [_search, _setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveState>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{
    userId: number;
    username: string;
    newPassword: string;
    confirmPassword: string;
    error?: string;
  } | null>(null);
  const setToast = useSetToast();

  useEffect(() => {
    if (hasLoaded) return; // Only load once

    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        // Load users
        const usersRes = await fetch('/api/permissions', {
          method: 'GET',
          credentials: 'include',
        });
        if (!usersRes.ok) {
          console.error(
            '[UsersTab] Failed to load users:',
            usersRes.status,
            usersRes.statusText,
          );
          if (active)
            setMessage(
              `Errore nel caricamento utenti: ${usersRes.status} ${usersRes.statusText}`,
            );
          return;
        }
        const usersData = await usersRes.json().catch(() => null);

        // Load roles
        const rolesRes = await fetch('/api/roles', {
          method: 'GET',
          credentials: 'include',
        });
        const rolesData = await rolesRes.json().catch(() => null);

        if (!active) return;

        if (usersData?.ok) {
          const list: PermissionProfile[] = usersData.data ?? [];
          setUsers(
            list.map((user) => ({
              ...user,
              localId: `u-${user.id}`,
              roleId: user.roleId ?? null,
              newPassword: '',
            })),
          );
        }

        if (rolesData?.ok) {
          setRoles(rolesData.data ?? []);
        }

        if (active) setHasLoaded(true);
      } catch (error) {
        console.error('[UsersTab] Load error:', error);
        if (active) setMessage('Errore di rete');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [hasLoaded]);

  const updateUser = (
    localId: string,
    updater: (user: EditableUser) => EditableUser,
  ) => {
    setUsers((prev) =>
      prev.map((user) => (user.localId === localId ? updater(user) : user)),
    );
  };

  const handleFieldChange = (
    localId: string,
    field: keyof EditableUser,
    value: boolean | string | number | null,
  ) => {
    updateUser(localId, (user) => ({
      ...user,
      [field]: value,
    }));
  };

  const handleUsernameChange = (localId: string, value: string) => {
    updateUser(localId, (user) => ({
      ...user,
      username: normalizeUsername(value),
    }));
  };

  const handleAddUser = () => {
    if (!canEditUsers) {
      setMessage('Non hai i permessi per creare utenti.');
      return;
    }
    setUsers((prev) => [emptyUser(), ...prev]);
    setMessage(null);
  };

  const persistUser = async (user: EditableUser) => {
    if (!canEditUsers) {
      setMessage('Non hai i permessi per modificare gli utenti.');
      return;
    }
    if (!user.username || !user.displayName) {
      setMessage('Username e Nome sono obbligatori.');
      setSaveStatus((prev) => ({ ...prev, [user.localId]: 'error' }));
      return;
    }
    setSaveStatus((prev) => ({ ...prev, [user.localId]: 'saving' }));
    setMessage(null);
    const payload: PermissionProfileInput = {
      id: user.id,
      username: user.username.toLowerCase(),
      displayName: user.displayName,
      brand: user.brand,
      roleLabel: user.roleLabel ?? '',
      roleId: user.roleId ?? null,
      avatarUrl: user.avatarUrl ?? '',
      defaultSection: user.defaultSection ?? '',
      notes: user.notes ?? '',
      mustChangePassword: user.mustChangePassword ?? false,
      newPassword: user.newPassword || undefined,
    };

    try {
      // Always use POST - the API handles both create and update based on profile.id
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setMessage(data?.error || 'Errore durante il salvataggio');
        setSaveStatus((prev) => ({ ...prev, [user.localId]: 'error' }));
        return;
      }
      setSaveStatus((prev) => ({ ...prev, [user.localId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [user.localId]: 'idle' }));
      }, 2000);
      if (user.isNew) {
        // Reload users
        const reloadRes = await fetch('/api/permissions');
        const reloadData = await reloadRes.json().catch(() => null);
        if (reloadData?.ok) {
          const list: PermissionProfile[] = reloadData.data ?? [];
          setUsers(
            list.map((u) => ({
              ...u,
              localId: `u-${u.id}`,
              roleId: u.roleId ?? null,
              newPassword: '',
            })),
          );
        }
      }
    } catch {
      setMessage('Errore di rete durante il salvataggio');
      setSaveStatus((prev) => ({ ...prev, [user.localId]: 'error' }));
    }
  };

  const filteredUsers = useMemo(() => {
    if (!_search.trim()) return users;
    const q = _search.toLowerCase();
    return users.filter(
      (user) =>
        user.username?.toLowerCase().includes(q) ||
        user.displayName?.toLowerCase().includes(q),
    );
  }, [users, _search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-zinc-400">Caricamento...</p>
      </div>
    );
  }

  const openPasswordModal = (user: EditableUser) => {
    if (!user.id) return;
    setPasswordModal({
      userId: user.id,
      username: user.username ?? '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const closePasswordModal = () => {
    setPasswordModal(null);
  };

  const handlePasswordReset = async () => {
    if (!passwordModal) return;
    const { userId, newPassword, confirmPassword } = passwordModal;
    if (newPassword.length < 6) {
      setPasswordModal((prev) =>
        prev
          ? { ...prev, error: 'La password deve avere almeno 6 caratteri' }
          : prev,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordModal((prev) =>
        prev ? { ...prev, error: 'Le password non coincidono' } : prev,
      );
      return;
    }
    try {
      const res = await fetch(`/api/permissions/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setPasswordModal((prev) =>
          prev
            ? { ...prev, error: data?.error || 'Errore durante il reset' }
            : prev,
        );
        return;
      }
      setToast('Password aggiornata con successo', { type: 'success' });
      closePasswordModal();
    } catch (error) {
      console.error('[UsersTab] Reset password error', error);
      setPasswordModal((prev) =>
        prev ? { ...prev, error: 'Errore di rete durante il reset' } : prev,
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-zinc-100">Gestione Utenti</h2>
        {canEditUsers && (
          <button
            type="button"
            onClick={handleAddUser}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            + Nuovo Utente
          </button>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/20 p-3 text-sm text-red-200">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <UserEditor
            key={user.localId}
            user={user}
            roles={roles}
            canEdit={canEditUsers}
            onFieldChange={handleFieldChange}
            onUsernameChange={handleUsernameChange}
            onSave={persistUser}
            saveStatus={saveStatus[user.localId] || 'idle'}
            onAdminResetPassword={openPasswordModal}
          />
        ))}
      </div>
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-6 text-sm text-zinc-100 shadow-xl">
            <h3 className="text-lg font-semibold">
              Reset password — {passwordModal.username}
            </h3>
            <p className="text-xs text-zinc-400">
              La nuova password sarà impostata senza chiedere la vecchia.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs">
                Nuova password
                <input
                  type="password"
                  value={passwordModal.newPassword}
                  onChange={(event) =>
                    setPasswordModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            newPassword: event.target.value,
                            error: undefined,
                          }
                        : prev,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </label>
              <label className="block text-xs">
                Conferma password
                <input
                  type="password"
                  value={passwordModal.confirmPassword}
                  onChange={(event) =>
                    setPasswordModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            confirmPassword: event.target.value,
                            error: undefined,
                          }
                        : prev,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </label>
            </div>
            {passwordModal.error && (
              <p className="mt-3 text-xs text-red-400">{passwordModal.error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs tracking-wide text-zinc-300 uppercase transition hover:border-zinc-500"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-950 uppercase transition hover:bg-amber-500"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type UserEditorProps = {
  user: EditableUser;
  roles: AppRole[];
  canEdit: boolean;
  onFieldChange: (
    localId: string,
    field: keyof EditableUser,
    value: boolean | string | number | null,
  ) => void;
  onUsernameChange: (localId: string, value: string) => void;
  onSave: (user: EditableUser) => void;
  saveStatus: SaveState;
  onAdminResetPassword?: (user: EditableUser) => void;
};

function UserEditor({
  user,
  roles,
  canEdit,
  onFieldChange,
  onUsernameChange,
  onSave,
  saveStatus,
  onAdminResetPassword,
}: UserEditorProps) {
  const selectedRole = roles.find((r) => r.id === user.roleId);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-300">
            Username
            <input
              value={user.username ?? ''}
              onChange={(e) => onUsernameChange(user.localId, e.target.value)}
              disabled={!canEdit || !!user.id}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-300">
            Nome
            <input
              value={user.displayName ?? ''}
              onChange={(e) =>
                onFieldChange(user.localId, 'displayName', e.target.value)
              }
              disabled={!canEdit}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-300">
            Brand
            <select
              value={user.brand ?? BRAND_OPTIONS[0].id}
              onChange={(e) =>
                onFieldChange(user.localId, 'brand', e.target.value)
              }
              disabled={!canEdit}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            >
              {BRAND_OPTIONS.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-300">
            Ruolo
            <select
              value={user.roleId ?? ''}
              onChange={(e) => {
                const selectedRoleId =
                  e.target.value === '' ? null : Number(e.target.value);
                const selectedRole = roles.find((r) => r.id === selectedRoleId);
                // Update both roleId and roleLabel when role changes
                onFieldChange(user.localId, 'roleId', selectedRoleId);
                onFieldChange(
                  user.localId,
                  'roleLabel',
                  selectedRole?.roleLabel || '',
                );
              }}
              disabled={!canEdit}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">Nessun ruolo</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.roleLabel}
                </option>
              ))}
            </select>
            {selectedRole && (
              <p className="mt-1 text-xs text-zinc-400">
                Ruolo: {selectedRole.roleLabel}
              </p>
            )}
          </label>
        </div>
        {!user.hasPassword && (
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Password temporanea
              <input
                type="password"
                value={user.newPassword ?? ''}
                onChange={(e) =>
                  onFieldChange(user.localId, 'newPassword', e.target.value)
                }
                disabled={!canEdit}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onSave(user)}
          disabled={!canEdit || saveStatus === 'saving'}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saveStatus === 'saving'
            ? 'Salvataggio...'
            : saveStatus === 'saved'
              ? 'Salvato!'
              : 'Salva'}
        </button>
        {onAdminResetPassword && user.id && (
          <button
            type="button"
            onClick={() => onAdminResetPassword(user)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold tracking-wide text-zinc-100 uppercase transition hover:border-amber-500 hover:text-amber-400"
          >
            Reset password
          </button>
        )}
      </div>
    </div>
  );
}
