'use client';
import React from 'react';

type InlineEditableCellProps = {
  value: string | number | null | undefined;
  onSave: (value: string | number | null) => Promise<void>;
  type?: 'text' | 'select';
  options?: Array<{ id: number; name: string }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayValue?: string; // Custom display value (e.g., for select showing name instead of id)
};

export function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  options = [],
  placeholder = '',
  disabled = false,
  className = '',
  displayValue,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState<string>(
    value?.toString() || '',
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const selectRef = React.useRef<HTMLSelectElement | null>(null);

  React.useEffect(() => {
    setEditValue(value?.toString() || '');
  }, [value]);

  React.useEffect(() => {
    if (isEditing) {
      if (type === 'text' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (type === 'select' && selectRef.current) {
        selectRef.current.focus();
      }
    }
  }, [isEditing, type]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || '');
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (disabled || isSaving) return;

    const trimmedValue = editValue.trim();
    let valueToSave: string | number | null = trimmedValue;

    // For select, convert string to number if it's a valid option ID
    if (type === 'select') {
      const numValue = Number(trimmedValue);
      if (trimmedValue === '' || trimmedValue === 'null') {
        valueToSave = null;
      } else if (Number.isFinite(numValue) && numValue > 0) {
        valueToSave = numValue;
      } else {
        setError('Invalid selection');
        return;
      }
    }

    // Check if value actually changed
    const currentValue = value?.toString() || '';
    if (valueToSave?.toString() === currentValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(valueToSave);
      setIsEditing(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
      // Keep editing mode open on error so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Delay to allow click on select dropdown
    setTimeout(() => {
      if (type === 'select' && selectRef.current?.matches(':focus-within')) {
        return; // Don't close if select is still focused
      }
      handleSave();
    }, 200);
  };

  if (isEditing) {
    if (type === 'select') {
      return (
        <div className="relative">
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isSaving || disabled}
            className={`w-full rounded border border-blue-500 bg-white px-2 py-1 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-100 ${className}`}
          >
            <option value="">Nessuna categoria</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {isSaving && (
            <div className="absolute top-1/2 right-2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
            </div>
          )}
          {error && (
            <div className="absolute -bottom-5 left-0 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving || disabled}
          placeholder={placeholder}
          className={`w-full rounded border border-blue-500 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${className}`}
        />
        {isSaving && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
          </div>
        )}
        {error && (
          <div className="absolute -bottom-5 left-0 text-xs text-red-500">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Display mode
  const displayText =
    displayValue !== undefined
      ? displayValue
      : type === 'select' && value
        ? options.find((opt) => opt.id === Number(value))?.name || 'Nessuna'
        : value?.toString() || placeholder || '—';

  return (
    <div
      onClick={handleStartEdit}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleStartEdit();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`cursor-pointer rounded px-2 py-1 text-sm transition-colors hover:bg-blue-50 hover:text-zinc-900 dark:hover:bg-blue-500/5 dark:hover:text-white ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
      title={disabled ? '' : 'Click to edit'}
    >
      {displayText}
    </div>
  );
}
