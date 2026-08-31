import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ShieldAlert, KeyRound, LogOut } from 'lucide-react';
import { usePinLock } from '../../context/PinLockContext';
import { BrandLogo } from '../layout/BrandLogo';
import { NeoButton } from '../ui/NeoButton';
import { useAuthActions } from '@convex-dev/auth/react';

export const PinLockScreen: React.FC = () => {
  const { isLocked, unlockWithPin, isLockout } = usePinLock();
  const { signOut } = useAuthActions();
  
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length < 6 && !isVerifying) {
      setErrorMsg('');
      setPin((prev) => prev + digit);
    }
  }, [pin, isVerifying]);

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !isVerifying) {
      setErrorMsg('');
      setPin((prev) => prev.slice(0, -1));
    }
  }, [pin, isVerifying]);

  const handleClear = useCallback(() => {
    if (!isVerifying) {
      setErrorMsg('');
      setPin('');
    }
  }, [isVerifying]);

  // Physical keyboard listener for desktop users
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, handleDigit, handleDelete, handleClear]);

  // Auto-verify as soon as 6 digits are typed
  useEffect(() => {
    if (pin.length === 6 && !isVerifying) {
      const verify = async () => {
        setIsVerifying(true);
        const result = await unlockWithPin(pin);
        setIsVerifying(false);

        if (!result.success) {
          setErrorMsg(result.message || 'Incorrect 6-digit PIN');
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 500);
        } else {
          setPin('');
          setErrorMsg('');
        }
      };

      verify();
    }
  }, [pin, isVerifying, unlockWithPin]);

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#FFFDF5] flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-200">
      {/* Background Neo-Brutalist Pattern */}
      <div className="absolute inset-0 neo-pattern-stripes opacity-40 pointer-events-none" />

      {/* Main Lock Card */}
      <div className="relative w-full max-w-sm bg-white border-[3px] border-[#121212] shadow-neo-xl p-6 sm:p-8 flex flex-col items-center z-10">
        
        {/* Brand Header */}
        <div className="mb-4">
          <BrandLogo size="md" showSubtitle={false} />
        </div>

        {/* Lock Shield Badge */}
        <div className="flex items-center gap-2 bg-[#FFE600] px-3 py-1 border-2 border-[#121212] shadow-neo-sm mb-4">
          <Lock size={16} className="text-[#121212]" strokeWidth={3} />
          <span className="text-xs font-black uppercase tracking-wider text-[#121212]">
            SECURITY PIN LOCKED
          </span>
        </div>

        <p className="text-xs font-bold text-neutral-600 mb-6 text-center">
          Enter your 6-digit PIN to access your cloud finances
        </p>

        {/* 6-Digit Indicator Bubbles */}
        <div className={`flex gap-3 mb-6 ${isShaking ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-9 h-11 border-[3px] border-[#121212] flex items-center justify-center transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#05DF72] shadow-neo-sm scale-105'
                    : 'bg-[#FFFDF5] shadow-none'
                }`}
              >
                {isFilled && (
                  <div className="w-3.5 h-3.5 bg-[#121212] rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Feedback */}
        {errorMsg ? (
          <div className="w-full bg-[#FF4343] text-white text-xs font-black p-2 border-2 border-[#121212] shadow-neo-sm flex items-center gap-2 mb-4 animate-in fade-in">
            <ShieldAlert size={16} strokeWidth={3} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : isLockout ? (
          <div className="w-full bg-[#FFE600] text-[#121212] text-xs font-black p-2 border-2 border-[#121212] shadow-neo-sm flex items-center gap-2 mb-4">
            <ShieldAlert size={16} strokeWidth={3} className="shrink-0" />
            <span>Temporarily locked out due to failed attempts</span>
          </div>
        ) : null}

        {/* Neo-Brutalist 3x4 Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              disabled={isVerifying || isLockout}
              className="neo-btn bg-white hover:bg-[#FFE600] text-[#121212] font-mono text-xl font-black py-3 border-2 border-[#121212] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            onClick={handleClear}
            disabled={isVerifying || pin.length === 0}
            className="neo-btn bg-neutral-100 hover:bg-neutral-200 text-[#121212] text-xs font-black py-3 border-2 border-[#121212] shadow-neo-sm cursor-pointer"
          >
            C
          </button>

          {/* 0 Button */}
          <button
            onClick={() => handleDigit('0')}
            disabled={isVerifying || isLockout}
            className="neo-btn bg-white hover:bg-[#FFE600] text-[#121212] font-mono text-xl font-black py-3 border-2 border-[#121212] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            onClick={handleDelete}
            disabled={isVerifying || pin.length === 0}
            className="neo-btn bg-[#FF4343] hover:bg-[#FF5C5C] text-white flex items-center justify-center py-3 border-2 border-[#121212] shadow-neo-sm cursor-pointer"
          >
            <Delete size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Emergency Sign Out Button */}
        <div className="w-full pt-2 border-t-2 border-neutral-200 flex justify-center">
          <button
            onClick={() => signOut()}
            className="text-xs font-bold text-neutral-500 hover:text-[#FF4343] flex items-center gap-1.5 cursor-pointer underline transition-colors"
          >
            <LogOut size={13} />
            Sign Out / Switch Account
          </button>
        </div>

      </div>
    </div>
  );
};
