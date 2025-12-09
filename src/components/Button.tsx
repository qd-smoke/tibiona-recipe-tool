import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'plain';
type IconPosition = 'left' | 'right';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  children?: React.ReactNode;
}

const getVariantClasses = (variant: ButtonVariant): string => {
  switch (variant) {
    case 'primary':
      return 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border-blue-600 hover:border-blue-700';
    case 'secondary':
      return 'bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white border-gray-600 hover:border-gray-700';
    case 'plain':
      return 'bg-transparent hover:bg-gray-700 active:bg-gray-800 text-gray-100 border-gray-600 hover:border-gray-500';
    default:
      return 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border-blue-600 hover:border-blue-700';
  }
};

export function Button({
  variant = 'primary',
  icon,
  iconPosition = 'left',
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const hasText = Boolean(children);
  const hasIcon = Boolean(icon);
  const isCircleButton = hasIcon && !hasText;

  const baseClasses =
    'inline-flex items-center justify-center font-medium border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900';

  const sizeClasses = isCircleButton
    ? 'w-10 h-10 rounded-full p-0'
    : 'px-4 py-2 rounded-lg min-h-10';

  const variantClasses = getVariantClasses(variant);

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer';

  const combinedClasses = twMerge(
    clsx(baseClasses, sizeClasses, variantClasses, disabledClasses, className),
  );

  const renderContent = () => {
    if (isCircleButton) {
      return icon;
    }

    if (!hasIcon) {
      return children;
    }

    if (iconPosition === 'left') {
      return (
        <>
          <span className="mr-2">{icon}</span>
          {children}
        </>
      );
    }

    return (
      <>
        {children}
        <span className="ml-2">{icon}</span>
      </>
    );
  };

  return (
    <button className={combinedClasses} disabled={disabled} {...props}>
      {renderContent()}
    </button>
  );
}
