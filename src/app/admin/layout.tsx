import React from 'react';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';

import { UserWidget } from '@/components/UserWidget';
import { OperatorViewProvider } from '@/contexts/OperatorViewContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { AdminNavigation } from '@/components/AdminNavigation';
import { getCurrentProfile } from '@/lib/auth/currentUser';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore(); // Prevent caching to avoid serialization issues
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    // If profile loading fails, continue without profile
    // User will be redirected by middleware if authentication is required
    console.error('[AdminLayout] Failed to load profile:', error);
    if (error instanceof Error) {
      console.error('[AdminLayout] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
  }

  return (
    <ProfileProvider profile={profile}>
      <OperatorViewProvider>
        <div className="flex min-h-screen flex-col">
          <header className="w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mx-auto flex w-full items-center gap-4 px-4 py-2">
              <Link
                href="/recipes"
                className="shrink-0 text-xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                <div
                  className="logo text-center text-5xl font-extrabold"
                  aria-label="MixLab"
                >
                  <span className="text-blue-500">M</span>
                  <span className="text-red-400">i</span>
                  <span className="text-yellow-500">x</span>
                  <span className="text-blue-500">L</span>
                  <span className="text-green-600">a</span>
                  <span className="text-red-400">b</span>
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <AdminNavigation
                  profileCapabilities={profile?.capabilities}
                  roleLabel={profile?.roleLabel}
                />
              </div>
              <div className="shrink-0">
                <UserWidget profile={profile} />
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </OperatorViewProvider>
    </ProfileProvider>
  );
}
