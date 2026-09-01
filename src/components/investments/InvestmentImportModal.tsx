import React, { useState, useRef } from 'react';
import { NeoModal } from '../ui/NeoModal';
import { NeoButton } from '../ui/NeoButton';
import { parseInvestmentFile, ParsedHolding } from '../../utils/investmentParser';
import { AssetType } from '../../types';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Check,
  AlertCircle,
  TrendingUp,
  Trash2,
  Sparkles,
  Layers,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface InvestmentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchImport: (
    items: {
      name: string;
      assetType: AssetType;
      investedAmount: number;
      currentValue: number;
      units?: number;
      buyPrice?: number;
      currentPrice?: number;
      notes?: string;
    }[]
  ) => Promise<void>;
  currencySymbol?: string;
}

const ASSET_TYPES: { label: string; value: AssetType }[] = [
  { label: 'Mutual Fund', value: 'mutual_fund' },
  { label: 'Stocks', value: 'stocks' },
  { label: 'FD & RD', value: 'fd_rd' },
  { label: 'Gold & Silver', value: 'gold' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'PPF / EPF', value: 'ppf_epf' },
  { label: 'Real Estate', value: 'real_estate' },
  { label: 'Other', value: 'other' },
];

export const InvestmentImportModal: React.FC<InvestmentImportModalProps> = ({
  isOpen,
  onClose,
  onBatchImport,
  currencySymbol = '₹',
}) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parsedHoldings, setParsedHoldings] = useState<ParsedHolding[]>([]);
  const [error, setError] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setParsedHoldings([]);
    setError('');
    setIsParsing(false);
    setIsImporting(false);
    setFileName('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      setError('');
      setFileName(file.name);

      const results = await parseInvestmentFile(file);
      setParsedHoldings(results);
      setIsParsing(false);
    } catch (err: any) {
      setIsParsing(false);
      setError(err?.message || 'Failed to parse file. Please upload a standard CAS PDF, Excel, or CSV statement.');
    }
  };

  const toggleSelectAll = () => {
    const allSelected = parsedHoldings.every((h) => h.selected);
    setParsedHoldings((prev) => prev.map((h) => ({ ...h, selected: !allSelected })));
  };

  const toggleItem = (id: string) => {
    setParsedHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, selected: !h.selected } : h))
    );
  };

  const updateItemField = (id: string, field: keyof ParsedHolding, val: any) => {
    setParsedHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const removeItem = (id: string) => {
    setParsedHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const selectedCount = parsedHoldings.filter((h) => h.selected).length;
  const totalSelectedInvested = parsedHoldings
    .filter((h) => h.selected)
    .reduce((sum, h) => sum + h.investedAmount, 0);
  const totalSelectedCurrent = parsedHoldings
    .filter((h) => h.selected)
    .reduce((sum, h) => sum + h.currentValue, 0);

  const handleImportCommit = async () => {
    const selected = parsedHoldings.filter((h) => h.selected && h.name.trim());
    if (selected.length === 0) {
      setError('Please select at least 1 holding to import.');
      return;
    }

    try {
      setIsImporting(true);
      setError('');

      await onBatchImport(
        selected.map((h) => ({
          name: h.name.trim(),
          assetType: h.assetType,
          investedAmount: h.investedAmount,
          currentValue: h.currentValue,
          units: h.units,
          buyPrice: h.buyPrice,
          currentPrice: h.currentPrice,
          notes: `Imported from ${fileName}`,
        }))
      );

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#05DF72', '#FFE600', '#121212'],
        });
      } catch (e) {}

      setIsImporting(false);
      resetState();
      onClose();
    } catch (err: any) {
      setIsImporting(false);
      setError(err?.message || 'Failed to import holdings to portfolio.');
    }
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="IMPORT INVESTMENTS (PDF / EXCEL / CSV)"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4">
        
        {/* Upload Dropzone if no file loaded */}
        {parsedHoldings.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-[3px] border-dashed border-[#121212] bg-[#FFFDF5] hover:bg-[#FFE600]/20 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-14 h-14 bg-[#FFE600] border-2 border-[#121212] shadow-neo flex items-center justify-center font-black">
                <Upload size={28} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-[#121212]">
                  Click or Drag & Drop your Statement File
                </h4>
                <p className="text-xs font-semibold text-neutral-600 mt-1 max-w-sm">
                  Supports CAMS / KFintech CAS (PDF), Zerodha / Groww Holdings (CSV / Excel), and custom spreadsheets (.xlsx, .xls, .csv).
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-mono font-bold text-neutral-500">
                <span className="px-2 py-0.5 bg-white border border-[#121212]">.PDF</span>
                <span className="px-2 py-0.5 bg-white border border-[#121212]">.XLSX</span>
                <span className="px-2 py-0.5 bg-white border border-[#121212]">.CSV</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.tsv"
              onChange={handleFileChange}
              className="hidden"
            />

            {isParsing && (
              <div className="p-4 bg-[#FFE600] border-2 border-[#121212] shadow-neo-sm text-xs font-black uppercase flex items-center justify-center gap-2 animate-pulse">
                <Sparkles size={16} />
                <span>Extracting all holdings & valuations...</span>
              </div>
            )}
          </div>
        ) : (
          /* Preview & Edit Extracted Holdings */
          <div className="flex flex-col gap-3">
            
            {/* Header summary of parsed file */}
            <div className="p-3 bg-[#05DF72] border-2 border-[#121212] shadow-neo-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-[#121212]" />
                <span className="text-xs font-black uppercase text-[#121212]">
                  {fileName} · {parsedHoldings.length} Holdings Extracted
                </span>
              </div>
              <button
                onClick={() => {
                  resetState();
                  fileInputRef.current?.click();
                }}
                className="text-[11px] font-black uppercase underline text-[#121212] cursor-pointer"
              >
                Upload Different File
              </button>
            </div>

            {/* Selection & Total Preview Bar */}
            <div className="p-3 bg-white border-2 border-[#121212] shadow-neo-sm flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={parsedHoldings.length > 0 && parsedHoldings.every((h) => h.selected)}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-[#121212] cursor-pointer"
                />
                <span className="uppercase">Select All ({selectedCount}/{parsedHoldings.length})</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono font-black">
                <span>Invested: {currencySymbol}{totalSelectedInvested.toLocaleString()}</span>
                <span className="text-[#05DF72]">Value: {currencySymbol}{totalSelectedCurrent.toLocaleString()}</span>
              </div>
            </div>

            {/* Editable Holdings Table */}
            <div className="max-h-[340px] overflow-y-auto border-2 border-[#121212] bg-white">
              <table className="w-full text-left text-xs font-bold border-collapse">
                <thead className="bg-[#FFE600] border-b-2 border-[#121212] sticky top-0 z-10 text-[11px] font-black uppercase">
                  <tr>
                    <th className="p-2 w-8 text-center">✓</th>
                    <th className="p-2">Asset / Scheme Name</th>
                    <th className="p-2">Class</th>
                    <th className="p-2 text-right">Invested ({currencySymbol})</th>
                    <th className="p-2 text-right">Current Value ({currencySymbol})</th>
                    <th className="p-2 text-center">✕</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {parsedHoldings.map((h) => (
                    <tr key={h.id} className={h.selected ? 'bg-white' : 'bg-neutral-100 opacity-60'}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={h.selected}
                          onChange={() => toggleItem(h.id)}
                          className="w-4 h-4 accent-[#121212] cursor-pointer"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={h.name}
                          onChange={(e) => updateItemField(h.id, 'name', e.target.value)}
                          className="w-full p-1 border border-neutral-300 font-bold text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={h.assetType}
                          onChange={(e) => updateItemField(h.id, 'assetType', e.target.value as AssetType)}
                          className="p-1 border border-neutral-300 text-[11px] font-black uppercase bg-white cursor-pointer"
                        >
                          {ASSET_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={h.investedAmount}
                          onChange={(e) => updateItemField(h.id, 'investedAmount', parseFloat(e.target.value) || 0)}
                          className="w-24 p-1 border border-neutral-300 font-mono text-xs font-bold text-right"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={h.currentValue}
                          onChange={(e) => updateItemField(h.id, 'currentValue', parseFloat(e.target.value) || 0)}
                          className="w-24 p-1 border border-neutral-300 font-mono text-xs font-black text-[#05DF72] text-right"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeItem(h.id)}
                          className="p-1 hover:text-[#FF4343] cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {error && (
          <div className="bg-[#FF4343] text-white text-xs font-bold p-2.5 border-2 border-[#121212] shadow-neo-sm flex items-center gap-2">
            <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-200">
          <NeoButton
            type="button"
            variant="outline"
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={isImporting}
          >
            Cancel
          </NeoButton>

          {parsedHoldings.length > 0 && (
            <NeoButton
              type="button"
              variant="secondary"
              onClick={handleImportCommit}
              disabled={isImporting || selectedCount === 0}
              className="flex items-center gap-1.5"
            >
              <Check size={16} strokeWidth={3} />
              <span>
                {isImporting
                  ? 'Importing...'
                  : `Import ${selectedCount} Holdings to Portfolio`}
              </span>
            </NeoButton>
          )}
        </div>

      </div>
    </NeoModal>
  );
};
