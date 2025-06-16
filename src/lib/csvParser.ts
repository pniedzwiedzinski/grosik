import type { TransactionEntry } from '@/types/reconciliation';

export const parseCsv = (
  csvString: string,
  source: 'bank' | 'bookkeeping'
): TransactionEntry[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  // Attempt to sniff headers, or assume a fixed format
  // For simplicity, assuming: Date, Description, Amount
  // A more robust solution would allow header mapping or use a library.
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIndex = headers.findIndex(h => h.includes('date'));
  const descriptionIndex = headers.findIndex(h => h.includes('description') || h.includes('narrative') || h.includes('details'));
  const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('value'));
  const debitIndex = headers.findIndex(h => h.includes('debit'));
  const creditIndex = headers.findIndex(h => h.includes('credit'));


  if (dateIndex === -1 || descriptionIndex === -1 || (amountIndex === -1 && (debitIndex === -1 || creditIndex === -1))) {
    console.error('CSV headers not recognized. Expected columns like Date, Description, Amount or Date, Description, Debit, Credit.');
    // Fallback to fixed positions if headers are not as expected
    // This is a very basic fallback and might not be accurate
    // Date = 0, Description = 1, Amount = 2
    // return parseWithFixedPositions(lines, source);
    throw new Error('CSV headers not recognized. Ensure columns for Date, Description, and Amount (or Debit/Credit) are present.');
  }
  
  const entries: TransactionEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(','); // Basic split, doesn't handle commas in fields
    if (values.length < Math.max(dateIndex, descriptionIndex, amountIndex, debitIndex, creditIndex) + 1) continue;

    try {
      const date = values[dateIndex]?.trim() || '';
      const description = values[descriptionIndex]?.trim() || '';
      let amount: number;

      if (amountIndex !== -1) {
        amount = parseFloat(values[amountIndex]?.trim() || '0');
      } else if (debitIndex !== -1 && creditIndex !== -1) {
        const debit = parseFloat(values[debitIndex]?.trim() || '0');
        const credit = parseFloat(values[creditIndex]?.trim() || '0');
        amount = credit - debit; // Common convention: credit is positive, debit is negative
      } else {
        throw new Error('Amount columns (Amount or Debit/Credit) not found or incomplete.');
      }
      
      if (!date || isNaN(amount)) {
        console.warn(`Skipping row due to invalid data: ${lines[i]}`);
        continue;
      }

      entries.push({
        id: `${source}-${crypto.randomUUID()}`, // Client-side unique ID
        date,
        description,
        amount,
        source,
        status: 'unmatched',
        originalRowData: values.map(v => v.trim()),
      });
    } catch (error) {
      console.error(`Error parsing row: ${lines[i]}`, error);
    }
  }
  return entries;
};
