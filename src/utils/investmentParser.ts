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
 * Heuristic to detect Asset Type from scheme/holding name
 */
export function detectAssetType(name: string): AssetType {
  const lower = name.toLowerCase();

  // Mutual Funds
  if (
    lower.includes('fund') ||
    lower.includes('growth') ||
    lower.includes('direct') ||
    lower.includes('elss') ||
    lower.includes('index') ||
    lower.includes('flexi cap') ||
    lower.includes('small cap') ||
    lower.includes('mid cap') ||
    lower.includes('large cap') ||
    lower.includes('hybrid') ||
    lower.includes('etf') ||
    lower.includes('parag parikh') ||
    lower.includes('mirae') ||
    lower.includes('nippon') ||
    lower.includes('hdfc mf') ||
    lower.includes('sbi mf') ||
    lower.includes('uti') ||
    lower.includes('icici pru')
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
    lower.includes('itc')
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

  return 'mutual_fund'; // default to mutual fund if standard portfolio statement
}

/**
 * Clean and parse numeric currency string (handles ₹, $, commas, parentheses)
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);
  if (!val) return 0;
  const str = String(val)
    .replace(/[₹$,\s]/g, '')
    .replace(/\((.*?)\)/g, '-$1');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse Excel (.xlsx, .xls) and CSV / TSV file
 */
export async function parseExcelOrCsv(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to rows of objects
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rawRows || rawRows.length === 0) {
    throw new Error('No readable data rows found in this spreadsheet.');
  }

  const holdings: ParsedHolding[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const keys = Object.keys(row);

    // Look for column names matching scheme, name, invested, current, units
    let nameKey = keys.find((k) => /scheme|name|symbol|stock|holding|asset|instrument|description|security/i.test(k));
    let investedKey = keys.find((k) => /invested|cost|purchase|buy.*value|inv.*amount|principal|total.*cost/i.test(k));
    let currentKey = keys.find((k) => /current|market.*value|cur.*value|val.*today|present|latest.*value/i.test(k));
    let unitsKey = keys.find((k) => /units|qty|quantity|balance|shares|volume/i.test(k));
    let buyPriceKey = keys.find((k) => /buy.*price|avg.*cost|avg.*price|nav.*purchase/i.test(k));
    let currentPriceKey = keys.find((k) => /nav|cmp|market.*price|cur.*price|ltp|current.*nav/i.test(k));

    // Fallbacks if header names are generic (col 0, 1, 2)
    if (!nameKey && keys.length > 0) nameKey = keys[0];

    const rawName = String(row[nameKey || ''] || '').trim();
    if (!rawName || rawName.length < 3 || /total|disclaimer|subtotal|summary|folio/i.test(rawName)) {
      continue;
    }

    let invested = investedKey ? parseCleanNumber(row[investedKey]) : 0;
    let current = currentKey ? parseCleanNumber(row[currentKey]) : 0;
    const units = unitsKey ? parseCleanNumber(row[unitsKey]) : undefined;
    const buyPrice = buyPriceKey ? parseCleanNumber(row[buyPriceKey]) : undefined;
    const currentPrice = currentPriceKey ? parseCleanNumber(row[currentPriceKey]) : undefined;

    // If only units and prices exist, compute amounts
    if (invested === 0 && units && buyPrice) invested = units * buyPrice;
    if (current === 0 && units && currentPrice) current = units * currentPrice;
    if (invested === 0 && current > 0) invested = current;
    if (current === 0 && invested > 0) current = invested;

    if (invested > 0 || current > 0) {
      holdings.push({
        id: `hold_${Date.now()}_${i}`,
        name: rawName,
        assetType: detectAssetType(rawName),
        investedAmount: Number(invested.toFixed(2)),
        currentValue: Number(current.toFixed(2)),
        units: units ? Number(units.toFixed(3)) : undefined,
        buyPrice: buyPrice ? Number(buyPrice.toFixed(2)) : undefined,
        currentPrice: currentPrice ? Number(currentPrice.toFixed(2)) : undefined,
        selected: true,
      });
    }
  }

  if (holdings.length === 0) {
    throw new Error('Could not identify investment amounts. Please ensure column headers include Name, Invested Amount, and Current Value.');
  }

  return holdings;
}

/**
 * Parse PDF Statements (CAMS CAS, KFintech, Zerodha, Groww)
 */
export async function parsePdfStatement(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;

  let fullText = '';
  const lines: string[] = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageLines = content.items.map((item: any) => item.str).filter(Boolean);
    lines.push(...pageLines);
    fullText += pageLines.join(' ') + '\n';
  }

  const holdings: ParsedHolding[] = [];

  // 1. Regex pattern for CAS / CAMS / KFintech mutual fund scheme rows
  // Example: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth ... 521.432 ... ₹45.20 ... ₹25,000.00 ... ₹32,150.00"
  const schemeRegex = /([A-Z0-9][A-Za-z0-9\s\-\&]{4,60}(?:Fund|Growth|Plan|Direct|Cap|Index|Equity|ETF)[A-Za-z0-9\s\-\&]*)/gi;
  
  // Extract text blocks
  const textBlocks = fullText.split(/\n+/);
  let idCounter = 0;

  for (const block of textBlocks) {
    const numbers = block.match(/[\d,]+\.\d{2}/g);
    if (numbers && numbers.length >= 2) {
      const parsedNums = numbers.map(parseCleanNumber).filter((n) => n > 10);
      if (parsedNums.length >= 2) {
        // Find scheme name in block
        const schemeMatch = block.match(schemeRegex);
        const name = schemeMatch ? schemeMatch[0].trim() : '';

        if (name && name.length >= 5 && !/total|summary|valuation|subtotal/i.test(name)) {
          const invested = parsedNums[0];
          const current = parsedNums[1];

          holdings.push({
            id: `pdf_hold_${Date.now()}_${idCounter++}`,
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

  // Fallback: If structured regex found nothing, parse lines sequentially
  if (holdings.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        (line.includes('Fund') || line.includes('Growth') || line.includes('Direct') || line.includes('Equity')) &&
        line.length > 8 &&
        !/portfolio|valuation|statement|page/i.test(line)
      ) {
        // Look ahead for numbers in next 5 lines
        const upcomingNumbers: number[] = [];
        for (let j = 1; j <= 5 && i + j < lines.length; j++) {
          const val = parseCleanNumber(lines[i + j]);
          if (val > 100) upcomingNumbers.push(val);
        }

        if (upcomingNumbers.length >= 1) {
          const invested = upcomingNumbers[0];
          const current = upcomingNumbers[1] || invested;

          holdings.push({
            id: `pdf_line_${Date.now()}_${idCounter++}`,
            name: line.trim(),
            assetType: detectAssetType(line),
            investedAmount: invested,
            currentValue: current,
            selected: true,
          });
        }
      }
    }
  }

  // Deduplicate holdings by name
  const seen = new Set<string>();
  const uniqueHoldings = holdings.filter((h) => {
    if (seen.has(h.name)) return false;
    seen.add(h.name);
    return true;
  });

  if (uniqueHoldings.length === 0) {
    throw new Error(
      'Could not automatically detect investment tables in this PDF. If the PDF is password protected, please remove the password or export as Excel/CSV for 100% extraction.'
    );
  }

  return uniqueHoldings;
}

/**
 * Universal Unified File Parser (PDF, Excel, CSV)
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
