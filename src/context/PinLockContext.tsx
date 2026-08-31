import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface PinLockContextType {
  isLocked: boolean;
  isPinEnabled: boolean;
  isPinLoading: boolean;
  autoLockTimeoutMs: number;
  lockNow: () => void;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  enablePin: (pin: string, timeoutMs?: number) => Promise<boolean>;
  disablePin: (currentPin: string) => Promise<boolean>;
  updateTimeout: (timeoutMs: number) => Promise<boolean>;
  isLockout: boolean;
}

const PinLockContext = createContext<PinLockContextType | undefined>(undefined);

export const PinLockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Cloud query for PIN status
  const pinStatus = useQuery(api.pin.getPinStatus);
  const verifyPinMutation = useMutation(api.pin.verifyPin);
  const setPinMutation = useMutation(api.pin.setPin);
  const disablePinMutation = useMutation(api.pin.disablePin);
  const setAutoLockTimeoutMutation = useMutation(api.pin.setAutoLockTimeout);

  const isPinLoading = pinStatus === undefined;
  const isPinEnabled = Boolean(pinStatus?.pinEnabled);
  const autoLockTimeoutMs = pinStatus?.autoLockTimeoutMs ?? 300000;
  const isLockout = Boolean(pinStatus?.isLockedOut);

  // Initialize lock state synchronously from session cache or default to locked until verified
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      // If user previously had PIN enabled in this browser, start locked immediately
      return sessionStorage.getItem('panam_pin_configured') === 'true';
    } catch {
      return false;
    }
  });
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  // Sync with cloud pinStatus as soon as query resolves
  useEffect(() => {
    if (pinStatus !== undefined && !hasInitialized) {
      if (pinStatus?.pinEnabled) {
        setIsLocked(true);
        try {
          sessionStorage.setItem('panam_pin_configured', 'true');
        } catch {}
      } else {
        setIsLocked(false);
        try {
          sessionStorage.removeItem('panam_pin_configured');
        } catch {}
      }
      setHasInitialized(true);
    }
  }, [pinStatus, hasInitialized]);

  const lockNow = useCallback(() => {
    if (isPinEnabled) {
      setIsLocked(true);
    }
  }, [isPinEnabled]);

  // Handle visibility change (tab switch or mobile app backgrounding)
  useEffect(() => {
    if (!isPinEnabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (autoLockTimeoutMs === 0) {
          // Immediate lock on minimize/tab-switch
          setIsLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPinEnabled, autoLockTimeoutMs]);

  // Handle idle activity timeout
  useEffect(() => {
    if (!isPinEnabled || isLocked || autoLockTimeoutMs <= 0) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, autoLockTimeoutMs);
    };

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isPinEnabled, isLocked, autoLockTimeoutMs]);

  const unlockWithPin = async (pin: string): Promise<{ success: boolean; message?: string }> => {
    try {
      if (verifyPinMutation) {
        const res = await verifyPinMutation({ pin });
        if (res?.success) {
          setIsLocked(false);
          return { success: true };
        }
        return { success: false, message: res?.message || "Incorrect PIN" };
      }
      if (pin.length === 6) {
        setIsLocked(false);
        return { success: true };
      }
      return { success: false, message: "Invalid PIN" };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to verify PIN" };
    }
  };

  const enablePin = async (pin: string, timeoutMs = 300000): Promise<boolean> => {
    try {
      if (setPinMutation) {
        await setPinMutation({ pin, autoLockTimeoutMs: timeoutMs });
      }
      try {
        sessionStorage.setItem('panam_pin_configured', 'true');
      } catch {}
      return true;
    } catch (err) {
      console.error("Failed to enable PIN", err);
      return false;
    }
  };

  const disablePin = async (currentPin: string): Promise<boolean> => {
    try {
      if (disablePinMutation) {
        await disablePinMutation({ currentPin });
      }
      try {
        sessionStorage.removeItem('panam_pin_configured');
      } catch {}
      setIsLocked(false);
      return true;
    } catch (err) {
      console.error("Failed to disable PIN", err);
      return false;
    }
  };

  const updateTimeout = async (timeoutMs: number): Promise<boolean> => {
    try {
      if (setAutoLockTimeoutMutation) {
        await setAutoLockTimeoutMutation({ autoLockTimeoutMs: timeoutMs });
      }
      return true;
    } catch (err) {
      console.error("Failed to update auto lock timeout", err);
      return false;
    }
  };

  return (
    <PinLockContext.Provider
      value={{
        isLocked,
        isPinEnabled,
        isPinLoading,
        autoLockTimeoutMs,
        lockNow,
        unlockWithPin,
        enablePin,
        disablePin,
        updateTimeout,
        isLockout,
      }}
    >
      {children}
    </PinLockContext.Provider>
  );
};

export const usePinLock = () => {
  const context = useContext(PinLockContext);
  if (!context) {
    throw new Error("usePinLock must be used within a PinLockProvider");
  }
  return context;
};
