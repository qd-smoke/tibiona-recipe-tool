'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { PermissionProfile } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

type UserWidgetProps = {
  profile: PermissionProfile | null;
};

export function UserWidget({ profile }: UserWidgetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { darkMode, toggleTheme } = useTheme();

  if (!profile) return null;

  const handleLogout = async () => {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/login');
  };

  return (
    <div className="flex items-center gap-4 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-white">
      <Link
        href="/permissions"
        className="flex flex-col text-left leading-tight transition hover:text-blue-500"
      >
        <span className="font-semibold text-zinc-900 dark:text-white">
          {profile.displayName}
        </span>
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {profile.brand}
        </span>
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Preferenza tema ${darkMode ? 'chiaro' : 'scuro'}`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white/80 text-zinc-700 transition hover:border-blue-500 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-blue-400"
      >
        {darkMode ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.93 4.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M4.93 19.07l1.41-1.41" />
            <path d="M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="rounded-full border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-200"
      >
        {loading ? '...' : 'Logout'}
      </button>
    </div>
  );
}
