import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const NeoModal: React.FC<NeoModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div
        className={twMerge(
          'relative w-full bg-white border-[3px] border-[#121212] shadow-neo-xl z-10 animate-in fade-in zoom-in-95 duration-150',
          maxWidthStyles[maxWidth]
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-[#FFE600] px-4 py-3 border-b-[3px] border-[#121212]">
          <h3 className="text-base font-black uppercase tracking-wider text-[#121212] flex items-center gap-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-[#FF4343] hover:text-white border-2 border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
