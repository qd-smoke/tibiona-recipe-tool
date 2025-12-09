'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PermissionProfile } from '@/types';
import { canEdit, canView } from '@/lib/permissions/check';
import { RolesTab } from './RolesTab';
import { UsersTab } from './UsersTab';

export default function AdminPermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<PermissionProfile | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const meResponse = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (!meResponse.ok) {
          if (active) {
            if (meResponse.status === 401) {
              setMessage('Sessione non valida, verrai reindirizzato al login.');
              router.replace('/login');
            } else {
              setMessage('Sessione non valida.');
            }
          }
          return;
        }
        const meData = await meResponse.json().catch(() => null);
        if (!active) return;
        const meProfile: PermissionProfile | null = meData?.data ?? null;
        setCurrentUser(meProfile);
        if (!canView(meProfile?.capabilities, 'admin.permissions')) {
          setMessage('Non hai i permessi per visualizzare questa pagina.');
          return;
        }
      } catch {
        if (active) {
          setMessage('Errore di rete nel recupero profilo');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router]);

  const canViewPermissions = canView(
    currentUser?.capabilities,
    'admin.permissions',
  );
  const canEditPermissions = canEdit(
    currentUser?.capabilities,
    'admin.permissions',
  );
  const canEditRoles = canEditPermissions;
  const canEditUsers = canEditPermissions;

  if (loading) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          Caricamento...
        </div>
      </div>
    );
  }

  if (message && !canViewPermissions) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          {message}
        </div>
      </div>
    );
  }

  if (!canViewPermissions) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          Non hai i permessi per visualizzare questa pagina.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
      <header className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">
              Gestione Permessi
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Gestisci ruoli e utenti del sistema
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'roles'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Ruoli
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'users'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Utenti
          </button>
        </div>
      </header>

      {message && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {message}
        </div>
      )}

      {activeTab === 'roles' ? (
        <RolesTab canEditRoles={canEditRoles} />
      ) : (
        <UsersTab canEditUsers={canEditUsers} />
      )}
    </div>
  );
}
