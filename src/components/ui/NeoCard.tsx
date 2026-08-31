import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface NeoCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'yellow' | 'green' | 'red' | 'purple' | 'cyan' | 'dark';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  isPatterned?: boolean;
}

export const NeoCard: React.FC<NeoCardProps> = ({
  children,
  variant = 'white',
  shadow = 'md',
  isPatterned = false,
  className,
  ...props
}) => {
  const bgStyles = {
    white: 'bg-white text-[#121212]',
    yellow: 'bg-[#FFE600] text-[#121212]',
    green: 'bg-[#05DF72] text-[#121212]',
    red: 'bg-[#FF4343] text-white',
    purple: 'bg-[#9B51E0] text-white',
    cyan: 'bg-[#00F0FF] text-[#121212]',
    dark: 'bg-[#121212] text-white',
  };

  const shadowStyles = {
    none: 'shadow-none',
    sm: 'shadow-neo-sm',
    md: 'shadow-neo',
    lg: 'shadow-neo-lg',
    xl: 'shadow-neo-xl',
  };

  return (
    <div
      className={twMerge(
        'border-[3px] border-[#121212] transition-all',
        bgStyles[variant],
        shadowStyles[shadow],
        isPatterned && 'neo-pattern-stripes',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
