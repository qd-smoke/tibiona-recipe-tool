import React from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function CollapsibleSection({
  title,
  children,
  defaultCollapsed = false,
  actions,
  className,
  contentClassName,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <div
      className={clsx(
        'w-full rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-lg font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-100 dark:hover:bg-gray-900/80 dark:focus-visible:ring-offset-gray-900"
        aria-expanded={!collapsed}
        aria-controls={`${title.replace(/\s+/g, '-').toLowerCase()}-content`}
      >
        <span className="flex-1 text-left">{title}</span>
        <span className="flex items-center gap-3">
          {actions}
          <ChevronDown
            className={clsx(
              'h-5 w-5 transition-transform duration-200',
              collapsed ? '-rotate-90' : 'rotate-0',
            )}
            aria-hidden="true"
          />
        </span>
      </button>
      <div
        id={`${title.replace(/\s+/g, '-').toLowerCase()}-content`}
        className={clsx(
          collapsed ? 'hidden' : 'block',
          'px-5 pt-2 pb-5',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
