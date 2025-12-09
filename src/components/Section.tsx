import React from 'react';

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-xl border border-zinc-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-gray-100">
          {title}
        </h2>
        {action ? action : null}
      </div>
      {children}
    </section>
  );
}
