import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { AssetType } from '../types';

// PDF Worker Initialization
// In browser (Vite), loads worker from '/pdf.worker.min.mjs' (served statically from public/).
// In Node.js (test suites/scripts), falls back to the legacy worker path.
function initPdfWorker() {
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) return;

  if (typeof window !== 'undefined') {
    const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${base.replace(/\/$/, '')}/pdf.worker.min.mjs`;
  } else if (typeof process !== 'undefined' && process.cwd) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        'file:///' + process.cwd().replace(/\\/g, '/') + '/'
      ).href;
    } catch {
      // ignore
    }
  }
}

export class PasswordRequiredError extends Error {
  isPasswordRequired: boolean = true;
  isIncorrectPassword: boolean = false;

  constructor(message: string, isIncorrect: boolean = false) {
    super(message);
    this.name = 'PasswordRequiredError';
    this.isIncorrectPassword = isIncorrect;
  }
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
// Pure Utility — Number and Text Cleaning
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

/** Noise tokens that look like tickers but are metadata */
const NOISE_TOKENS = new Set([
  'PAN', 'AADHAAR', 'GSTIN', 'GST', 'TAN', 'CIN', 'NA', 'NIL', 'YES', 'NO', 'PAGE', 'TOTAL',
]);

export function isValidHoldingName(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;

  // Reject summary/valuation lines
  if (/(?:market|cost|total\s*cost|present|current|latest)\s*val(?:ue)?\s*[:：]/i.test(t)) return false;
  if (/(?:closing|opening|balance)\s*(?:unit\s*)?balance\s*[:：]/i.test(t)) return false;
  if (/^nav\s*[:：]/i.test(t)) return false;

  // Allow short all-caps tickers (TCS, ITC, INFY, HDFC, RELIANCE, etc.)
  if (/^[A-Z]{2,8}$/.test(t) && !NOISE_TOKENS.has(t.toUpperCase())) return true;
  if (t.length < 3) return false;

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
export function isCASMetadata(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;

  // Valuation summary lines are NOT scheme names
  if (/(?:market|cost|total\s*cost|current|present|latest)\s*val(?:ue)?\s*[:：]/i.test(t)) return true;
  if (/(?:closing|opening|balance)\s*(?:unit\s*)?balance\s*[:：]/i.test(t)) return true;
  if (/^valuation\s*on\b/i.test(t)) return true;

  // Structural CAS metadata patterns
  const metadataPatterns = [
    // Personal / Account info (specifically match investor/holder, not "scheme name")
    /mobile|phone|email|address|pin\s*code|pincode/,
    /pan\s*[:]/,
    /nominee|guardian|joint.*holder/,
    /account\s*holder|investor\s*name|name\s*of\s*(the\s*)?(investor|holder|client|unit\s*holder|account)/i,
    /kyc|know\s*your\s*customer/i,
    // Statement structure
    /statement\s*period|valuation\s*date|generated\s*on/,
    /consolidated|page\s+\d|disclaimer/,
    /\bfolio\s*(no|number)?\s*[:.]|\bisin\s*[:]/,
    // Summary / header rows
    /^date\b|^nav\b|^total\b|^sub\s*total|^grand\s*total/,
    /opening\s*balance|closing\s*balance/,
    /registrar|amc\s*[:]|brokerage/,
    // Transaction row markers
    /^\d{2}[-/]\w{3}[-/]\d{2,4}/,
  ];

  return metadataPatterns.some((pattern) => pattern.test(t));
}

// Strip common label prefixes before a scheme name (used by KFintech-style CAS:
// "Name of the Scheme: X", "Scheme Name: X", etc.) so the scheme itself is parsed.
export function cleanSchemeName(line: string): string {
  return line
    .replace(/^(name\s+of\s+(the\s+)?scheme|scheme\s*name|scheme|scrip\s*name|instrument|particulars?)\s*[:：]\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const LABEL_TOKENS = [
  'market value', 'current value', 'present value', 'latest value',
  'total market value', 'cost value', 'total cost value',
  'valuation on', 'closing unit balance', 'unit balance', 'balance units',
  'closing balance', 'nav',
];

function extractLabeledValue(line: string, labelRegex: RegExp): number {
  const lower = line.toLowerCase();
  const m = labelRegex.exec(line);
  if (!m) return 0;
  const start = m.index + m[0].length;
  let end = line.length;
  for (const lb of LABEL_TOKENS) {
    const li = lower.indexOf(lb, start);
    if (li !== -1 && li < end) end = li;
  }
  // Match integer or decimal numbers
  const nums = line.slice(start, end).match(/[\d,]+(?:\.\d+)?/g);
  if (!nums) return 0;
  const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
  return parsed.length > 0 ? parsed[0] : 0;
}

/**
 * Detect asset type from name using generic category descriptors.
 */
export function detectAssetType(name: string): AssetType {
  const lower = name.toLowerCase();

  // Mutual fund category keywords
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

  // All-caps short tickers (TCS, ITC, INFY, HDFCBANK, RELIANCE, etc.) -> stocks
  if (/^[A-Z]{2,8}$/.test(name.trim())) return 'stocks';

  return 'other';
}

// ──────────────────────────────────────────
// CAS PDF Parser — Structure-Based
// ──────────────────────────────────────────

async function parseCASPdf(file: File, password?: string): Promise<ParsedHolding[]> {
  initPdfWorker();
  const buffer = await file.arrayBuffer();
  let pdf: any;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      password: password || undefined,
    });
    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (
      err?.name === 'PasswordException' ||
      err?.code === 1 ||
      err?.code === 2 ||
      String(err?.message || '').toLowerCase().includes('password')
    ) {
      throw new PasswordRequiredError(
        err?.code === 2 ? 'Incorrect password for PDF.' : 'PDF is password-protected.',
        err?.code === 2
      );
    }
    throw err;
  }

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

    // ── STRUCTURAL MARKER: "Folio No" line ──
    if (/\bfolio\s*(no|number)?\s*[:.]/i.test(line)) {
      let schemeName = '';

      // Look at the next few lines for the scheme name
      for (let j = i + 1; j < Math.min(sortedLines.length, i + 8); j++) {
        let candidate = sortedLines[j].replace(/\s{2,}/g, ' ').trim();
        if (!candidate || candidate.length < 4) continue;

        // Clean label prefix BEFORE evaluating metadata/validity!
        const cleaned = cleanSchemeName(candidate);
        if (/^kyc|know\s*your\s*customer/i.test(cleaned)) continue;
        if (isCASMetadata(cleaned)) continue;
        if (/^registrar|^advisor|^distributor/i.test(cleaned)) continue;
        if (/^\d[\d\s.,-]*$/.test(cleaned)) continue;

        if (isValidHoldingName(cleaned)) {
          schemeName = cleaned;
          break;
        }
      }

      if (schemeName) {
        let costValue = 0;
        let marketValue = 0;
        let closingUnits = 0;
        let navValue = 0;

        for (let k = i + 1; k < Math.min(sortedLines.length, i + 200); k++) {
          const valLine = sortedLines[k];

          // Stop at next folio block
          if (k > i + 3 && /\bfolio\s*(no|number)?\s*[:.]/i.test(valLine)) break;

          // Extract "Cost Value" / "Total Cost Value"
          if (/(?:total\s*)?cost\s*(?:value)?/i.test(valLine) && !/^(grand\s*|sub\s*)?total\s*[:：]/i.test(valLine)) {
            const val = extractLabeledValue(valLine, /(?:total\s*)?cost\s*(?:value)?/i);
            if (val > 0) costValue = val;
          }

          // Extract "Market Value" / "Current Value" / "Present Value"
          if (/(?:market|current|present|latest)\s*(?:value|val)/i.test(valLine) && !/^(grand\s*|sub\s*)?total\s*[:：]/i.test(valLine)) {
            const val = extractLabeledValue(valLine, /(?:market|current|present|latest)\s*(?:value|val)/i);
            if (val > 0) marketValue = val;
          }

          // Extract "Valuation on DD-MMM-YYYY: XX,XXX.XX"
          if (/valuation\s*on/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+(?:\.\d+)?/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0 && marketValue === 0) {
                marketValue = parsed[parsed.length - 1];
              }
            }
          }

          // Extract "Closing Unit Balance" / "Balance Units" / "Closing Balance"
          if (/(?:closing|balance)\s*(?:unit\s*)?(?:balance|units)?/i.test(valLine) || /unit\s*balance/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+(?:\.\d+)?/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) closingUnits = parsed[parsed.length - 1];
            }
          }

          // Extract NAV value
          if (/^nav\s|nav\s*on|nav\s*[:(]/i.test(valLine)) {
            const nums = valLine.match(/[\d,]+(?:\.\d+)?/g);
            if (nums) {
              const parsed = nums.map(parseCleanNumber).filter((n) => n > 0);
              if (parsed.length > 0) navValue = parsed[parsed.length - 1];
            }
          }

          if (costValue > 0 && marketValue > 0) break;
        }

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

  // ── FALLBACK: For non-standard or broker PDFs ──
  if (holdings.length === 0) {
    let currentScheme = '';
    let costAcc = 0, mktAcc = 0;

    const flushScheme = () => {
      if (currentScheme && (costAcc > 0 || mktAcc > 0)) {
        const current = mktAcc > 0 ? mktAcc : costAcc;
        holdings.push({
          id: `fallback_${idCounter++}`,
          name: currentScheme,
          assetType: detectAssetType(currentScheme),
          investedAmount: costAcc || current,
          currentValue: current,
          selected: true,
        });
      }
      currentScheme = ''; costAcc = 0; mktAcc = 0;
    };

    for (let li = 0; li < sortedLines.length; li++) {
      const line = sortedLines[li];
      const lineLower = line.toLowerCase();

      // Don't treat valuation summary lines as schemes
      if (/(?:market|cost|total\s*cost|current|present|latest)\s*val(?:ue)?\s*[:：]/i.test(line)) {
        const c = extractLabeledValue(line, /(?:total\s*)?cost\s*(?:value)?/i);
        const m = extractLabeledValue(line, /(?:market|current|present|latest)\s*(?:value|val)/i);
        if (c > 0) costAcc = c;
        if (m > 0) mktAcc = m;
        continue;
      }

      if (!currentScheme) {
        let candidate = line.replace(/\s{2,}/g, ' ').trim();
        const cleaned = cleanSchemeName(candidate);
        if (
          cleaned.length > 5 && cleaned.length < 150 &&
          isValidHoldingName(cleaned) &&
          !cleaned.toLowerCase().includes('cost') &&
          !cleaned.toLowerCase().includes('market') &&
          !cleaned.toLowerCase().includes('value') &&
          !cleaned.toLowerCase().includes('valuation') &&
          !/^\d/.test(cleaned) &&
          !/^(dividend|sip|stp|swp|systematic|switch|redemption|purchase|sale|transaction|allotment)/i.test(cleaned)
        ) {
          currentScheme = cleaned;
          continue;
        }
      } else {
        let candidate = line.replace(/\s{2,}/g, ' ').trim();
        const cleaned = cleanSchemeName(candidate);
        if (
          isValidHoldingName(cleaned) && cleaned.length > 5 && cleaned.length < 150 && !/^\d/.test(cleaned) &&
          !lineLower.includes('cost') && !lineLower.includes('market') && !lineLower.includes('value') && !lineLower.includes('valuation') &&
          !/^(dividend|sip|stp|swp|systematic|switch|redemption|purchase|sale|transaction|allotment)/i.test(lineLower)
        ) {
          flushScheme();
          currentScheme = cleaned;
          continue;
        }

        const c = extractLabeledValue(line, /(?:total\s*)?cost\s*(?:value)?/i);
        const m = extractLabeledValue(line, /(?:market|current|present|latest)\s*(?:value|val)/i);
        if (c > 0) costAcc = c;
        if (m > 0) mktAcc = m;
        if (/\bfolio\s*(no|number)?\s*[:.]/i.test(line)) flushScheme();
      }
    }
    flushScheme();
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
// Excel / CSV / PDF Raw Grid Extraction
// ──────────────────────────────────────────

export async function extractRawGrid(file: File, password?: string): Promise<RawFileContent> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    initPdfWorker();
    const buffer = await file.arrayBuffer();
    let pdf: any;

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        password: password || undefined,
      });
      pdf = await loadingTask.promise;
    } catch (err: any) {
      if (
        err?.name === 'PasswordException' ||
        err?.code === 1 ||
        err?.code === 2 ||
        String(err?.message || '').toLowerCase().includes('password')
      ) {
        throw new PasswordRequiredError(
          err?.code === 2 ? 'Incorrect password for PDF.' : 'PDF is password-protected.',
          err?.code === 2
        );
      }
      throw err;
    }

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

  // Excel / CSV / TSV
  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', raw: false });
  } catch (e) {
    const text = new TextDecoder('utf-8').decode(buffer);
    workbook = XLSX.read(text, { type: 'string', raw: false });
  }

  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    let rawRows: any[][] = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) : [];

    // If CSV with semicolon or tab was parsed into 1 column with delimiter in text:
    if (rawRows.length > 0 && rawRows[0].length === 1 && typeof rawRows[0][0] === 'string') {
      const firstCell = rawRows[0][0];
      const delim = firstCell.includes(';') ? ';' : firstCell.includes('\t') ? '\t' : firstCell.includes('|') ? '|' : null;
      if (delim) {
        rawRows = rawRows.map((r) => (typeof r[0] === 'string' ? r[0].split(delim) : r));
      }
    }

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

      // Look for a holding / instrument / scheme name column, excluding metadata names like "client name"
      let foundNameCol = -1;
      const specificIdx = row.findIndex((c) =>
        /^(scheme\s*name|fund\s*name|stock\s*name|scrip\s*name|company\s*name|instrument|symbol|security\s*name|holding\s*name|particulars?)$/i.test(c)
      );

      if (specificIdx !== -1) {
        foundNameCol = specificIdx;
      } else {
        foundNameCol = row.findIndex((c) =>
          !/client|investor|nominee|account\s*holder|user\s*name|broker|depository|dp\s*name/i.test(c) &&
          /scheme|instrument|symbol|stock|holding|particular|security|company|scrip|asset|description|name/i.test(c)
        );
      }

      if (foundNameCol !== -1) {
        let tempInv = -1, tempCur = -1, tempQty = -1, tempBuy = -1, tempCurP = -1, tempPnl = -1;
        row.forEach((colName, cIdx) => {
          if (/qty|quantity|units|shares|volume|balance/i.test(colName) && tempQty === -1) tempQty = cIdx;
          else if (/invested|cost.*val|purchase.*val|inv.*val|total.*cost|buy.*val|principal/i.test(colName) && tempInv === -1) tempInv = cIdx;
          else if (/current|market.*val|cur.*val|present.*val|latest.*val|val.*today|valuation/i.test(colName) && tempCur === -1) tempCur = cIdx;
          else if (/buy.*price|avg.*cost|avg.*price|buy.*avg|cost.*price/i.test(colName) && tempBuy === -1) tempBuy = cIdx;
          else if (/ltp|cmp|current.*price|market.*price|nav|closing/i.test(colName) && tempCurP === -1) tempCurP = cIdx;
          else if (/p\&l|profit.*loss|unrealized/i.test(colName) && tempPnl === -1) tempPnl = cIdx;
        });

        const hasValueCol = tempInv !== -1 || tempCur !== -1 || tempQty !== -1 || tempPnl !== -1 || tempBuy !== -1 || tempCurP !== -1;
        if (!hasValueCol) {
          // It's a title row or client name label — continue searching for the real header
          continue;
        }

        headerIdx = r;
        nameCol = foundNameCol;
        invCol = tempInv;
        curCol = tempCur;
        qtyCol = tempQty;
        buyPriceCol = tempBuy;
        curPriceCol = tempCurP;
        pnlCol = tempPnl;
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

        // Reject absurdly large values
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
      // Positional Scan fallback
      const TX_MARKERS = /^(purchase|redemption|switch|sip|dividend|stp|swp|systematic|allotment|bonus|split|merger|transaction|nav|price|amount|balance|units)$/i;
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length < 2) continue;

        const stringCell = row.find((c: any) => typeof c === 'string' && isValidHoldingName(c) && !TX_MARKERS.test(c));
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

export async function parseInvestmentFile(
  file: File,
  password?: string
): Promise<{
  holdings: ParsedHolding[];
  rawGrid: RawFileContent;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    // Dedicated CAS PDF parser first (structure-based)
    const casHoldings = await parseCASPdf(file, password);
    const rawGrid = await extractRawGrid(file, password);

    if (casHoldings.length > 0) {
      return { holdings: casHoldings, rawGrid };
    }

    // Fallback to raw grid auto-extract for non-CAS PDFs
    const gridHoldings = autoExtractHoldings(rawGrid);
    return { holdings: gridHoldings, rawGrid };
  }

  // Excel / CSV / TSV
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
