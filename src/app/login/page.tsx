'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginPage() {
  const router = useRouter();
  const { darkMode, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/status', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!active) return;
        const data = await res.json().catch(() => null);
        if (data?.authenticated) {
          router.replace('/recipes');
        }
      } catch (error) {
        console.warn('[login] unable to verify existing session', error);
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const loginData = { username, password, remember };

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData),
      });

      const data = await res.json().catch(() => null);

      setLoading(false);

      if (!res.ok || !data?.ok) {
        const errorMsg = data?.error || 'Credenziali non valide';
        setMessage(errorMsg);
        return;
      }

      router.replace('/recipes');
    } catch {
      setLoading(false);
      setMessage('Errore di connessione. Riprova.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#e3e7ec] px-4 py-10">
      <div
        className={`mx-auto flex max-w-xl flex-col gap-6 rounded-[32px] border p-8 shadow-2xl ${darkMode ? 'border-white/10 bg-zinc-900/80 text-white' : 'border-black/10 bg-white/80 text-zinc-900'} backdrop-blur-xl`}
        suppressHydrationWarning
      >
        <header className="text-center">
          <p className="text-xs tracking-[0.4em] text-blue-500 uppercase">
            MixLab Portal
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Accedi</h1>
          <p className="text-sm opacity-70">
            Inserisci le credenziali fornite dal team per continuare.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-200">
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="text-xs text-zinc-700 dark:text-zinc-300">
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-white"
              required
            />
          </label>
          <label className="text-xs text-zinc-700 dark:text-zinc-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-white"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ricordami per 7 giorni
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Accesso in corso...' : 'Entra'}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleTheme}
          className="mx-auto text-xs text-zinc-600 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          suppressHydrationWarning
        >
          {darkMode ? 'Modalità chiara' : 'Modalità scura'}
        </button>
      </div>
    </div>
  );
}
