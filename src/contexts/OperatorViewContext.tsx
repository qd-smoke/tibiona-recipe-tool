'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { PermissionCapabilities, AppRole } from '@/types';

type OperatorViewContextType = {
  isOperatorView: boolean;
  toggleOperatorView: () => void;
  getEffectiveCapabilities: (
    capabilities: PermissionCapabilities | null | undefined,
  ) => PermissionCapabilities | null | undefined;
};

const OperatorViewContext = createContext<OperatorViewContextType | undefined>(
  undefined,
);

export function OperatorViewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOperatorView, setIsOperatorView] = useState(false);
  const [operatorCapabilities, setOperatorCapabilities] =
    useState<PermissionCapabilities | null>(null);

  // Carica le capabilities del ruolo "operator" quando la Vista Operatore è attivata
  useEffect(() => {
    if (isOperatorView && !operatorCapabilities) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/roles', { credentials: 'include' });
          if (!cancelled && res.ok) {
            const data = await res.json();
            if (data?.ok && Array.isArray(data.data)) {
              const operatorRole = data.data.find(
                (role: AppRole) => role.roleLabel === 'operator',
              );
              if (operatorRole?.capabilities) {
                setOperatorCapabilities(operatorRole.capabilities);
              }
            }
          }
        } catch (e) {
          console.warn(
            '[OperatorViewContext] Failed to load operator capabilities',
            e,
          );
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [isOperatorView, operatorCapabilities]);

  const toggleOperatorView = useCallback(() => {
    setIsOperatorView((prev) => {
      const newValue = !prev;
      // Reset operator capabilities when disabling operator view
      if (!newValue) {
        setOperatorCapabilities(null);
      }
      return newValue;
    });
  }, []);

  const getEffectiveCapabilities = useCallback(
    (
      capabilities: PermissionCapabilities | null | undefined,
    ): PermissionCapabilities | null | undefined => {
      // Se Vista Operatore è attiva, restituisci le capabilities del ruolo "operator"
      if (isOperatorView) {
        return operatorCapabilities ?? {};
      }
      // Altrimenti restituisci capabilities normali
      return capabilities;
    },
    [isOperatorView, operatorCapabilities],
  );

  return (
    <OperatorViewContext.Provider
      value={{
        isOperatorView,
        toggleOperatorView,
        getEffectiveCapabilities,
      }}
    >
      {children}
    </OperatorViewContext.Provider>
  );
}

export function useOperatorView() {
  const context = useContext(OperatorViewContext);
  if (context === undefined) {
    throw new Error(
      'useOperatorView must be used within an OperatorViewProvider',
    );
  }
  return context;
}
