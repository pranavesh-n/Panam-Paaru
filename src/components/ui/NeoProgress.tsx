import React from 'react';
import { twMerge } from 'tailwind-merge';

interface NeoProgressProps {
  value: number; // 0 to 100+
  max?: number;
  variant?: 'auto' | 'yellow' | 'green' | 'red' | 'cyan';
  className?: string;
  showPercent?: boolean;
}

export const NeoProgress: React.FC<NeoProgressProps> = ({
  value,
  max = 100,
  variant = 'auto',
  className,
  showPercent = false,
}) => {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);
  const isOver = value > max;

  let barColor = 'bg-[#FFE600]';
  if (variant === 'auto') {
    if (isOver || percentage >= 90) barColor = 'bg-[#FF4343]';
    else if (percentage >= 75) barColor = 'bg-[#FF8800]';
    else barColor = 'bg-[#05DF72]';
  } else {
    const colors = {
      yellow: 'bg-[#FFE600]',
      green: 'bg-[#05DF72]',
      red: 'bg-[#FF4343]',
      cyan: 'bg-[#00F0FF]',
    };
    barColor = colors[variant];
  }

  return (
    <div className={twMerge('w-full flex flex-col gap-1', className)}>
      <div className="w-full h-4 bg-white border-2 border-[#121212] overflow-hidden p-[2px] relative shadow-neo-sm">
        <div
          className={twMerge('h-full transition-all duration-300 border-r border-[#121212]', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercent && (
        <div className="flex justify-between items-center text-[10px] font-mono font-bold">
          <span>{percentage}% USED</span>
          {isOver && <span className="text-[#FF4343] font-black">OVER BUDGET!</span>}
        </div>
      )}
    </div>
  );
};
