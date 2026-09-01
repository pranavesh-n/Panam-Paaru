import React, { useState, useEffect } from 'react';
import { NeoModal } from '../ui/NeoModal';
import { NeoButton } from '../ui/NeoButton';
import { NeoInput } from '../ui/NeoInput';
import { Investment, AssetType } from '../../types';
import { TrendingUp, Coins, Layers, Calendar, DollarSign, Tag, Info } from 'lucide-react';

interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    assetType: AssetType;
    investedAmount: number;
    currentValue: number;
    units?: number;
    buyPrice?: number;
    currentPrice?: number;
    sipAmount?: number;
    sipDay?: number;
    notes?: string;
  }) => Promise<void>;
  initialData?: Investment | null;
  currencySymbol?: string;
}

const ASSET_TYPES: { label: string; value: AssetType; color: string; desc: string }[] = [
  { label: 'Mutual Funds', value: 'mutual_fund', color: '#00F0FF', desc: 'SIPs, Index Funds, ELSS, Flexi Cap' },
  { label: 'Stocks & Equity', value: 'stocks', color: '#FFE600', desc: 'Direct Shares, ETFs' },
  { label: 'Fixed Deposits & RDs', value: 'fd_rd', color: '#05DF72', desc: 'Bank FDs, Corporate FDs, RDs' },
  { label: 'Gold & Silver', value: 'gold', color: '#FFD700', desc: 'Digital Gold, Sovereign Gold Bonds, Silver' },
  { label: 'Crypto & Web3', value: 'crypto', color: '#9B51E0', desc: 'Bitcoin, Ethereum, Tokens' },
  { label: 'PPF & EPF', value: 'ppf_epf', color: '#FF8800', desc: 'Provident Fund, NPS, Retirement' },
  { label: 'Real Estate & Land', value: 'real_estate', color: '#FF4D8D', desc: 'Plots, Commercial, Residential' },
  { label: 'Other Assets', value: 'other', color: '#A0AEC0', desc: 'Bonds, P2P, Angel, Art' },
];

export const InvestmentModal: React.FC<InvestmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  currencySymbol = '₹',
}) => {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('mutual_fund');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [units, setUnits] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sipAmount, setSipAmount] = useState('');
  const [sipDay, setSipDay] = useState('5');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAssetType(initialData.assetType);
      setInvestedAmount(String(initialData.investedAmount));
      setCurrentValue(String(initialData.currentValue));
      setUnits(initialData.units ? String(initialData.units) : '');
      setBuyPrice(initialData.buyPrice ? String(initialData.buyPrice) : '');
      setSipAmount(initialData.sipAmount ? String(initialData.sipAmount) : '');
      setSipDay(initialData.sipDay ? String(initialData.sipDay) : '5');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setAssetType('mutual_fund');
      setInvestedAmount('');
      setCurrentValue('');
      setUnits('');
      setBuyPrice('');
      setSipAmount('');
      setSipDay('5');
      setNotes('');
    }
    setError('');
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numInvested = parseFloat(investedAmount);
    const numCurrent = currentValue ? parseFloat(currentValue) : numInvested;
    const numUnits = units ? parseFloat(units) : undefined;
    const numBuyPrice = buyPrice ? parseFloat(buyPrice) : undefined;
    const numSip = sipAmount ? parseFloat(sipAmount) : undefined;
    const numSipDay = sipDay ? parseInt(sipDay, 10) : undefined;

    if (!name.trim()) {
      setError('Please enter asset or investment name');
      return;
    }
    if (isNaN(numInvested) || numInvested < 0) {
      setError('Please enter a valid invested amount');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), 8000)
      );

      await Promise.race([
        onSubmit({
          name: name.trim(),
          assetType,
          investedAmount: numInvested,
          currentValue: !isNaN(numCurrent) ? numCurrent : numInvested,
          units: numUnits,
          buyPrice: numBuyPrice,
          sipAmount: numSip,
          sipDay: numSipDay,
          notes: notes.trim() || undefined,
        }),
        timeoutPromise,
      ]);

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to save investment. Please try again.');
    }
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'EDIT INVESTMENT ASSET' : 'ADD INVESTMENT ASSET'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* Asset Name */}
        <NeoInput
          label="Investment / Asset Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Parag Parikh Flexi Cap, Nifty 50, HDFC FD, Gold 24K"
          required
        />

        {/* Asset Classification Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <Layers size={13} />
            Asset Class *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ASSET_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setAssetType(type.value)}
                className={`p-2 text-[11px] font-black uppercase border-2 transition-all cursor-pointer text-center truncate ${
                  assetType === type.value
                    ? 'bg-[#121212] text-[#FFE600] border-[#121212] shadow-neo-sm'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#121212]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invested Capital vs Current Valuation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Invested Capital */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
              <DollarSign size={13} />
              Invested Capital ({currencySymbol}) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-mono font-black text-neutral-500 pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={investedAmount}
                onChange={(e) => {
                  setInvestedAmount(e.target.value);
                  if (!currentValue || currentValue === investedAmount) {
                    setCurrentValue(e.target.value);
                  }
                }}
                placeholder="25000.00"
                className="neo-input pl-8 pr-3 py-2 text-base font-mono font-black text-[#121212]"
                required
              />
            </div>
          </div>

          {/* Current Valuation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
              <TrendingUp size={13} className="text-[#05DF72]" />
              Current Value ({currencySymbol}) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-mono font-black text-neutral-500 pointer-events-none">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="28500.00"
                className="neo-input pl-8 pr-3 py-2 text-base font-mono font-black text-[#05DF72]"
                required
              />
            </div>
          </div>
        </div>

        {/* Optional Units & Purchase Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black uppercase text-neutral-600">
              Quantity / Units (Optional)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="e.g. 50 shares or 10.5 g"
              className="neo-input py-1.5 px-2.5 text-xs font-mono font-bold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-black uppercase text-neutral-600">
              Buy Price per Unit ({currencySymbol})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="e.g. 500.00"
              className="neo-input py-1.5 px-2.5 text-xs font-mono font-bold"
            />
          </div>
        </div>

        {/* Recurring SIP Section */}
        <div className="p-3 bg-[#FFFDF5] border-2 border-[#121212] shadow-neo-sm flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#121212]">
            <Calendar size={14} className="text-[#00F0FF]" />
            <span>Monthly Recurring SIP (Optional)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black uppercase text-neutral-600">
                Monthly SIP Amount ({currencySymbol})
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={sipAmount}
                onChange={(e) => setSipAmount(e.target.value)}
                placeholder="e.g. 2000"
                className="neo-input py-1.5 px-2.5 text-xs font-mono font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black uppercase text-neutral-600">
                SIP Deduction Day (1 - 28)
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={sipDay}
                onChange={(e) => setSipDay(e.target.value)}
                placeholder="5"
                className="neo-input py-1.5 px-2.5 text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-black uppercase text-neutral-600">
            Notes / Folio Number (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Zerodha / Groww / Folio #12345"
            className="neo-input py-1.5 px-2.5 text-xs font-bold"
          />
        </div>

        {error && (
          <div className="bg-[#FF4343] text-white text-xs font-bold p-2.5 border-2 border-[#121212] shadow-neo-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <NeoButton type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </NeoButton>
          <NeoButton type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : initialData
              ? 'Update Asset'
              : 'Add Investment'}
          </NeoButton>
        </div>
      </form>
    </NeoModal>
  );
};
