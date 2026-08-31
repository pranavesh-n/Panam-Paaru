import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (enabled: boolean) => void;
  formatPrivateAmount: (amount: number | string, symbol?: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('panam_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('panam_privacy_mode', String(isPrivacyMode));
    } catch {}
  }, [isPrivacyMode]);

  const togglePrivacyMode = () => {
    if (navigator.vibrate) navigator.vibrate(15);
    setIsPrivacyMode((prev) => !prev);
  };

  const setPrivacyMode = (enabled: boolean) => {
    setIsPrivacyMode(enabled);
  };

  const formatPrivateAmount = (amount: number | string, symbol = '₹'): string => {
    if (isPrivacyMode) {
      return '••••••';
    }
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${symbol}0.00`;
    return `${symbol}${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        togglePrivacyMode,
        setPrivacyMode,
        formatPrivateAmount,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
