
import type { TransactionEntry } from '@/types/reconciliation';

export const parseCsv = (
  csvString: string,
  source: 'bank' | 'bookkeeping'
): TransactionEntry[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const separator = source === 'bookkeeping' ? '\t' : ',';
  // Remove quotes and convert to lowercase for robust matching
  const rawHeaders = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

  let dateIndex = -1;
  let descriptionPart1Index = -1; // 'Opis' for bookkeeping, 'Tytuł' for bank
  let descriptionPart2Index = -1; // 'Numer dokumentu' for bookkeeping
  
  let amountIndex = -1; // 'Kwota' for bank
  let incomeIndex = -1; // 'Wpływy razem' for bookkeeping
  let expenseIndex = -1; // 'Wydatki razem' for bookkeeping

  if (source === 'bookkeeping') {
    dateIndex = rawHeaders.findIndex(h => h === 'data');
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'opis');
    descriptionPart2Index = rawHeaders.findIndex(h => h === 'numer dokumentu');
    incomeIndex = rawHeaders.findIndex(h => h === 'wpływy razem');
    expenseIndex = rawHeaders.findIndex(h => h === 'wydatki razem');

    if (dateIndex === -1 || descriptionPart1Index === -1 || descriptionPart2Index === -1 || incomeIndex === -1 || expenseIndex === -1) {
      throw new Error(
        `Bookkeeping CSV headers not recognized. Expected: "Data", "Opis", "Numer dokumentu", "Wpływy razem", "Wydatki razem". Found: ${lines[0].split(separator).map(h => h.trim()).join(', ')}`
      );
    }
  } else { // source === 'bank'
    dateIndex = rawHeaders.findIndex(h => h === 'zaksięgowano'); // Corrected to lowercase
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'tytuł');
    amountIndex = rawHeaders.findIndex(h => h === 'kwota');

    if (dateIndex === -1 || descriptionPart1Index === -1 || amountIndex === -1) {
      throw new Error(
        `Bank CSV headers not recognized. Expected: "Zaksięgowano", "Tytuł", "Kwota". Found: ${lines[0].split(separator).map(h => h.trim()).join(', ')}`
      );
    }
  }
  
  const entries: TransactionEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Remove quotes from individual values
    const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));

    const maxRequiredIndex = Math.max(
      dateIndex, 
      descriptionPart1Index, 
      descriptionPart2Index, 
      amountIndex, 
      incomeIndex, 
      expenseIndex
    );
    // Ensure all necessary columns are present based on their found indices
    if (values.length <= maxRequiredIndex || 
        (source === 'bank' && (dateIndex === -1 || descriptionPart1Index === -1 || amountIndex === -1)) ||
        (source === 'bookkeeping' && (dateIndex === -1 || descriptionPart1Index === -1 || descriptionPart2Index === -1 || incomeIndex === -1 || expenseIndex === -1))) {
        // This condition is technically covered by the header check, but as a safeguard for row processing:
        // console.warn(`Skipping row with insufficient columns or headers not found: ${lines[i]}`);
        continue;
    }

    try {
      const date = values[dateIndex]?.trim() || '';
      
      let description = '';
      if (source === 'bookkeeping') {
        const opis = values[descriptionPart1Index]?.trim() || '';
        const numerDokumentu = values[descriptionPart2Index]?.trim() || '';
        description = `${opis} ${numerDokumentu}`.trim();
      } else { // bank
        description = values[descriptionPart1Index]?.trim() || '';
      }

      let amount: number;
      if (source === 'bookkeeping') {
        // Replace comma with dot for decimal, then parse
        const incomeValueStr = values[incomeIndex]?.trim().replace(',', '.') || '0';
        const expenseValueStr = values[expenseIndex]?.trim().replace(',', '.') || '0';
        const incomeValue = parseFloat(incomeValueStr);
        const expenseValue = parseFloat(expenseValueStr);
        amount = incomeValue - expenseValue; 
      } else { // bank
        const amountStr = values[amountIndex]?.trim().replace(',', '.') || '0';
        amount = parseFloat(amountStr);
      }
      
      if (!date || description === '' || isNaN(amount)) {
        // console.warn(`Skipping row due to invalid or missing critical data: Date='${date}', Desc='${description}', Amount='${amount}' from line: ${lines[i]}`);
        continue;
      }

      entries.push({
        id: `${source}-${crypto.randomUUID()}`,
        date,
        description,
        amount,
        source,
        status: 'unmatched',
        originalRowData: lines[i].split(separator).map(v => v.trim()), // Store original, non-processed values
      });
    } catch (error: any) {
      console.error(`Error parsing row: ${lines[i]}. Error: ${error.message}`);
    }
  }
  return entries;
};
