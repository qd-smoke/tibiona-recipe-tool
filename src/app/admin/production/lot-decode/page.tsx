'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/contexts/ProfileContext';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { canView } from '@/lib/permissions/check';
import {
  decodeProductionLot,
  isValidLotFormat,
} from '@/lib/production/lotEncoder';
import type { LotData } from '@/lib/production/lotEncoder';

export default function LotDecodePage() {
  const router = useRouter();
  const { profile } = useProfile();
  const { getEffectiveCapabilities } = useOperatorView();
  const [lotInput, setLotInput] = useState('');
  const [decodedData, setDecodedData] = useState<LotData | null>(null);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [possibleRecipes, setPossibleRecipes] = useState<string[]>([]);
  const [possibleUsers, setPossibleUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decoding, setDecoding] = useState(false);

  const effectiveCapabilities = getEffectiveCapabilities(profile?.capabilities);
  const canDecode = canView(
    effectiveCapabilities,
    'production.lot.decode',
    false,
    profile?.roleLabel === 'operator',
  );

  useEffect(() => {
    if (!profile) {
      router.replace('/login');
      return;
    }
    if (!canDecode) {
      setError('Non hai i permessi per accedere a questa pagina.');
    }
    setLoading(false);
  }, [profile, canDecode, router]);

  const handleDecode = async () => {
    setError(null);
    setDecodedData(null);
    setRecipeName(null);
    setUserName(null);
    setPossibleRecipes([]);
    setPossibleUsers([]);

    const trimmedLot = lotInput.trim().toUpperCase();

    if (!trimmedLot) {
      setError('Inserisci un lotto da decodificare');
      return;
    }

    if (!isValidLotFormat(trimmedLot)) {
      setError(
        'Formato lotto non valido. Il lotto deve essere di 12 caratteri alfanumerici.',
      );
      return;
    }

    setDecoding(true);
    try {
      const response = await fetch('/api/production/lot-decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lot: trimmedLot }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante la decodifica');
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || 'Errore durante la decodifica');
      }

      // Decode locally for display
      const decoded = decodeProductionLot(trimmedLot);
      if (decoded) {
        setDecodedData(decoded);
        setRecipeName(data.data.recipeName);
        setUserName(data.data.userName);
        setPossibleRecipes(data.data.possibleRecipes || []);
        setPossibleUsers(data.data.possibleUsers || []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Errore durante la decodifica',
      );
    } finally {
      setDecoding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-zinc-600 dark:text-gray-200">Caricamento...</div>
    );
  }

  if (!canDecode) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
          <h2 className="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
            Accesso negato
          </h2>
          <p className="text-red-600 dark:text-red-300">
            {error || 'Non hai i permessi per accedere a questa pagina.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Decodifica Lotto Produzione
        </h1>

        <div className="mb-6 rounded-lg border border-zinc-300 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <label
            htmlFor="lot-input"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Inserisci il lotto (12 caratteri)
          </label>
          <div className="flex gap-2">
            <input
              id="lot-input"
              type="text"
              value={lotInput}
              onChange={(e) => setLotInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDecode();
                }
              }}
              placeholder="Es: PAMOH5XK1234"
              maxLength={12}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              onClick={handleDecode}
              disabled={decoding}
              className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {decoding ? 'Decodifica...' : 'Decodifica'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {decodedData && (
          <div className="rounded-lg border border-zinc-300 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Dati Decodificati
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Nome Ricetta:
                </span>{' '}
                <span className="text-zinc-900 dark:text-zinc-100">
                  {recipeName || (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {decodedData.recipeName} (iniziali - nome completo non
                      trovato)
                    </span>
                  )}
                </span>
                {!recipeName && possibleRecipes.length > 0 && (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Possibili ricette: {possibleRecipes.join(', ')}
                  </div>
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Nome Utente:
                </span>{' '}
                <span className="text-zinc-900 dark:text-zinc-100">
                  {userName || (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {decodedData.userName} (iniziali - nome completo non
                      trovato)
                    </span>
                  )}
                </span>
                {!userName && possibleUsers.length > 0 && (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Possibili utenti: {possibleUsers.join(', ')}
                  </div>
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Data e Ora Inizio:
                </span>{' '}
                <span className="text-zinc-900 dark:text-zinc-100">
                  {decodedData.startedAt.toLocaleString('it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Data e Ora Fine:
                </span>{' '}
                <span className="text-zinc-900 dark:text-zinc-100">
                  {decodedData.finishedAt.toLocaleString('it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="mt-4 rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <strong>Durata:</strong>{' '}
                  {Math.round(
                    (decodedData.finishedAt.getTime() -
                      decodedData.startedAt.getTime()) /
                      (1000 * 60),
                  )}{' '}
                  minuti
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
