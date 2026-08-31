import React, { useState } from 'react';
import { Lock, ShieldCheck, Key, AlertTriangle, Check } from 'lucide-react';
import { NeoModal } from '../ui/NeoModal';
import { NeoButton } from '../ui/NeoButton';
import { NeoInput } from '../ui/NeoInput';
import { usePinLock } from '../../context/PinLockContext';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isChangingPin?: boolean;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  isChangingPin = false,
}) => {
  const { enablePin, disablePin, isPinEnabled, autoLockTimeoutMs, updateTimeout } = usePinLock();

  const [step, setStep] = useState<'create' | 'confirm' | 'current' | 'timeout'>('create');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(autoLockTimeoutMs);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const resetForm = () => {
    setStep(isChangingPin ? 'current' : 'create');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccessMsg('');
  };

  const handleNext = () => {
    setError('');
    if (step === 'create') {
      if (!/^\d{6}$/.test(newPin)) {
        setError('PIN must be exactly 6 numeric digits');
        return;
      }
      setStep('confirm');
    } else if (step === 'confirm') {
      if (newPin !== confirmPin) {
        setError('PIN confirmation does not match');
        return;
      }
      handleSavePin();
    }
  };

  const handleSavePin = async () => {
    setIsSubmitting(true);
    setError('');
    const success = await enablePin(newPin, timeoutMs);
    setIsSubmitting(false);

    if (success) {
      setSuccessMsg('6-Digit Security PIN successfully configured!');
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1200);
    } else {
      setError('Failed to save PIN in cloud. Please check connection.');
    }
  };

  const handleDisablePin = async () => {
    if (!/^\d{6}$/.test(currentPin)) {
      setError('Please enter your valid 6-digit current PIN');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const success = await disablePin(currentPin);
    setIsSubmitting(false);

    if (success) {
      setSuccessMsg('Security PIN disabled');
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } else {
      setError('Incorrect current PIN');
    }
  };

  const timeoutOptions = [
    { label: 'Immediate (on tab switch / minimize)', value: 0 },
    { label: '1 Minute of inactivity', value: 60000 },
    { label: '5 Minutes of inactivity', value: 300000 },
    { label: '15 Minutes of inactivity', value: 900000 },
  ];

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title={isPinEnabled ? 'MANAGE SECURITY PIN' : 'ENABLE 6-DIGIT PIN LOCK'}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Success Alert */}
        {successMsg && (
          <div className="bg-[#05DF72] text-[#121212] p-3 border-2 border-[#121212] shadow-neo-sm font-black text-sm flex items-center gap-2">
            <Check size={18} strokeWidth={3} />
            {successMsg}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-[#FF4343] text-white p-3 border-2 border-[#121212] shadow-neo-sm font-bold text-xs flex items-center gap-2">
            <AlertTriangle size={16} strokeWidth={3} />
            {error}
          </div>
        )}

        {!isPinEnabled ? (
          /* Step 1 & 2: Setup New PIN */
          <div className="flex flex-col gap-4">
            <p className="text-xs font-bold text-neutral-700">
              Set up a 6-digit PIN to lock your finances when inactive. Data is securely hashed in the cloud.
            </p>

            {step === 'create' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
                  Enter 6-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="neo-input text-center text-2xl tracking-[0.5em] font-mono py-3"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <NeoButton variant="outline" onClick={onClose}>
                    Cancel
                  </NeoButton>
                  <NeoButton variant="primary" onClick={handleNext} disabled={newPin.length !== 6}>
                    Next
                  </NeoButton>
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
                  Confirm 6-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="neo-input text-center text-2xl tracking-[0.5em] font-mono py-3"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <NeoButton variant="outline" onClick={() => setStep('create')}>
                    Back
                  </NeoButton>
                  <NeoButton
                    variant="secondary"
                    onClick={handleSavePin}
                    disabled={confirmPin.length !== 6 || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Activate PIN'}
                  </NeoButton>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Manage Existing PIN: Change PIN, Update Timeout, or Disable */
          <div className="flex flex-col gap-4">
            {/* Auto Lock Timeout Selector */}
            <div className="flex flex-col gap-1.5 p-3 bg-neutral-50 border-2 border-[#121212]">
              <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
                Auto-Lock Inactivity Timer
              </label>
              <select
                value={timeoutMs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTimeoutMs(val);
                  updateTimeout(val);
                }}
                className="neo-input py-2 text-xs font-bold"
              >
                {timeoutOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Disable PIN Section */}
            <div className="flex flex-col gap-2 p-3 bg-red-50 border-2 border-[#FF4343]">
              <span className="text-xs font-black text-[#FF4343] uppercase tracking-wider">
                Disable Security PIN
              </span>
              <p className="text-[11px] font-semibold text-neutral-600">
                Enter your current 6-digit PIN to turn off PIN protection.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Current PIN"
                  className="neo-input py-1.5 text-center tracking-widest font-mono text-sm"
                />
                <NeoButton
                  variant="danger"
                  size="sm"
                  onClick={handleDisablePin}
                  disabled={currentPin.length !== 6 || isSubmitting}
                >
                  Disable
                </NeoButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </NeoModal>
  );
};
