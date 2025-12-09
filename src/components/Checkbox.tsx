import * as React from 'react';

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  indeterminate?: boolean;
  containerClassName?: string;
  label?: React.ReactNode;
  boxClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

// A11y-friendly custom styled checkbox that preserves a native input under the hood.
// - Supports controlled and uncontrolled usage.
// - Supports the indeterminate visual state via prop.
// - Forwards ref to the native input (needed to focus or read .indeterminate from parent if desired).
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      containerClassName,
      indeterminate,
      disabled,
      checked,
      defaultChecked,
      label,
      boxClassName,
      activeClassName,
      inactiveClassName,
      ...rest
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    // Determine visual state from props (prefer controlled "checked" when provided)
    const isChecked = !!(checked ?? defaultChecked);

    const boxBase = `block ${boxClassName ?? 'h-4 w-4'} rounded border transition-colors duration-150 ease-out`;
    const checkedClass = activeClassName ?? 'border-blue-600 bg-blue-600';
    const uncheckedClass = inactiveClassName ?? 'border-zinc-600 bg-zinc-900';
    const boxColors = disabled
      ? 'border-zinc-700 bg-zinc-800/60'
      : isChecked
        ? checkedClass
        : uncheckedClass;

    return (
      <label
        className={`inline-flex items-center gap-2 select-none ${containerClassName ?? ''}`}
      >
        <span className="relative z-0 inline-flex h-4 w-4">
          {/* The real input (accessible, focusable). Kept full-size but invisible. */}
          <input
            {...rest}
            ref={inputRef}
            type="checkbox"
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            className={`absolute inset-0 h-4 w-4 cursor-pointer appearance-none opacity-0 ${className ?? ''}`}
          />

          {/* Visual box */}
          <span
            aria-hidden
            className={`${boxBase} ${boxColors} ${boxClassName ?? ''}`}
          >
            {/* Focus ring (using sibling focus-visible) */}
          </span>

          {/* Checkmark / dash overlay */}
          {indeterminate ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="h-0.5 w-2.5 rounded bg-white/95" />
            </span>
          ) : isChecked ? (
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="pointer-events-none absolute -top-px -left-px h-5 w-5 text-white"
            >
              <path
                d="M7.5 13.5 4.5 10.5 3 12l4.5 4.5L17 7l-1.5-1.5z"
                fill="currentColor"
                strokeWidth="1.2"
                stroke="currentColor"
                transform="translate(2.5, 1.5) scale(0.7)"
              />
            </svg>
          ) : null}
        </span>
        {label != null ? (
          <span
            className={
              disabled ? 'text-sm text-zinc-500' : 'text-sm text-zinc-200'
            }
          >
            {label}
          </span>
        ) : null}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
