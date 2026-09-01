import React from 'react';
import { twMerge } from 'tailwind-merge';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={twMerge('flex items-center gap-2.5 select-none cursor-pointer group', className)}>
      {/* High-Impact Neo-Brutalist Monogram Badge */}
      <div
        className={twMerge(
          'relative bg-[#FFE600] border-[2.5px] border-[#121212] shadow-neo-sm flex items-center justify-center font-black font-mono shrink-0 transition-transform group-hover:scale-105 group-hover:shadow-neo',
          iconSizes[size]
        )}
      >
        <span className="text-[#121212] font-black tracking-tighter">
          ப
        </span>
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#05DF72] border border-[#121212]" />
      </div>

      {/* Brand Title Lockup */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={twMerge('font-black uppercase tracking-tight text-[#121212]', titleSizes[size])}>
            PANAM
          </span>
          <span className={twMerge('font-black uppercase tracking-tight text-[#121212] bg-[#FFE600] px-1 py-0.5 border border-[#121212] leading-none', titleSizes[size])}>
            PAARU
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-600 uppercase mt-1">
            பணம் பாரு · See Your Money
          </span>
        )}
      </div>
    </div>
  );
};
