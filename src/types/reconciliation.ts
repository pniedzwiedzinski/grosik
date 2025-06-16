
export interface TransactionEntry {
  id: string; 
  date: string; 
  description: string;
  amount: number;
  source: 'bank' | 'ziher';
  status: 'unmatched' | 'matched' | 'candidate'; 
  matchId?: string; 
  originalRowData: string[]; 
  matchedEntryDetails?: Partial<TransactionEntry>[]; 
}

export interface MatchGroup {
  id: string;
  type: 'auto' | 'manual';
  bankEntryIds: string[];
  ziherEntryIds: string[];
  bankSumInMatch?: number; 
  ziherSumInMatch?: number; 
  isDiscrepancy?: boolean; 
}
