import React from 'react';
import { IngredientNutritionAttributes } from '@/types';

export default function NutritionTooltip({
  nutritionData,
  className,
  ariaLabel = 'Nutrition info',
}: {
  nutritionData?: IngredientNutritionAttributes;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const tipId = React.useId();
  const rootRef = React.useRef<HTMLSpanElement | null>(null);

  const items = React.useMemo(() => {
    if (!nutritionData) return [];
    const def = [
      { key: 'kcal', label: 'kcal | Kcal' },
      { key: 'kj', label: 'kJ | Kj' },
      { key: 'protein', label: 'Protein | Proteine' },
      { key: 'carbo', label: 'Carbohydrates | Carboidrati' },
      { key: 'sugar', label: 'Sugar | di cui Zuccheri' },
      { key: 'fiber', label: 'Fiber | Fibre' },
      { key: 'fat', label: 'Fat | Grassi' },
      { key: 'saturi', label: 'Saturated Fat | di cui Saturi' },
      { key: 'salt', label: 'Salt | Sale' },
      { key: 'polioli', label: 'Polioli | di cui Polioli' },
    ] as const;

    const fmtVal = (obj?: { value?: number; unit?: string }) => {
      if (!obj) return undefined;
      const { value, unit } = obj;
      if (value === undefined || value === null) return undefined;
      const v = Number.isFinite(value) ? value : value;
      return `${v}${unit ? ` ${unit}` : ''}`;
    };

    return def
      .map(({ key, label }) => {
        const raw = (nutritionData as never)[key] as
          | { value?: number; unit?: string }
          | undefined;
        const display = fmtVal(raw);
        return display ? { label, value: display } : null;
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  }, [nutritionData]);

  const hasData = items.length > 0;

  // Close on the outside click when pinned/open
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={'relative inline-flex ' + (className || '')}>
      <button
        type="button"
        className={
          'cursor-pointer rounded-full border border-gray-600 bg-gray-800 px-1.5 text-xs text-gray-200 shadow-sm ring-offset-0 outline-none hover:bg-gray-700 focus:ring-2 focus:ring-blue-500'
        }
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={tipId}
        aria-pressed={pinned}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={() => {
          // Toggle "pinned" state; ensure tooltip is open when pinning
          setPinned((prev) => {
            const next = !prev;
            if (next) setOpen(true);
            return next;
          });
        }}
      >
        i
      </button>

      {open && (
        <div
          id={tipId}
          role="tooltip"
          className="absolute -top-2 left-1/2 z-50 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-gray-700 bg-gray-900/95 p-3 text-sm text-gray-100 shadow-lg backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-gray-100">Nutrition</span>
            <span className="text-[10px] tracking-wide text-gray-400 uppercase">
              per 100g
            </span>
          </div>

          {hasData ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {items.map((it) => (
                <React.Fragment key={it.label}>
                  <dt className="text-gray-300">{it.label}</dt>
                  <dd className="text-right font-medium text-gray-100">
                    {it.value}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          ) : (
            <div className="text-gray-400">No nutrition data</div>
          )}

          <div className="pointer-events-none absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-gray-700 bg-gray-900/95" />
        </div>
      )}
    </span>
  );
}
