'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PERMISSION_SECTIONS } from '@/constants/permissionSections';
import type { PermissionProfile } from '@/types';
import { canEdit, canView } from '@/lib/permissions/check';
import { useTheme } from '@/contexts/ThemeContext';

type ChangePwdStatus = 'idle' | 'saving' | 'success' | 'error';

export default function PermissionsPortal() {
  const router = useRouter();
  const { darkMode, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<PermissionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changePwd, setChangePwd] = useState({
    current: '',
    next: '',
    confirm: '',
    status: 'idle' as ChangePwdStatus,
    message: '',
  });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (!active) return;
        if (!data?.ok) {
          setError(data?.error || 'Errore durante il caricamento profilo');
          return;
        }
        setProfile(data.data);
        setError(null);
      } catch {
        if (active) setError('Errore di rete');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  const allowedSectionCards = useMemo(() => {
    if (!profile) return [];
    const allowed = new Set(profile.allowedSections || []);
    return PERMISSION_SECTIONS.filter((section) => allowed.has(section.id));
  }, [profile]);

  const canViewPortalWidget = (widgetId: string) =>
    canView(profile?.capabilities, widgetId);
  const canEditPortalWidget = (widgetId: string) =>
    canEdit(profile?.capabilities, widgetId);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/login');
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (changePwd.next !== changePwd.confirm) {
      setChangePwd((prev) => ({
        ...prev,
        status: 'error',
        message: 'Le nuove password non coincidono',
      }));
      return;
    }
    setChangePwd((prev) => ({ ...prev, status: 'saving', message: '' }));
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        currentPassword: changePwd.current,
        newPassword: changePwd.next,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setChangePwd((prev) => ({
        ...prev,
        status: 'error',
        message: data?.error || 'Errore durante il cambio password',
      }));
      return;
    }
    setChangePwd({
      current: '',
      next: '',
      confirm: '',
      status: 'success',
      message: 'Password aggiornata correttamente',
    });
    setProfile((prev) =>
      prev ? { ...prev, mustChangePassword: false } : prev,
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#e3e7ec] px-4 py-10 text-zinc-900">
      <div
        className={`mx-auto flex max-w-4xl flex-col gap-8 rounded-[32px] border p-8 shadow-xl ${darkMode ? 'border-white/10 bg-zinc-900/80 text-white' : 'border-black/10 bg-white/70 text-zinc-900'} backdrop-blur-xl`}
      >
        {canViewPortalWidget('portal.overview') ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.4em] text-blue-500 uppercase">
                Portal
              </p>
              <h1 className="text-3xl font-semibold">
                {profile
                  ? `Benvenuto, ${profile.displayName}`
                  : 'Caricamento...'}
              </h1>
              <p className="text-sm opacity-70">
                Visualizza solo le sezioni abilitate dal pannello Admin.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/recipes"
                className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wider uppercase ${
                  darkMode
                    ? 'bg-blue-500/20 text-blue-100 hover:bg-blue-500/30'
                    : 'bg-blue-600/10 text-blue-700 hover:bg-blue-600/20'
                }`}
              >
                Vai alle ricette
              </Link>
              <button
                type="button"
                onClick={toggleTheme}
                className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wider uppercase ${darkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-zinc-600'}`}
              >
                Tema {darkMode ? 'Light' : 'Dark'}
              </button>
              {profile ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-red-300/60 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-transparent bg-black/5 px-4 py-6 text-center text-sm opacity-70 dark:bg-white/5">
            Caricamento profilo...
          </div>
        ) : profile ? (
          <>
            {profile.mustChangePassword &&
            canViewPortalWidget('portal.banner') ? (
              <div className="rounded-2xl border border-yellow-500/60 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                È necessario aggiornare la password prima di continuare.
              </div>
            ) : null}

            {canViewPortalWidget('portal.sections') ? (
              <section
                className={`rounded-2xl border px-6 py-6 ${darkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white/80'}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.4em] text-blue-500 uppercase">
                      Profilo
                    </p>
                    <h2 className="text-2xl font-semibold">
                      {profile.displayName}
                    </h2>
                    <p className="text-sm opacity-70">
                      {profile.username} · {profile.brand}
                    </p>
                  </div>
                  <div className="text-right text-xs tracking-widest uppercase opacity-60">
                    Sezioni abilitate
                  </div>
                </header>

                {allowedSectionCards.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-zinc-300/50 px-4 py-6 text-center text-sm opacity-70">
                    Nessuna sezione assegnata dal team Admin.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {allowedSectionCards.map((section) => (
                      <div
                        key={section.id}
                        className={`rounded-xl border px-4 py-4 ${darkMode ? 'border-white/10 bg-white/5' : 'border-black/5 bg-white'}`}
                      >
                        <div className="text-xl">
                          {section.icon} {section.title}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-300">
                          {section.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {canViewPortalWidget('portal.password') ? (
              <section
                className={`rounded-2xl border px-6 py-6 ${darkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white/80'}`}
              >
                <h3 className="text-lg font-semibold text-zinc-100">
                  Cambia password
                </h3>
                <fieldset
                  disabled={!canEditPortalWidget('portal.password')}
                  aria-disabled={!canEditPortalWidget('portal.password')}
                  className="mt-4"
                >
                  <form
                    className="grid gap-3 md:grid-cols-2"
                    onSubmit={handlePasswordSubmit}
                  >
                    <label className="text-xs text-zinc-400 md:col-span-2">
                      Password corrente
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={changePwd.current}
                        onChange={(e) =>
                          setChangePwd((prev) => ({
                            ...prev,
                            current: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-zinc-400">
                      Nuova password
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        value={changePwd.next}
                        onChange={(e) =>
                          setChangePwd((prev) => ({
                            ...prev,
                            next: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-zinc-400">
                      Conferma nuova password
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        value={changePwd.confirm}
                        onChange={(e) =>
                          setChangePwd((prev) => ({
                            ...prev,
                            confirm: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={changePwd.status === 'saving'}
                        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                      >
                        {changePwd.status === 'saving'
                          ? 'Salvataggio...'
                          : 'Aggiorna password'}
                      </button>
                      {changePwd.message ? (
                        <span
                          className={`ml-3 text-xs ${
                            changePwd.status === 'success'
                              ? 'text-green-300'
                              : 'text-red-300'
                          }`}
                        >
                          {changePwd.message}
                        </span>
                      ) : null}
                    </div>
                  </form>
                </fieldset>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
