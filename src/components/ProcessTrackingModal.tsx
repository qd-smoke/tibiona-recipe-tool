'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './Button';
import { useSetToast } from '@/state/ToastProvider';
import { apiClient } from '@/helpers/api';
import type { Process, ProcessTracking, Production } from '@/types';

type ProcessTrackingModalProps = {
  recipeId: number;
  processes: Process[];
  onClose: () => void;
  activeProduction?: Production | null;
};

type ProcessState = {
  processId: number;
  state: 'not_started' | 'in_progress' | 'completed';
  trackingId?: number;
  startedAt?: string;
  durationSeconds?: number;
};

export function ProcessTrackingModal({
  recipeId,
  processes,
  onClose,
  activeProduction,
}: ProcessTrackingModalProps) {
  const setToast = useSetToast();
  const [productionId, setProductionId] = useState<number | null>(null);
  const [processStates, setProcessStates] = useState<ProcessState[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalTime, setTotalTime] = useState<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set production from prop
  useEffect(() => {
    if (activeProduction && !productionId) {
      setProductionId(activeProduction.id);
    }
  }, [activeProduction, productionId]);

  // Initialize process states
  useEffect(() => {
    if (processes.length > 0) {
      setProcessStates(
        processes.map((proc) => ({
          processId: proc.id,
          state: 'not_started',
        })),
      );
    }
  }, [processes]);

  // Load tracking for selected production
  useEffect(() => {
    if (!productionId) return;

    const fetchTracking = async () => {
      try {
        const response = (await apiClient.get(
          `/api/recipes/${recipeId}/processes/tracking?productionId=${productionId}`,
        )) as { tracking: ProcessTracking[] };

        const tracking = response.tracking || [];
        setProcessStates((prev) =>
          prev.map((ps) => {
            const track = tracking.find((t) => t.processId === ps.processId);
            if (!track) return ps;

            if (track.endedAt) {
              return {
                processId: ps.processId,
                state: 'completed',
                trackingId: track.id,
                startedAt: track.startedAt,
                durationSeconds: track.durationSeconds || 0,
              };
            } else {
              return {
                processId: ps.processId,
                state: 'in_progress',
                trackingId: track.id,
                startedAt: track.startedAt,
              };
            }
          }),
        );
      } catch (e) {
        console.error('Failed to fetch tracking', e);
      }
    };

    fetchTracking();
  }, [recipeId, productionId]);

  // Timer for in-progress processes
  useEffect(() => {
    const updateTimers = () => {
      setProcessStates((prev) =>
        prev.map((ps) => {
          if (ps.state === 'in_progress' && ps.startedAt) {
            const started = new Date(ps.startedAt).getTime();
            const now = Date.now();
            const durationSeconds = Math.floor((now - started) / 1000);
            return { ...ps, durationSeconds };
          }
          return ps;
        }),
      );
    };

    timerIntervalRef.current = setInterval(updateTimers, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Calculate total time
  useEffect(() => {
    const total = processStates.reduce((sum, ps) => {
      if (ps.durationSeconds) {
        return sum + ps.durationSeconds;
      }
      return sum;
    }, 0);
    setTotalTime(total);
  }, [processStates]);

  const handleStartProcess = useCallback(
    async (processId: number) => {
      if (!productionId) {
        setToast('Seleziona una produzione prima di avviare un processo', {
          type: 'error',
        });
        return;
      }

      setLoading(true);
      try {
        const response = (await apiClient.post(
          `/api/recipes/${recipeId}/processes/tracking`,
          {
            productionId,
            processId,
            action: 'start',
          },
        )) as { tracking: ProcessTracking };

        setProcessStates((prev) =>
          prev.map((ps) =>
            ps.processId === processId
              ? {
                  processId,
                  state: 'in_progress',
                  trackingId: response.tracking.id,
                  startedAt: response.tracking.startedAt,
                }
              : ps,
          ),
        );

        setToast('Processo avviato', { type: 'success' });
      } catch (e) {
        console.error('Failed to start process', e);
        setToast(
          e instanceof Error ? e.message : "Errore nell'avvio del processo",
          { type: 'error' },
        );
      } finally {
        setLoading(false);
      }
    },
    [recipeId, productionId, setToast],
  );

  const handleStopProcess = useCallback(
    async (processId: number) => {
      if (!productionId) {
        return;
      }

      setLoading(true);
      try {
        const response = (await apiClient.post(
          `/api/recipes/${recipeId}/processes/tracking`,
          {
            productionId,
            processId,
            action: 'stop',
          },
        )) as { tracking: ProcessTracking };

        setProcessStates((prev) =>
          prev.map((ps) =>
            ps.processId === processId
              ? {
                  processId,
                  state: 'completed',
                  trackingId: response.tracking.id,
                  startedAt: response.tracking.startedAt,
                  durationSeconds: response.tracking.durationSeconds || 0,
                }
              : ps,
          ),
        );

        setToast('Processo fermato', { type: 'success' });
      } catch (e) {
        console.error('Failed to stop process', e);
        setToast(
          e instanceof Error ? e.message : 'Errore nella fermata del processo',
          { type: 'error' },
        );
      } finally {
        setLoading(false);
      }
    },
    [recipeId, productionId, setToast],
  );

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">
            Tracciamento Processi
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

        <div className="space-y-4">
          {/* Production info */}
          {activeProduction ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="space-y-2 text-sm text-gray-300">
                <div>
                  <span className="font-medium">Produzione:</span>{' '}
                  {activeProduction.productionLot || 'In corso'}
                </div>
                <div>
                  <span className="font-medium">Iniziata il:</span>{' '}
                  {new Date(activeProduction.startedAt).toLocaleString('it-IT')}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 p-4">
              <p className="text-sm text-yellow-200">
                Nessuna produzione attiva. Avvia una produzione prima di
                tracciare i processi.
              </p>
            </div>
          )}

          {/* Process list */}
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {processes.map((proc) => {
              const state = processStates.find(
                (ps) => ps.processId === proc.id,
              );
              const currentState = state?.state || 'not_started';

              return (
                <div
                  key={proc.id}
                  className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-100">{proc.name}</h3>
                      {currentState === 'in_progress' &&
                        state?.durationSeconds !== undefined && (
                          <p className="mt-1 text-sm text-gray-400">
                            Tempo: {formatTime(state.durationSeconds)}
                          </p>
                        )}
                      {currentState === 'completed' &&
                        state?.durationSeconds !== undefined && (
                          <p className="mt-1 text-sm text-gray-400">
                            Completato in: {formatTime(state.durationSeconds)}
                          </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                      {currentState === 'not_started' && (
                        <Button
                          variant="primary"
                          onClick={() => handleStartProcess(proc.id)}
                          disabled={loading || !productionId}
                        >
                          Avvia
                        </Button>
                      )}
                      {currentState === 'in_progress' && (
                        <Button
                          variant="secondary"
                          onClick={() => handleStopProcess(proc.id)}
                          disabled={loading}
                        >
                          Ferma
                        </Button>
                      )}
                      {currentState === 'completed' && (
                        <span className="rounded-md bg-green-600 px-3 py-1 text-sm text-white">
                          Completato
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total time */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-100">Tempo Totale:</span>
              <span className="text-lg font-semibold text-gray-100">
                {formatTime(totalTime)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
