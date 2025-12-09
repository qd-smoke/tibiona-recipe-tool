'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { useSetToast } from '@/state/ToastProvider';
import { apiClient } from '@/helpers/api';
import type { Production } from '@/types';

type ProductionModalProps = {
  recipeId: number;
  isOpen: boolean;
  onClose: () => void;
  onProductionStarted: (production: Production) => void;
  onProductionFinished: () => void;
  activeProduction: Production | null;
};

export function ProductionModal({
  recipeId,
  isOpen,
  onClose,
  onProductionStarted,
  onProductionFinished,
  activeProduction,
}: ProductionModalProps) {
  const setToast = useSetToast();
  const [startedAt, setStartedAt] = useState(
    new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
  );
  const [notes, setNotes] = useState('');
  const [finishNotes, setFinishNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartProduction = async () => {
    setLoading(true);
    try {
      const body: Record<string, string> = {
        startedAt: new Date(startedAt).toISOString(),
      };
      if (notes.trim()) {
        body.notes = notes.trim();
      }
      const response = (await apiClient.post(
        `/api/recipes/${recipeId}/production/start`,
        body,
      )) as { ok?: boolean; production?: Production; error?: string };

      if (response?.ok && response.production) {
        setToast('Produzione avviata con successo', { type: 'success' });
        onProductionStarted(response.production);
        setStartedAt(new Date().toISOString().slice(0, 16));
        setNotes('');
        onClose();
      } else {
        throw new Error(response?.error || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('Failed to start production', error);
      setToast(
        error instanceof Error
          ? error.message
          : "Errore durante l'avvio della produzione",
        { type: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinishProduction = async () => {
    if (!activeProduction) return;

    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (finishNotes.trim()) {
        body.notes = finishNotes.trim();
      }
      const response = (await apiClient.post(
        `/api/recipes/${recipeId}/production/${activeProduction.id}/finish`,
        body,
      )) as { ok?: boolean; production?: Production; error?: string };

      if (response?.ok && response.production) {
        setToast('Produzione terminata con successo', { type: 'success' });
        onProductionFinished();
        setFinishNotes('');
        onClose();
      } else {
        throw new Error(response?.error || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('Failed to finish production', error);
      setToast(
        error instanceof Error
          ? error.message
          : 'Errore durante la terminazione della produzione',
        { type: 'error' },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">
            {activeProduction ? 'Termina Produzione' : 'Avvia Produzione'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {activeProduction ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="space-y-2 text-sm text-gray-300">
                <div>
                  <span className="font-medium">Lotto:</span>{' '}
                  {activeProduction.productionLot}
                </div>
                <div>
                  <span className="font-medium">Iniziata il:</span>{' '}
                  {new Date(activeProduction.startedAt).toLocaleString('it-IT')}
                </div>
                {activeProduction.notes && (
                  <div>
                    <span className="font-medium">Note:</span>{' '}
                    {activeProduction.notes}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="finish-notes"
                className="block text-sm font-medium text-gray-300"
              >
                Note di chiusura (opzionale)
              </label>
              <textarea
                id="finish-notes"
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100"
                rows={3}
                placeholder="Aggiungi note sulla produzione..."
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleFinishProduction}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Terminazione...' : 'Termina Produzione'}
              </Button>
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="started-at"
                className="block text-sm font-medium text-gray-300"
              >
                Data e Ora Inizio
              </label>
              <input
                id="started-at"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">
                Il lotto verrà generato automaticamente alla fine della
                produzione
              </p>
            </div>

            <div>
              <label
                htmlFor="start-notes"
                className="block text-sm font-medium text-gray-300"
              >
                Note (opzionale)
              </label>
              <textarea
                id="start-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100"
                rows={3}
                placeholder="Aggiungi note sulla produzione..."
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleStartProduction}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Avvio...' : 'Avvia Produzione'}
              </Button>
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
