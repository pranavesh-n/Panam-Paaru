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
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={twMerge('flex items-center gap-2.5 select-none cursor-pointer group', className)}>
      {/* Neo-Brutalist Geometric PP Badge */}
      <div
        className={twMerge(
          'relative bg-[#FFE600] border-[2.5px] border-[#121212] shadow-neo-sm flex items-center justify-center p-1 font-black shrink-0 transition-transform group-hover:scale-105',
          iconSizes[size]
        )}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current text-[#121212]">
          {/* First P */}
          <path d="M 18 15 H 52 C 68 15 72 25 72 40 C 72 55 68 65 52 65 H 32 V 88 H 18 Z" />
          <path d="M 32 30 H 48 C 55 30 58 35 58 40 C 58 45 55 50 48 50 H 32 Z" fill="#FFE600" />
          {/* Second overlapping accent P in Green */}
          <rect x="42" y="44" width="44" height="12" fill="#05DF72" stroke="#121212" strokeWidth="4" />
          <line x1="12" y1="50" x2="60" y2="50" stroke="#FFE600" strokeWidth="6" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className={twMerge('font-black uppercase tracking-tight leading-none text-[#121212]', titleSizes[size])}>
          PANAM <span className="bg-[#FFE600] px-1.5 py-0.5 border-2 border-[#121212] shadow-neo-sm">PAARU</span>
        </span>
        {showSubtitle && (
          <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-600 uppercase mt-0.5">
            பணம் பாரு · See Your Money
          </span>
        )}
      </div>
    </div>
  );
};
