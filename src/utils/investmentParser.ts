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
// Pure Utility — No hardcoded names anywhere
// ──────────────────────────────────────────

export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val)
    .replace(/[₹$,\s%]/gi, '')
    .replace(/INR/gi, '')
    .replace(/\((.*?)\)/g, '-$1')
    .trim();

  // Reject phone numbers (10 digits starting with 6-9)
  if (/^[6-9]\d{9}$/.test(str)) return 0;
  // Reject dates like 01-01-2025 or 01/01/25
  if (/^\d{2}[-/]\d{2}[-/]\d{2,4}$/.test(str)) return 0;
  // Reject PAN-like patterns
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(str)) return 0;

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/** A valid holding name must have letters — rejects folio numbers, phone numbers, dates */
function isValidHoldingName(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  // Must contain at least 2 alphabetic characters
  const letterCount = (t.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) return false;
  if (/^\d+$/.test(t)) return false;
  if (isCASMetadata(t)) return false;
  return true;
}

/**
 * Checks if a line is CAS metadata / noise — NOT a scheme name.
 * Uses structural patterns only, no hardcoded fund/company names.
 */
function isCASMetadata(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;

  // Structural CAS metadata patterns
  const metadataPatterns = [
    // Personal / Account info
    /mobile|phone|email|address|pin\s*code|pincode/,
    /pan\s*[:]/,
    /nominee|guardian|joint.*holder/,
    /account\s*holder|investor\s*name|name\s*of/,
    // Statement structure
    /statement\s*period|valuation\s*date|generated\s*on/,
    /consolidated|page\s+\d|disclaimer/,
    /folio|isin\s*[:]/,
    // Summary / header rows
    /^date\b|^nav\b|^total\b|^sub\s*total|^grand\s*total/,
    /opening\s*balance|closing\s*balance/,
    /registrar|amc\s*[:]|brokerage/,
    // Transaction row markers
    /^\d{2}[-/]\w{3}[-/]\d{2,4}/, // Date-starting lines like "01-Jan-2025"
  ];

  return metadataPatterns.some((pattern) => pattern.test(t));
}

/**
 * Detect asset type from name using generic category keywords.
 * No hardcoded company/fund house names — only category descriptors.
 */
export function detectAssetType(name: string): AssetType {
  const lower = name.toLowerCase();

  // Mutual fund category keywords (generic)
  if (
    /\bfund\b|\bgrowth\b|\bdirect\b|\bregular\b|\belss\b|\bindex\b/.test(lower) ||
    /\bflexi\b|\bsmall\s*cap\b|\bmid\s*cap\b|\blarge\s*cap\b|\bmulti\s*cap\b/.test(lower) ||
    /\bhybrid\b|\barbitrage\b|\bliquid\b|\bdebt\b|\bovernight\b/.test(lower) ||
    /\bdividend\b|\bidcw\b|\bpayout\b|\breinvest\b/.test(lower) ||
    /\bbalanced\b|\baggressive\b|\bconservative\b|\bdynamic\b/.test(lower) ||
    /\bthematic\b|\bsectoral\b|\bvalue\b|\bcontra\b|\bfocused\b/.test(lower) ||
    /\bbluechip\b|\bflexi\s*cap\b|\bmulti\s*asset\b/.test(lower)
  ) return 'mutual_fund';

  // Stock / equity keywords
  if (/\bltd\b|\blimited\b|\bshares\b|\bequity\b|\betf\b|\bnse\b|\bbse\b/.test(lower)) return 'stocks';

  // Precious metals
  if (/\bgold\b|\bsilver\b|\bsgb\b|\bsovereign\b|\bplatinum\b/.test(lower)) return 'gold';

  // Fixed income
  if (/\bfd\b|\bfixed\s*deposit\b|\brecurring\s*deposit\b|\brd\b|\bbond\b|\bdebenture\b|\bncd\b/.test(lower)) return 'fd_rd';

  // Crypto
  if (/\bbitcoin\b|\bbtc\b|\bethereum\b|\beth\b|\bcrypto\b|\bsolana\b|\btoken\b|\bnft\b/.test(lower)) return 'crypto';

  // Retirement / provident
  if (/\bppf\b|\bepf\b|\bnps\b|\bprovident\b|\bpension\b|\bretirement\b/.test(lower)) return 'ppf_epf';

  // Real estate
  if (/\breit\b|\bland\b|\bplot\b|\bproperty\b|\bflat\b|\bapartment\b|\bhouse\b/.test(lower)) return 'real_estate';

  // Default — the UI lets users change this, so a reasonable default is fine
  return 'other';
}

// ──────────────────────────────────────────
// CAS PDF Parser — 100% Structure-Based
// ──────────────────────────────────────────

/**
 * Parses CAMS / KFintech CAS PDFs using the standard CAS structure:
 *   Folio No: XXXXX
 *   <Scheme Name Line>
 *   <Registrar: ...>
 *   <Transaction rows>
 *   Closing Unit Balance: XXX.XXX
 *   Valuation on DD-MMM-YYYY: ...
 *   Cost Value: XX,XXX.XX
 *   Market Value: XX,XXX.XX
 *
 * No fund names are hardcoded. Detection is purely structural.
 */
async function parseCASPdf(file: File): Promise<ParsedHolding[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;

  // Step 1: Collect all text items with coordinates
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

  // Step 2: Group text into lines by Y coordinate (3px tolerance)
  const lineMap = new Map<string, { text: string; x: number }[]>();
  for (const item of allItems) {
    const key = `${item.page}_${Math.round(item.y / 3) * 3}`;
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key)!.push({ text: item.text, x: item.x });
  }

  // Step 3: Sort lines top-to-bottom across pages
  const sortedLines = Array.from(lineMap.entries())
    .sort((a, b) => {
      const [pageA, yA] = a[0].split('_').map(Number);
      const [pageB, yB] = b[0].split('_').map(Number);
      if (pageA !== pageB) return pageA - pageB;
      return yB - yA; // PDF Y is bottom-up
    })
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      return items.map((i) => i.text).join('  ');
    });

  // Step 4: Parse using CAS structural markers
  const holdings: ParsedHolding[] = [];
  let idCounter = 0;
  let i = 0;

  while (i < sortedLines.length) {
    const line = sortedLines[i];
    const lineLower = line.toLowerCase().trim();

    // ── STRUCTURAL MARKER: "Folio No" line ──
    // After a folio line, the next meaningful non-metadata line is the scheme name
    if (/folio\s*(no|number)?\s*[:.]/i.test(line)) {
      let schemeName = '';

      // Look at the next few lines for the scheme name
      for (let j = i + 1; j < Math.min(sortedLines.length, i + 5); j++) {
        const candidate = sortedLines[j].replace(/\s{2,}/g, ' ').trim();
        // Skip empty, metadata, or lines that start with "Registrar" / "Advisor"
        if (!candidate || candidate.length < 5) continue;
        if (isCASMetadata(candidate)) continue;
        if (/^registrar|^advisor|^distributor/i.test(candidate)) continue;
        // Skip lines that are all numbers (folio sub-numbers, dates)
        if (/^\d[\d\s.,-]*$/.test(candidate)) continue;

        // This is the scheme name — it must contain letters
        if (isValidHoldingName(candidate)) {
          schemeName = candidate;
          break;
        }
      }

      if (schemeName) {
        // Now scan forward to find the valuation block for this scheme
        let costValue = 0;
        let marketValue = 0;
        let closingUnits = 0;
        let navValue = 0;

        // Scan up to 200 lines ahead (schemes can have many transactions)
        // Stop if we hit another "Folio" line (next scheme block starts)
        for (let k = i + 1; k < Math.min(sortedLines.length, i + 200); k++) {
          const valLine = sortedLines[k];
          const valLower = valLine.toLowerCase();

          // Stop at next folio block
          if (k > i + 3 && /folio\s*(no|number)?\s*[:.]/i.test(valLine)) break;

          // Extract "Cost Value" — the number on a line containing "cost"
          if (/cost\s*(?:value)?/i.test(valLine) && !/total/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+\.\d{2}/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) costValue = parsed[parsed.length - 1]; // last number is usually the value
            }
          }

          // Extract "Market Value" / "Current Value" / "Present Value"
          if (/(?:market|current|present|latest)\s*(?:value|val)/i.test(valLine) && !/total/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+\.\d{2}/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) marketValue = parsed[parsed.length - 1];
            }
          }

          // Extract "Valuation on DD-MMM-YYYY: XX,XXX.XX" (some CAS formats put value inline)
          if (/valuation\s*on/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+\.\d{2}/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              // If there are big numbers here and we haven't found market value yet
              if (parsed.length > 0 && marketValue === 0) {
                marketValue = parsed[parsed.length - 1];
              }
            }
          }

          // Extract "Closing Unit Balance" / "Balance Units"
          if (/(?:closing|balance)\s*(?:unit|units)/i.test(valLine) || /unit\s*balance/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+\.?\d*/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) closingUnits = parsed[parsed.length - 1];
            }
          }

          // Extract NAV value
          if (/^nav\s|nav\s*on|nav\s*[:(]/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+\.\d{2,4}/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) navValue = parsed[parsed.length - 1];
            }
          }

          // If we found both cost and market, we're done for this scheme
          if (costValue > 0 && marketValue > 0) break;
        }

        // Only add if we found at least ONE monetary value
        if (costValue > 0 || marketValue > 0) {
          holdings.push({
            id: `cas_${idCounter++}`,
            name: schemeName,
            assetType: detectAssetType(schemeName),
            investedAmount: costValue || marketValue,
            currentValue: marketValue || costValue,
            units: closingUnits > 0 ? closingUnits : undefined,
            currentPrice: navValue > 0 ? navValue : undefined,
            selected: true,
          });
        }
      }
    }

    i++;
  }

  // ── FALLBACK: If no Folio-based blocks found, try label-based extraction ──
  // This handles non-CAS PDFs (broker reports, etc.)
  if (holdings.length === 0) {
    let currentScheme = '';

    for (let li = 0; li < sortedLines.length; li++) {
      const line = sortedLines[li];
      const lineLower = line.toLowerCase();

      // Find lines that look like scheme names (have letters, reasonable length, not metadata)
      if (
        !currentScheme &&
        isValidHoldingName(line) &&
        line.length > 8 &&
        line.length < 150 &&
        !lineLower.includes('cost') &&
        !lineLower.includes('market') &&
        !lineLower.includes('value') &&
        !lineLower.includes('valuation') &&
        !/^\d/.test(line.trim()) // doesn't start with a number
      ) {
        currentScheme = line.replace(/\s{2,}/g, ' ').trim();
        continue;
      }

      // Look for cost/market value labels after a scheme name
      if (currentScheme) {
        if (lineLower.includes('cost') || lineLower.includes('market') || lineLower.includes('current') || lineLower.includes('valuation')) {
          const allNums = line.match(/[\d,]+\.\d{2}/g);
          if (allNums && allNums.length >= 1) {
            const nums = allNums.map(parseCleanNumber).filter((n) => n > 0);
            if (nums.length >= 2) {
              holdings.push({
                id: `fallback_${idCounter++}`,
                name: currentScheme,
                assetType: detectAssetType(currentScheme),
                investedAmount: nums[0],
                currentValue: nums[1],
                selected: true,
              });
              currentScheme = '';
            } else if (nums.length === 1) {
              // Only one value found — look ahead for the paired value
              let pairedValue = 0;
              for (let k = li + 1; k < Math.min(sortedLines.length, li + 5); k++) {
                const nextLower = sortedLines[k].toLowerCase();
                if (nextLower.includes('cost') || nextLower.includes('market') || nextLower.includes('current')) {
                  const nextNums = sortedLines[k].match(/[\d,]+\.\d{2}/g);
                  if (nextNums) {
                    const parsed = nextNums.map(parseCleanNumber).filter((n) => n > 0);
                    if (parsed.length > 0) { pairedValue = parsed[parsed.length - 1]; break; }
                  }
                }
              }
              holdings.push({
                id: `fallback_${idCounter++}`,
                name: currentScheme,
                assetType: detectAssetType(currentScheme),
                investedAmount: nums[0],
                currentValue: pairedValue || nums[0],
                selected: true,
              });
              currentScheme = '';
            }
          }
        }
      }
    }
  }

  // Deduplicate by name prefix
  const seen = new Set<string>();
  return holdings.filter((h) => {
    const key = h.name.toLowerCase().substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────
// Excel / CSV Raw Grid Extraction
// ──────────────────────────────────────────

export async function extractRawGrid(file: File): Promise<RawFileContent> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const lines: (string | number)[][] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items as any[];

      const rowMap = new Map<number, { text: string; x: number }[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!rowMap.has(y)) rowMap.set(y, []);
        rowMap.get(y)!.push({ text: String(item.str || ''), x: item.transform[4] });
      }

      const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
      for (const y of sortedYs) {
        const cells = rowMap.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.text.trim()).filter(Boolean);
        if (cells.length > 0 && !isCASMetadata(cells.join(' '))) {
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

// ──────────────────────────────────────────
// Excel / CSV Auto-Extraction (Header-Based)
// ──────────────────────────────────────────

export function autoExtractHoldings(raw: RawFileContent): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  for (const sheet of raw.sheets) {
    const matrix = sheet.rows;
    if (!matrix || matrix.length === 0) continue;

    // 1. Find header row — search for column names using structural patterns
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
        /scheme|instrument|symbol|stock|holding|particular|security|company|scrip|asset|description|name/i.test(c)
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

        // Compute missing values from available data
        if (invested === 0 && units && buyPrice) invested = units * buyPrice;
        if (current === 0 && units && currentPrice) current = units * currentPrice;
        if (current === 0 && invested > 0 && pnl !== undefined) current = invested + pnl;
        if (invested === 0 && current > 0 && pnl !== undefined) invested = current - pnl;
        if (invested === 0 && current > 0) invested = current;
        if (current === 0 && invested > 0) current = invested;

        // Reject absurdly large values (probably misread)
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
      // Positional Scan fallback — find rows with a name + numbers
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
// Universal Entry Point
// ──────────────────────────────────────────

export async function parseInvestmentFile(file: File): Promise<{
  holdings: ParsedHolding[];
  rawGrid: RawFileContent;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    // Use the dedicated CAS PDF parser first (structure-based)
    const casHoldings = await parseCASPdf(file);
    const rawGrid = await extractRawGrid(file);

    if (casHoldings.length > 0) {
      return { holdings: casHoldings, rawGrid };
    }

    // Fallback to raw grid auto-extract for non-CAS PDFs
    const gridHoldings = autoExtractHoldings(rawGrid);
    return { holdings: gridHoldings, rawGrid };
  }

  // Excel / CSV
  const rawGrid = await extractRawGrid(file);
  const holdings = autoExtractHoldings(rawGrid);
  return { holdings, rawGrid };
}

// ──────────────────────────────────────────
// Pasted Text Parser
// ──────────────────────────────────────────

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
