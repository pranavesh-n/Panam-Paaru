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

// ──────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────

export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val)
    .replace(/[₹$,\s%INR]/gi, '')
    .replace(/\((.*?)\)/g, '-$1')
    .trim();

  // Reject phone numbers (10 digits starting with 6-9)
  if (/^[6-9]\d{9}$/.test(str)) return 0;
  // Reject dates
  if (/^\d{2}[-/]\d{2}[-/]\d{2,4}$/.test(str)) return 0;

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/** Returns true if the text looks like a valid investment/scheme name (must have letters) */
function isValidHoldingName(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // Must contain at least 2 alphabetic characters
  const letterCount = (t.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) return false;
  // Must NOT be pure numbers / codes
  if (/^\d+$/.test(t)) return false;
  // Reject metadata keywords
  if (isMetadataOrNoise(t)) return false;
  return true;
}

export function isMetadataOrNoise(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
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
    t.includes('folio') ||
    t.includes('statement period') ||
    t.includes('valuation date') ||
    t.includes('isin') ||
    t.includes('account holder') ||
    t.includes('investor name') ||
    t.includes('disclaimer') ||
    t.includes('subtotal') ||
    t.includes('generated on') ||
    t.includes('consolidated') ||
    t.includes('page ') ||
    t.includes('amc:') ||
    t.includes('registrar') ||
    t.includes('cams') ||
    t.includes('kfintech') ||
    t.includes('karvy') ||
    t.includes('brokerage') ||
    t.includes('opening balance') ||
    t.includes('closing balance') ||
    t.includes('transaction') ||
    t.startsWith('date') ||
    t.startsWith('nav') ||
    t.startsWith('total')
  );
}

export function detectAssetType(name: string): AssetType {
  const lower = name.toLowerCase();

  if (
    lower.includes('fund') || lower.includes('growth') || lower.includes('direct') ||
    lower.includes('regular') || lower.includes('elss') || lower.includes('index') ||
    lower.includes('flexi') || lower.includes('small cap') || lower.includes('mid cap') ||
    lower.includes('large cap') || lower.includes('hybrid') || lower.includes('arbitrage') ||
    lower.includes('liquid') || lower.includes('parag parikh') || lower.includes('mirae') ||
    lower.includes('nippon') || lower.includes('hdfc') || lower.includes('sbi') ||
    lower.includes('uti') || lower.includes('quant') || lower.includes('icici') ||
    lower.includes('motilal') || lower.includes('axis') || lower.includes('kotak') ||
    lower.includes('dsp') || lower.includes('tata') || lower.includes('aditya birla') ||
    lower.includes('canara') || lower.includes('sundaram')
  ) return 'mutual_fund';

  if (
    lower.includes('ltd') || lower.includes('limited') || lower.includes('shares') ||
    lower.includes('equity') || lower.includes('reliance') || lower.includes('infosys') ||
    lower.includes('tcs') || lower.includes('wipro') || lower.includes('itc') ||
    lower.includes('etf')
  ) return 'stocks';

  if (lower.includes('gold') || lower.includes('silver') || lower.includes('sgb') || lower.includes('sovereign')) return 'gold';
  if (lower.includes('fd') || lower.includes('fixed deposit') || lower.includes('recurring deposit')) return 'fd_rd';
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('ethereum') || lower.includes('crypto') || lower.includes('solana')) return 'crypto';
  if (lower.includes('ppf') || lower.includes('epf') || lower.includes('nps') || lower.includes('provident')) return 'ppf_epf';
  if (lower.includes('reit') || lower.includes('land') || lower.includes('plot') || lower.includes('property')) return 'real_estate';

  return 'mutual_fund';
}

// ──────────────────────────────────────────
// CAS PDF Parser (CAMS / KFintech specific)
// ──────────────────────────────────────────

interface CASSchemeBlock {
  schemeName: string;
  costValue: number;
  marketValue: number;
  units: number;
  nav: number;
}

async function parseCASPdf(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;

  // Collect all text items with their Y position for line grouping
  const allItems: { text: string; y: number; x: number; page: number }[] = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      const text = String(item.str || '').trim();
      if (text) {
        allItems.push({
          text,
          y: Math.round(item.transform[5]),
          x: Math.round(item.transform[4]),
          page: p,
        });
      }
    }
  }

  // Group items into lines by Y coordinate (within 3px tolerance)
  const lineMap = new Map<string, { text: string; x: number }[]>();
  for (const item of allItems) {
    const key = `${item.page}_${Math.round(item.y / 3) * 3}`;
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key)!.push({ text: item.text, x: item.x });
  }

  // Sort lines by page then Y (descending Y = top of page)
  const sortedLines = Array.from(lineMap.entries())
    .sort((a, b) => {
      const [pageA, yA] = a[0].split('_').map(Number);
      const [pageB, yB] = b[0].split('_').map(Number);
      if (pageA !== pageB) return pageA - pageB;
      return yB - yA; // PDF Y is bottom-up, so higher Y = higher on page
    })
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      return items.map((i) => i.text).join('  ');
    });

  const fullText = sortedLines.join('\n');

  const holdings: ParsedHolding[] = [];
  let currentScheme = '';
  let idCounter = 0;

  // Strategy 1: Look for "Cost Value" / "Market Value" / "Valuation" labeled pairs
  const costRegex = /cost\s*(?:value)?[:\s]+[\₹]?\s*([\d,]+\.?\d*)/gi;
  const marketRegex = /(?:market|current|present)\s*(?:value)?[:\s]+[\₹]?\s*([\d,]+\.?\d*)/gi;

  // Strategy 2: Find scheme names (lines with Fund/Growth/Direct etc.)
  for (let i = 0; i < sortedLines.length; i++) {
    const line = sortedLines[i];

    // Detect scheme name
    if (
      isValidHoldingName(line) &&
      (line.includes('Fund') || line.includes('Growth') || line.includes('Direct') ||
       line.includes('ELSS') || line.includes('Cap') || line.includes('Plan') ||
       line.includes('Ltd') || line.includes('ETF') || line.includes('Equity') ||
       line.includes('Gold') || line.includes('Bond'))
    ) {
      currentScheme = line.replace(/\s{2,}/g, ' ').trim();
      continue;
    }

    // If we have a current scheme, look for valuation data
    if (currentScheme) {
      const lineLower = line.toLowerCase();

      // Pattern: "Cost Value: 32,062.52  Market/Current Value: 44,500.00"
      if (lineLower.includes('cost') || lineLower.includes('market') || lineLower.includes('valuation')) {
        const allNums = line.match(/[\d,]+\.\d{2}/g);
        if (allNums && allNums.length >= 2) {
          const nums = allNums.map(parseCleanNumber).filter((n) => n > 100);
          if (nums.length >= 2) {
            holdings.push({
              id: `cas_${idCounter++}`,
              name: currentScheme,
              assetType: detectAssetType(currentScheme),
              investedAmount: Math.min(...nums),
              currentValue: Math.max(...nums),
              selected: true,
            });
            currentScheme = '';
            continue;
          }
        }
      }

      // Pattern: Look ahead in the next 15 lines for Cost/Market value pair
      let costFound = 0;
      let marketFound = 0;
      let unitsFound = 0;

      for (let j = i; j < Math.min(sortedLines.length, i + 15); j++) {
        const ahead = sortedLines[j].toLowerCase();
        const numsInLine = sortedLines[j].match(/[\d,]+\.?\d*/g)?.map(parseCleanNumber).filter((n) => n > 0) || [];

        if (ahead.includes('cost') && numsInLine.length > 0) {
          // Take the largest number on a "cost" line as cost value
          costFound = Math.max(...numsInLine.filter((n) => n > 100));
        }
        if ((ahead.includes('market') || ahead.includes('current') || ahead.includes('present')) && numsInLine.length > 0) {
          marketFound = Math.max(...numsInLine.filter((n) => n > 100));
        }
        if ((ahead.includes('unit') || ahead.includes('balance')) && numsInLine.length > 0) {
          unitsFound = numsInLine.find((n) => n > 0 && n < 100000) || 0;
        }

        if (costFound > 0 && marketFound > 0) break;
      }

      if (costFound > 0 || marketFound > 0) {
        holdings.push({
          id: `cas_${idCounter++}`,
          name: currentScheme,
          assetType: detectAssetType(currentScheme),
          investedAmount: costFound || marketFound,
          currentValue: marketFound || costFound,
          units: unitsFound || undefined,
          selected: true,
        });
        currentScheme = '';
      }
    }
  }

  // Strategy 3: Regex across full text for "Scheme ... Cost: X ... Value: Y" blocks
  if (holdings.length === 0) {
    const schemePattern = /([A-Za-z][A-Za-z0-9\s\-\&]{5,80}(?:Fund|Growth|Direct|Cap|ELSS|Plan|ETF|Ltd|Equity)[A-Za-z0-9\s\-\&]*)/g;
    let match;
    while ((match = schemePattern.exec(fullText)) !== null) {
      const name = match[1].trim();
      if (!isValidHoldingName(name)) continue;

      // Get text after this match (next 500 chars)
      const afterText = fullText.substring(match.index + match[0].length, match.index + match[0].length + 500);
      const bigNums = afterText.match(/[\d,]+\.\d{2}/g)?.map(parseCleanNumber).filter((n) => n > 500) || [];

      if (bigNums.length >= 2) {
        holdings.push({
          id: `regex_${idCounter++}`,
          name,
          assetType: detectAssetType(name),
          investedAmount: bigNums[0],
          currentValue: bigNums[1],
          selected: true,
        });
      } else if (bigNums.length === 1) {
        holdings.push({
          id: `regex_${idCounter++}`,
          name,
          assetType: detectAssetType(name),
          investedAmount: bigNums[0],
          currentValue: bigNums[0],
          selected: true,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return holdings.filter((h) => {
    const key = h.name.toLowerCase().substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────
// Excel / CSV Parser
// ──────────────────────────────────────────

export async function extractRawGrid(file: File): Promise<RawFileContent> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    // For PDFs, we still need to return a raw grid for the column mapper fallback
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const lines: (string | number)[][] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items as any[];

      // Group by Y coordinate into rows
      const rowMap = new Map<number, { text: string; x: number }[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!rowMap.has(y)) rowMap.set(y, []);
        rowMap.get(y)!.push({ text: String(item.str || ''), x: item.transform[4] });
      }

      const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
      for (const y of sortedYs) {
        const cells = rowMap.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.text.trim()).filter(Boolean);
        if (cells.length > 0 && !isMetadataOrNoise(cells.join(' '))) {
          lines.push(cells);
        }
      }
    }

    return { fileName: file.name, sheets: [{ sheetName: 'PDF', rows: lines }] };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rawRows: any[][] = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) : [];
    return { sheetName: name, rows: rawRows };
  });

  return { fileName: file.name, sheets };
}

export function autoExtractHoldings(raw: RawFileContent): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  for (const sheet of raw.sheets) {
    const matrix = sheet.rows;
    if (!matrix || matrix.length === 0) continue;

    // 1. Find header row
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
        /scheme|instrument|symbol|stock|holding|particular|security|company|scrip|fund.*name|asset|description/i.test(c)
      );
      if (nIdx !== -1) {
        headerIdx = r;
        nameCol = nIdx;
        row.forEach((colName, cIdx) => {
          if (/invested|cost.*val|purchase.*val|inv.*val|total.*cost|buy.*val|principal/i.test(colName) && invCol === -1) invCol = cIdx;
          else if (/current|market.*val|cur.*val|present.*val|latest.*val|val.*today|valuation/i.test(colName) && curCol === -1) curCol = cIdx;
          else if (/qty|quantity|units|shares|volume|balance/i.test(colName) && qtyCol === -1) qtyCol = cIdx;
          else if (/buy.*price|avg.*cost|avg.*price|buy.*avg|cost.*price/i.test(colName) && buyPriceCol === -1) buyPriceCol = cIdx;
          else if (/ltp|cmp|current.*price|market.*price|nav|closing/i.test(colName) && curPriceCol === -1) curPriceCol = cIdx;
          else if (/p\&l|profit.*loss|unrealized/i.test(colName) && pnlCol === -1) pnlCol = cIdx;
        });
        break;
      }
    }

    if (headerIdx !== -1 && nameCol !== -1) {
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;

        const rawName = String(row[nameCol] || '').trim();
        if (!isValidHoldingName(rawName)) continue;

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
      // Positional Scan — require name to have letters
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length < 2) continue;

        const stringCell = row.find((c: any) => typeof c === 'string' && isValidHoldingName(c));
        if (!stringCell) continue;

        const numCells = row.map(parseCleanNumber).filter((n: number) => n > 100 && n < 500000000);
        if (numCells.length >= 1) {
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

  const seen = new Set<string>();
  return holdings.filter((h) => {
    const key = h.name.toLowerCase().substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────
// Universal Entry Point
// ──────────────────────────────────────────

export async function parseInvestmentFile(file: File): Promise<{
  holdings: ParsedHolding[];
  rawGrid: RawFileContent;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    // Use the dedicated CAS PDF parser first
    const casHoldings = await parseCASPdf(file);
    const rawGrid = await extractRawGrid(file);

    if (casHoldings.length > 0) {
      return { holdings: casHoldings, rawGrid };
    }

    // Fallback to raw grid auto-extract
    const gridHoldings = autoExtractHoldings(rawGrid);
    return { holdings: gridHoldings, rawGrid };
  }

  // Excel / CSV
  const rawGrid = await extractRawGrid(file);
  const holdings = autoExtractHoldings(rawGrid);
  return { holdings, rawGrid };
}

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
