
import type { TransactionEntry } from '@/types/reconciliation';

const parseCsvLineWithQuotes = (line: string, separator: string): string[] => {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
        currentField += '"';
        i++; 
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField); 
  return fields.map(field => field.trim()); 
};


export const parseCsv = (
  csvString: string,
  source: 'bank' | 'ziher'
): TransactionEntry[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const separator = source === 'ziher' ? '\t' : ',';
  
  const rawHeaders = parseCsvLineWithQuotes(lines[0], separator).map(h => h.toLowerCase().replace(/^"|"$/g, ''));


  let dateIndex = -1;
  let descriptionPart1Index = -1; 
  let descriptionPart2Index = -1; 
  
  let amountIndex = -1; 
  let incomeIndex = -1; 
  let expenseIndex = -1; 

  if (source === 'ziher') {
    dateIndex = rawHeaders.findIndex(h => h === 'data');
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'opis');
    descriptionPart2Index = rawHeaders.findIndex(h => h === 'numer dokumentu');
    incomeIndex = rawHeaders.findIndex(h => h === 'wpływy razem');
    expenseIndex = rawHeaders.findIndex(h => h === 'wydatki razem');

    if (dateIndex === -1 || descriptionPart1Index === -1 || descriptionPart2Index === -1 || incomeIndex === -1 || expenseIndex === -1) {
      throw new Error(
        `Nagłówki CSV Ziher nierozpoznane. Oczekiwano: "Data", "Opis", "Numer dokumentu", "Wpływy razem", "Wydatki razem". Znalezione nagłówki (małe litery): ${rawHeaders.join(', ')}`
      );
    }
  } else { 
    dateIndex = rawHeaders.findIndex(h => h === 'zaksięgowano');
    descriptionPart1Index = rawHeaders.findIndex(h => h === 'tytuł');
    amountIndex = rawHeaders.findIndex(h => h === 'kwota');

    if (dateIndex === -1 || descriptionPart1Index === -1 || amountIndex === -1) {
      throw new Error(
        `Nagłówki CSV Banku nierozpoznane. Oczekiwano: "Zaksięgowano", "Tytuł", "Kwota". Znalezione nagłówki (małe litery): ${rawHeaders.join(', ')}`
      );
    }
  }
  
  const entries: TransactionEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; 

    const values = parseCsvLineWithQuotes(lines[i], separator);

    const maxRequiredIndex = Math.max(
      dateIndex, 
      descriptionPart1Index, 
      descriptionPart2Index > -1 ? descriptionPart2Index : 0, 
      amountIndex > -1 ? amountIndex : 0, 
      incomeIndex > -1 ? incomeIndex : 0, 
      expenseIndex > -1 ? expenseIndex : 0 
    );
    
    if (values.length <= maxRequiredIndex) {
        continue;
    }

    try {
      let parsedDate: string | undefined = undefined;
      const rawDateValue = values[dateIndex]?.trim();

      if (rawDateValue) {
        if (source === 'bank') {
          const parts = rawDateValue.split('.');
          if (parts.length === 3) {
            const day = parts[0];
            const month = parts[1];
            const year = parts[2];
            if (day.length === 2 && month.length === 2 && year.length === 4 && 
                !isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
              parsedDate = `${year}-${month}-${day}`;
            }
          }
        } else { // source === 'ziher'
          // Attempt 1: YYYY-M-D or YYYY-MM-DD
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDateValue)) {
            const dateParts = rawDateValue.split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10);
              const day = parseInt(dateParts[2], 10);

              if (year > 1900 && year < 3000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                parsedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            }
          }
          
          // Attempt 2: DD.MM.YYYY (if Attempt 1 failed)
          if (!parsedDate) {
            const parts = rawDateValue.split('.');
            if (parts.length === 3) {
              const day = parts[0];
              const month = parts[1];
              const year = parts[2];
              if (day.length <= 2 && month.length <= 2 && year.length === 4 &&
                  !isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
                const parsedYear = parseInt(year, 10);
                const parsedMonth = parseInt(month, 10);
                const parsedDay = parseInt(day, 10);

                if (parsedYear > 1900 && parsedYear < 3000 && parsedMonth >= 1 && parsedMonth <= 12 && parsedDay >= 1 && parsedDay <= 31) {
                   parsedDate = `${parsedYear}-${parsedMonth.toString().padStart(2, '0')}-${parsedDay.toString().padStart(2, '0')}`;
                }
              }
            }
          }
        }
      }
      
      if (!parsedDate) { // If date couldn't be parsed from any format
        continue;
      }
      
      let description = '';
      if (source === 'ziher') {
        const opis = values[descriptionPart1Index]?.trim() || '';
        const numerDokumentu = values[descriptionPart2Index]?.trim() || '';
        description = `${opis} ${numerDokumentu}`.trim();
      } else { 
        description = values[descriptionPart1Index]?.trim() || '';
      }

      let amount: number;
      if (source === 'ziher') {
        let rawIncomeField = values[incomeIndex];
        let processedIncomeStr = '0';
        if (typeof rawIncomeField === 'string' && rawIncomeField.trim() !== '') {
            processedIncomeStr = rawIncomeField.trim().replace(/\s/g, '').replace(',', '.');
        } else if (typeof rawIncomeField === 'number') { 
            processedIncomeStr = rawIncomeField.toString().replace(',', '.');
        }
        const incomeValue = parseFloat(processedIncomeStr);

        let rawExpenseField = values[expenseIndex];
        let processedExpenseStr = '0';
        if (typeof rawExpenseField === 'string' && rawExpenseField.trim() !== '') {
            processedExpenseStr = rawExpenseField.trim().replace(/\s/g, '').replace(',', '.');
        } else if (typeof rawExpenseField === 'number') {
            processedExpenseStr = rawExpenseField.toString().replace(',', '.');
        }
        const expenseValue = parseFloat(processedExpenseStr);
        amount = incomeValue - expenseValue; 
      } else { 
        let rawAmountField = values[amountIndex];
        let processedAmountStr = '0'; 
        if (typeof rawAmountField === 'string' && rawAmountField.trim() !== '') {
            processedAmountStr = rawAmountField.trim().replace(/\s/g, '').replace(',', '.');
        } else if (typeof rawAmountField === 'number') {
             processedAmountStr = rawAmountField.toString().replace(',', '.');
        }
        amount = parseFloat(processedAmountStr);
      }
      
      if (description === '' || isNaN(amount)) { // Date check already happened
        continue;
      }

      entries.push({
        id: `${source}-${crypto.randomUUID()}`,
        date: parsedDate,
        description,
        amount,
        source,
        status: 'unmatched',
        originalRowData: parseCsvLineWithQuotes(lines[i], separator), 
        matchedEntryDetails: [],
      });
    } catch (error: any) {
      // console.error(`Error parsing row: ${lines[i]}. Error: ${error.message}`);
    }
  }
  return entries;
};

