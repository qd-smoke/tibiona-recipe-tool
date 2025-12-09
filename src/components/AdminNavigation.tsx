'use client';

import React from 'react';
import Link from 'next/link';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { canView } from '@/lib/permissions/check';
import type { PermissionCapabilities } from '@/types';
import { OperatorViewToggle } from './OperatorViewToggle';
import { isAdminRole } from '@/constants/roles';

type AdminNavigationProps = {
  profileCapabilities: PermissionCapabilities | null | undefined;
  roleLabel: string | null | undefined;
};

export function AdminNavigation({
  profileCapabilities,
  roleLabel,
}: AdminNavigationProps) {
  const { getEffectiveCapabilities, isOperatorView } = useOperatorView();
  const effectiveCapabilities = getEffectiveCapabilities(profileCapabilities);
  const isAdmin = isAdminRole(roleLabel);

  const showPermissionsLink = canView(
    effectiveCapabilities,
    'admin.permissions',
    isOperatorView,
  );
  const showCostsLink = canView(
    effectiveCapabilities,
    'admin.costs.standard',
    isOperatorView,
  );
  const showParametersLink = canView(
    effectiveCapabilities,
    'admin.parameters.standard',
    isOperatorView,
  );
  const showLotDecodeLink = canView(
    effectiveCapabilities,
    'production.lot.decode',
    isOperatorView,
  );
  const showExcelRxLink = canView(
    effectiveCapabilities,
    'admin.navigation.excelrx',
    isOperatorView,
  );
  const showProductionHistoryLink = canView(
    effectiveCapabilities,
    'admin.production.history',
    isOperatorView,
  );
  const showMetadataLink = canView(
    effectiveCapabilities,
    'admin.permissions',
    isOperatorView,
  );

  // Admin should see all links regardless of permissions
  const showAllForAdmin = isAdmin && !isOperatorView;

  const hasVisibleLink =
    showExcelRxLink ||
    showCostsLink ||
    showParametersLink ||
    showPermissionsLink ||
    showProductionHistoryLink ||
    showLotDecodeLink ||
    showMetadataLink;

  // Always render navigation if user is admin (to show operator view toggle)
  if (!hasVisibleLink && !showAllForAdmin && !isAdmin) {
    return null;
  }

  return (
    <nav className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 shadow-inner dark:border-zinc-800/80 dark:bg-zinc-950/40">
      <ul className="flex items-center gap-3 overflow-x-auto px-2 text-sm font-semibold tracking-wide whitespace-nowrap text-zinc-600 uppercase dark:text-zinc-400">
        {showExcelRxLink || showAllForAdmin ? (
          <li>
            <a
              href="https://tool.tibiona.it/excelrx/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              ExcelRx
            </a>
          </li>
        ) : null}
        {showCostsLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/costs/standard"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Costi
            </Link>
          </li>
        ) : null}
        {showParametersLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/parameters/standard"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Parametri
            </Link>
          </li>
        ) : null}
        {showPermissionsLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/permissions"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Permissions
            </Link>
          </li>
        ) : null}
        {showProductionHistoryLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/production/history"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Storico Produzioni
            </Link>
          </li>
        ) : null}
        {showLotDecodeLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/production/lot-decode"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Decodifica Lotto
            </Link>
          </li>
        ) : null}
        {showMetadataLink || showAllForAdmin ? (
          <li>
            <Link
              href="/admin/recipes/metadata"
              className="inline-flex items-center rounded-full px-4 py-1.5 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Categorie & Clienti
            </Link>
          </li>
        ) : null}
        {isAdmin ? (
          <li className="ml-auto">
            <OperatorViewToggle />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
