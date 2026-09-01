import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { AssetType } from '../types';

if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ParsedHolding {
  id: string;
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
  selected: boolean;
}

export interface RawFileContent {
  fileName: string;
  sheets: {
    sheetName: string;
    rows: (string | number)[][];
  }[];
}

/**
 * Clean and parse numeric currency string (handles ₹, $, commas, %, parenthetical negatives)
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val)
    .replace(/[₹$,\s%INR]/gi, '')
    .replace(/\((.*?)\)/g, '-$1')
    .trim();

  // If it's a 10-digit mobile number or date or pincode, discard
  if (/^[6-9]\d{9}$/.test(str)) return 0;
  if (/^\d{2}[-/]\d{2}[-/]\d{2,4}$/.test(str)) return 0;

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Identify if a row or name is a metadata key or personal info (Mobile, PAN, Address, Folio)
 */
export function isMetadataOrNoise(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return true;

  // Check if text is just a number (like "37554" or "9876543210")
  if (/^\d+$/.test(t)) return true;

  // Metadata keywords
  return (
    t.includes('mobile') ||
    t.includes('phone') ||
    t.includes('pan :') ||
    t.includes('pan:') ||
    t.includes('email') ||
    t.includes('address') ||
    t.includes('nominee') ||
    t.includes('pin code') ||
    t.includes('pincode') ||
    t.includes('folio no') ||
    t.includes('statement period') ||
    t.includes('valuation date') ||
    t.includes('isin') ||
    t.includes('account holder') ||
    t.includes('investor name') ||
    t.includes('disclaimer') ||
    t.includes('summary') ||
    t.includes('subtotal') ||
    t.includes('generated on') ||
    t.includes('consolidated') ||
    t.includes('page ') ||
    t.includes('amc:') ||
    t.includes('registrar') ||
    t.includes('cams') ||
    t.includes('kfintech') ||
    t.includes('karvy') ||
    t.includes('brokerage')
  );
}

/**
 * Heuristic to detect Asset Type from scheme/holding name
 */
export function detectAssetType(name: string): AssetType {
  const lower = name.toLowerCase();

  // Mutual Funds
  if (
    lower.includes('fund') ||
    lower.includes('growth') ||
    lower.includes('direct') ||
    lower.includes('regular') ||
    lower.includes('elss') ||
    lower.includes('index') ||
    lower.includes('flexi') ||
    lower.includes('small cap') ||
    lower.includes('mid cap') ||
    lower.includes('large cap') ||
    lower.includes('hybrid') ||
    lower.includes('arbitrage') ||
    lower.includes('liquid') ||
    lower.includes('parag parikh') ||
    lower.includes('mirae') ||
    lower.includes('nippon') ||
    lower.includes('hdfc mf') ||
    lower.includes('sbi mf') ||
    lower.includes('uti') ||
    lower.includes('quant') ||
    lower.includes('icici pru') ||
    lower.includes('motilal') ||
    lower.includes('axis') ||
    lower.includes('kotak') ||
    lower.includes('dsp') ||
    lower.includes('tata')
  ) {
    return 'mutual_fund';
  }

  // Stocks & Equities
  if (
    lower.includes('ltd') ||
    lower.includes('limited') ||
    lower.includes('shares') ||
    lower.includes('eq') ||
    lower.includes('equity') ||
    lower.includes('reliance') ||
    lower.includes('infosys') ||
    lower.includes('tcs') ||
    lower.includes('wipro') ||
    lower.includes('itc') ||
    lower.includes('etf')
  ) {
    return 'stocks';
  }

  // Gold & Silver
  if (lower.includes('gold') || lower.includes('silver') || lower.includes('sgb') || lower.includes('sovereign')) {
    return 'gold';
  }

  // Fixed Deposits & RDs
  if (lower.includes('fd') || lower.includes('fixed deposit') || lower.includes('recurring deposit') || lower.includes('rd')) {
    return 'fd_rd';
  }

  // Crypto
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('ethereum') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana') || lower.includes('usdt')) {
    return 'crypto';
  }

  // PPF & EPF / Retirement
  if (lower.includes('ppf') || lower.includes('epf') || lower.includes('pf') || lower.includes('nps') || lower.includes('provident')) {
    return 'ppf_epf';
  }

  // Real Estate
  if (lower.includes('reit') || lower.includes('land') || lower.includes('plot') || lower.includes('apartment') || lower.includes('property')) {
    return 'real_estate';
  }

  return 'mutual_fund';
}

/**
 * Extract Raw Grid of rows from Excel, CSV, or PDF
 */
export async function extractRawGrid(file: File): Promise<RawFileContent> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const numPages = pdf.numPages;
    const lines: (string | number)[][] = [];

    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageItems = content.items.map((item: any) => String(item.str || '').trim()).filter(Boolean);

      for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        if (isMetadataOrNoise(item)) continue;

        // If line is a mutual fund scheme name (e.g. Parag Parikh, Nippon, etc.)
        if (
          (item.includes('Fund') || item.includes('Growth') || item.includes('Direct') || item.includes('ELSS') || item.includes('Cap')) &&
          item.length > 8
        ) {
          // Look ahead for numbers in the next 8 items
          const nums: number[] = [];
          for (let j = 1; j <= 8 && i + j < pageItems.length; j++) {
            const nextItem = pageItems[i + j];
            if (!isMetadataOrNoise(nextItem)) {
              const val = parseCleanNumber(nextItem);
              if (val > 10 && val < 50000000) nums.push(val);
            }
          }

          if (nums.length >= 1) {
            lines.push([item, nums[0], nums[1] || nums[0]]);
          }
        }
      }
    }

    return {
      fileName: file.name,
      sheets: [{ sheetName: 'PDF Statement', rows: lines }],
    };
  }

  // Excel (.xlsx, .xls) / CSV / TSV
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rawRows: any[][] = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) : [];
    
    // Filter out rows where the first column is a personal mobile number, address or noise
    const cleanRows = rawRows.filter((row) => {
      if (!row || row.length === 0) return false;
      const cell0 = String(row[0] || '').trim();
      return !isMetadataOrNoise(cell0);
    });

    return { sheetName: name, rows: cleanRows };
  });

  return { fileName: file.name, sheets };
}

/**
 * Intelligent Extraction from Raw Grid
 */
export function autoExtractHoldings(raw: RawFileContent): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  for (const sheet of raw.sheets) {
    const matrix = sheet.rows;
    if (!matrix || matrix.length === 0) continue;

    // 1. Locate genuine header
    let headerIdx = -1;
    let nameCol = -1;
    let invCol = -1;
    let curCol = -1;
    let qtyCol = -1;
    let buyPriceCol = -1;
    let curPriceCol = -1;
    let pnlCol = -1;

    for (let r = 0; r < Math.min(matrix.length, 35); r++) {
      const row = matrix[r].map((c) => String(c || '').trim().toLowerCase());
      const nIdx = row.findIndex((c) =>
        /scheme|instrument|symbol|stock|holding|particular|security|company|scrip|fund.*name|asset/i.test(c)
      );
      if (nIdx !== -1) {
        headerIdx = r;
        nameCol = nIdx;
        row.forEach((colName, cIdx) => {
          if (/invested|cost.*val|purchase.*val|inv.*val|total.*cost|buy.*val|principal/i.test(colName) && invCol === -1) {
            invCol = cIdx;
          } else if (/current|market.*val|cur.*val|present.*val|latest.*val|val.*today|valuation/i.test(colName) && curCol === -1) {
            curCol = cIdx;
          } else if (/qty|quantity|units|shares|volume|balance/i.test(colName) && qtyCol === -1) {
            qtyCol = cIdx;
          } else if (/buy.*price|avg.*cost|avg.*price|buy.*avg|cost.*price/i.test(colName) && buyPriceCol === -1) {
            buyPriceCol = cIdx;
          } else if (/ltp|cmp|current.*price|market.*price|nav|closing/i.test(colName) && curPriceCol === -1) {
            curPriceCol = cIdx;
          } else if (/p\&l|profit.*loss|unrealized/i.test(colName) && pnlCol === -1) {
            pnlCol = cIdx;
          }
        });
        break;
      }
    }

    if (headerIdx !== -1 && nameCol !== -1) {
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;

        const rawName = String(row[nameCol] || '').trim();
        if (!rawName || isMetadataOrNoise(rawName)) continue;

        let units = qtyCol !== -1 ? parseCleanNumber(row[qtyCol]) : undefined;
        let buyPrice = buyPriceCol !== -1 ? parseCleanNumber(row[buyPriceCol]) : undefined;
        let currentPrice = curPriceCol !== -1 ? parseCleanNumber(row[curPriceCol]) : undefined;
        let invested = invCol !== -1 ? parseCleanNumber(row[invCol]) : 0;
        let current = curCol !== -1 ? parseCleanNumber(row[curCol]) : 0;
        let pnl = pnlCol !== -1 ? parseCleanNumber(row[pnlCol]) : undefined;

        if (invested === 0 && units && buyPrice) invested = units * buyPrice;
        if (current === 0 && units && currentPrice) current = units * currentPrice;
        if (current === 0 && invested > 0 && pnl !== undefined) current = invested + pnl;
        if (invested === 0 && current > 0 && pnl !== undefined) invested = current - pnl;
        if (invested === 0 && current > 0) invested = current;
        if (current === 0 && invested > 0) current = invested;

        // Sanity filter: Ignore values over ₹100 Crores if likely a phone number
        if (invested > 500000000 || current > 500000000) continue;

        if (invested > 0 || current > 0) {
          holdings.push({
            id: `auto_${sheet.sheetName}_${r}_${Date.now()}`,
            name: rawName,
            assetType: detectAssetType(rawName),
            investedAmount: Math.abs(Number(invested.toFixed(2))),
            currentValue: Math.abs(Number(current.toFixed(2))),
            units: units && units > 0 ? Number(units.toFixed(3)) : undefined,
            buyPrice: buyPrice && buyPrice > 0 ? Number(buyPrice.toFixed(2)) : undefined,
            currentPrice: currentPrice && currentPrice > 0 ? Number(currentPrice.toFixed(2)) : undefined,
            selected: true,
          });
        }
      }
    } else {
      // Positional Scan with strict filter
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length < 2) continue;

        const stringCell = row.find((c: any) => typeof c === 'string' && c.trim().length > 4 && !isMetadataOrNoise(c));
        const numCells = row.map(parseCleanNumber).filter((n: number) => n > 10 && n < 500000000);

        if (stringCell && numCells.length >= 1) {
          const invested = numCells[0];
          const current = numCells.length >= 2 ? numCells[1] : invested;

          holdings.push({
            id: `pos_${sheet.sheetName}_${r}_${Date.now()}`,
            name: String(stringCell).trim(),
            assetType: detectAssetType(String(stringCell)),
            investedAmount: Math.abs(Number(invested.toFixed(2))),
            currentValue: Math.abs(Number(current.toFixed(2))),
            selected: true,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return holdings.filter((h) => {
    const key = h.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse pasted table or CSV text
 */
export function parsePastedText(text: string): ParsedHolding[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const rows = lines.map((l) => {
    if (l.includes('\t')) return l.split('\t');
    if (l.includes(',')) return l.split(',');
    if (l.includes(';')) return l.split(';');
    return l.split(/\s{2,}/);
  });

  const raw: RawFileContent = {
    fileName: 'Pasted Table',
    sheets: [{ sheetName: 'Pasted', rows }],
  };

  return autoExtractHoldings(raw);
}
