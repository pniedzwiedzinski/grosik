
import type { TransactionEntry } from '@/types/reconciliation';

// Helper function to parse a single CSV line, respecting quotes
const parseCsvLineWithQuotes = (line: string, separator: string): string[] => {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes: "" inside a quoted field becomes "
      if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
        currentField += '"';
        i++; // Skip the second quote of the pair
        continue;
      }
      inQuotes = !inQuotes;
      // Do not add the quote character itself to the field if it's a delimiter quote
    } else if (char === separator && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField); // Add the last field
  return fields.map(field => field.trim()); // Trim fields after parsing
};


export const parseCsv = (
  csvString: string,
  source: 'bank' | 'bookkeeping'
): TransactionEntry[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const separator = source === 'bookkeeping' ? '\t' : ',';
  
  // Parse headers using the robust line parser
  const rawHeaders = parseCsvLineWithQuotes(lines[0], separator).map(h => h.toLowerCase());

  let dateIndex = -1;
  let descriptionPart1Index = -1; 
  let descriptionPart2Index = -1; 
  
  let amountIndex = -1; 
  let incomeIndex = -1; 
  let expenseIndex = -1; 

  if (source === 'bookkeeping') {
    dateIndex = rawHeaders.findIndex(h => h === 'data');
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'opis');
    descriptionPart2Index = rawHeaders.findIndex(h => h === 'numer dokumentu');
    incomeIndex = rawHeaders.findIndex(h => h === 'wpływy razem');
    expenseIndex = rawHeaders.findIndex(h => h === 'wydatki razem');

    if (dateIndex === -1 || descriptionPart1Index === -1 || descriptionPart2Index === -1 || incomeIndex === -1 || expenseIndex === -1) {
      throw new Error(
        `Bookkeeping CSV headers not recognized. Expected: "Data", "Opis", "Numer dokumentu", "Wpływy razem", "Wydatki razem". Found headers (lowercase): ${rawHeaders.join(', ')}`
      );
    }
  } else { // source === 'bank'
    dateIndex = rawHeaders.findIndex(h => h === 'zaksięgowano');
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'tytuł');
    amountIndex = rawHeaders.findIndex(h => h === 'kwota');

    if (dateIndex === -1 || descriptionPart1Index === -1 || amountIndex === -1) {
      throw new Error(
        `Bank CSV headers not recognized. Expected: "Zaksięgowano", "Tytuł", "Kwota". Found headers (lowercase): ${rawHeaders.join(', ')}`
      );
    }
  }
  
  const entries: TransactionEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; 

    // Parse data rows using the robust line parser
    const values = parseCsvLineWithQuotes(lines[i], separator);

    const maxRequiredIndex = Math.max(
      dateIndex, 
      descriptionPart1Index, 
      descriptionPart2Index, 
      amountIndex, 
      incomeIndex, 
      expenseIndex
    );
    
    if (values.length <= maxRequiredIndex) {
        // console.warn(`Skipping row with insufficient columns: ${lines[i]}. Expected at least ${maxRequiredIndex + 1} columns, got ${values.length}. Headers: ${rawHeaders.join(',')}`);
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
        // Bookkeeping uses dot as decimal separator, or sometimes no decimal part
        const incomeValueStr = values[incomeIndex]?.trim().replace(',', '.') || '0'; 
        const expenseValueStr = values[expenseIndex]?.trim().replace(',', '.') || '0';
        const incomeValue = parseFloat(incomeValueStr);
        const expenseValue = parseFloat(expenseValueStr);
        amount = incomeValue - expenseValue; 
      } else { // bank
        // Bank uses comma as decimal separator
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
        originalRowData: parseCsvLineWithQuotes(lines[i], separator), // Store raw parsed values
        matchedEntryDetails: [],
      });
    } catch (error: any) {
      // console.error(`Error parsing row: ${lines[i]}. Error: ${error.message}`);
    }
  }
  return entries;
};
