import React, { useState } from 'react';
import { Investment, PortfolioSummary, AssetType } from '../types';
import { NeoButton } from '../components/ui/NeoButton';
import { usePrivacy } from '../context/PrivacyContext';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Layers,
  Edit,
  Trash2,
  Calendar,
  Sparkles,
  PieChart,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';

interface InvestmentsPageProps {
  investments: Investment[];
  portfolioSummary: PortfolioSummary | null;
  onOpenAddModal: (defaultType?: AssetType) => void;
  onOpenImportModal: () => void;
  onEdit: (inv: Investment) => void;
  onDelete: (id: string) => void;
  onQuickUpdateValue: (id: string, currentValue: number) => Promise<void>;
  currencySymbol?: string;
}

const ASSET_COLORS: Record<string, { label: string; color: string }> = {
  mutual_fund: { label: 'MUTUAL FUNDS', color: '#00F0FF' },
  stocks: { label: 'STOCKS', color: '#FFE600' },
  fd_rd: { label: 'FD & RD', color: '#05DF72' },
  gold: { label: 'GOLD & SILVER', color: '#FFD700' },
  crypto: { label: 'CRYPTO', color: '#9B51E0' },
  ppf_epf: { label: 'PPF & EPF', color: '#FF8800' },
  real_estate: { label: 'REAL ESTATE', color: '#FF4D8D' },
  other: { label: 'OTHER', color: '#A0AEC0' },
};

export const InvestmentsPage: React.FC<InvestmentsPageProps> = ({
  investments,
  portfolioSummary,
  onOpenAddModal,
  onOpenImportModal,
  onEdit,
  onDelete,
  onQuickUpdateValue,
  currencySymbol = '₹',
}) => {
  const { formatPrivateAmount } = usePrivacy();
  const [selectedFilter, setSelectedFilter] = useState<'all' | AssetType>('all');
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null);
  const [quickValueInput, setQuickValueInput] = useState<string>('');

  const totalInvested = portfolioSummary?.totalInvested ?? 0;
  const totalCurrentValue = portfolioSummary?.totalCurrentValue ?? 0;
  const totalReturns = portfolioSummary?.totalReturnsAmount ?? 0;
  const totalReturnsPercent = portfolioSummary?.totalReturnsPercent ?? 0;
  const totalSip = portfolioSummary?.totalMonthlySip ?? 0;
  const isPositiveReturns = totalReturns >= 0;

  const filteredInvestments =
    selectedFilter === 'all'
      ? investments
      : investments.filter((inv) => inv.assetType === selectedFilter);

  const handleStartQuickUpdate = (inv: Investment) => {
    setQuickUpdateId(inv._id);
    setQuickValueInput(String(inv.currentValue));
  };

  const handleSaveQuickUpdate = async (id: string) => {
    const val = parseFloat(quickValueInput);
    if (isNaN(val) || val < 0) return;
    await onQuickUpdateValue(id, val);
    setQuickUpdateId(null);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-150">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFE600] p-4 sm:p-6 border-[3px] border-[#121212] shadow-neo">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-[#121212] text-[#FFE600] px-2 py-0.5 inline-block">
              WEALTH & PORTFOLIO ENGINE
            </span>
            {totalReturnsPercent >= 12 && (
              <span className="text-[10px] font-black bg-[#05DF72] text-[#121212] px-2 py-0.5 border border-[#121212] flex items-center gap-1 shadow-neo-sm">
                <Sparkles size={11} /> HIGH ALPHA RETURNS
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-[#121212] tracking-tight">
            INVESTMENT TRACKER
          </h2>
          <p className="text-xs font-bold text-neutral-800 mt-0.5">
            Track Mutual Funds, Equities, Gold, FDs, Crypto & SIPs. Upload CAS PDFs or Excel sheets to import all at once!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <NeoButton
            variant="outline"
            size="md"
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 bg-white"
          >
            <UploadCloud size={16} strokeWidth={2.5} />
            <span>Import Statement (PDF/Excel)</span>
          </NeoButton>

          <NeoButton
            variant="dark"
            size="md"
            onClick={() => onOpenAddModal()}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={3} className="text-[#05DF72]" />
            <span>+ Add Asset</span>
          </NeoButton>
        </div>
      </div>

      {/* Top 4 Key Portfolio Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Portfolio Valuation */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex flex-col justify-between gap-1">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            PORTFOLIO CURRENT VALUATION
          </span>
          <span className="text-2xl font-mono font-black text-[#121212]">
            {formatPrivateAmount(totalCurrentValue, currencySymbol)}
          </span>
          <span className="text-[10px] font-bold text-neutral-500">
            Across {investments.length} total holdings
          </span>
        </div>

        {/* Total Invested Capital */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex flex-col justify-between gap-1">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            TOTAL INVESTED CAPITAL
          </span>
          <span className="text-2xl font-mono font-black text-[#121212]">
            {formatPrivateAmount(totalInvested, currencySymbol)}
          </span>
          <span className="text-[10px] font-bold text-neutral-500">
            Principal investment basis
          </span>
        </div>

        {/* All-time Profit / Loss */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex flex-col justify-between gap-1">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            ALL-TIME GAIN / LOSS
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-mono font-black ${
                isPositiveReturns ? 'text-[#05DF72]' : 'text-[#FF4343]'
              }`}
            >
              {isPositiveReturns ? '+' : ''}
              {formatPrivateAmount(totalReturns, currencySymbol)}
            </span>
            <span
              className={`text-xs font-mono font-black px-1.5 py-0.5 border border-[#121212] ${
                isPositiveReturns ? 'bg-[#05DF72] text-[#121212]' : 'bg-[#FF4343] text-white'
              }`}
            >
              {isPositiveReturns ? '+' : ''}
              {totalReturnsPercent}%
            </span>
          </div>
          <span className="text-[10px] font-bold text-neutral-500">
            Unrealized net portfolio growth
          </span>
        </div>

        {/* Monthly Recurring SIPs */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex flex-col justify-between gap-1">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            ACTIVE MONTHLY SIPs
          </span>
          <span className="text-2xl font-mono font-black text-[#00F0FF]">
            {formatPrivateAmount(totalSip, currencySymbol)}
            <span className="text-xs font-bold text-neutral-600">/mo</span>
          </span>
          <span className="text-[10px] font-bold text-neutral-500">
            Automated wealth accumulation
          </span>
        </div>

      </div>

      {/* Asset Allocation Proportion Bar */}
      {portfolioSummary?.assetBreakdown && portfolioSummary.assetBreakdown.length > 0 && (
        <div className="p-4 sm:p-5 bg-white border-[3px] border-[#121212] shadow-neo flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-[#121212]" />
              <h3 className="text-xs font-black uppercase text-[#121212] tracking-wider">
                Asset Allocation Distribution
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-neutral-500">
              100% Diversification Pool
            </span>
          </div>

          {/* Allocation Multi-Segment Bar */}
          <div className="w-full h-4 bg-neutral-200 border-2 border-[#121212] flex overflow-hidden p-[1px]">
            {portfolioSummary.assetBreakdown.map((item) => (
              <div
                key={item.assetType}
                title={`${ASSET_COLORS[item.assetType]?.label || item.assetType}: ${item.allocationPercent}%`}
                className="h-full transition-all border-r border-[#121212] last:border-none"
                style={{
                  width: `${item.allocationPercent}%`,
                  backgroundColor: ASSET_COLORS[item.assetType]?.color || '#FFE600',
                }}
              />
            ))}
          </div>

          {/* Legend Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {portfolioSummary.assetBreakdown.map((item) => {
              const info = ASSET_COLORS[item.assetType] || { label: item.assetType, color: '#FFE600' };
              return (
                <div key={item.assetType} className="flex items-center gap-1.5 text-[11px] font-bold">
                  <div
                    className="w-3 h-3 border border-[#121212] shrink-0"
                    style={{ backgroundColor: info.color }}
                  />
                  <span className="text-[#121212] uppercase">{info.label}:</span>
                  <span className="font-mono font-black">{item.allocationPercent}%</span>
                  <span className="text-neutral-500 font-mono">
                    ({formatPrivateAmount(item.currentValue, currencySymbol)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset Classification Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { label: 'All Holdings', value: 'all' },
            { label: 'Mutual Funds', value: 'mutual_fund' },
            { label: 'Stocks', value: 'stocks' },
            { label: 'Fixed Deposits', value: 'fd_rd' },
            { label: 'Gold & Silver', value: 'gold' },
            { label: 'Crypto', value: 'crypto' },
            { label: 'PPF & EPF', value: 'ppf_epf' },
            { label: 'Real Estate', value: 'real_estate' },
            { label: 'Other', value: 'other' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedFilter(tab.value)}
            className={`px-3 py-1.5 text-xs font-black uppercase border-2 transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === tab.value
                ? 'bg-[#121212] text-white border-[#121212] shadow-neo-sm'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#121212]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Holdings List / Zero State */}
      {filteredInvestments.length === 0 ? (
        <div className="bg-white border-[3px] border-[#121212] shadow-neo p-12 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[#FFE600] border-2 border-[#121212] shadow-neo flex items-center justify-center font-black">
            <TrendingUp size={28} />
          </div>
          <h3 className="text-lg font-black uppercase text-[#121212]">
            No Investment Assets Added
          </h3>
          <p className="text-xs font-semibold text-neutral-600 max-w-md">
            Import your complete CAMS / KFintech CAS (PDF), Zerodha / Groww statement (Excel/CSV), or add assets manually!
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 mt-2">
            <NeoButton variant="dark" size="md" onClick={onOpenImportModal} className="flex items-center gap-1.5">
              <UploadCloud size={16} strokeWidth={2.5} className="text-[#05DF72]" />
              <span>Import Statement File (PDF / Excel / CSV)</span>
            </NeoButton>
            <NeoButton variant="secondary" size="md" onClick={() => onOpenAddModal('mutual_fund')}>
              + Add Manually
            </NeoButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInvestments.map((inv) => {
            const badgeInfo = ASSET_COLORS[inv.assetType] || { label: inv.assetType, color: '#FFE600' };
            const gain = inv.currentValue - inv.investedAmount;
            const gainPercent =
              inv.investedAmount > 0
                ? Number(((gain / inv.investedAmount) * 100).toFixed(2))
                : 0;
            const isGain = gain >= 0;

            return (
              <div
                key={inv._id}
                className="bg-white border-[3px] border-[#121212] shadow-neo p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-neo-lg"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="neo-badge text-[10px]"
                        style={{ backgroundColor: badgeInfo.color }}
                      >
                        {badgeInfo.label}
                      </span>
                      {inv.sipAmount && (
                        <span className="text-[10px] font-mono font-bold bg-[#121212] text-[#00F0FF] px-1.5 py-0.5">
                          SIP: {currencySymbol}{inv.sipAmount}/mo ({inv.sipDay || 5}th)
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-black uppercase text-[#121212] tracking-tight">
                      {inv.name}
                    </h4>
                    {inv.notes && (
                      <p className="text-[11px] font-medium text-neutral-500 mt-0.5">
                        {inv.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartQuickUpdate(inv)}
                      className="p-1.5 bg-[#FFE600] hover:bg-[#FFD700] text-[#121212] border border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer text-[10px] font-black uppercase"
                      title="Quick Update Current Value"
                    >
                      Update Value
                    </button>
                    <button
                      onClick={() => onEdit(inv)}
                      className="p-1.5 bg-white hover:bg-[#FFE600] border border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                      title="Edit Asset"
                    >
                      <Edit size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete investment "${inv.name}"?`)) {
                          onDelete(inv._id);
                        }
                      }}
                      className="p-1.5 bg-white hover:bg-[#FF4343] hover:text-white border border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                      title="Delete Asset"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Inline Quick Value Update Form if Active */}
                {quickUpdateId === inv._id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSaveQuickUpdate(inv._id);
                    }}
                    className="p-2.5 bg-[#FFE600] border-2 border-[#121212] shadow-neo-sm flex items-center gap-2 animate-in fade-in"
                  >
                    <span className="text-xs font-black uppercase text-[#121212] shrink-0">New Value:</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1.5 text-xs font-mono font-bold text-neutral-600">{currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickValueInput}
                        onChange={(e) => setQuickValueInput(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold bg-white border border-[#121212]"
                        required
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-[#121212] text-white hover:bg-black text-xs font-black uppercase cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickUpdateId(null)}
                      className="px-1.5 py-1 text-xs font-bold text-[#121212] cursor-pointer"
                    >
                      ✕
                    </button>
                  </form>
                )}

                {/* Valuations Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200">
                  <div>
                    <span className="text-[10px] font-black uppercase text-neutral-500 block">
                      INVESTED BASIS
                    </span>
                    <span className="text-base font-mono font-bold text-[#121212]">
                      {formatPrivateAmount(inv.investedAmount, currencySymbol)}
                    </span>
                    {inv.units && (
                      <span className="text-[10px] font-mono text-neutral-500 block">
                        {inv.units} units
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-neutral-500 block">
                      CURRENT VALUE
                    </span>
                    <span className="text-lg font-mono font-black text-[#121212]">
                      {formatPrivateAmount(inv.currentValue, currencySymbol)}
                    </span>
                  </div>
                </div>

                {/* Returns Banner */}
                <div
                  className={`p-2.5 border-2 border-[#121212] shadow-neo-sm flex items-center justify-between text-xs font-mono font-black ${
                    isGain ? 'bg-[#05DF72] text-[#121212]' : 'bg-[#FF4343] text-white'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isGain ? <ArrowUpRight size={15} strokeWidth={3} /> : <ArrowDownLeft size={15} strokeWidth={3} />}
                    <span>RETURNS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>
                      {isGain ? '+' : ''}
                      {formatPrivateAmount(gain, currencySymbol)}
                    </span>
                    <span>({isGain ? '+' : ''}{gainPercent}%)</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
