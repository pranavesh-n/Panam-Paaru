import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { AssetType } from '../types';

// Configure pdfjs worker if in browser
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

/**
 * Clean and parse numeric currency string (handles ₹, $, commas, %, parenthetical negatives)
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val)
    .replace(/[₹$,\s%]/g, '')
    .replace(/\((.*?)\)/g, '-$1')
    .trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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
    lower.includes('flexi cap') ||
    lower.includes('small cap') ||
    lower.includes('mid cap') ||
    lower.includes('large cap') ||
    lower.includes('hybrid') ||
    lower.includes('arbitrage') ||
    lower.includes('liquid') ||
    lower.includes('overnight') ||
    lower.includes('parag parikh') ||
    lower.includes('mirae') ||
    lower.includes('nippon') ||
    lower.includes('hdfc mf') ||
    lower.includes('sbi mf') ||
    lower.includes('uti') ||
    lower.includes('quant') ||
    lower.includes('icici pru') ||
    lower.includes('tata digital') ||
    lower.includes('motilal') ||
    lower.includes('axis mf') ||
    lower.includes('kotak mf')
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
    lower.includes('tata') ||
    lower.includes('infosys') ||
    lower.includes('tcs') ||
    lower.includes('wipro') ||
    lower.includes('itc') ||
    lower.includes('hcl') ||
    lower.includes('bharti') ||
    lower.includes('etf')
  ) {
    return 'stocks';
  }

  // Gold & Silver
  if (
    lower.includes('gold') ||
    lower.includes('silver') ||
    lower.includes('sgb') ||
    lower.includes('sovereign')
  ) {
    return 'gold';
  }

  // Fixed Deposits & RDs
  if (
    lower.includes('fd') ||
    lower.includes('fixed deposit') ||
    lower.includes('recurring deposit') ||
    lower.includes('rd')
  ) {
    return 'fd_rd';
  }

  // Crypto
  if (
    lower.includes('bitcoin') ||
    lower.includes('btc') ||
    lower.includes('ethereum') ||
    lower.includes('eth') ||
    lower.includes('crypto') ||
    lower.includes('solana') ||
    lower.includes('usdt') ||
    lower.includes('doge')
  ) {
    return 'crypto';
  }

  // PPF & EPF / Retirement
  if (
    lower.includes('ppf') ||
    lower.includes('epf') ||
    lower.includes('pf') ||
    lower.includes('nps') ||
    lower.includes('provident')
  ) {
    return 'ppf_epf';
  }

  // Real Estate
  if (
    lower.includes('reit') ||
    lower.includes('land') ||
    lower.includes('plot') ||
    lower.includes('apartment') ||
    lower.includes('property')
  ) {
    return 'real_estate';
  }

  return 'mutual_fund';
}

/**
 * Filter out boilerplate / header / footer rows
 */
function isNoiseRow(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 2) return true;
  return (
    t.includes('total') ||
    t.includes('disclaimer') ||
    t.includes('summary') ||
    t.includes('subtotal') ||
    t.includes('portfolio value') ||
    t.includes('all amounts in inr') ||
    t.includes('generated on') ||
    t.includes('page ') ||
    t.includes('statement for') ||
    t.includes('account holder') ||
    t.includes('pan :') ||
    t.includes('folio no') ||
    t.includes('brokerage')
  );
}

/**
 * Universal Excel (.xlsx, .xls) & CSV / TSV Parser
 * Handles Zerodha, Groww, AngelOne, CAMS CAS Excel, Upstox, INDmoney, Kuvera & Custom sheets
 */
export async function parseExcelOrCsv(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });

  const allHoldings: ParsedHolding[] = [];

  // Iterate across all sheets in the workbook
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to 2D array of rows
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!matrix || matrix.length < 2) continue;

    // 1. Find Header Row by scanning first 30 rows
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r].map((cell: any) => String(cell || '').trim().toLowerCase());
      
      const nameIdx = row.findIndex((c: string) =>
        /scheme|instrument|symbol|stock|holding|asset|particular|security|company|scrip|fund|description|name/i.test(c)
      );
      const qtyIdx = row.findIndex((c: string) =>
        /qty|quantity|units|volume|balance|shares|avail.*qty/i.test(c)
      );
      const valIdx = row.findIndex((c: string) =>
        /invested|current|market.*val|cur.*val|cost|present.*val|val.*today|amount|total.*cost|nav|ltp|cmp/i.test(c)
      );

      if (nameIdx !== -1 && (qtyIdx !== -1 || valIdx !== -1)) {
        headerRowIdx = r;
        break;
      }
    }

    // 2. If a recognized header was found, map columns
    if (headerRowIdx !== -1) {
      const headerRow = matrix[headerRowIdx].map((c: any) => String(c || '').trim().toLowerCase());
      
      headerRow.forEach((colName: string, idx: number) => {
        if (/scheme|instrument|symbol|stock|holding|asset|particular|security|company|scrip|name/i.test(colName) && !colMap.name) {
          colMap.name = idx;
        } else if (/invested|cost.*val|purchase.*val|inv.*val|total.*cost|buy.*val|cost.*price|principal/i.test(colName) && !colMap.invested) {
          colMap.invested = idx;
        } else if (/current|market.*val|cur.*val|present.*val|latest.*val|val.*today|valuation/i.test(colName) && !colMap.current) {
          colMap.current = idx;
        } else if (/qty|quantity|units|shares|volume|balance/i.test(colName) && !colMap.units) {
          colMap.units = idx;
        } else if (/buy.*price|avg.*cost|avg.*price|buy.*avg|cost.*price|purchase.*price/i.test(colName) && !colMap.buyPrice) {
          colMap.buyPrice = idx;
        } else if (/ltp|cmp|current.*price|market.*price|nav|current.*nav|latest.*nav|closing/i.test(colName) && !colMap.currentPrice) {
          colMap.currentPrice = idx;
        } else if (/p\&l|profit.*loss|unrealized|net.*p\&l/i.test(colName) && !colMap.pnl) {
          colMap.pnl = idx;
        }
      });

      // Parse data rows starting after headerRowIdx
      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;

        const rawName = String(colMap.name !== undefined ? row[colMap.name] : row[0] || '').trim();
        if (!rawName || isNoiseRow(rawName)) continue;

        let units = colMap.units !== undefined ? parseCleanNumber(row[colMap.units]) : undefined;
        let buyPrice = colMap.buyPrice !== undefined ? parseCleanNumber(row[colMap.buyPrice]) : undefined;
        let currentPrice = colMap.currentPrice !== undefined ? parseCleanNumber(row[colMap.currentPrice]) : undefined;
        let invested = colMap.invested !== undefined ? parseCleanNumber(row[colMap.invested]) : 0;
        let current = colMap.current !== undefined ? parseCleanNumber(row[colMap.current]) : 0;
        let pnl = colMap.pnl !== undefined ? parseCleanNumber(row[colMap.pnl]) : undefined;

        // Auto calculate missing values
        if (invested === 0 && units && buyPrice) invested = units * buyPrice;
        if (current === 0 && units && currentPrice) current = units * currentPrice;
        if (current === 0 && invested > 0 && pnl !== undefined) current = invested + pnl;
        if (invested === 0 && current > 0 && pnl !== undefined) invested = current - pnl;
        if (invested === 0 && current > 0) invested = current;
        if (current === 0 && invested > 0) current = invested;

        if (invested > 0 || current > 0) {
          allHoldings.push({
            id: `row_${sheetName}_${r}_${Date.now()}`,
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
      // 3. Fallback: Positional Scan (Find rows with a String in Col 0/1 and Numbers in subsequent cols)
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length < 2) continue;

        const stringCell = row.find((c: any) => typeof c === 'string' && c.trim().length > 3 && !isNoiseRow(c));
        const numCells = row.map(parseCleanNumber).filter((n: number) => n > 10);

        if (stringCell && numCells.length >= 1) {
          const invested = numCells[0];
          const current = numCells.length >= 2 ? numCells[1] : invested;

          allHoldings.push({
            id: `fallback_${sheetName}_${r}_${Date.now()}`,
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
  const unique = allHoldings.filter((h) => {
    const key = h.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    throw new Error(
      'Could not extract investment rows from this file. Please verify the spreadsheet contains holding names and invested/current values.'
    );
  }

  return unique;
}

/**
 * Universal PDF Statement Parser (CAMS CAS, KFintech, Zerodha, Groww)
 */
export async function parsePdfStatement(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;

  const lines: string[] = [];
  let fullText = '';

  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageLines = content.items.map((item: any) => item.str).filter(Boolean);
    lines.push(...pageLines);
    fullText += pageLines.join(' ') + '\n';
  }

  const holdings: ParsedHolding[] = [];
  let idCounter = 0;

  // Regex 1: Match mutual fund scheme blocks in CAS / CAMS / KFintech
  const schemeRegex = /([A-Za-z0-9][A-Za-z0-9\s\-\&]{3,70}(?:Fund|Growth|Direct|ELSS|Index|Cap|Equity|Plan|Arbitrage|Liquid|ETF)[A-Za-z0-9\s\-\&]*)/gi;

  const textBlocks = fullText.split(/\n+/);
  for (const block of textBlocks) {
    const numbers = block.match(/[\d,]+\.\d{2}/g);
    if (numbers && numbers.length >= 2) {
      const parsedNums = numbers.map(parseCleanNumber).filter((n) => n > 10);
      if (parsedNums.length >= 2) {
        const schemeMatch = block.match(schemeRegex);
        const name = schemeMatch ? schemeMatch[0].trim() : '';

        if (name && name.length >= 4 && !isNoiseRow(name)) {
          const invested = parsedNums[0];
          const current = parsedNums[1];

          holdings.push({
            id: `pdf_block_${Date.now()}_${idCounter++}`,
            name,
            assetType: detectAssetType(name),
            investedAmount: Math.min(invested, current),
            currentValue: Math.max(invested, current),
            selected: true,
          });
        }
      }
    }
  }

  // Regex 2: Line-by-line lookahead
  if (holdings.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        (line.includes('Fund') || line.includes('Growth') || line.includes('Direct') || line.includes('Ltd') || line.includes('Shares')) &&
        line.length > 5 &&
        !isNoiseRow(line)
      ) {
        const upcomingNumbers: number[] = [];
        for (let j = 1; j <= 6 && i + j < lines.length; j++) {
          const val = parseCleanNumber(lines[i + j]);
          if (val > 100) upcomingNumbers.push(val);
        }

        if (upcomingNumbers.length >= 1) {
          const invested = upcomingNumbers[0];
          const current = upcomingNumbers[1] || invested;

          holdings.push({
            id: `pdf_line_${Date.now()}_${idCounter++}`,
            name: line,
            assetType: detectAssetType(line),
            investedAmount: Math.min(invested, current),
            currentValue: Math.max(invested, current),
            selected: true,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = holdings.filter((h) => {
    const key = h.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    throw new Error(
      'Could not detect investment tables in this PDF. If the statement is password protected, please remove the password or export as Excel/CSV for 100% extraction.'
    );
  }

  return unique;
}

/**
 * Universal Unified File Parser (PDF, Excel, CSV, TSV)
 */
export async function parseInvestmentFile(file: File): Promise<ParsedHolding[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    return await parsePdfStatement(file);
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') {
    return await parseExcelOrCsv(file);
  } else {
    throw new Error('Unsupported format. Please upload a PDF (.pdf), Excel (.xlsx/.xls), or CSV (.csv) statement.');
  }
}
