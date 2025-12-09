'use client';

'use client';

import React from 'react';
import { useOperatorView } from '@/contexts/OperatorViewContext';

export function OperatorViewToggle() {
  const { isOperatorView, toggleOperatorView } = useOperatorView();

  return (
    <button
      type="button"
      onClick={toggleOperatorView}
      className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        isOperatorView
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
      }`}
      title={
        isOperatorView ? 'Disattiva Vista Operatore' : 'Attiva Vista Operatore'
      }
    >
      {isOperatorView ? 'Vista Operatore ON' : 'Vista Operatore'}
    </button>
  );
}
