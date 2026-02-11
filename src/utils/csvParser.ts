import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
}

export interface BankAdapter {
  name: string;
  detect: (headers: string[]) => boolean;
  parse: (row: Record<string, string>) => ParsedTransaction | null;
}

// ─── Swedish number parser ──────────────────────────────────────────

function parseSEKAmount(raw: string): number {
  if (!raw) return 0;
  // Handle Swedish format: "1 234,56" or "-245,50"
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseSwedishDate(raw: string): string {
  if (!raw) return '';
  // Handles YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[./]/);
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return trimmed;
}

// ─── Bank adapters ──────────────────────────────────────────────────

const nordeaAdapter: BankAdapter = {
  name: 'Nordea',
  detect: (headers) => {
    const h = headers.map(s => s.toLowerCase().trim());
    return h.some(x => x.includes('bokföringsdag') || x.includes('bokforingsdag')) ||
           (h.includes('belopp') && h.includes('saldo'));
  },
  parse: (row) => {
    const date = parseSwedishDate(
      row['Bokföringsdag'] || row['Bokforingsdag'] || row['Datum'] || ''
    );
    const description = (
      row['Avsändare'] || row['Avsandare'] || row['Mottagare'] || row['Rubrik'] || row['Text'] || row['Namn'] || ''
    ).trim();
    const amount = parseSEKAmount(row['Belopp'] || '');
    const balance = parseSEKAmount(row['Saldo'] || '');
    if (!date || !description) return null;
    return { date, description, amount, balance: balance || undefined };
  },
};

const sebAdapter: BankAdapter = {
  name: 'SEB',
  detect: (headers) => {
    const h = headers.map(s => s.toLowerCase().trim());
    return h.includes('bokföringsdatum') || h.includes('bokforingsdatum') ||
           (h.includes('verifikationsnummer') && h.includes('belopp'));
  },
  parse: (row) => {
    const date = parseSwedishDate(
      row['Bokföringsdatum'] || row['Bokforingsdatum'] || row['Datum'] || ''
    );
    const description = (row['Text/mottagare'] || row['Text'] || row['Mottagare'] || '').trim();
    const amount = parseSEKAmount(row['Belopp'] || '');
    const balance = parseSEKAmount(row['Saldo'] || '');
    if (!date || !description) return null;
    return { date, description, amount, balance: balance || undefined };
  },
};

const handelsbankenAdapter: BankAdapter = {
  name: 'Handelsbanken',
  detect: (headers) => {
    const h = headers.map(s => s.toLowerCase().trim());
    return h.includes('transaktionsdag') || (h.includes('händelse') && h.includes('belopp'));
  },
  parse: (row) => {
    const date = parseSwedishDate(
      row['Transaktionsdag'] || row['Bokföringsdag'] || row['Datum'] || ''
    );
    const description = (row['Händelse'] || row['Text'] || '').trim();
    const amount = parseSEKAmount(row['Belopp'] || '');
    const balance = parseSEKAmount(row['Saldo'] || '');
    if (!date || !description) return null;
    return { date, description, amount, balance: balance || undefined };
  },
};

const swedbankAdapter: BankAdapter = {
  name: 'Swedbank',
  detect: (headers) => {
    const h = headers.map(s => s.toLowerCase().trim());
    return h.includes('clnr') || h.includes('kontonummer') ||
           (h.includes('transaktionsdag') && h.includes('valutadag'));
  },
  parse: (row) => {
    const date = parseSwedishDate(
      row['Transaktionsdag'] || row['Bokföringsdag'] || row['Datum'] || ''
    );
    const description = (row['Beskrivning'] || row['Text'] || '').trim();
    const amount = parseSEKAmount(row['Belopp'] || '');
    const balance = parseSEKAmount(row['Bokfört saldo'] || row['Saldo'] || '');
    if (!date || !description) return null;
    return { date, description, amount, balance: balance || undefined };
  },
};

const adapters: BankAdapter[] = [nordeaAdapter, sebAdapter, handelsbankenAdapter, swedbankAdapter];

// ─── Generic fallback ───────────────────────────────────────────────

function genericParse(row: Record<string, string>): ParsedTransaction | null {
  const keys = Object.keys(row);
  const dateKey = keys.find(k => /dat/i.test(k));
  const descKey = keys.find(k => /text|beskr|mottagare|avsändare|rubrik|namn/i.test(k));
  const amountKey = keys.find(k => /belopp|amount|summa/i.test(k));
  const balanceKey = keys.find(k => /saldo|balance/i.test(k));

  if (!dateKey || !amountKey) return null;

  const date = parseSwedishDate(row[dateKey]);
  const description = descKey ? row[descKey].trim() : 'Unknown';
  const amount = parseSEKAmount(row[amountKey]);
  const balance = balanceKey ? parseSEKAmount(row[balanceKey]) : undefined;

  if (!date) return null;
  return { date, description, amount, balance };
}

// ─── Main parse function ────────────────────────────────────────────

export interface CSVParseResult {
  transactions: ParsedTransaction[];
  bankFormat: string;
  errors: string[];
  skippedRows: number;
}

export function parseCSV(fileContent: string): CSVParseResult {
  // Try semicolon first (common in Swedish exports), then comma
  let result = Papa.parse(fileContent, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  }) as Papa.ParseResult<Record<string, string>>;

  // If only 1 column detected, try comma
  if (result.meta.fields && result.meta.fields.length <= 1) {
    result = Papa.parse(fileContent, {
      header: true,
      delimiter: ',',
      skipEmptyLines: true,
    }) as Papa.ParseResult<Record<string, string>>;
  }

  const headers = result.meta.fields || [];
  const errors: string[] = [];
  let bankFormat = 'Generic';
  let parseRow: (row: Record<string, string>) => ParsedTransaction | null = genericParse;

  // Detect bank format
  for (const adapter of adapters) {
    if (adapter.detect(headers)) {
      bankFormat = adapter.name;
      parseRow = adapter.parse;
      break;
    }
  }

  const transactions: ParsedTransaction[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    try {
      const parsed = parseRow(row);
      if (parsed && parsed.amount !== 0) {
        transactions.push(parsed);
      } else {
        skippedRows++;
      }
    } catch {
      skippedRows++;
    }
  }

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 3).map((e: any) => e.message));
  }

  return { transactions, bankFormat, errors, skippedRows };
}

// ─── Hash for duplicate detection ───────────────────────────────────

export function transactionHash(t: ParsedTransaction): string {
  return `${t.date}|${t.description}|${t.amount}`;
}
